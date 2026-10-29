<?php

namespace App\Observers;

use App\Enums\BatchStatus;
use App\Enums\BoxStatus;
use App\Http\Controllers\PublicScheduleAndRateController;
use App\Models\Batch;
use App\Models\User;
use App\Notifications\BatchLifecycleNotification;
use App\Notifications\BatchStatusNotification;
use App\Services\BatchService;
use App\Services\CalendarEventService;
use App\Services\TrackingCacheService;
use App\Services\TrackingStepService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;

class BatchObserver
{
    /**
     * Status transitions that should trigger admin notifications.
     */
    private const ADMIN_NOTIFIABLE_STATUSES = [
        BatchStatus::ReadyToClose,
        BatchStatus::Sailed,
        BatchStatus::Arrived,
        BatchStatus::UnderCustomsClearance,
        BatchStatus::ReleasedByBoc,
        BatchStatus::ReceivedAtWarehouse,
    ];

    /**
     * Status transitions that should trigger sender notifications.
     */
    private const SENDER_NOTIFIABLE_STATUSES = [
        BatchStatus::Sailed,
        BatchStatus::Arrived,
        BatchStatus::ReceivedAtWarehouse,
    ];

    /**
     * Handle the Batch "created" event.
     */
    public function created(Batch $batch): void
    {
        PublicScheduleAndRateController::forgetUpcomingBatchesCache();
        app(CalendarEventService::class)->syncBatchEvents($batch);
    }

    /**
     * Handle the Batch "updated" event.
     */

    /**
     * Handle the Batch "deleted" event.
     */
    public function deleted(Batch $batch): void
    {
        PublicScheduleAndRateController::forgetUpcomingBatchesCache();
        app(TrackingCacheService::class)->forgetBatch($batch);
    }

    public function updated(Batch $batch): void
    {
        PublicScheduleAndRateController::forgetUpcomingBatchesCache();
        app(TrackingCacheService::class)->forgetBatch($batch);
        app(CalendarEventService::class)->syncBatchEvents($batch);

        if ($batch->wasChanged('status')) {
            $this->handleStatusChange($batch);
        }
    }

    /**
     * Handle status changes: cascade to boxes and send notifications.
     */
    private function handleStatusChange(Batch $batch): void
    {
        $newStatus = $batch->status;

        // Keep box updates and tracking_step_key in sync with major tracking milestones.
        $this->cascadeTrackingPhaseToBoxes($batch, $newStatus);

        // Cascade batch status to any remaining eligible box statuses
        $this->cascadeStatusToBoxes($batch, $newStatus);

        // Notify admins
        if (in_array($newStatus, self::ADMIN_NOTIFIABLE_STATUSES, true)) {
            $this->notifyAdmins($batch, $newStatus);
        }

        // Notify senders whose boxes are in this batch
        if (in_array($newStatus, self::SENDER_NOTIFIABLE_STATUSES, true)) {
            $this->notifySenders($batch, $newStatus);
        }
    }

    /**
     * When a batch transitions, cascade to all boxes.
     */
    private function cascadeStatusToBoxes(Batch $batch, BatchStatus $status): void
    {
        $boxStatus = match ($status) {
            BatchStatus::Sailed => BoxStatus::InTransit,
            BatchStatus::Arrived,
            BatchStatus::UnderCustomsClearance,
            BatchStatus::ReleasedByBoc => BoxStatus::Arrived,
            BatchStatus::ReceivedAtWarehouse => BoxStatus::UnloadedManila,
            default => null,
        };

        if ($boxStatus === null) {
            return;
        }

        $trackingStepService = app(TrackingStepService::class);
        $batchService = app(BatchService::class);
        $targetPhase = $batchService->resolveTrackingPhaseForStatus($status);
        $targetOrder = $targetPhase ? $trackingStepService->getStepOrder($targetPhase->value) : null;

        foreach ($batch->boxes as $box) {
            // Do not demote or regress boxes that have already reached or passed this journey stage
            if ($targetOrder !== null) {
                $currentKey = $box->tracking_step_key ?: $box->latestUpdate?->tracking_step_key ?: $box->latestUpdate?->tracking_phase?->value;
                $currentOrder = $currentKey ? $trackingStepService->getStepOrder($currentKey) : null;
                if ($currentOrder !== null && $currentOrder >= $targetOrder) {
                    continue;
                }
            }

            if ($box->status?->canTransitionTo($boxStatus)) {
                $updates = ['status' => $boxStatus];
                if ($targetPhase !== null && $box->tracking_step_key !== $targetPhase->value) {
                    $updates['tracking_step_key'] = $targetPhase->value;
                }
                $box->update($updates);
            }
        }
    }

    private function cascadeTrackingPhaseToBoxes(Batch $batch, BatchStatus $status): void
    {
        $batchService = app(BatchService::class);

        $trackingPhase = $batchService->resolveTrackingPhaseForStatus($status);

        if ($trackingPhase === null) {
            return;
        }

        $description = match ($status) {
            BatchStatus::Sailed => sprintf('Container %s has sailed from origin port.', $batch->container_number),
            BatchStatus::Arrived => sprintf('Container %s has arrived at Philippine port. Ready for customs clearance.', $batch->container_number),
            BatchStatus::UnderCustomsClearance => sprintf('Container %s is currently under customs inspection and clearance.', $batch->container_number),
            BatchStatus::ReleasedByBoc => sprintf('Container %s has been released by customs and queued for warehouse delivery.', $batch->container_number),
            BatchStatus::ReceivedAtWarehouse => sprintf('Container %s arrived at Manila Warehouse. Boxes safely unloaded for sorting and dispatch.', $batch->container_number),
            default => sprintf('Batch moved to %s.', $status->label()),
        };

        $targetStatus = match ($status) {
            BatchStatus::Sailed => BoxStatus::InTransit,
            BatchStatus::Arrived,
            BatchStatus::UnderCustomsClearance,
            BatchStatus::ReleasedByBoc => BoxStatus::Arrived,
            BatchStatus::ReceivedAtWarehouse => BoxStatus::UnloadedManila,
            default => null,
        };

        // Note: bulkUpdateTrackingPhase performs per-box forward progression checks,
        // advancing eligible boxes while preserving any boxes that have already advanced further.
        $batchService->bulkUpdateTrackingPhase(
            $batch,
            $trackingPhase,
            Auth::id(),
            $description,
            $targetStatus,
        );
    }

    /**
     * Send notifications to admin users.
     */
    private function notifyAdmins(Batch $batch, BatchStatus $status): void
    {
        $admins = User::where('role', 'admin')
            ->orWhere('role', 'staff')
            ->get();

        if ($admins->isEmpty()) {
            return;
        }

        Notification::send(
            $admins,
            new BatchLifecycleNotification($batch, $status)
        );
    }

    /**
     * Send notifications to senders with boxes in this batch.
     */
    private function notifySenders(Batch $batch, BatchStatus $status): void
    {
        $senderIds = $batch->boxes()
            ->with('booking.sender')
            ->get()
            ->pluck('booking.sender.user_id')
            ->filter()
            ->unique();

        if ($senderIds->isEmpty()) {
            return;
        }

        $senders = User::whereIn('id', $senderIds)->get();

        if ($senders->isEmpty()) {
            return;
        }

        Notification::send(
            $senders,
            new BatchStatusNotification($batch, $status)
        );
    }
}
