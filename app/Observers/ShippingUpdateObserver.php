<?php

namespace App\Observers;

use App\Models\ShippingUpdate;
use Illuminate\Support\Facades\Cache;

class ShippingUpdateObserver
{
    public const PUBLISHED_CACHE_KEY = 'public.shipping_updates.published';

    public function saved(ShippingUpdate $shippingUpdate): void
    {
        $this->forgetPublishedUpdates();
    }

    public function deleted(ShippingUpdate $shippingUpdate): void
    {
        $this->forgetPublishedUpdates();
    }

    private function forgetPublishedUpdates(): void
    {
        Cache::forget(self::PUBLISHED_CACHE_KEY);
    }
}
