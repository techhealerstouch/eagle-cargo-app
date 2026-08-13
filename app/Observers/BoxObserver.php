<?php

namespace App\Observers;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Models\Box;
use App\Notifications\BoxStatusChanged;
use App\Services\BatchService;
use App\Services\ReferenceDataService;
use App\Services\TrackingCacheService;

class BoxObserver
{
    /**
     * Handle the Box "saving" event.
     */
    public function saving(Box $box): void
    {
        if (! empty($box->recipient_id) && ($box->isDirty('recipient_id') || empty($box->destination) || empty($box->recipient_snapshot))) {
            $snapshotPayload = Box::buildSnapshotPayload($box);

            if (! empty($snapshotPayload['destination'])) {
                $box->destination = $snapshotPayload['destination'];
            }

            $box->recipient_snapshot = $snapshotPayload['recipient_snapshot'];
            $box->recipient_version_id = $snapshotPayload['recipient_version_id'];
            $box->snapshot_taken_at = $snapshotPayload['snapshot_taken_at'];
        }

        if (($box->isDirty('price_charged') || empty($box->price_snapshot)) && $box->price_charged !== null) {
            $box->price_snapshot = $box->price_charged;

            if (empty($box->snapshot_taken_at)) {
                $box->snapshot_taken_at = now();
            }
        }

        // Auto-populate price_charged if not specifically set (Item #45)
        if (($box->price_charged === null || (float) $box->price_charged === 0.0) && ! empty($box->box_type_id) && (! empty($box->recipient_id) || ! empty($box->area_id))) {
            $areaId = $box->recipient?->area_id ?? $box->area_id;
            if ($areaId) {
                $pickupZoneId = $box->booking?->pickup_zone_id;
                $priceConfig = app(ReferenceDataService::class)->priceFor($areaId, $box->box_type_id, $pickupZoneId);

                if ($priceConfig) {
                    $doorToDoorFee = $box->is_door_to_door ? app(ReferenceDataService::class)->doorToDoorFeeFor($areaId) : 0.0;
                    $box->price_charged    = (float) $priceConfig->price + $doorToDoorFee;
                    $box->price_snapshot   = $box->price_charged;
                    $box->price_is_estimate = false;
                }
            }
        }

        // Auto-populate price_charged for custom-size boxes via CBM × area rate
        if (($box->price_charged === null || (float) $box->price_charged === 0.0) && $box->is_custom_size
            && $box->custom_length && $box->custom_width && $box->custom_height
            && (! empty($box->recipient_id) || ! empty($box->area_id))) {
            $areaId = $box->recipient?->area_id ?? $box->area_id;
            if ($areaId) {
                $pickupZoneId = $box->booking?->pickup_zone_id;
                $cbmRate = app(ReferenceDataService::class)->cbmRateFor($areaId, $pickupZoneId);
                if ($cbmRate && $cbmRate > 0) {
                    $cbm = ((float) $box->custom_length * (float) $box->custom_width * (float) $box->custom_height) / 1_000_000;
                    $doorToDoorFee = $box->is_door_to_door ? app(ReferenceDataService::class)->doorToDoorFeeFor($areaId) : 0.0;
                    $box->price_charged    = round($cbm * $cbmRate, 2) + $doorToDoorFee;
                    $box->price_snapshot   = $box->price_charged;
                    $box->price_is_estimate = true;
                }
            }
        }
    }

    /**
     * Handle the Box "creating" event.
     */
    public function creating(Box $box): void
    {
        if (empty($box->tracking_number)) {
            $booking = $box->booking()->withTrashed()->first();
            $referenceNumber = (string) ($booking?->reference_number ?? '');

            $year = $booking?->created_at?->format('Y') ?? now()->format('Y');
            if (preg_match('/^BK-(\d{4})-/', $referenceNumber, $matches) === 1) {
                $year = $matches[1];
            }

            $referenceSuffix = str_pad((string) (($booking?->id ?? $box->booking_id ?? 0) % 1000), 3, '0', STR_PAD_LEFT);
            if (preg_match('/(\d{3})$/', $referenceNumber, $matches) === 1) {
                $referenceSuffix = $matches[1];
            }

            $batchNumber = Box::withTrashed()
                ->where('booking_id', $box->booking_id)
                ->count() + 1;

            $box->tracking_number = sprintf('TRK-%s-%03d-%s', $year, $batchNumber, $referenceSuffix);

            while (Box::withTrashed()->where('tracking_number', $box->tracking_number)->exists()) {
                $batchNumber++;
                $box->tracking_number = sprintf('TRK-%s-%03d-%s', $year, $batchNumber, $referenceSuffix);
            }
        }
    }

