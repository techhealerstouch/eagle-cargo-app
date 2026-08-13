<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ScopesApiAccess;
use App\Http\Controllers\Controller;
use App\Http\Resources\BoxResource;
use App\Models\Box;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * API Controller for Box operations.
 *
 * @see Box
 */
class BoxController extends Controller
{
    use ScopesApiAccess;

    /**
     * List boxes with optional filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $boxes = $this->scopeBoxesForUser(
            Box::query()->with(['recipient', 'boxType', 'batch']),
            $request->user()
        )
            ->when($request->has('status'), fn ($query) => $query->where('status', $request->status))
            ->when($request->has('batch_id'), fn ($query) => $query->where('batch_id', $request->batch_id))
            ->when($request->has('booking_id'), fn ($query) => $query->where('booking_id', $request->booking_id))
            ->orderByDesc('created_at')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => BoxResource::collection($boxes),
            'meta' => [
                'current_page' => $boxes->currentPage(),
                'last_page' => $boxes->lastPage(),
                'per_page' => $boxes->perPage(),
                'total' => $boxes->total(),
            ],
        ]);
    }

    /**
     * Get a single box by tracking number.
     */
    public function show(Request $request, string $trackingNumber): JsonResponse
    {
        $box = $this->scopeBoxesForUser(
            Box::query()->with(['recipient', 'boxType', 'batch', 'updates', 'booking']),
            $request->user()
        )
            ->where('tracking_number', $trackingNumber)
            ->first();

        if (! $box) {
            return response()->json([
                'success' => false,
                'message' => 'Box not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => new BoxResource($box),
        ]);
    }

    /**
     * Update box status or details.
     */
    public function update(Request $request, string $trackingNumber): JsonResponse
    {
        $box = $this->scopeBoxesForUser(Box::query(), $request->user())
            ->where('tracking_number', $trackingNumber)
            ->first();

        if (! $box) {
            return response()->json([
                'success' => false,
                'message' => 'Box not found.',
            ], 404);
        }

        $validated = $request->validate([
            'courier_notes' => 'nullable|string|max:500',
            'weight' => 'nullable|numeric|min:0',
            'actual_cbm' => 'nullable|numeric|min:0',
        ]);

        if (! $this->canUpdateBoxViaApi($request->user(), $box, array_keys($validated))) {
            abort(403, 'Unauthorized action.');
        }

        $box->update($validated);

        return response()->json([
            'success' => true,
            'data' => new BoxResource($box->fresh()),
        ]);
    }

    /**
     * Bulk sync offline scans.
     */
    public function bulkSync(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'scans' => 'required|array',
            'scans.*.client_uuid' => 'required|string|max:255',
            'scans.*.tracking_number' => 'required|string',
            'scans.*.status' => 'required|string',
            'scans.*.scanned_at' => 'required|date',
            'scans.*.notes' => 'nullable|string',
            'scans.*.location' => 'nullable|string',
            'scans.*.tracking_step_key' => 'nullable|string',
        ]);

        $scans = collect($validated['scans'])->sortBy('scanned_at')->values();

        $processed = 0;
        $skipped = 0;
        $errors = [];

        foreach ($scans as $scan) {
            // Check idempotency
            if (\App\Models\BoxUpdate::where('client_uuid', $scan['client_uuid'])->exists()) {
                $skipped++;
                continue;
            }

            // Lock box for update to avoid race conditions
            $box = $this->scopeBoxesForUser(Box::query(), $request->user())
                ->where('tracking_number', $scan['tracking_number'])
                ->lockForUpdate()
                ->first();

            if (! $box) {
                $errors[] = ['client_uuid' => $scan['client_uuid'], 'message' => 'Box not found or unauthorized.'];
                continue;
            }

            // Determine tracking phase
            $statusEnum = \App\Enums\BoxStatus::tryFrom($scan['status']);
            $trackingPhase = null;
            if ($statusEnum) {
                $trackingPhase = match ($statusEnum) {
                    \App\Enums\BoxStatus::Collected => \App\Enums\TrackingPhase::PICKED_UP->value,
                    \App\Enums\BoxStatus::ReceivedByWarehouse => \App\Enums\TrackingPhase::RECEIVED_BY_WAREHOUSE->value,
                    \App\Enums\BoxStatus::LoadedToContainer => \App\Enums\TrackingPhase::LOADING_CONTAINER->value,
                    \App\Enums\BoxStatus::InTransit => \App\Enums\TrackingPhase::IN_TRANSIT_SEA->value,
                    \App\Enums\BoxStatus::Arrived => \App\Enums\TrackingPhase::ARRIVED_MANILA_PORT->value,
                    \App\Enums\BoxStatus::ForCheckingUnloading, \App\Enums\BoxStatus::UnloadedManila => \App\Enums\TrackingPhase::RECEIVED_MANILA_WAREHOUSE->value,
                    \App\Enums\BoxStatus::ForDeliveryScheduling, \App\Enums\BoxStatus::EnRouteRoRo => \App\Enums\TrackingPhase::DISPATCHED_TO_LOCAL_HUB->value,
                    \App\Enums\BoxStatus::OutForDelivery => \App\Enums\TrackingPhase::OUT_FOR_DELIVERY->value,
                    \App\Enums\BoxStatus::Delivered => \App\Enums\TrackingPhase::DELIVERED->value,
                    default => null,
                };
            }

            \App\Models\BoxUpdate::create([
                'client_uuid' => $scan['client_uuid'],
                'box_id' => $box->id,
                'status' => $scan['status'],
                'tracking_step_key' => $scan['tracking_step_key'] ?? null,
                'location' => $scan['location'] ?? 'In-Transit',
                'description' => $scan['notes'] ?? 'Status updated from offline sync.',
                'tracking_phase' => $trackingPhase,
                'updated_by' => $request->user()->id,
                'created_at' => $scan['scanned_at'],
            ]);

            // Check if this newly inserted scan is the latest one
            $latestUpdate = \App\Models\BoxUpdate::where('box_id', $box->id)
                ->orderByDesc('created_at')
                ->first();

            // If the latest update is our newly inserted scan, update the box's current status
            if ($latestUpdate && $latestUpdate->client_uuid === $scan['client_uuid']) {
                $box->bypassStatusValidation = true;
                $box->update([
                    'status' => $scan['status'],
                ]);
            }

            $processed++;
        }

        return response()->json([
            'success' => true,
            'message' => 'Sync completed',
            'data' => [
                'processed' => $processed,
                'skipped' => $skipped,
                'errors' => $errors,
            ],
        ]);
    }
}
