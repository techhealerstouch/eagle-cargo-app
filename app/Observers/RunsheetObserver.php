<?php

namespace App\Observers;

use App\Http\Controllers\SenderDashboardController;
use App\Models\Runsheet;
use App\Enums\RunsheetStatus;
use App\Notifications\RunsheetAssigned;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Cache;

class RunsheetObserver
{
    public function created(Runsheet $runsheet): void
    {
        $this->bustCache();
        $this->notifyAssigneeIfNeeded($runsheet);
    }

    public function updated(Runsheet $runsheet): void
    {
        $this->bustCache();
        $this->notifyAssigneeIfNeeded($runsheet);
    }

    public function deleted(Runsheet $runsheet): void
    {
        $this->bustCache();
    }

    public function restored(Runsheet $runsheet): void
    {
        $this->bustCache();
    }

    public function forceDeleted(Runsheet $runsheet): void
    {
        $this->bustCache();
    }

    private function bustCache(): void
    {
        Cache::forget(SenderDashboardController::DASHBOARD_CACHE_KEY);
    }

    private function notifyAssigneeIfNeeded(Runsheet $runsheet): void
    {
        // Only notify if the runsheet is currently in an active status (assigned or in progress)
        if (!in_array($runsheet->status, [RunsheetStatus::Assigned, RunsheetStatus::InProgress], true)) {
            return;
        }

        $wasCreated = $runsheet->wasRecentlyCreated;

        // Determine if status transitioned from a non-active status to an active one
        $origStatus = $runsheet->getOriginal('status');
        if (is_string($origStatus)) {
            $origStatus = RunsheetStatus::tryFrom($origStatus);
        }

        $statusChangedToActive = $runsheet->isDirty('status') 
            && !in_array($origStatus, [RunsheetStatus::Assigned, RunsheetStatus::InProgress], true);

        // Force relationship refresh if keys are dirty to avoid cached relations returning outdated models
        if ($runsheet->isDirty('picker_id')) {
            $runsheet->unsetRelation('picker');
        }
        if ($runsheet->isDirty('courier_id')) {
            $runsheet->unsetRelation('courier');
        }

        // Notify picker
        if ($runsheet->picker_id) {
            $shouldNotify = $wasCreated 
                || $runsheet->isDirty('picker_id') 
                || $statusChangedToActive;
            
            if ($shouldNotify && $runsheet->picker) {
                app(NotificationService::class)->notify(
                    $runsheet->picker,
                    new RunsheetAssigned($runsheet),
                    \App\Enums\NotificationEvent::RunsheetAssigned
                );
            }
        }

        // Notify courier
        if ($runsheet->courier_id) {
            $shouldNotify = $wasCreated 
                || $runsheet->isDirty('courier_id') 
                || $statusChangedToActive;
            
            if ($shouldNotify && $runsheet->courier) {
                app(NotificationService::class)->notify(
                    $runsheet->courier,
                    new RunsheetAssigned($runsheet),
                    \App\Enums\NotificationEvent::RunsheetAssigned
                );
            }
        }
    }
}
