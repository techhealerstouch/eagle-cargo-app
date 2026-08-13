<?php

namespace App\Http\Resources;

use App\Models\Batch;
use Illuminate\Http\Request;
use Illuminate\Http\resources\Json\JsonResource;

/**
 * API Resource for Batch serialization.
 *
 * This resource transforms Batch models into JSON format for API responses.
 * It includes capacity metrics and relationship data.
 *
 * @see Batch
 */
class BatchResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<int|string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'batch_number' => $this->batch_number,
            'branch_name' => $this->branch_name,
            'container_number' => $this->container_number,
            'seal_number' => $this->seal_number,
            'container_size' => $this->container_size,
            'vessel_name' => $this->vessel_name,
            'shipping_line' => $this->shipping_line,
            'voyage_number' => $this->voyage_number,
            'origin_port' => $this->origin_port,
            'destination_port' => $this->destination_port,

            // Capacity
            'capacity_boxes' => $this->capacity_boxes,
            'capacity_weight_kg' => $this->capacity_weight_kg,
            'capacity_cbm' => $this->capacity_cbm,

            // Current metrics
            'current_box_count' => $this->current_box_count,
            'current_weight_kg' => $this->current_weight_kg,
            'current_cbm' => $this->current_cbm,

            // Timestamps
            'cutoff_at' => $this->cutoff_at?->toISOString(),
            'closed_at' => $this->closed_at?->toISOString(),
            'sailed_at' => $this->sailed_at?->toISOString(),
            'departed_at' => $this->departed_at?->toISOString(),
            'eta_at' => $this->eta_at?->toISOString(),
            'arrived_at' => $this->arrived_at?->toISOString(),
            'delivered_at' => $this->delivered_at?->toISOString(),

            'status' => $this->status?->value,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),

            // Relationships
            'boxes' => $this->whenLoaded('boxes', fn () => BoxResource::collection($this->boxes)),
        ];
    }
}
