<?php

namespace App\Observers;

use App\Services\ReferenceDataService;
use Illuminate\Database\Eloquent\Model;

class ReferenceDataObserver
{
    public function saved(Model $model): void
    {
        $this->forgetReferenceData();
    }

    public function deleted(Model $model): void
    {
        $this->forgetReferenceData();
    }

    public function restored(Model $model): void
    {
        $this->forgetReferenceData();
    }

    public function forceDeleted(Model $model): void
    {
        $this->forgetReferenceData();
    }

    private function forgetReferenceData(): void
    {
        app(ReferenceDataService::class)->forgetBookingReferenceData();
    }
}