    /**
     * Handle the Box "updating" event.
     */
    public function updating(Box $box): void {}

    /**
     * Handle the Box "updated" event.
     */
    public function updated(Box $box): void
    {
        app(TrackingCacheService::class)->forgetBox($box);

        if ($box->wasChanged('status')) {
            // Notify sender (via User if linked, otherwise directly to Sender)
            $sender = $box->booking?->sender;
            if ($sender) {
                $notifiable = $sender->user ?? $sender;
                $notifiable->notify(new BoxStatusChanged($box));
            }

            // Rollup status to Booking (skip Draft — still being edited by sender)
            $booking = $box->booking;
            if ($booking && ! in_array($booking->status, [BookingStatus::Draft, BookingStatus::Cancelled])) {
                \Illuminate\Support\Facades\DB::transaction(function () use ($booking) {
                    $lockedBooking = \App\Models\Booking::whereKey($booking->id)->lockForUpdate()->first();
                    if (! $lockedBooking) {
                        return;
                    }

                    // Normalize to raw string values — pluck() may return enum instances when the model has casts.
                    $boxes = $lockedBooking->boxes()->pluck('status')->map(function ($s) {
                        return $s instanceof BoxStatus ? $s->value : (string) $s;
                    })->toArray();

                    if (! empty($boxes)) {
                        $totalBoxes = count($boxes);
                        $deliveredCount = count(array_filter($boxes, fn ($s) => $s === BoxStatus::Delivered->value));
                        $shippedCount = count(array_filter($boxes, fn ($s) => in_array($s, [BoxStatus::InTransit->value, BoxStatus::Delivered->value, BoxStatus::Arrived->value])));
                        $collectedCount = count(array_filter($boxes, fn ($s) => in_array($s, [BoxStatus::Collected->value, BoxStatus::InTransit->value, BoxStatus::Delivered->value, BoxStatus::Arrived->value])));

                        $allDelivered = $deliveredCount === $totalBoxes;
                        $someDelivered = $deliveredCount > 0 && $deliveredCount < $totalBoxes;

                        $allShipped = $shippedCount === $totalBoxes;
                        $allCollected = $collectedCount === $totalBoxes;

                        if ($allDelivered && $lockedBooking->status !== BookingStatus::Delivered) {
                            $lockedBooking->bypassStatusValidation = true;
                            $lockedBooking->update(['status' => BookingStatus::Delivered]);
                        } elseif ($someDelivered && ! in_array($lockedBooking->status, [BookingStatus::Delivered, BookingStatus::PartiallyDelivered])) {
                            $lockedBooking->bypassStatusValidation = true;
                            $lockedBooking->update(['status' => BookingStatus::PartiallyDelivered]);
                        } elseif ($allShipped && ! in_array($lockedBooking->status, [BookingStatus::Delivered, BookingStatus::PartiallyDelivered, BookingStatus::Shipped])) {
                            $lockedBooking->bypassStatusValidation = true;
                            $lockedBooking->update(['status' => BookingStatus::Shipped]);
                        } elseif ($allCollected && ! in_array($lockedBooking->status, [BookingStatus::Delivered, BookingStatus::PartiallyDelivered, BookingStatus::Shipped, BookingStatus::Collected])) {
                            $lockedBooking->bypassStatusValidation = true;
                            $lockedBooking->update(['status' => BookingStatus::Collected]);
                        }
                    }
                });
            }

            // Sync related runsheets automatically when status changes
            // This ensures Pickup/Delivery runsheets close when boxes reach terminal states
            app(\App\Services\RunsheetService::class)->syncRelatedRunsheets($box);

            // Handle Commission updates automatically if box is cancelled, held, or damaged
            if (in_array($box->status, [BoxStatus::Cancelled, BoxStatus::Held, BoxStatus::Damaged])) {
                app(\App\Services\CommissionService::class)->cancelCommission($box);
            }
        }

        if ($this->requiresBatchRefresh($box)) {
            $this->refreshAffectedBatches($box);
        }
    }

