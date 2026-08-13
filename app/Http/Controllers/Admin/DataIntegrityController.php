<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DataIntegrityWarning;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DataIntegrityController extends Controller
{
    private const CATEGORY_TYPES = [
        'pickup' => [
            'missed_pickup',
            'partial_pickup',
            'delayed_receipt',
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
        ],
        'delivery' => [
            'delivery_overdue',
            'partial_delivery',
            'delivery_proof_missing',
            'delivered_no_invoice',
        ],
        'payment' => [
            'unpaid_loading_block',
            'paid_no_payment_record',
            'payment_balance_mismatch',
            'paid_no_invoice',
        ],
        'data' => [
            'missing_declaration',
            'box_count_mismatch',
            'stale_scan',
            'booking_status_mismatch',
        ],
    ];

    public function index(Request $request)
    {
        $filters = $request->validate([
            'category' => ['nullable', 'string', 'in:pickup,warehouse,batch,delivery,payment,data'],
            'type' => ['nullable', 'string', 'max:100'],
            'severity' => ['nullable', 'in:low,medium,high'],
            'record_type' => ['nullable', 'string', 'max:255'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $categoryTypes = self::CATEGORY_TYPES[$filters['category'] ?? ''] ?? null;

        $warnings = DataIntegrityWarning::with('record')
            ->where('is_resolved', false)
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

        return Inertia::render('admin/DataIntegrity/Index', [
            'warnings' => $warnings,
            'filters' => [
                'category' => $filters['category'] ?? '',
                'type' => $filters['type'] ?? '',
                'severity' => $filters['severity'] ?? '',
                'record_type' => $filters['record_type'] ?? '',
                'q' => $filters['q'] ?? '',
            ],
            'filterOptions' => [
                'types' => DataIntegrityWarning::query()
                    ->where('is_resolved', false)
                    ->when($categoryTypes, fn ($query, $types) => $query->whereIn('type', $types))
                    ->distinct()
                    ->orderBy('type')
                    ->pluck('type')
                    ->values(),
                'severities' => ['high', 'medium', 'low'],
                'categories' => $this->categoryCounts(),
            ],
        ]);
    }

    public function scan()
    {
        \Illuminate\Support\Facades\Artisan::call('app:audit-data-integrity');

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
}
