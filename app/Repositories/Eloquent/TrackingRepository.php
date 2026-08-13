<?php

namespace App\Repositories\Eloquent;

use App\Models\Booking;
use App\Models\Box;
use App\Repositories\Contracts\TrackingRepositoryInterface;
use App\Services\TrackingCacheService;
use Illuminate\Http\UploadedFile;

class TrackingRepository implements TrackingRepositoryInterface
{
    public function __construct(
        private readonly TrackingCacheService $trackingCache,
    ) {}

    public function getTrackingData(string $trackingNumber): ?array
    {
        return $this->trackingCache->rememberPage(
            $trackingNumber,
            fn () => $this->resolveTrackingData($trackingNumber),
        );
    }

    private function resolveTrackingData(string $trackingNumber): ?array
    {
        $boxWithRelations = [
            'updates' => function ($q) {
                $q->orderBy('created_at', 'desc');
            },
            'batch',
            'boxType',
            'recipient.area.milestones' => function ($q) {
                $q->orderBy('sequence_order', 'asc');
            },
        ];

        // 1. Try finding by Box tracking_number first
        $box = Box::with(array_merge($boxWithRelations, [
            'booking.boxes.updates' => function ($q) {
                $q->orderBy('created_at', 'desc');
            },
            'booking.boxes.batch',
            'booking.boxes.boxType',
            'booking.boxes.recipient.area.milestones' => function ($q) {
                $q->orderBy('sequence_order', 'asc');
            },
        ]))
            ->where('tracking_number', $trackingNumber)
            ->first();

        if ($box && $box->booking) {
            return $this->formatTrackingResponse($box, $box->booking, false);
        }

        // 2. Check if it's a booking reference number instead of Box tracking number
        $booking = Booking::with([
            'boxes.updates' => function ($q) {
                $q->orderBy('created_at', 'desc');
            },
            'boxes.batch',
            'boxes.boxType',
            'boxes.recipient.area.milestones' => function ($q) {
                $q->orderBy('sequence_order', 'asc');
            },
        ])->where('reference_number', $trackingNumber)->first();

        if ($booking && $booking->boxes && $booking->boxes->count() > 0) {
            $box = $booking->boxes->first();
            return $this->formatTrackingResponse($box, $booking, true);
        }

        return null;
    }

    private function formatSingleBoxData(Box $b): array
    {
        return [
            'id' => $b->id,
            'tracking_number' => $b->tracking_number,
            'status' => $b->status,
            'status_label' => $this->resolveStatusLabel($b->updates->first(), $b->status),
            'current_milestone_id' => $b->updates->whereNotNull('area_milestone_id')->first()?->area_milestone_id,
            'area_milestones' => $b->recipient?->area?->milestones->map(function ($m) {
                return [
                    'id' => $m->id,
                    'name' => $m->name,
                    'description' => $m->description,
                    'is_final' => $m->is_final_delivery,
                ];
            })->toArray(),
            'destination' => $this->resolveBoxDestination($b),
            'area' => $b->recipient?->area ? [
                'id' => $b->recipient->area->id,
                'name' => $b->recipient->area->name,
            ] : null,
            'recipient_name' => $b->recipient?->name,
            'box_type' => $b->boxType ? ['name' => $b->boxType->name] : null,
            'eta_date' => $b->eta_date,
            'eta_message' => $b->eta_message,
            'estimate_delivery_date' => $b->estimate_delivery_date,
            'estimate_delivery_message' => $b->estimate_delivery_message,
            'batch' => $b->batch ? [
                'batch_number' => $b->batch->batch_number,
                'status' => $b->batch->status,
                'container_number' => $b->batch->container_number,
                'vessel_name' => $b->batch->vessel_name,
                'voyage_number' => $b->batch->voyage_number,
                'shipping_line' => $b->batch->shipping_line,
                'origin_port' => $b->batch->origin_port,
                'destination_port' => $b->batch->destination_port,
                'branch_code' => $b->batch->branch_name,
                'eta_at' => $b->batch->eta_at,
            ] : null,
            'timeline' => $b->updates ? $b->updates->map(function ($update) {
                return [
                    'status' => $update->status,
                    'status_label' => $this->resolveStatusLabel($update, $update->status),
                    'tracking_phase' => $update->tracking_phase?->value,
                    'location' => $update->location,
                    'description' => $update->description,
                    'date' => $update->created_at->format('M d, Y h:i A'),
                    'raw_date' => $update->created_at,
                ];
            })->toArray() : [],
        ];
    }

