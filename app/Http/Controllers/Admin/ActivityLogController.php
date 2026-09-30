<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ActivityLogController extends Controller
{
    private const CATEGORIES = [
        'all' => 'All Activities',
        'logistics' => 'Logistics & Cargo',
        'financial' => 'Financial & Invoices',
        'security' => 'Security & Auth',
        'settings' => 'Settings & Rates',
        'user' => 'User & Accounts',
        'compliance' => 'Compliance & Exports',
        'communication' => 'Communication',
        'general' => 'General',
    ];

    public function index(Request $request)
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:50'],
            'action' => ['nullable', 'string', 'max:50'],
            'model_type' => ['nullable', 'string', 'max:100'],
            'user_id' => ['nullable', 'integer'],
            'request_id' => ['nullable', 'string', 'max:50'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        $query = ActivityLog::with(['user', 'impersonator'])
            ->latest('id');

        if (! empty($filters['search'])) {
            $query->search($filters['search']);
        }

        if (! empty($filters['request_id'])) {
            $query->requestId($filters['request_id']);
        }

        if (! empty($filters['category'])) {
            $query->category($filters['category']);
        }

        if (! empty($filters['action'])) {
            $query->action($filters['action']);
        }

        if (! empty($filters['model_type'])) {
            $query->modelType($filters['model_type']);
        }

        if (! empty($filters['user_id'])) {
            $query->userId($filters['user_id']);
        }

        if (! empty($filters['start_date']) || ! empty($filters['end_date'])) {
            $query->dateRange($filters['start_date'] ?? null, $filters['end_date'] ?? null);
        }

        $logs = $query->paginate(25)->withQueryString();

        // Calculate telemetry / metric cards
        $now = now();
        $stats = [
            'total_today' => ActivityLog::whereDate('created_at', $now->toDateString())->count(),
            'total_week' => ActivityLog::where('created_at', '>=', $now->copy()->subDays(7))->count(),
            'security_events_week' => ActivityLog::where('event_category', 'security')
                ->where('created_at', '>=', $now->copy()->subDays(7))
                ->count(),
            'financial_events_week' => ActivityLog::where('event_category', 'financial')
                ->where('created_at', '>=', $now->copy()->subDays(7))
                ->count(),
            'active_actors_today' => ActivityLog::whereDate('created_at', $now->toDateString())
                ->whereNotNull('user_id')
                ->distinct('user_id')
                ->count('user_id'),
        ];

        // Distinct available model types and actions for filter dropdowns
        $availableModelTypes = ActivityLog::select('model_type')
            ->distinct()
            ->whereNotNull('model_type')
            ->pluck('model_type')
            ->map(fn ($type) => [
                'value' => $type,
                'label' => class_basename($type),
            ])
            ->values();

        $availableActions = ActivityLog::select('action')
            ->distinct()
            ->whereNotNull('action')
            ->pluck('action')
            ->values();

        return Inertia::render('admin/activity-logs/index', [
            'logs' => $logs,
            'stats' => $stats,
            'filters' => [
                'search' => $filters['search'] ?? '',
                'category' => $filters['category'] ?? 'all',
                'action' => $filters['action'] ?? 'all',
                'model_type' => $filters['model_type'] ?? 'all',
                'user_id' => $filters['user_id'] ?? null,
                'request_id' => $filters['request_id'] ?? '',
                'start_date' => $filters['start_date'] ?? '',
                'end_date' => $filters['end_date'] ?? '',
            ],
            'categories' => self::CATEGORIES,
            'available_models' => $availableModelTypes,
            'available_actions' => $availableActions,
        ]);
    }

    public function show(ActivityLog $activityLog)
    {
        $activityLog->load(['user', 'impersonator']);

        return response()->json([
            'log' => $activityLog,
            'model_basename' => class_basename($activityLog->model_type),
        ]);
    }

    public function export(Request $request, AuditLogService $auditLogService): StreamedResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:50'],
            'action' => ['nullable', 'string', 'max:50'],
            'model_type' => ['nullable', 'string', 'max:100'],
            'user_id' => ['nullable', 'integer'],
            'request_id' => ['nullable', 'string', 'max:50'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        $query = ActivityLog::with(['user'])
            ->latest('id');

        if (! empty($filters['search'])) {
            $query->search($filters['search']);
        }
        if (! empty($filters['request_id'])) {
            $query->requestId($filters['request_id']);
        }
        if (! empty($filters['category'])) {
            $query->category($filters['category']);
        }
        if (! empty($filters['action'])) {
            $query->action($filters['action']);
        }
        if (! empty($filters['model_type'])) {
            $query->modelType($filters['model_type']);
        }
        if (! empty($filters['user_id'])) {
            $query->userId($filters['user_id']);
        }
        if (! empty($filters['start_date']) || ! empty($filters['end_date'])) {
            $query->dateRange($filters['start_date'] ?? null, $filters['end_date'] ?? null);
        }

        // Log this compliance export
        $auditLogService->logExportEvent('csv', 'Audit trails compliance report exported as CSV', [
            'filters' => $filters,
            'total_rows_estimated' => $query->count(),
        ]);

        $filename = 'audit-trail-export-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');

            // Add UTF-8 BOM for Excel compatibility
            fprintf($handle, chr(0xEF).chr(0xBB).chr(0xBF));

            // CSV Header
            fputcsv($handle, [
                'Log ID',
                'Timestamp (UTC)',
                'Actor Name',
                'Actor Email',
                'Actor Role',
                'Category',
                'Action',
                'Entity Type',
                'Entity ID',
                'Description',
                'IP Address',
                'Context',
                'User Agent',
                'Changes (JSON)',
            ]);

            $query->chunk(500, function ($logs) use ($handle) {
                foreach ($logs as $log) {
                    fputcsv($handle, [
                        $log->id,
                        $log->created_at?->toIso8601String(),
                        $log->user?->name ?? 'System',
                        $log->user?->email ?? 'N/A',
                        $log->user?->role ?? 'system',
                        $log->event_category,
                        $log->action,
                        class_basename($log->model_type),
                        $log->model_id,
                        $log->description,
                        $log->ip_address ?? 'N/A',
                        $log->context,
                        $log->user_agent ?? 'N/A',
                        $log->changes ? json_encode($log->changes, JSON_UNESCAPED_UNICODE) : '',
                    ]);
                }
            });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }
}
