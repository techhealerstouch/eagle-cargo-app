<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Box;
use App\Models\Booking;
use App\Models\TrackingLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class TrackingAnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'search' => 'nullable|string|max:255',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'source' => 'nullable|string|in:web,api',
        ]);

        $search = $request->input('search');
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $source = $request->input('source');

        // Overall stats
        $stats = [
            'total_lookups_today' => TrackingLog::whereDate('created_at', Carbon::today())->count(),
            'total_lookups_all_time' => TrackingLog::count(),
            'unique_ips_today' => TrackingLog::whereDate('created_at', Carbon::today())
                ->distinct('ip_address')->count('ip_address'),
            'top_searched_boxes' => TrackingLog::where('trackable_type', Box::class)
                ->select('trackable_id', DB::raw('COUNT(*) as search_count'))
                ->groupBy('trackable_id')
                ->orderByDesc('search_count')
                ->take(5)
                ->get()
                ->map(function ($row) {
                    $box = Box::find($row->trackable_id);
                    return [
                        'id' => $row->trackable_id,
                        'tracking_number' => $box?->tracking_number ?? 'Deleted',
                        'search_count' => $row->search_count,
                    ];
                }),
            'top_searched_bookings' => TrackingLog::where('trackable_type', Booking::class)
                ->select('trackable_id', DB::raw('COUNT(*) as search_count'))
                ->groupBy('trackable_id')
                ->orderByDesc('search_count')
                ->take(5)
                ->get()
                ->map(function ($row) {
                    $booking = Booking::find($row->trackable_id);
                    return [
                        'id' => $row->trackable_id,
                        'reference_number' => $booking?->reference_number ?? 'Deleted',
                        'search_count' => $row->search_count,
                    ];
                }),
        ];

        // Build filterable logs query
        $logsQuery = TrackingLog::latest();

        if ($search) {
            $logsQuery->where('search_query', 'like', "%{$search}%");
        }

        if ($dateFrom) {
            $logsQuery->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo) {
            $logsQuery->whereDate('created_at', '<=', $dateTo);
        }

        if ($source) {
            $logsQuery->where('source', $source);
        }

        $logs = $logsQuery->paginate(25)->through(fn ($log) => [
            'id' => $log->id,
            'search_query' => $log->search_query,
            'trackable_type' => class_basename($log->trackable_type),
            'trackable_id' => $log->trackable_id,
            'ip_address' => $log->ip_address,
            'source' => $log->source,
            'created_at' => $log->created_at->toIso8601String(),
        ]);

        return Inertia::render('admin/tracking-analytics/index', [
            'stats' => $stats,
            'logs' => $logs,
            'filters' => [
                'search' => $search,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'source' => $source,
            ],
        ]);
    }
}
