<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Box;
use App\Models\TrackingLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TrackingAnalyticsService
{
    /**
     * Rate limit / deduplication window in minutes for the same IP and query.
     */
    private const DEDUPLICATION_MINUTES = 5;

    /**
     * Record a tracking lookup from a raw search query (Box tracking number or Booking reference number).
     */
    public function recordLookup(string $searchQuery, Request $request, string $source = 'web'): void
    {
        $trimmedQuery = trim($searchQuery);
        if (empty($trimmedQuery)) {
            return;
        }

        // 1. Try finding Box by tracking_number
        $box = Box::where('tracking_number', $trimmedQuery)->first();
        if ($box) {
            $this->recordBoxTrack($box, $trimmedQuery, $request, $source);
            return;
        }

        // 2. Try finding Booking by reference_number
        $booking = Booking::where('reference_number', $trimmedQuery)->first();
        if ($booking) {
            $this->recordBookingTrack($booking, $trimmedQuery, $request, $source);
        }
    }

    /**
     * Record a tracking lookup for a Box (and its parent Booking).
     */
    public function recordBoxTrack(Box $box, string $searchQuery, Request $request, string $source = 'web'): void
    {
        try {
            $ipAddress = $request->ip();
            $userAgent = substr($request->userAgent() ?? '', 0, 500);

            // Check if this box was recently tracked by this IP within the deduplication window
            $recentLogExists = TrackingLog::where('trackable_type', Box::class)
                ->where('trackable_id', $box->id)
                ->where('ip_address', $ipAddress)
                ->where('created_at', '>=', Carbon::now()->subMinutes(self::DEDUPLICATION_MINUTES))
                ->exists();

            DB::transaction(function () use ($box, $searchQuery, $ipAddress, $userAgent, $source, $recentLogExists) {
                // Record detailed log entry
                TrackingLog::create([
                    'trackable_type' => Box::class,
                    'trackable_id' => $box->id,
                    'search_query' => $searchQuery,
                    'ip_address' => $ipAddress,
                    'user_agent' => $userAgent,
                    'source' => $source,
                ]);



                // Also track parent booking if present
                if ($box->booking_id) {
                    $booking = $box->booking ?: Booking::find($box->booking_id);
                    if ($booking) {

                    }
                }
            });
        } catch (\Throwable $e) {
            Log::error('Failed to record box tracking analytics: ' . $e->getMessage(), [
                'box_id' => $box->id,
                'search_query' => $searchQuery,
            ]);
        }
    }

    /**
     * Record a tracking lookup for a Booking (and its associated boxes).
     */
    public function recordBookingTrack(Booking $booking, string $searchQuery, Request $request, string $source = 'web'): void
    {
        try {
            $ipAddress = $request->ip();
            $userAgent = substr($request->userAgent() ?? '', 0, 500);

            $recentLogExists = TrackingLog::where('trackable_type', Booking::class)
                ->where('trackable_id', $booking->id)
                ->where('ip_address', $ipAddress)
                ->where('created_at', '>=', Carbon::now()->subMinutes(self::DEDUPLICATION_MINUTES))
                ->exists();

            DB::transaction(function () use ($booking, $searchQuery, $ipAddress, $userAgent, $source, $recentLogExists) {
                TrackingLog::create([
                    'trackable_type' => Booking::class,
                    'trackable_id' => $booking->id,
                    'search_query' => $searchQuery,
                    'ip_address' => $ipAddress,
                    'user_agent' => $userAgent,
                    'source' => $source,
                ]);



                // Also record for all associated boxes
                $boxes = $booking->boxes;

            });
        } catch (\Throwable $e) {
            Log::error('Failed to record booking tracking analytics: ' . $e->getMessage(), [
                'booking_id' => $booking->id,
                'search_query' => $searchQuery,
            ]);
        }
    }

    /**
     * Get detailed tracking analytics for a searched query (admin only).
     */
    public function getAnalyticsForQuery(string $searchQuery): ?array
    {
        $trimmedQuery = trim($searchQuery);
        if (empty($trimmedQuery)) {
            return null;
        }

        $box = Box::where('tracking_number', $trimmedQuery)->first();
        if ($box) {
            $logs = TrackingLog::where('trackable_type', Box::class)
                ->where('trackable_id', $box->id)
                ->latest()
                ->take(10)
                ->get();

            return [
                'type' => 'box',
                'query' => $box->tracking_number,
                'tracking_views_count' => TrackingLog::where('trackable_type', Box::class)->where('trackable_id', $box->id)->count(),
                'last_tracked_at' => TrackingLog::where('trackable_type', Box::class)->where('trackable_id', $box->id)->latest()->first()?->created_at?->toIso8601String(),
                'logs' => $logs->map(fn ($log) => [
                    'id' => $log->id,
                    'search_query' => $log->search_query,
                    'ip_address' => $log->ip_address,
                    'source' => $log->source,
                    'created_at' => $log->created_at->toIso8601String(),
                ])->values()->toArray(),
            ];
        }

        $booking = Booking::where('reference_number', $trimmedQuery)->first();
        if ($booking) {
            $logs = TrackingLog::where('trackable_type', Booking::class)
                ->where('trackable_id', $booking->id)
                ->latest()
                ->take(10)
                ->get();

            return [
                'type' => 'booking',
                'query' => $booking->reference_number,
                'tracking_views_count' => TrackingLog::where('trackable_type', Booking::class)->where('trackable_id', $booking->id)->count(),
                'last_tracked_at' => TrackingLog::where('trackable_type', Booking::class)->where('trackable_id', $booking->id)->latest()->first()?->created_at?->toIso8601String(),
                'logs' => $logs->map(fn ($log) => [
                    'id' => $log->id,
                    'search_query' => $log->search_query,
                    'ip_address' => $log->ip_address,
                    'source' => $log->source,
                    'created_at' => $log->created_at->toIso8601String(),
                ])->values()->toArray(),
            ];
        }

        return null;
    }

    /**
     * Get overall system-wide tracking lookup statistics for admin summary.
     */
    public function getOverallAnalytics(): array
    {
        return [
            'total_lookups_today' => TrackingLog::whereDate('created_at', Carbon::today())->count(),
            'total_lookups_all_time' => TrackingLog::count(),
        ];
    }
}