    private function formatTrackingResponse(Box $primaryBox, Booking $booking, bool $isBookingSearch): array
    {
        $allBoxes = $booking->boxes->map(fn (Box $b) => $this->formatSingleBoxData($b))->toArray();

        $area = $primaryBox->recipient?->area;
        if (! $area) {
            foreach ($booking->boxes as $box) {
                if ($box->recipient?->area) {
                    $area = $box->recipient->area;
                    break;
                }
            }
        }

        return [
            'booking_id' => $booking->id,
            'booking_reference' => $booking->reference_number,
            'tracking_number' => $primaryBox->tracking_number,
            'recipient_name' => $primaryBox->recipient?->name,
            'status' => $primaryBox->status,
            'status_label' => $this->resolveStatusLabel($primaryBox->updates->first(), $primaryBox->status),
            'current_milestone_id' => $primaryBox->updates->whereNotNull('area_milestone_id')->first()?->area_milestone_id,
            'area_milestones' => $primaryBox->recipient?->area?->milestones->map(function ($m) {
                return [
                    'id' => $m->id,
                    'name' => $m->name,
                    'description' => $m->description,
                    'is_final' => $m->is_final_delivery,
                ];
            })->toArray(),
            'destination' => $this->resolveBoxDestination($primaryBox),
            'area' => $area ? [
                'id' => $area->id,
                'name' => $area->name,
            ] : null,
            'box_type' => $primaryBox->boxType ? ['name' => $primaryBox->boxType->name] : null,
            'shipped_at' => $booking->shipped_at,
            'payment_status' => $booking->payment_status,
            'declaration_form_status' => $booking->declaration_form_status,
            'eta_date' => $primaryBox->eta_date,
            'eta_message' => $primaryBox->eta_message,
            'estimate_delivery_date' => $primaryBox->estimate_delivery_date,
            'estimate_delivery_message' => $primaryBox->estimate_delivery_message,
            'batch' => $primaryBox->batch ? [
                'batch_number' => $primaryBox->batch->batch_number,
                'status' => $primaryBox->batch->status,
                'container_number' => $primaryBox->batch->container_number,
                'vessel_name' => $primaryBox->batch->vessel_name,
                'voyage_number' => $primaryBox->batch->voyage_number,
                'shipping_line' => $primaryBox->batch->shipping_line,
                'origin_port' => $primaryBox->batch->origin_port,
                'destination_port' => $primaryBox->batch->destination_port,
                'branch_code' => $primaryBox->batch->branch_name,
                'eta_at' => $primaryBox->batch->eta_at,
            ] : null,
            'timeline' => $primaryBox->updates ? $primaryBox->updates->map(function ($update) {
                return [
                    'status' => $update->status,
                    'status_label' => $this->resolveStatusLabel($update, $update->status),
                    'tracking_phase' => $update->tracking_phase?->value,
                    'location' => $update->location,
                    'description' => $update->description,
                    'date' => $update->created_at->format('M d, Y h:i A'),
                    'raw_date' => $update->created_at,
                ];
            })->toArray() : [],
            'is_multi_box' => $booking->boxes->count() > 1,
            'is_booking_search' => $isBookingSearch,
            'total_boxes_count' => $booking->boxes->count(),
            'all_boxes' => $allBoxes,
        ];
    }

    private function resolveStatusLabel(?\App\Models\BoxUpdate $update, mixed $boxStatus): ?string
    {
        if ($update?->tracking_phase) {
            return $update->tracking_phase->label();
        }

        if (! $boxStatus) {
            return null;
        }

        $enum = $boxStatus instanceof \App\Enums\BoxStatus
            ? $boxStatus
            : \App\Enums\BoxStatus::tryFrom((string) $boxStatus);

        return $enum ? $enum->label() : ucwords(str_replace('_', ' ', (string) $boxStatus));
    }

    private function resolveBoxDestination(Box $box): string
    {
        if (! empty($box->destination)) {
            return (string) $box->destination;
        }

        if ($box->recipient) {
            return collect([$box->recipient->city, $box->recipient->province])->filter()->implode(', ');
        }

        return 'N/A';
    }

    private function resolveBookingDestination(Booking $booking): string
    {
        $box = $booking->boxes->first();
        if (! $box) {
            return 'N/A';
        }

        return $this->resolveBoxDestination($box);
    }

    public function uploadDeclaration(int $bookingId, UploadedFile $file, string $status = 'submitted_online'): bool
    {
        $booking = Booking::findOrFail($bookingId);

        // Check if google drive disk is configured (just checking fallback to local if needed)
        $disk = config('filesystems.disks.google.clientId') ? 'google' : 'local';

        $path = $file->store('declarations/'.$booking->reference_number, $disk);

        $updated = $booking->update([
            'declaration_form_status' => $status,
            'declaration_form_path' => $path,
        ]);

        if ($updated) {
            $this->trackingCache->forgetBooking($booking);
        }

        return $updated;
    }

    public function saveDeclarationData(int $bookingId, array $data): bool
    {
        $booking = Booking::findOrFail($bookingId);

        $updateData = [
            'declaration_form_status' => 'submitted_online',
            'declaration_data' => $data,
        ];

        // If the booking is in Pending status and declaration is now submitted,
        // we can optionally auto-confirm it (or leave it for admin review)
        // For now, we'll leave it in Pending status for admin to review and confirm
        // If you want auto-confirmation, uncomment the following:
        // if ($booking->status === \App\Enums\BookingStatus::Pending) {
        //     $updateData['status'] = \App\Enums\BookingStatus::Confirmed;
        //     $updateData['confirmed_at'] = now();
        // }

        $updated = $booking->update($updateData);

        if ($updated) {
            $this->trackingCache->forgetBooking($booking);
        }

        return $updated;
    }
}
