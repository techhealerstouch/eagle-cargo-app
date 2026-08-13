<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ScopesApiAccess;
use App\Http\Controllers\Controller;
use App\Http\Resources\BatchResource;
use App\Models\Batch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * API Controller for Batch (container) operations.
 *
 * @see Batch
 */
class BatchController extends Controller
{
    use ScopesApiAccess;

    /**
     * List batches with optional filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $batches = $this->scopeBatchesForUser(
            Batch::query()->with(['boxes' => fn ($query) => $this->scopeBoxesForUser($query, $request->user())]),
            $request->user()
        )
            ->when($request->has('status'), fn ($query) => $query->where('status', $request->status))
            ->when($request->has('destination_port'), fn ($query) => $query->where('destination_port', $request->destination_port))
            ->orderByDesc('created_at')
            ->paginate($request->input('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => BatchResource::collection($batches),
            'meta' => [
                'current_page' => $batches->currentPage(),
                'last_page' => $batches->lastPage(),
                'per_page' => $batches->perPage(),
                'total' => $batches->total(),
            ],
        ]);
    }

    /**
     * Get a single batch by ID or batch number.
     */
    public function show(Request $request, string $identifier): JsonResponse
    {
        $batch = $this->scopeBatchesForUser(
            Batch::query()->with(['boxes' => fn ($query) => $this->scopeBoxesForUser(
                $query->with(['recipient', 'boxType']),
                $request->user()
            )]),
            $request->user()
        )
            ->where(fn ($query) => $query
                ->where('id', $identifier)
                ->orWhere('batch_number', $identifier))
            ->first();

        if (! $batch) {
            return response()->json([
                'success' => false,
                'message' => 'Batch not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => new BatchResource($batch),
        ]);
    }

    /**
     * Get boxes in a batch.
     */
    public function boxes(Request $request, string $identifier): JsonResponse
    {
        $batch = $this->scopeBatchesForUser(Batch::query(), $request->user())
            ->where(fn ($query) => $query
                ->where('id', $identifier)
                ->orWhere('batch_number', $identifier))
            ->first();

        if (! $batch) {
            return response()->json([
                'success' => false,
                'message' => 'Batch not found.',
            ], 404);
        }

        $boxesQuery = $batch->boxes()->with(['recipient', 'boxType']);
        $this->scopeBoxesForUser($boxesQuery, $request->user());
        $boxes = $boxesQuery->get();

        return response()->json([
            'success' => true,
            'data' => $boxes->map(fn ($box) => [
                'id' => $box->id,
                'tracking_number' => $box->tracking_number,
                'status' => $box->status?->value,
                'destination' => $box->destination,
                'weight' => $box->weight,
                'recipient' => $box->recipient ? [
                    'name' => $box->recipient->name,
                    'city' => $box->recipient->city,
                    'province' => $box->recipient->province,
                ] : null,
                'box_type' => $box->boxType ? [
                    'name' => $box->boxType->name,
                ] : null,
            ]),
        ]);
    }
}