    public function created(Box $box): void
    {
        $statusValue = $box->status instanceof BoxStatus ? $box->status->value : (string) $box->status;

        $phase = match ($statusValue) {
            'collected' => \App\Enums\TrackingPhase::PICKED_UP->value,
            'received_by_branch' => \App\Enums\TrackingPhase::RECEIVED_BY_WAREHOUSE->value,
            'loaded_to_container' => \App\Enums\TrackingPhase::LOADING_CONTAINER->value,
            'in_transit' => \App\Enums\TrackingPhase::IN_TRANSIT_SEA->value,
            'arrived' => \App\Enums\TrackingPhase::ARRIVED_MANILA_PORT->value,
            'out_for_delivery' => \App\Enums\TrackingPhase::OUT_FOR_DELIVERY->value,
            'delivered' => \App\Enums\TrackingPhase::DELIVERED->value,
            default => null,
        };

        \App\Models\BoxUpdate::create([
            'box_id' => $box->id,
            'status' => $statusValue,
            'description' => 'Booking created and box registered.',
            'location' => 'System',
            'tracking_phase' => $phase,
            'updated_by' => auth()->id(),
        ]);

        app(TrackingCacheService::class)->forgetBox($box);
        $this->refreshBatchById((int) $box->batch_id);
    }

    /**
     * Handle the Box "deleted" event.
     */
    public function deleted(Box $box): void
    {
        app(TrackingCacheService::class)->forgetBox($box);
        $this->refreshBatchById((int) $box->getOriginal('batch_id'));
    }

    /**
     * Handle the Box "restored" event.
     */
    public function restored(Box $box): void
    {
        app(TrackingCacheService::class)->forgetBox($box);
        $this->refreshBatchById((int) $box->batch_id);
    }

    /**
     * Handle the Box "force deleted" event.
     */
    public function forceDeleted(Box $box): void
    {
        app(TrackingCacheService::class)->forgetBox($box);
        $this->refreshBatchById((int) $box->getOriginal('batch_id'));
    }

    private function requiresBatchRefresh(Box $box): bool
    {
        if ($box->wasChanged('batch_id') || $box->wasChanged('weight') || $box->wasChanged('box_type_id')) {
            return true;
        }

        if (! $box->wasChanged('status')) {
            return false;
        }

        $oldStatusValue = $box->getOriginal('status');
        if ($oldStatusValue instanceof BoxStatus) {
            $oldStatusValue = $oldStatusValue->value;
        }

        $newStatusValue = $box->status;
        if ($newStatusValue instanceof BoxStatus) {
            $newStatusValue = $newStatusValue->value;
        }

        $oldStatus = (string) $oldStatusValue;
        $newStatus = (string) $newStatusValue;

        return $oldStatus === BoxStatus::Cancelled->value || $newStatus === BoxStatus::Cancelled->value;
    }

    private function refreshAffectedBatches(Box $box): void
    {
        $batchIds = collect([
            (int) $box->getOriginal('batch_id'),
            (int) $box->batch_id,
        ])->filter(fn (int $id) => $id > 0)->unique();

        if ($batchIds->isEmpty()) {
            return;
        }

        $batchService = app(BatchService::class);
        $batchIds->each(fn (int $batchId) => $batchService->refreshAndEvaluateById($batchId));
    }

    private function refreshBatchById(int $batchId): void
    {
        if ($batchId <= 0) {
            return;
        }

        app(BatchService::class)->refreshAndEvaluateById($batchId);
    }
}
