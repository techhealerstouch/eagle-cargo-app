<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\ShippingUpdate;
use App\Observers\ShippingUpdateObserver;
use App\Services\TrackingAnalyticsService;
use App\Services\TrackingCacheService;
use App\Services\TrackingStepService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class TrackingController extends Controller
{
    public function __construct(
        private readonly TrackingCacheService $trackingCache,
        private readonly TrackingAnalyticsService $analyticsService,
    ) {}

    /**
     * Track a box by its tracking number.
     */
    public function track(Request $request, string $trackingNumber): JsonResponse
    {
        $data = $this->trackingCache->rememberApi($trackingNumber, function () use ($trackingNumber): ?array {
            $box = Box::with(['updates', 'recipient', 'boxType', 'batch'])
                ->where('tracking_number', $trackingNumber)
                ->first();

            if (! $box) {
                return null;
            }

            return [
                'tracking_number' => $box->tracking_number,
                'status' => $box->status,
                'destination' => $box->destination,
                'box_type' => $box->boxType?->name,
                'weight' => $box->weight,
                'batch' => $box->batch ? [
                    'batch_number' => $box->batch->batch_number,
                    'container_number' => $box->batch->container_number,
                    'vessel' => $box->batch->vessel_name,
                    'status' => $box->batch->status,
                    'voyage_number' => $box->batch->voyage_number,
                    'shipping_line' => $box->batch->shipping_line,
                    'origin_port' => $box->batch->origin_port,
                    'destination_port' => $box->batch->destination_port,
                    'branch_code' => $box->batch->branch_name,
                    'eta' => $box->batch->eta_at?->toISOString(),
                ] : null,
                'updates' => $this->formatPublicApiUpdates($box),
            ];
        });

        if (! $data) {
            return response()->json([
                'success' => false,
                'message' => 'No box found with that tracking number.',
            ], 404);
        }

        $this->analyticsService->recordLookup($trackingNumber, $request, 'api');

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Get published shipping updates.
     */
    public function shippingUpdates(): JsonResponse
    {
        $updates = Cache::remember(
            ShippingUpdateObserver::PUBLISHED_CACHE_KEY,
            now()->addMinutes(10),
            fn () => ShippingUpdate::where('is_published', true)
                ->latest('published_at')
                ->take(20)
                ->get()
                ->map(fn ($u) => [
                    'type' => $u->type,
                    'title' => $u->title,
                    'body' => $u->body,
                    'published_at' => $u->published_at?->toISOString(),
                ])
                ->all()
        );

        return response()->json([
            'success' => true,
            'data' => $updates,
        ]);
    }

    private function formatPublicApiUpdates(Box $box): array
    {
        $stepService = app(TrackingStepService::class);
        $activeOrder = $box->tracking_step_key ? $stepService->getStepOrder($box->tracking_step_key) : null;

        return $box->updates
            ->reject(function (BoxUpdate $u) use ($stepService, $activeOrder): bool {
                $description = trim((string) ($u->description ?? ''));
                if (preg_match('/^admin\s+correction\s*:/i', $description)) {
                    return true;
                }

                if ($activeOrder !== null) {
                    $updateOrder = $stepService->resolveUpdateStepOrder($u);

                    if ($updateOrder !== null && $updateOrder > $activeOrder) {
                        return true;
                    }
                }

                return false;
            })
            ->values()
            ->map(fn (BoxUpdate $u) => [
                'status' => $u->status,
                'location' => $u->location,
                'description' => trim((string) preg_replace('/\R*Admin proof override\s*:.*$/is', '', (string) ($u->description ?? ''))),
                'date' => $u->created_at->toISOString(),
            ])
            ->all();
    }
}
