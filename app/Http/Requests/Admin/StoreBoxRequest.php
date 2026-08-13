<?php

namespace App\Http\Requests\Admin;

use App\Enums\BoxStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreBoxRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'booking_id' => 'required|exists:bookings,id',
            'recipient_id' => 'nullable|exists:recipients,id',
            'box_type_id' => 'nullable|exists:box_types,id',
            'batch_id' => 'nullable|exists:batches,id',
            'status' => ['required', new Enum(BoxStatus::class)],
            'courier_notes' => 'nullable|string',
            'weight' => 'nullable|numeric|min:0',
            'price_charged' => 'nullable|numeric|min:0',
        ];
    }
}
