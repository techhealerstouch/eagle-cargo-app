<?php

namespace App\Observers;

use App\Enums\BatchStatus;
use App\Enums\BoxStatus;
use App\Models\Batch;
use App\Models\User;
use App\Notifications\BatchLifecycleNotification;
use App\Notifications\BatchStatusNotification;
use App\Services\BatchService;
use App\Services\TrackingCacheService;
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
        BatchStatus::Delivered,
    ];

    /**
     * Status transitions that should trigger sender notifications.
     */
    private const SENDER_NOTIFIABLE_STATUSES = [
        BatchStatus::Sailed,
        BatchStatus::Arrived,
        BatchStatus::Delivered,
    ];

    /**
     * Handle the Batch "updated" event.
     */
    public function updated(Batch $batch): void
    {
        app(TrackingCacheService::class)->forgetBatch($batch);

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

        // Cascade batch status to box statuses
        $this->cascadeStatusToBoxes($batch, $newStatus);

        // Keep box updates in sync with major tracking milestones.
        $this->cascadeTrackingPhaseToBoxes($batch, $newStatus);

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
     * When a batch transitions to Sailed or Arrived, cascade to all boxes.
     * (Previously handled by ContainerObserver)
     */
    private function cascadeStatusToBoxes(Batch $batch, BatchStatus $status): void
    {
        $boxStatus = match ($status) {
            BatchStatus::Sailed => BoxStatus::InTransit,
            BatchStatus::Arrived => BoxStatus::Arrived,
            default => null,
        };

        if ($boxStatus === null) {
            return;
        }

        foreach ($batch->boxes as $box) {
            if ($box->status?->canTransitionTo($boxStatus)) {
                $box->update(['status' => $boxStatus]);
            }
        }
    }

    private function cascadeTrackingPhaseToBoxes(Batch $batch, BatchStatus $status): void
    {
        $batchService = app(BatchService::class);
        $trackingStepService = app(\App\Services\TrackingStepService::class);

        $trackingPhase = $batchService->resolveTrackingPhaseForStatus($status);

        if ($trackingPhase === null) {
            return;
        }

        // --- Prevent Downgrading ---
        // If the batch already has boxes at this or a later tracking phase, don't revert them.
        // This is especially important when a user manually updates to a later phase (like Customs Clearance)
        // which triggers a batch status change to Arrived, which would otherwise loop back to Arrived at Port.
        $boxIds = $batch->boxes->pluck('id');
        if ($boxIds->isNotEmpty()) {
            $latestUpdate = \App\Models\BoxUpdate::whereIn('box_id', $boxIds)
                ->whereNotNull('tracking_phase')
                ->latest()
                ->first();

            if ($latestUpdate) {
                $currentOrder = $trackingStepService->getStepOrder($latestUpdate->tracking_phase->value) ?? 0;
                $newOrder = $trackingStepService->getStepOrder($trackingPhase->value) ?? 0;

                if ($currentOrder >= $newOrder) {
                    return;
                }
            }
        }

        $description = match ($status) {
            BatchStatus::Sailed => sprintf('Container %s has sailed from origin port.', $batch->container_number),
            BatchStatus::Arrived => sprintf('Container %s has arrived at Manila Port. Ready for warehouse sorting.', $batch->container_number),
            BatchStatus::Delivered => 'Batch has been fully delivered.',
            default => sprintf('Batch moved to %s.', $status->label()),
        };

        $batchService->bulkUpdateTrackingPhase(
            $batch,
            $trackingPhase,
            Auth::id(),
            $description,
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
