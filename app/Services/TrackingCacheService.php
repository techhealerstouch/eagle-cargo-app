<?php

namespace App\Services;

use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use Closure;
use Illuminate\Support\Facades\Cache;

class TrackingCacheService
{
    private const PAGE_PREFIX = 'tracking.page.';

    private const API_PREFIX = 'tracking.api.';

    private const TTL_SECONDS = 120;

    public function rememberPage(string $identifier, Closure $resolver): ?array
    {
        return $this->remember(self::PAGE_PREFIX.$this->normalize($identifier), $resolver);
    }

    public function rememberApi(string $identifier, Closure $resolver): ?array
    {
        return $this->remember(self::API_PREFIX.$this->normalize($identifier), $resolver);
    }

    public function forgetIdentifier(?string $identifier): void
    {
        if (blank($identifier)) {
            return;
        }

        $normalized = $this->normalize($identifier);

        Cache::forget(self::PAGE_PREFIX.$normalized);
        Cache::forget(self::API_PREFIX.$normalized);
    }

    public function forgetBox(Box $box): void
    {
        $this->forgetIdentifier($box->tracking_number);
        $this->forgetIdentifier($box->serial_number);

        $booking = $box->relationLoaded('booking')
            ? $box->booking
            : $box->booking()->withTrashed()->first();

        if ($booking) {
            $this->forgetIdentifier($booking->reference_number);
        }
    }

    public function forgetBooking(Booking $booking): void
    {
        $this->forgetIdentifier($booking->reference_number);

        $booking->boxes()
            ->withTrashed()
            ->get(['tracking_number', 'serial_number'])
            ->each(function (Box $box) {
                $this->forgetIdentifier($box->tracking_number);
                $this->forgetIdentifier($box->serial_number);
            });
    }

    public function forgetBatch(Batch $batch): void
    {
        $batch->boxes()
            ->with(['booking' => fn ($query) => $query->withTrashed()])
            ->get(['id', 'booking_id', 'tracking_number', 'serial_number'])
            ->each(fn (Box $box) => $this->forgetBox($box));
    }

    private function remember(string $key, Closure $resolver): ?array
    {
        $cached = Cache::get($key);

        if ($cached !== null) {
            return $cached;
        }

        $resolved = $resolver();

        if ($resolved !== null) {
            Cache::put($key, $resolved, self::TTL_SECONDS);
        }

        return $resolved;
    }

    private function normalize(string $identifier): string
    {
        return sha1(strtolower(trim($identifier)));
    }
}
