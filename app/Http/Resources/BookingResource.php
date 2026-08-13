<?php

namespace App\Http\Resources;

use App\Models\Booking;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * API Resource for Booking serialization.
 *
 * @see Booking
 */
class BookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference_number' => $this->reference_number,
            'service_type' => $this->service_type,
            'status' => $this->status?->value,
            'payment_status' => $this->payment_status?->value,
            'preferred_date' => $this->preferred_date?->toISOString(),
            'confirmed_at' => $this->confirmed_at?->toISOString(),
            'shipped_at' => $this->shipped_at?->toISOString(),
            'declaration_form_path' => $this->declaration_form_path,
            'proof_of_payment' => $this->proof_of_payment,
            'notes' => $this->notes,
            'admin_notes' => $this->admin_notes,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),

            // Relationships
            'sender_id' => $this->sender_id,
            'sender' => $this->whenLoaded('sender', fn () => new SenderResource($this->sender)),
            'boxes' => $this->whenLoaded('boxes', fn () => BoxResource::collection($this->boxes)),
            'invoice' => $this->whenLoaded('invoice', fn () => new InvoiceResource($this->invoice)),
            'runsheets' => $this->whenLoaded('runsheets', fn () => $this->runsheets->map(fn ($r) => [
                'id' => $r->id,
                'type' => $r->type,
                'status' => $r->status,
                'scheduled_date' => $r->scheduled_date?->toISOString(),
            ])),
        ];
    }
}
