<?php

namespace App\Http\Resources;

use App\Models\Recipient;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * API Resource for Recipient serialization.
 *
 * @see Recipient
 */
class RecipientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone_number' => $this->phone_number,
            'secondary_phone_number' => $this->secondary_phone_number,
            'address' => $this->address,
            'city' => $this->city,
            'province' => $this->province,
            'zip_code' => $this->zip_code,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
