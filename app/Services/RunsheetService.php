<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Enums\TrackingPhase;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\Runsheet;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RunsheetService
{
    public function attachBookings(Runsheet $runsheet, array $bookingIds, ?string $startingSerialNumber = null): void
    {
        DB::transaction(function () use ($runsheet, $bookingIds, $startingSerialNumber): void {
            $lockedRunsheet = Runsheet::query()
                ->whereKey($runsheet->id)
                ->lockForUpdate()
                ->firstOrFail();

            foreach ($bookingIds as $bookingId) {
                $booking = Booking::findOrFail($bookingId);
                $this->attachBooking($lockedRunsheet, $booking, $startingSerialNumber);
            }

            $this->ensureStopSequence($lockedRunsheet);
        });
    }

    public function syncBookings(Runsheet $runsheet, array $bookingIds, ?array $stopSequence = null): void
    {
        DB::transaction(function () use ($runsheet, $bookingIds, $stopSequence): void {
            $lockedRunsheet = Runsheet::query()
                ->whereKey($runsheet->id)
                ->lockForUpdate()
                ->firstOrFail();

            $desiredIds = collect($bookingIds)
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();

            $runsheetStatus = $lockedRunsheet->status;
            if (! $runsheetStatus instanceof RunsheetStatus) {
                $runsheetStatus = RunsheetStatus::from((string) $runsheetStatus);
            }

            if (
                $desiredIds->isEmpty()
                && in_array($runsheetStatus, [RunsheetStatus::Assigned, RunsheetStatus::InProgress], true)
            ) {
                throw new \InvalidArgumentException('At least one booking is required when runsheet status is assigned or in progress.');
            }

            $currentIds = $lockedRunsheet->bookings()->pluck('bookings.id');

            $idsToDetach = $currentIds->diff($desiredIds);
            if ($idsToDetach->isNotEmpty()) {
                $lockedRunsheet->bookings()->detach($idsToDetach->all());
            }

            $idsToAttach = $desiredIds->diff($currentIds);
            foreach ($idsToAttach as $bookingId) {
                $booking = Booking::findOrFail($bookingId);
                $this->attachBooking($lockedRunsheet, $booking);
            }

            if ($stopSequence !== null) {
                $this->reorderBookings($lockedRunsheet, $stopSequence);
            } else {
                $this->ensureStopSequence($lockedRunsheet);
            }
        });
    }

    public function reorderBookings(Runsheet $runsheet, array $bookingIds): void
    {
        DB::transaction(function () use ($runsheet, $bookingIds): void {
            $lockedRunsheet = Runsheet::query()
                ->whereKey($runsheet->id)
                ->lockForUpdate()
                ->firstOrFail();

            $orderedIds = collect($bookingIds)
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();

            $currentIds = $lockedRunsheet->bookings()
                ->pluck('bookings.id')
                ->map(fn ($id) => (int) $id)
                ->sort()
                ->values();

            if ($orderedIds->sort()->values()->all() !== $currentIds->all()) {
                throw new \InvalidArgumentException('Stop order must include every booking currently assigned to this runsheet.');
            }

            foreach ($orderedIds as $index => $bookingId) {
                $lockedRunsheet->bookings()->updateExistingPivot($bookingId, [
                    'sequence' => $index + 1,
                    'updated_at' => now(),
                ]);
            }
        });
    }

    public function transition(Runsheet $runsheet, RunsheetStatus $targetStatus): void
    {
        $currentStatus = $runsheet->status;

        if (! $currentStatus instanceof RunsheetStatus) {
            $currentStatus = RunsheetStatus::from((string) $currentStatus);
        }

        if ($currentStatus === $targetStatus) {
            return;
        }

        if (! $currentStatus->canTransitionTo($targetStatus)) {
            throw new \InvalidArgumentException(sprintf(
                'Invalid runsheet transition from %s to %s.',
                $currentStatus->value,
                $targetStatus->value
            ));
        }

        // Item 20: Empty runsheet prevention
        $runsheetTypeStr = $runsheet->type instanceof RunsheetType ? $runsheet->type->value : (string) $runsheet->type;
        if (in_array($targetStatus, [RunsheetStatus::Assigned, RunsheetStatus::InProgress], true)) {
            if ($runsheetTypeStr === RunsheetType::Delivery->value) {
                if ($runsheet->boxes()->count() === 0) {
                    throw new \InvalidArgumentException('At least one box is required when runsheet status is assigned or in progress.');
                }
            } else {
                if ($runsheet->bookings()->count() === 0) {
                    throw new \InvalidArgumentException('At least one booking is required when runsheet status is assigned or in progress.');
                }
            }
        }

        // Prevent completing a runsheet with un-acted upon boxes
        if ($targetStatus === RunsheetStatus::Completed) {
            $runsheetType = $runsheet->type instanceof RunsheetType
                ? $runsheet->type->value
                : (string) $runsheet->type;

            $runsheetTypeStr = $runsheet->type instanceof RunsheetType ? $runsheet->type->value : (string) $runsheet->type;
            if ($runsheetTypeStr === RunsheetType::Pickup->value) {
                $allBoxes = $runsheet->bookings()
                    ->with('boxes')
                    ->get()
                    ->flatMap(fn (Booking $booking) => $booking->boxes);
            } else {
                $allBoxes = $runsheet->boxes;
            }

            if ($runsheetType === RunsheetType::Pickup->value) {
                $terminalStatuses = [
                    BoxStatus::Collected->value,
                    BoxStatus::ReceivedByWarehouse->value,
                    BoxStatus::LoadedToContainer->value,
                    BoxStatus::InTransit->value,
                    BoxStatus::Arrived->value,
                    BoxStatus::OutForDelivery->value,
                    BoxStatus::Delivered->value,
                    BoxStatus::Cancelled->value,
                ];

                $hasNonTerminal = $allBoxes->contains(function (Box $box) use ($terminalStatuses) {
                    $status = $box->status instanceof BoxStatus ? $box->status->value : (string) $box->status;

                    return ! in_array($status, $terminalStatuses, true);
                });

                if ($hasNonTerminal) {
                    throw new \InvalidArgumentException('Cannot complete run: All boxes must be Received by Warehouse or Cancelled before completion.');
                }
            } else {
                // For delivery, they should be Delivered, Cancelled, Held, or Damaged
                $hasUnacted = $allBoxes->contains(function (Box $box) {
                    $status = $box->status instanceof BoxStatus ? $box->status->value : (string) $box->status;

                    return ! in_array($status, [
                        BoxStatus::Delivered->value,
                        BoxStatus::Cancelled->value,
                        BoxStatus::Held->value,
                        BoxStatus::Damaged->value,
                    ], true);
                });

                if ($hasUnacted) {
                    throw new \InvalidArgumentException('Cannot complete run: You have unresolved boxes. Please mark them as delivered, cancelled, held, or damaged.');
                }
            }
        }

        $runsheet->update(['status' => $targetStatus]);

        if ($targetStatus === RunsheetStatus::Assigned) {
            $runsheetTypeStr = $runsheet->type instanceof RunsheetType ? $runsheet->type->value : (string) $runsheet->type;
            if ($runsheetTypeStr === RunsheetType::Pickup->value) {
                $runsheet->loadMissing('bookings.boxes');
                foreach ($runsheet->bookings as $booking) {
                    $this->logAssignmentToTracking($runsheet, $booking);
                }
            } else {
                $runsheet->loadMissing('boxes');
                foreach ($runsheet->boxes as $box) {
                    $this->logBoxAssignmentToTracking($runsheet, $box);
                }
            }
        }
    }

    private function attachBooking(Runsheet $runsheet, Booking $booking, ?string $startingSerialNumber = null): void
    {
        $booking = Booking::query()
            ->whereKey($booking->id)
            ->lockForUpdate()
            ->firstOrFail();

        $runsheetStatus = $runsheet->status;
        if (! $runsheetStatus instanceof RunsheetStatus) {
            $runsheetStatus = RunsheetStatus::from((string) $runsheetStatus);
        }

        if ($runsheetStatus === RunsheetStatus::Completed) {
            throw new \InvalidArgumentException('Cannot attach bookings to a completed runsheet.');
        }

        $alreadyAttachedToThisRunsheet = $runsheet->bookings()
            ->where('bookings.id', $booking->id)
            ->exists();

        if (! $alreadyAttachedToThisRunsheet) {
            $this->assertAreaCompatibility($runsheet, $booking);
        }

        $runsheetType = $runsheet->type;
        if (! $runsheetType instanceof RunsheetType) {
            $runsheetType = RunsheetType::from((string) $runsheetType);
        }

        if ($runsheetType === RunsheetType::Delivery && $booking->payment_status !== PaymentStatus::Paid) {
            throw new \InvalidArgumentException(sprintf(
                'Booking %s must be paid before being assigned to a courier.',
                $booking->reference_number
            ));
        }

        $bookingStatus = $booking->status;
        if (! $bookingStatus instanceof BookingStatus) {
            $bookingStatus = BookingStatus::from((string) $bookingStatus);
        }

        if ($runsheetType === RunsheetType::Pickup) {
            if ($bookingStatus !== BookingStatus::Confirmed) {
                throw new \InvalidArgumentException("Booking {$booking->reference_number} must be confirmed for pickup assignment.");
            }
        } else {
            if ($bookingStatus === BookingStatus::Cancelled) {
                throw new \InvalidArgumentException("Booking {$booking->reference_number} is cancelled and cannot be assigned.");
            }

            if (! $booking->hasCompletedPickupRunsheet()) {
                throw new \InvalidArgumentException("Booking {$booking->reference_number} must complete pickup before courier assignment.");
            }

            if ($booking->hasActiveRunsheetOfType(RunsheetType::Pickup)) {
                throw new \InvalidArgumentException("Booking {$booking->reference_number} still has an active pickup runsheet.");
            }

            if (! $booking->hasWarehouseHandoffCompleted()) {
                throw new \InvalidArgumentException("Booking {$booking->reference_number} requires warehouse handoff before courier assignment.");
            }
        }

        $alreadyAttachedToActiveRunsheet = $booking->runsheets()
            ->where('type', $runsheetType->value)
            ->whereIn('status', RunsheetStatus::activeValues())
            ->where('runsheets.id', '!=', $runsheet->id)
            ->exists();

        if ($alreadyAttachedToActiveRunsheet) {
            throw new \InvalidArgumentException(sprintf(
                'Booking %s is already assigned to another active %s runsheet.',
                $booking->reference_number,
                $runsheetType->value
            ));
        }

        if ($runsheetType === RunsheetType::Delivery) {
            $hasAlreadyDeliveredRunsheet = $booking->runsheets()
                ->where('type', RunsheetType::Delivery->value)
                ->where('status', RunsheetStatus::Completed->value)
                ->exists();

            if ($hasAlreadyDeliveredRunsheet) {
                // If it was already completed, we check if there are still boxes needing delivery
                // But the primary request is to never allow same box can assign runsheet twice.
                // If the whole booking already has a completed delivery runsheet, it shouldn't be assigned again
                // unless it is partially delivered and we have new boxes or re-attempts (which might be a different flow).
                // For now, let's block it if it has any completed delivery runsheet as per user request.
                throw new \InvalidArgumentException(sprintf(
                    'Booking %s has already been assigned to a completed delivery runsheet.',
                    $booking->reference_number
                ));
            }
        }

        $runsheet->bookings()->syncWithoutDetaching([$booking->id]);

        if ($runsheetType === RunsheetType::Pickup || $runsheetType->value === RunsheetType::Pickup->value) {
            $this->allocateSerialNumbers($booking, $runsheet->user_id, $startingSerialNumber);
        }

        if (in_array($runsheet->status, [RunsheetStatus::Assigned, RunsheetStatus::InProgress]) || in_array($runsheet->status->value ?? '', [RunsheetStatus::Assigned->value, RunsheetStatus::InProgress->value])) {
            $this->logAssignmentToTracking($runsheet, $booking);
        }
    }

    private function allocateSerialNumbers(Booking $booking, ?int $assignedBy = null, ?string $startingSerialNumber = null): void
    {
        $boxesToAllocate = $booking->boxes()->whereNull('serial_number')->get();
        if ($boxesToAllocate->isEmpty()) {
            return;
        }

        $neededCount = $boxesToAllocate->count();

        // Get available serial numbers
        $query = \App\Models\SerialNumber::query()
            ->where('status', \App\Enums\SerialNumberStatus::Available->value)
            ->orderBy('id', 'asc');

        if ($startingSerialNumber) {
            // Find the ID of the starting serial number to start allocating from it
            $startingSerialModel = \App\Models\SerialNumber::where('serial_number', $startingSerialNumber)->first();
            if ($startingSerialModel) {
                $query->where('id', '>=', $startingSerialModel->id);
            }
        }

        $availableSerials = $query->limit($neededCount)
            ->lockForUpdate()
            ->get();

        if ($availableSerials->count() < $neededCount) {
            throw new \RuntimeException("Not enough available serial numbers in the pool. Needed {$neededCount}, found {$availableSerials->count()}. Please generate more serial numbers in the admin panel.");
        }

        foreach ($boxesToAllocate as $index => $box) {
            $serial = $availableSerials[$index];
            $serial->update([
                'status' => \App\Enums\SerialNumberStatus::Allocated->value,
                'box_id' => $box->id,
                'assigned_by' => $assignedBy ?? auth()->id(),
                'allocated_at' => now(),
            ]);

            $box->update(['serial_number' => $serial->serial_number]);
        }
    }

    private function ensureStopSequence(Runsheet $runsheet): void
    {
        $bookings = $runsheet->bookings()
            ->with(['boxes.recipient.area'])
            ->get();

        if ($bookings->isEmpty()) {
            return;
        }

        $sequenced = $bookings
            ->filter(fn (Booking $booking) => $booking->pivot?->sequence !== null)
            ->sortBy(fn (Booking $booking) => (int) $booking->pivot->sequence)
            ->values();

        $unsequenced = $bookings
            ->filter(fn (Booking $booking) => $booking->pivot?->sequence === null)
            ->sortBy(fn (Booking $booking) => $this->defaultStopSortKey($runsheet, $booking))
            ->values();

        $orderedBookings = $sequenced->isEmpty()
            ? $bookings->sortBy(fn (Booking $booking) => $this->defaultStopSortKey($runsheet, $booking))->values()
            : $sequenced->concat($unsequenced)->values();

        foreach ($orderedBookings as $index => $booking) {
            $runsheet->bookings()->updateExistingPivot($booking->id, [
                'sequence' => $index + 1,
                'updated_at' => now(),
            ]);
        }
    }

    private function defaultStopSortKey(Runsheet $runsheet, Booking $booking): string
    {
        $booking->loadMissing('boxes.recipient.area');

        $recipient = $booking->boxes
            ->map(fn (Box $box) => $box->recipient)
            ->filter()
            ->sortBy(fn ($recipient) => implode('|', [
                mb_strtolower((string) ($recipient->area?->name ?? '')),
                mb_strtolower((string) $recipient->province),
                mb_strtolower((string) $recipient->city),
                mb_strtolower((string) $recipient->address),
            ]))
            ->first();

        return implode('|', [
            mb_strtolower((string) ($recipient?->area?->name ?? '')),
            mb_strtolower((string) ($recipient?->province ?? '')),
            mb_strtolower((string) ($recipient?->city ?? '')),
            (string) ($runsheet->scheduled_date?->format('Y-m-d') ?? ''),
            mb_strtolower((string) ($runsheet->timeslot ?? '')),
            (string) ($booking->preferred_date?->format('Y-m-d H:i:s') ?? ''),
            (string) ($booking->created_at?->format('Y-m-d H:i:s') ?? ''),
            str_pad((string) $booking->id, 10, '0', STR_PAD_LEFT),
        ]);
    }

    private function logAssignmentToTracking(Runsheet $runsheet, Booking $booking): void
    {
        $runsheetType = $runsheet->type instanceof RunsheetType
            ? $runsheet->type
            : RunsheetType::tryFrom((string) $runsheet->type);

        $description = '';
        $trackingPhase = null;

        if ($runsheetType === RunsheetType::Pickup) {
            $pickerName = $runsheet->picker->name ?? 'Picker';
            $description = "Assigned to picker {$pickerName} for collection.";
        } else {
            $courierName = $runsheet->courier->name ?? 'Courier';
            $description = "Assigned to courier {$courierName} for final delivery.";
            $trackingPhase = TrackingPhase::DISPATCHED_TO_LOCAL_HUB->value;
        }

        foreach ($booking->undeliveredBoxes as $box) {
            $boxStatus = $box->status instanceof \BackedEnum ? $box->status->value : $box->status;

            BoxUpdate::create([
                'box_id' => $box->id,
                'status' => $boxStatus,
                'tracking_phase' => $trackingPhase,
                'description' => $description,
                'updated_by' => auth()->id(),
            ]);
        }
    }

    private function assertAreaCompatibility(Runsheet $runsheet, Booking $booking): void
    {
        $bookingAreaIds = $this->resolveBookingAreaIds($booking);
        if ($bookingAreaIds->isEmpty()) {
            return;
        }

        // Enforce that bookings strictly match the courier's assigned area for delivery runsheets
        $runsheetType = $runsheet->type instanceof RunsheetType ? $runsheet->type : RunsheetType::tryFrom((string) $runsheet->type);
        if ($runsheetType === RunsheetType::Delivery && $runsheet->courier_id) {
            $runsheet->loadMissing('courier.courier');
            $courierAreaId = $runsheet->courier?->courier?->area_id;

            if ($courierAreaId) {
                if ($bookingAreaIds->isEmpty() || $bookingAreaIds->diff([(int) $courierAreaId])->isNotEmpty() || !$bookingAreaIds->contains((int) $courierAreaId)) {
                    $courierAreaName = \App\Models\Area::find($courierAreaId)?->name ?? 'Unknown Hub';
                    throw new \InvalidArgumentException(sprintf(
                        'Booking %s area does not strictly match the assigned courier\'s hub (%s).',
                        $booking->reference_number,
                        $courierAreaName
                    ));
                }
            }
        }

        $runsheetAreaIds = $runsheet->bookings()
            ->with('boxes.recipient')
            ->get()
            ->flatMap(fn ($b) => $this->resolveBookingAreaIds($b))
            ->unique();

        if ($runsheetAreaIds->isEmpty()) {
            return;
        }

        $mismatchedAreas = $runsheetAreaIds->diff($bookingAreaIds)->isNotEmpty()
            || $bookingAreaIds->diff($runsheetAreaIds)->isNotEmpty();

        if (! $mismatchedAreas) {
            return;
        }

        throw new \InvalidArgumentException(sprintf(
            'Cannot mix bookings from different areas in the same runsheet. Runsheet areas: %s. Booking areas: %s.',
            $this->formatAreaNames($runsheetAreaIds),
            $this->formatAreaNames($bookingAreaIds)
        ));
    }

    private function resolveBookingAreaIds(Booking $booking): Collection
    {
        $booking->loadMissing('boxes.recipient:id,area_id');

        return $booking->boxes
            ->map(fn ($box) => $box->recipient?->area_id)
            ->filter(fn ($areaId) => $areaId !== null)
            ->map(fn ($areaId) => (int) $areaId)
            ->unique()
            ->sort()
            ->values();
    }

    private function formatAreaNames(Collection $areaIds): string
    {
        $namesById = Area::query()
            ->whereIn('id', $areaIds->all())
            ->pluck('name', 'id');

        $names = $areaIds
            ->map(fn (int $areaId) => $namesById->get($areaId, 'Area #'.$areaId))
            ->values();

        return $names->implode(', ');
    }

    /**
     * After a box status update, find and sync all active runsheets
     * that contain the box's booking.
     */
    public function syncRelatedRunsheets(Box $box): void
    {
        $booking = $box->booking;
        if (! $booking) {
            return;
        }

        $bookingRunsheets = $booking->runsheets()
            ->whereIn('status', RunsheetStatus::activeValues())
            ->get();

        $boxRunsheets = $box->runsheets()
            ->whereIn('status', RunsheetStatus::activeValues())
            ->get();

        $activeRunsheets = $bookingRunsheets
            ->concat($boxRunsheets)
            ->unique('id');

        foreach ($activeRunsheets as $runsheet) {
            $this->syncRunsheetStatusFromBoxes($runsheet);
        }
    }

    /**
     * Automatically transition a runsheet based on its boxes' statuses:
     *  - Assigned Ã¢â€ â€™ InProgress: when any box is no longer Pending.
     *  - InProgress Ã¢â€ â€™ Completed: when ALL boxes are in terminal states.
     *    (For Pickup: ReceivedByWarehouse, Delivered, Cancelled)
     *    (For Delivery: Delivered, Cancelled)
     */
    public function syncRunsheetStatusFromBoxes(Runsheet $runsheet): void
    {
        $currentStatus = $runsheet->status;
        if (! $currentStatus instanceof RunsheetStatus) {
            $currentStatus = RunsheetStatus::from((string) $currentStatus);
        }

        // Only act on active runsheets
        if (! in_array($currentStatus, [RunsheetStatus::Assigned, RunsheetStatus::InProgress], true)) {
            return;
        }

        $runsheetType = $runsheet->type instanceof RunsheetType
            ? $runsheet->type->value
            : (string) $runsheet->type;

        if ($runsheetType === RunsheetType::Pickup->value) {
            $allBoxes = $runsheet->bookings()
                ->with('boxes')
                ->get()
                ->flatMap(fn (Booking $booking) => $booking->boxes);
        } else {
            $allBoxes = $runsheet->boxes()->get();
        }

        if ($allBoxes->isEmpty()) {
            return;
        }

        if ($runsheetType === RunsheetType::Pickup->value) {
            $terminalStatuses = [
                BoxStatus::ReceivedByWarehouse->value,
                BoxStatus::LoadedToContainer->value,
                BoxStatus::InTransit->value,
                BoxStatus::Arrived->value,
                BoxStatus::OutForDelivery->value,
                BoxStatus::Delivered->value,
                BoxStatus::Cancelled->value,
            ];
        } else {
            $terminalStatuses = [
                BoxStatus::Delivered->value,
                BoxStatus::Cancelled->value,
                BoxStatus::Held->value,
                BoxStatus::Damaged->value,
            ];
        }

        // Auto-start: if any box has left Pending, move Assigned Ã¢â€ â€™ InProgress
        if ($currentStatus === RunsheetStatus::Assigned) {
            $anyNonPending = $allBoxes->contains(
                fn (Box $box) => ($box->status instanceof BoxStatus ? $box->status->value : (string) $box->status) !== BoxStatus::Pending->value
            );

            if ($anyNonPending) {
                $runsheet->update(['status' => RunsheetStatus::InProgress]);
                $currentStatus = RunsheetStatus::InProgress;
            }
        }

        // Auto-complete: if ALL boxes are in terminal states, move InProgress Ã¢â€ â€™ Completed
        if ($currentStatus === RunsheetStatus::InProgress) {
            $allTerminal = $allBoxes->every(
                fn (Box $box) => in_array(
                    $box->status instanceof BoxStatus ? $box->status->value : (string) $box->status,
                    $terminalStatuses,
                    true
                )
            );

            if ($allTerminal) {
                $runsheet->update(['status' => RunsheetStatus::Completed]);
            }
        }
    }

    public function attachBoxes(Runsheet $runsheet, array $boxIds): void
    {
        DB::transaction(function () use ($runsheet, $boxIds): void {
            $lockedRunsheet = Runsheet::query()
                ->whereKey($runsheet->id)
                ->lockForUpdate()
                ->firstOrFail();

            foreach ($boxIds as $boxId) {
                $box = Box::findOrFail($boxId);
                $this->attachBox($lockedRunsheet, $box);
            }

            $this->ensureBoxStopSequence($lockedRunsheet);
        });
    }

    public function syncBoxes(Runsheet $runsheet, array $boxIds, ?array $stopSequence = null): void
    {
        DB::transaction(function () use ($runsheet, $boxIds, $stopSequence): void {
            $lockedRunsheet = Runsheet::query()
                ->whereKey($runsheet->id)
                ->lockForUpdate()
                ->firstOrFail();

            $desiredIds = collect($boxIds)
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();

            $runsheetStatus = $lockedRunsheet->status;
            if (! $runsheetStatus instanceof RunsheetStatus) {
                $runsheetStatus = RunsheetStatus::from((string) $runsheetStatus);
            }

            if (
                $desiredIds->isEmpty()
                && in_array($runsheetStatus, [RunsheetStatus::Assigned, RunsheetStatus::InProgress], true)
            ) {
                throw new \InvalidArgumentException('At least one box is required when runsheet status is assigned or in progress.');
            }

            $currentIds = $lockedRunsheet->boxes()->pluck('boxes.id');

            $idsToDetach = $currentIds->diff($desiredIds);
            if ($idsToDetach->isNotEmpty()) {
                $lockedRunsheet->boxes()->detach($idsToDetach->all());
            }

            $idsToAttach = $desiredIds->diff($currentIds);
            foreach ($idsToAttach as $boxId) {
                $box = Box::findOrFail($boxId);
                $this->attachBox($lockedRunsheet, $box);
            }

            if ($stopSequence !== null) {
                $this->reorderBoxes($lockedRunsheet, $stopSequence);
            } else {
                $this->ensureBoxStopSequence($lockedRunsheet);
            }
        });
    }

    public function reorderBoxes(Runsheet $runsheet, array $boxIds): void
    {
        DB::transaction(function () use ($runsheet, $boxIds): void {
            $lockedRunsheet = Runsheet::query()
                ->whereKey($runsheet->id)
                ->lockForUpdate()
                ->firstOrFail();

            $orderedIds = collect($boxIds)
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();

            $currentIds = $lockedRunsheet->boxes()
                ->pluck('boxes.id')
                ->map(fn ($id) => (int) $id)
                ->sort()
                ->values();

            if ($orderedIds->sort()->values()->all() !== $currentIds->all()) {
                throw new \InvalidArgumentException('Stop order must include every box currently assigned to this runsheet.');
            }

            foreach ($orderedIds as $index => $boxId) {
                $lockedRunsheet->boxes()->updateExistingPivot($boxId, [
                    'sequence' => $index + 1,
                    'updated_at' => now(),
                ]);
            }
        });
    }

    private function attachBox(Runsheet $runsheet, Box $box): void
    {
        $box = Box::query()
            ->whereKey($box->id)
            ->lockForUpdate()
            ->firstOrFail();

        $runsheetStatus = $runsheet->status;
        if (! $runsheetStatus instanceof RunsheetStatus) {
            $runsheetStatus = RunsheetStatus::from((string) $runsheetStatus);
        }

        if ($runsheetStatus === RunsheetStatus::Completed) {
            throw new \InvalidArgumentException('Cannot attach boxes to a completed runsheet.');
        }

        $alreadyAttachedToThisRunsheet = $runsheet->boxes()
            ->where('boxes.id', $box->id)
            ->exists();

        if (! $alreadyAttachedToThisRunsheet) {
            $this->assertBoxAreaCompatibility($runsheet, $box);
        }

        $runsheetType = $runsheet->type;
        if (! $runsheetType instanceof RunsheetType) {
            $runsheetType = RunsheetType::from((string) $runsheetType);
        }

        $booking = $box->booking;
        if ($runsheetType === RunsheetType::Delivery) {
            if (! $booking) {
                throw new \InvalidArgumentException("Box {$box->tracking_number} must belong to a booking before courier assignment.");
            }

            $bookingStatus = $booking->status instanceof BookingStatus
                ? $booking->status
                : BookingStatus::from((string) $booking->status);

            if ($bookingStatus === BookingStatus::Cancelled) {
                throw new \InvalidArgumentException("Booking {$booking->reference_number} is cancelled and cannot be assigned.");
            }

            if ($booking->payment_status !== PaymentStatus::Paid) {
                throw new \InvalidArgumentException(sprintf(
                    'Booking %s must be paid before its boxes can be assigned to a courier.',
                    $booking->reference_number
                ));
            }

            if (! $booking->hasCompletedPickupRunsheet()) {
                throw new \InvalidArgumentException("Booking {$booking->reference_number} must complete pickup before courier assignment.");
            }

            if ($booking->hasActiveRunsheetOfType(RunsheetType::Pickup)) {
                throw new \InvalidArgumentException("Booking {$booking->reference_number} still has an active pickup runsheet.");
            }
        }

        $reachedWarehouse = $box->updates()->whereIn('tracking_phase', [
            'received_manila_warehouse',
            'sorting',
            'dispatched_to_local_hub',
        ])->exists() || $box->updates()->whereHas('milestone', function ($q) {
            $q->where('is_warehouse_handoff', true);
        })->exists();

        if (! $reachedWarehouse) {
            throw new \InvalidArgumentException("Box {$box->tracking_number} has not reached the warehouse.");
        }

        $alreadyAttachedToActiveRunsheet = $box->runsheets()
            ->where('type', $runsheetType->value)
            ->whereIn('status', RunsheetStatus::activeValues())
            ->where('runsheets.id', '!=', $runsheet->id)
            ->exists();

        if ($alreadyAttachedToActiveRunsheet) {
            throw new \InvalidArgumentException(sprintf(
                'Box %s is already assigned to another active %s runsheet.',
                $box->tracking_number,
                $runsheetType->value
            ));
        }

        if ($runsheetType === RunsheetType::Delivery) {
            $hasAlreadyDeliveredRunsheet = $box->runsheets()
                ->where('type', RunsheetType::Delivery->value)
                ->where('status', RunsheetStatus::Completed->value)
                ->exists();

            if ($hasAlreadyDeliveredRunsheet) {
                throw new \InvalidArgumentException(sprintf(
                    'Box %s has already been assigned to a completed delivery runsheet.',
                    $box->tracking_number
                ));
            }
        }

        $runsheet->boxes()->syncWithoutDetaching([$box->id]);

        if (in_array($runsheet->status, [RunsheetStatus::Assigned, RunsheetStatus::InProgress]) || in_array($runsheet->status->value ?? '', [RunsheetStatus::Assigned->value, RunsheetStatus::InProgress->value])) {
            $this->logBoxAssignmentToTracking($runsheet, $box);
        }
    }

    private function ensureBoxStopSequence(Runsheet $runsheet): void
    {
        $boxes = $runsheet->boxes()
            ->with(['recipient.area', 'booking'])
            ->get();

        if ($boxes->isEmpty()) {
            return;
        }

        $sequenced = $boxes
            ->filter(fn (Box $box) => $box->pivot?->sequence !== null)
            ->sortBy(fn (Box $box) => (int) $box->pivot->sequence)
            ->values();

        $unsequenced = $boxes
            ->filter(fn (Box $box) => $box->pivot?->sequence === null)
            ->sortBy(fn (Box $box) => $this->defaultBoxStopSortKey($runsheet, $box))
            ->values();

        $orderedBoxes = $sequenced->isEmpty()
            ? $boxes->sortBy(fn (Box $box) => $this->defaultBoxStopSortKey($runsheet, $box))->values()
            : $sequenced->concat($unsequenced)->values();

        foreach ($orderedBoxes as $index => $box) {
            $runsheet->boxes()->updateExistingPivot($box->id, [
                'sequence' => $index + 1,
                'updated_at' => now(),
            ]);
        }
    }

    private function defaultBoxStopSortKey(Runsheet $runsheet, Box $box): string
    {
        $box->loadMissing('recipient.area', 'booking');

        $recipient = $box->recipient;

        return implode('|', [
            mb_strtolower((string) ($recipient?->area?->name ?? '')),
            mb_strtolower((string) ($recipient?->province ?? '')),
            mb_strtolower((string) ($recipient?->city ?? '')),
            (string) ($runsheet->scheduled_date?->format('Y-m-d') ?? ''),
            mb_strtolower((string) ($runsheet->timeslot ?? '')),
            (string) ($box->booking?->preferred_date?->format('Y-m-d H:i:s') ?? ''),
            (string) ($box->booking?->created_at?->format('Y-m-d H:i:s') ?? ''),
            str_pad((string) $box->id, 10, '0', STR_PAD_LEFT),
        ]);
    }

    private function logBoxAssignmentToTracking(Runsheet $runsheet, Box $box): void
    {
        $runsheetType = $runsheet->type instanceof RunsheetType
            ? $runsheet->type
            : RunsheetType::tryFrom((string) $runsheet->type);

        $description = '';
        $trackingPhase = null;

        if ($runsheetType === RunsheetType::Pickup) {
            $pickerName = $runsheet->picker->name ?? 'Picker';
            $description = "Assigned to picker {$pickerName} for collection.";
        } else {
            $courierName = $runsheet->courier->name ?? 'Courier';
            $description = "Assigned to courier {$courierName} for final delivery.";
            $trackingPhase = TrackingPhase::DISPATCHED_TO_LOCAL_HUB->value;
        }

        $boxStatus = $box->status instanceof \BackedEnum ? $box->status->value : $box->status;

        BoxUpdate::create([
            'box_id' => $box->id,
            'status' => $boxStatus,
            'tracking_phase' => $trackingPhase,
            'description' => $description,
            'updated_by' => auth()->id(),
        ]);
    }

    private function assertBoxAreaCompatibility(Runsheet $runsheet, Box $box): void
    {
        $box->loadMissing('recipient:id,area_id');
        $boxAreaId = $box->recipient?->area_id;

        if (!$boxAreaId) {
            return;
        }

        $runsheetType = $runsheet->type instanceof RunsheetType ? $runsheet->type : RunsheetType::tryFrom((string) $runsheet->type);
        if ($runsheetType === RunsheetType::Delivery && $runsheet->courier_id) {
            $runsheet->loadMissing('courier.courier');
            $courierAreaId = $runsheet->courier?->courier?->area_id;

            if ($courierAreaId) {
                if ((int) $boxAreaId !== (int) $courierAreaId) {
                    $courierAreaName = \App\Models\Area::find($courierAreaId)?->name ?? 'Unknown Hub';
                    throw new \InvalidArgumentException(sprintf(
                        'Box %s area does not strictly match the assigned courier\'s hub (%s).',
                        $box->tracking_number,
                        $courierAreaName
                    ));
                }
            }
        }

        $runsheetAreaIds = $runsheet->boxes()
            ->with('recipient')
            ->get()
            ->map(fn ($b) => $b->recipient?->area_id)
            ->filter()
            ->map(fn ($areaId) => (int) $areaId)
            ->unique();

        if ($runsheetAreaIds->isEmpty()) {
            return;
        }

        if (!$runsheetAreaIds->contains((int) $boxAreaId)) {
            $boxAreaName = \App\Models\Area::find($boxAreaId)?->name ?? 'Unknown Hub';
            throw new \InvalidArgumentException(sprintf(
                'Cannot mix boxes from different areas in the same runsheet. Runsheet areas: %s. Box area: %s.',
                $this->formatAreaNames(collect($runsheetAreaIds)),
                $boxAreaName
            ));
        }
    }
}
