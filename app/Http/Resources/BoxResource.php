<?php

namespace App\Http\Resources;

use App\Models\Box;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * API Resource for Box serialization.
 *
 * This resource transforms Box models into JSON format for API responses.
 * It includes related data like recipient, box type, batch, and tracking updates.
 *
 * @see Box
 */
class BoxResource extends JsonResource
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
            'tracking_number' => $this->tracking_number,
            'serial_number' => $this->serial_number,
            'allocation_number' => $this->allocation_number,
            'status' => $this->status?->value,
            'destination' => $this->destination,
            'weight' => $this->weight,
            'actual_cbm' => $this->actual_cbm,
            'warehouse_location' => $this->warehouse_location,
            'courier_notes' => $this->courier_notes,
            'delivery_proof_path' => $this->delivery_proof_path,
            'pickup_proof_path' => $this->pickup_proof_path,
            'signature_path' => $this->signature_path,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),

            // Relationships
            'booking_id' => $this->booking_id,
            'recipient_id' => $this->recipient_id,
            'batch_id' => $this->batch_id,
            'box_type_id' => $this->box_type_id,

            // Eager loaded relationships
            'recipient' => $this->whenLoaded('recipient', fn () => new RecipientResource($this->recipient)),
            'boxType' => $this->whenLoaded('boxType', fn () => new BoxTypeResource($this->boxType)),
            'batch' => $this->whenLoaded('batch', fn () => new BatchResource($this->batch)),
            'updates' => $this->whenLoaded('updates', fn () => $this->updates->map(fn ($u) => [
                'status' => $u->status,
                'tracking_phase' => $u->tracking_phase,
                'location' => $u->location,
                'description' => $u->description,
                'created_at' => $u->created_at?->toISOString(),
            ])),
        ];
    }
}
