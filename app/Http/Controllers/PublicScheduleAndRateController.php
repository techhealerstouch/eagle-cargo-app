<?php

namespace App\Http\Controllers;

use App\Enums\BatchStatus;
use App\Models\Batch;
use App\Services\ReferenceDataService;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class PublicScheduleAndRateController extends Controller
{
    public const UPCOMING_BATCHES_CACHE_KEY = 'public.upcoming_batches.v1';

    public function __construct(
        private readonly ReferenceDataService $referenceData,
    ) {}

    public function welcome(): Response
    {
        return Inertia::render('welcome', $this->getPublicData());
    }

    public function services(): Response
    {
        return Inertia::render('marketing/services', $this->getPublicData());
    }

    public static function forgetUpcomingBatchesCache(): void
    {
        Cache::forget(self::UPCOMING_BATCHES_CACHE_KEY);
    }

    private function getPublicData(): array
    {
        $upcomingBatches = Cache::remember(self::UPCOMING_BATCHES_CACHE_KEY, 300, function () {
            return Batch::query()
                ->where(function ($query) {
                    $query->whereIn('status', [
                        BatchStatus::Open->value,
                        BatchStatus::Loading->value,
                        BatchStatus::ReadyToClose->value,
                        BatchStatus::Sailed->value,
                    ])
                    ->orWhere(function ($sub) {
                        $sub->whereNotNull('cutoff_at')
                            ->where('cutoff_at', '>=', now()->subDays(3));
                    });
                })
                ->orderByRaw('cutoff_at IS NULL, cutoff_at ASC')
                ->orderBy('created_at', 'desc')
                ->limit(4)
                ->get([
                    'id',
                    'batch_number',
                    'branch_name',
                    'container_number',
                    'container_size',
                    'vessel_name',
                    'shipping_line',
                    'voyage_number',
                    'cutoff_at',
                    'sailed_at',
                    'departed_at',
                    'eta_at',
                    'status',
                    'capacity_boxes',
                    'current_box_count',
                ])
                ->map(function ($batch) {
                    /** @var Batch $batch */
                    return [
                        'id' => $batch->id,
                        'batch_number' => $batch->batch_number,
                        'branch_name' => $batch->branch_name,
                        'container_number' => $batch->container_number,
                        'container_size' => $batch->container_size,
                        'vessel_name' => $batch->vessel_name,
                        'shipping_line' => $batch->shipping_line,
                        'voyage_number' => $batch->voyage_number,
                        'cutoff_at' => $batch->cutoff_at?->toISOString(),
                        'sailed_at' => $batch->sailed_at?->toISOString(),
                        'departed_at' => $batch->departed_at?->toISOString(),
                        'eta_at' => $batch->eta_at?->toISOString(),
                        'status' => $batch->status instanceof BatchStatus ? $batch->status->value : (string) $batch->status,
                        'capacity_boxes' => $batch->capacity_boxes,
                        'current_box_count' => $batch->current_box_count,
                    ];
                })
                ->values()
                ->toArray();
        });

        return [
            'areas' => $this->referenceData->activeAreas(),
            'provinces' => $this->referenceData->activeProvinces(),
            'boxTypes' => $this->referenceData->activeBoxTypes(),
            'boxPrices' => $this->referenceData->boxPrices(),
            'pickupZones' => $this->referenceData->activePickupZones(),
            'suburbs' => $this->referenceData->activeSuburbs(),
            'upcomingBatches' => $upcomingBatches,
        ];
    }
}
