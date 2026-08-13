<?php

namespace App\Http\Resources;

use App\Models\Sender;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * API Resource for Sender serialization.
 *
 * @see Sender
 */
class SenderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'email' => $this->email,
            'mobile' => $this->mobile,
            'phone' => $this->phone,
            'address' => $this->address,
            'suburb' => $this->suburb,
            'state' => $this->state,
            'postcode' => $this->postcode,
            'country' => $this->country,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
