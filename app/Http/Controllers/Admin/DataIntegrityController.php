<?php

namespace App\Http\Controllers\Admin;

use App\Events\SystemHealthUpdated;
use App\Http\Controllers\Controller;
use App\Models\DataIntegrityWarning;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DataIntegrityController extends Controller
{
    private const CATEGORY_TYPES = [
        'pickup' => [
            'missed_pickup',
            'partial_pickup',
            'delayed_receipt',
            'orphan_runsheet_stop',
        ],
        'warehouse' => [
            'orphan_box',
            'missing_warehouse_location',
            'overdue_loading',
            'held_box',
            'damaged_box',
            'unpaid_loading_block',
        ],
        'batch' => [
            'batch_capacity_overrun',
            'batch_status_blocked',
            'missed_eta',
            'port_dwell_overrun',
        ],
        'delivery' => [
            'delivery_overdue',
            'partial_delivery',
            'delivery_proof_missing',
            'delivered_no_invoice',
            'orphan_runsheet_stop',
        ],
        'payment' => [
            'unpaid_loading_block',
            'paid_no_payment_record',
            'payment_balance_mismatch',
            'paid_no_invoice',
            'payment_overcollection',
        ],
        'data' => [
            'missing_declaration',
            'box_count_mismatch',
            'stale_scan',
            'booking_status_mismatch',
        ],
        'security' => [
            'suspicious_file_upload',
            'privileged_user_without_2fa',
            'debug_mode_enabled',
        ],
    ];

    public function index(Request $request)
    {
        $filters = $request->validate([
            'category' => ['nullable', 'string', 'in:pickup,warehouse,batch,delivery,payment,data,security'],
            'type' => ['nullable', 'string', 'max:100'],
            'severity' => ['nullable', 'in:low,medium,high'],
            'record_type' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'in:unresolved,resolved,all'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $statusFilter = $filters['status'] ?? 'unresolved';
        $categoryTypes = self::CATEGORY_TYPES[$filters['category'] ?? ''] ?? null;

        $warnings = DataIntegrityWarning::with('record')
            ->when($statusFilter === 'unresolved', fn ($query) => $query->where('is_resolved', false))
            ->when($statusFilter === 'resolved', fn ($query) => $query->where('is_resolved', true))
            ->when($categoryTypes, fn ($query, $types) => $query->whereIn('type', $types))
            ->when($filters['type'] ?? null, fn ($query, $type) => $query->where('type', $type))
            ->when($filters['severity'] ?? null, fn ($query, $severity) => $query->where('severity', $severity))
            ->when($filters['record_type'] ?? null, fn ($query, $recordType) => $query->where('record_type', $recordType))
            ->when($filters['q'] ?? null, function ($query, $search) {
                $query->where(function ($nested) use ($search) {
                    $nested->where('message', 'like', "%{$search}%")
                        ->orWhere('record_id', $search);
                });
            })
            ->orderByRaw("case severity when 'high' then 3 when 'medium' then 2 else 1 end desc")
            ->latest()
            ->paginate(20)
            ->withQueryString();

        $severityCounts = $this->severityCounts();
        $healthScore = $this->calculateHealthScore($severityCounts);
        $telemetry = $this->collectSystemTelemetry();

        return Inertia::render('admin/DataIntegrity/Index', [
            'warnings' => $warnings,
            'filters' => [
                'category' => $filters['category'] ?? '',
                'type' => $filters['type'] ?? '',
                'severity' => $filters['severity'] ?? '',
                'record_type' => $filters['record_type'] ?? '',
                'status' => $statusFilter,
                'q' => $filters['q'] ?? '',
            ],
            'filterOptions' => [
                'types' => DataIntegrityWarning::query()
                    ->when($statusFilter === 'unresolved', fn ($query) => $query->where('is_resolved', false))
                    ->when($statusFilter === 'resolved', fn ($query) => $query->where('is_resolved', true))
                    ->when($categoryTypes, fn ($query, $types) => $query->whereIn('type', $types))
                    ->distinct()
                    ->orderBy('type')
                    ->pluck('type')
                    ->values(),
                'severities' => ['high', 'medium', 'low'],
                'categories' => $this->categoryCounts(),
                'resolvedCount' => DataIntegrityWarning::where('is_resolved', true)->count(),
            ],
            'metrics' => [
                'healthScore' => $healthScore,
                'severityCounts' => $severityCounts,
                'telemetry' => $telemetry,
            ],
        ]);
    }

    public function scan()
    {
        Artisan::call('app:audit-data-integrity');

        return back()->with('success', 'System health scan completed successfully.');
    }

    public function resolve(DataIntegrityWarning $warning)
    {
        $warning->update([
            'is_resolved' => true,
            'resolved_at' => now(),
        ]);

        return back()->with('success', 'Warning resolved successfully.');
    }

    public function resolveBatch(Request $request)
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:data_integrity_warnings,id'],
        ]);

        $count = DataIntegrityWarning::whereIn('id', $data['ids'])
            ->where('is_resolved', false)
            ->update([
                'is_resolved' => true,
                'resolved_at' => now(),
            ]);

        broadcast(new SystemHealthUpdated);

        return back()->with('success', "{$count} exception(s) marked as resolved.");
    }

    public function reopen(DataIntegrityWarning $warning)
    {
        $warning->update([
            'is_resolved' => false,
            'resolved_at' => null,
        ]);

        return back()->with('success', 'Warning reopened for review.');
    }

    private const TYPE_LABELS = [
        'missing_declaration' => 'Missing Customs Declaration',
        'missed_pickup' => 'Missed Pickup Window',
        'partial_pickup' => 'Partial Pickup',
        'orphan_box' => 'Orphan Box Record',
        'box_count_mismatch' => 'Box Count Mismatch',
        'stale_scan' => 'Stale Tracking Scan (>72h)',
        'delayed_receipt' => 'Delayed Warehouse Receipt',
        'missing_warehouse_location' => 'Missing Warehouse Bay',
        'overdue_loading' => 'Overdue Container Loading',
        'batch_capacity_overrun' => 'Batch Over Capacity',
        'batch_status_blocked' => 'Batch Status Blocked',
        'missed_eta' => 'Missed Vessel ETA',
        'held_box' => 'Held / Quarantine Box',
        'damaged_box' => 'Damaged Box Warning',
        'unpaid_loading_block' => 'Unpaid Staging Block',
        'delivery_overdue' => 'Delivery Overdue',
        'partial_delivery' => 'Partial Delivery',
        'delivery_proof_missing' => 'Missing Proof of Delivery',
        'paid_no_payment_record' => 'Paid Without Ledger Record',
        'payment_balance_mismatch' => 'Payment Balance Discrepancy',
        'delivered_no_invoice' => 'Delivered Without Invoice',
        'paid_no_invoice' => 'Paid Without Invoice',
        'booking_status_mismatch' => 'Booking Status Mismatch',
        'port_dwell_overrun' => 'Port Dwell Overrun (>7d)',
        'orphan_runsheet_stop' => 'Closed Runsheet Unacted Stops',
        'payment_overcollection' => 'Payment Overcollection Discrepancy',
        'suspicious_file_upload' => 'Suspicious File Upload Blocked',
        'privileged_user_without_2fa' => 'Privileged Account Missing Two-Factor Authentication',
        'debug_mode_enabled' => 'Production Debug Mode Enabled',
    ];

    private const CATEGORY_LABELS = [
        'pickup' => 'Pickup Ops',
        'warehouse' => 'Warehouse Hub',
        'batch' => 'Batch & Ocean',
        'delivery' => 'Final Mile',
        'payment' => 'Financial & Billing',
        'data' => 'Data Quality',
        'security' => 'Security Incidents',
    ];

    public function export(Request $request): StreamedResponse
    {
        $format = $request->query('format', 'csv');
        $statusFilter = $request->query('status', 'unresolved');
        $category = $request->query('category');
        $severity = $request->query('severity');
        $type = $request->query('type');
        $categoryTypes = self::CATEGORY_TYPES[$category ?? ''] ?? null;

        $warnings = DataIntegrityWarning::query()
            ->when($statusFilter === 'unresolved', fn ($query) => $query->where('is_resolved', false))
            ->when($statusFilter === 'resolved', fn ($query) => $query->where('is_resolved', true))
            ->when($categoryTypes, fn ($query, $types) => $query->whereIn('type', $types))
            ->when($type, fn ($query, $t) => $query->where('type', $t))
            ->when($severity, fn ($query, $s) => $query->where('severity', $s))
            ->orderByRaw("case severity when 'high' then 3 when 'medium' then 2 else 1 end desc")
            ->latest()
            ->get();

        $scopeLabel = ($statusFilter === 'resolved' ? 'Resolved Exceptions Archive' : 'Active Unresolved Exceptions');
        if ($category && isset(self::CATEGORY_LABELS[$category])) {
            $scopeLabel .= ' (Category: '.self::CATEGORY_LABELS[$category].')';
        } else {
            $scopeLabel .= ' (All Categories)';
        }

        $highCount = $warnings->where('severity', 'high')->count();
        $mediumCount = $warnings->where('severity', 'medium')->count();
        $lowCount = $warnings->where('severity', 'low')->count();
        $generatedAt = now()->format('Y-m-d H:i:s T');

        if ($format === 'excel' || $format === 'xls') {
            return $this->streamExcel($warnings, $scopeLabel, $highCount, $mediumCount, $lowCount, $generatedAt);
        }

        return $this->streamCsv($warnings, $scopeLabel, $highCount, $mediumCount, $lowCount, $generatedAt);
    }

    private function streamCsv($warnings, string $scopeLabel, int $highCount, int $mediumCount, int $lowCount, string $generatedAt): StreamedResponse
    {
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="system-health-audit-'.now()->format('Y-m-d-His').'.csv"',
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        return response()->stream(function () use ($warnings, $scopeLabel, $highCount, $mediumCount, $lowCount, $generatedAt) {
            $handle = fopen('php://output', 'w');

            // UTF-8 BOM for Microsoft Excel compatibility
            fprintf($handle, chr(0xEF).chr(0xBB).chr(0xBF));

            // Executive Summary Header Block
            fputcsv($handle, ['=== EAGLE CARGO - SYSTEM HEALTH & OPERATIONS AUDIT REPORT ===']);
            fputcsv($handle, ['Generated At:', $generatedAt]);
            fputcsv($handle, ['Export Scope:', $scopeLabel]);
            fputcsv($handle, ['Total Findings:', $warnings->count().' Exceptions']);
            fputcsv($handle, ['Severity Breakdown:', "High: {$highCount} | Medium: {$mediumCount} | Low: {$lowCount}"]);
            fputcsv($handle, []); // Blank separator row

            fputcsv($handle, [
                'ID',
                'Category',
                'Exception Type',
                'Severity',
                'Status',
                'Message',
                'Record Type',
                'Record ID',
                'Tracking Number',
                'Booking Reference',
                'Account / User',
                'Role',
                'Root Cause',
                'Recommended Action',
                'Detected At',
                'Resolved At',
            ]);

            foreach ($warnings as $w) {
                $recordType = $w->record_type ? class_basename($w->record_type) : '';
                $typeLabel = self::TYPE_LABELS[$w->type] ?? ucwords(str_replace('_', ' ', $w->type));
                $categoryLabel = $this->resolveCategory($w->type);
                $role = isset($w->metadata['role']) ? ucwords(str_replace('_', ' ', $w->metadata['role'])) : '';

                fputcsv($handle, [
                    $w->id,
                    $categoryLabel,
                    $typeLabel,
                    ucfirst($w->severity),
                    $w->is_resolved ? 'Resolved' : 'Active',
                    $w->message,
                    $recordType,
                    $w->record_id ?? '',
                    $w->metadata['tracking_number'] ?? '',
                    $w->metadata['booking_reference'] ?? '',
                    $w->metadata['user_email'] ?? '',
                    $role,
                    $w->metadata['severity_reason'] ?? '',
                    $w->metadata['recommended_action'] ?? '',
                    $w->created_at ? $w->created_at->format('Y-m-d H:i:s') : '',
                    $w->resolved_at ? $w->resolved_at->format('Y-m-d H:i:s') : '',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }

    private function streamExcel($warnings, string $scopeLabel, int $highCount, int $mediumCount, int $lowCount, string $generatedAt): StreamedResponse
    {
        $headers = [
            'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="system-health-audit-'.now()->format('Y-m-d-His').'.xls"',
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        return response()->stream(function () use ($warnings, $scopeLabel, $highCount, $mediumCount, $lowCount, $generatedAt) {
            $totalCount = $warnings->count();
            echo '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
            echo '<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">';
            echo '<style>
                body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; color: #1E293B; }
                table { border-collapse: collapse; width: 100%; }
                th { background-color: #7A2021; color: #FFFFFF; font-weight: bold; padding: 8px 10px; border: 1px solid #5A1617; font-size: 11px; text-align: left; }
                td { padding: 6px 10px; border: 1px solid #E2E8F0; vertical-align: top; }
                .report-title { background-color: #1E293B; color: #FFFFFF; font-size: 14px; font-weight: bold; padding: 12px 10px; }
                .summary-box { background-color: #F8FAFC; border: 1px solid #CBD5E1; padding: 8px 10px; }
                .summary-label { font-weight: bold; color: #475569; }
                .sev-high { background-color: #FEE2E2; color: #991B1B; font-weight: bold; text-align: center; }
                .sev-medium { background-color: #FEF3C7; color: #92400E; font-weight: bold; text-align: center; }
                .sev-low { background-color: #DBEAFE; color: #1E40AF; font-weight: bold; text-align: center; }
                .status-active { background-color: #FEF2F2; color: #B91C1C; font-weight: bold; text-align: center; }
                .status-resolved { background-color: #D1FAE5; color: #065F46; font-weight: bold; text-align: center; }
                .mono { font-family: "Consolas", "Courier New", monospace; font-size: 11px; }
                .zebra { background-color: #F9FAFB; }
            </style></head><body>';

            echo '<table>';
            // Report Header
            echo '<tr><td colspan="16" class="report-title">EAGLE CARGO &mdash; SYSTEM HEALTH & OPERATIONS AUDIT REPORT</td></tr>';
            echo '<tr><td colspan="4" class="summary-box"><span class="summary-label">Generated At:</span> '.htmlspecialchars($generatedAt).'</td>';
            echo '<td colspan="4" class="summary-box"><span class="summary-label">Scope:</span> '.htmlspecialchars($scopeLabel).'</td>';
            echo '<td colspan="4" class="summary-box"><span class="summary-label">Total Findings:</span> '.$totalCount.' Exceptions</td>';
            echo '<td colspan="4" class="summary-box"><span class="summary-label">Severity:</span> <span style="color:#991B1B;font-weight:bold;">High: '.$highCount.'</span> | <span style="color:#92400E;font-weight:bold;">Med: '.$mediumCount.'</span> | <span style="color:#1E40AF;font-weight:bold;">Low: '.$lowCount.'</span></td></tr>';
            echo '<tr><td colspan="16" style="height: 10px; border: none;"></td></tr>';

            // Table Headers
            echo '<tr>
                <th>ID</th>
                <th>Category</th>
                <th>Exception Type</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Message</th>
                <th>Record Type</th>
                <th>Record ID</th>
                <th>Tracking Number</th>
                <th>Booking Reference</th>
                <th>Account / User</th>
                <th>Role</th>
                <th>Root Cause</th>
                <th>Recommended Action</th>
                <th>Detected At</th>
                <th>Resolved At</th>
            </tr>';

            $index = 0;
            foreach ($warnings as $w) {
                $recordType = $w->record_type ? class_basename($w->record_type) : '';
                $typeLabel = self::TYPE_LABELS[$w->type] ?? ucwords(str_replace('_', ' ', $w->type));
                $categoryLabel = $this->resolveCategory($w->type);
                $role = isset($w->metadata['role']) ? ucwords(str_replace('_', ' ', $w->metadata['role'])) : '';
                $zebraClass = ($index % 2 === 1) ? 'zebra' : '';
                $sevClass = $w->severity === 'high' ? 'sev-high' : ($w->severity === 'medium' ? 'sev-medium' : 'sev-low');
                $statusClass = $w->is_resolved ? 'status-resolved' : 'status-active';

                echo '<tr class="'.$zebraClass.'">';
                echo '<td style="text-align: center;">'.$w->id.'</td>';
                echo '<td>'.htmlspecialchars($categoryLabel).'</td>';
                echo '<td><strong>'.htmlspecialchars($typeLabel).'</strong></td>';
                echo '<td class="'.$sevClass.'">'.ucfirst($w->severity).'</td>';
                echo '<td class="'.$statusClass.'">'.($w->is_resolved ? 'Resolved' : 'Active').'</td>';
                echo '<td>'.htmlspecialchars($w->message).'</td>';
                echo '<td>'.htmlspecialchars($recordType).'</td>';
                echo '<td style="text-align: center;">'.htmlspecialchars((string) ($w->record_id ?? '')).'</td>';
                echo '<td class="mono">'.htmlspecialchars($w->metadata['tracking_number'] ?? '').'</td>';
                echo '<td class="mono">'.htmlspecialchars($w->metadata['booking_reference'] ?? '').'</td>';
                echo '<td>'.htmlspecialchars($w->metadata['user_email'] ?? '').'</td>';
                echo '<td>'.htmlspecialchars($role).'</td>';
                echo '<td>'.htmlspecialchars($w->metadata['severity_reason'] ?? '').'</td>';
                echo '<td>'.htmlspecialchars($w->metadata['recommended_action'] ?? '').'</td>';
                echo '<td>'.($w->created_at ? $w->created_at->format('Y-m-d H:i:s') : '').'</td>';
                echo '<td>'.($w->resolved_at ? $w->resolved_at->format('Y-m-d H:i:s') : '').'</td>';
                echo '</tr>';

                $index++;
            }

            echo '</table></body></html>';
        }, 200, $headers);
    }

    private function resolveCategory(string $type): string
    {
        foreach (self::CATEGORY_TYPES as $category => $types) {
            if (in_array($type, $types, true)) {
                return self::CATEGORY_LABELS[$category] ?? ucfirst($category);
            }
        }

        return 'General Operations';
    }

    private function categoryCounts(): array
    {
        $counts = [
            'all' => DataIntegrityWarning::where('is_resolved', false)->count(),
        ];

        foreach (self::CATEGORY_TYPES as $category => $types) {
            $counts[$category] = DataIntegrityWarning::where('is_resolved', false)
                ->whereIn('type', $types)
                ->count();
        }

        return $counts;
    }

    private function severityCounts(): array
    {
        return [
            'high' => DataIntegrityWarning::where('is_resolved', false)->where('severity', 'high')->count(),
            'medium' => DataIntegrityWarning::where('is_resolved', false)->where('severity', 'medium')->count(),
            'low' => DataIntegrityWarning::where('is_resolved', false)->where('severity', 'low')->count(),
            'resolvedToday' => DataIntegrityWarning::where('is_resolved', true)->where('resolved_at', '>=', now()->startOfDay())->count(),
            'totalResolved' => DataIntegrityWarning::where('is_resolved', true)->count(),
            'totalActive' => DataIntegrityWarning::where('is_resolved', false)->count(),
        ];
    }

    private function calculateHealthScore(array $severityCounts): int
    {
        $totalActive = $severityCounts['totalActive'] ?? 0;
        if ($totalActive === 0) {
            return 100;
        }

        $high = $severityCounts['high'] ?? 0;
        $medium = $severityCounts['medium'] ?? 0;
        $low = $severityCounts['low'] ?? 0;

        $penalty = ($high * 15) + ($medium * 5) + ($low * 1.5);
        $score = 100 - (int) round($penalty);

        return max(15, min(100, $score));
    }

    private function collectSystemTelemetry(): array
    {
        // 1. Database check
        $dbStatus = 'healthy';
        $dbLatency = 0;
        try {
            $start = microtime(true);
            DB::select('SELECT 1');
            $dbLatency = round((microtime(true) - $start) * 1000, 2);
        } catch (\Throwable $e) {
            $dbStatus = 'down';
        }

        // 2. Queue / Failed Jobs check
        $queueStatus = 'healthy';
        $failedJobsCount = 0;
        try {
            if (Schema::hasTable('failed_jobs')) {
                $failedJobsCount = DB::table('failed_jobs')->count();
                if ($failedJobsCount > 0) {
                    $queueStatus = 'warning';
                }
            }
        } catch (\Throwable $e) {
            $queueStatus = 'unknown';
        }

        // 3. Cache check
        $cacheStatus = 'healthy';
        try {
            $testKey = 'system_health_probe_'.now()->timestamp;
            Cache::put($testKey, true, 5);
            $cacheCheck = Cache::get($testKey);
            Cache::forget($testKey);
            if (! $cacheCheck) {
                $cacheStatus = 'degraded';
            }
        } catch (\Throwable $e) {
            $cacheStatus = 'down';
        }

        // 4. Storage check
        $storageStatus = 'healthy';
        $storageWritable = is_writable(storage_path());
        if (! $storageWritable) {
            $storageStatus = 'warning';
        }

        // 5. Last scan time
        $lastScan = DataIntegrityWarning::latest('created_at')->value('created_at');

        // 6. Security incident summary
        $securityWarnings = DataIntegrityWarning::query()
            ->whereIn('type', self::CATEGORY_TYPES['security'])
            ->where('is_resolved', false);
        $activeSecurityIncidents = (clone $securityWarnings)->count();
        $criticalSecurityIncidents = (clone $securityWarnings)->where('severity', 'high')->count();
        $lastSecurityIncident = (clone $securityWarnings)->latest('created_at')->value('created_at');
        $blockedUploadsLast24Hours = DataIntegrityWarning::query()
            ->where('type', 'suspicious_file_upload')
            ->where('created_at', '>=', now()->subDay())
            ->count();
        $privilegedAccountsWithoutTwoFactor = User::query()
            ->whereIn('role', ['admin', 'super_admin'])
            ->whereNull('two_factor_confirmed_at')
            ->count();

        return [
            'database' => [
                'status' => $dbStatus,
                'latency_ms' => $dbLatency,
                'connection' => config('database.default'),
            ],
            'queue' => [
                'status' => $queueStatus,
                'failed_jobs' => $failedJobsCount,
                'driver' => config('queue.default'),
            ],
            'cache' => [
                'status' => $cacheStatus,
                'driver' => config('cache.default'),
            ],
            'storage' => [
                'status' => $storageStatus,
                'writable' => $storageWritable,
                'driver' => config('filesystems.default'),
            ],
            'environment' => [
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'env' => app()->environment(),
                'debug' => config('app.debug'),
                'last_scan_at' => $lastScan?->toISOString(),
            ],
            'security' => [
                'status' => $criticalSecurityIncidents > 0
                    ? 'critical'
                    : ($activeSecurityIncidents > 0 || $privilegedAccountsWithoutTwoFactor > 0 ? 'warning' : 'healthy'),
                'active_incidents' => $activeSecurityIncidents,
                'critical_incidents' => $criticalSecurityIncidents,
                'blocked_uploads_last_24_hours' => $blockedUploadsLast24Hours,
                'privileged_accounts_without_2fa' => $privilegedAccountsWithoutTwoFactor,
                'last_incident_at' => $lastSecurityIncident?->toISOString(),
            ],
        ];
    }
}
