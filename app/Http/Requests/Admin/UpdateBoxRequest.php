<?php

namespace App\Http\Requests\Admin;

use App\Enums\BoxStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class UpdateBoxRequest extends FormRequest
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
            'tracking_step_key' => 'nullable|string',
            'courier_notes' => 'nullable|string',
            'admin_delivery_override_reason' => 'nullable|string|min:10|max:1000',
            'weight' => 'nullable|numeric|min:0',
            'price_charged' => 'nullable|numeric|min:0',
            'update_eta' => 'nullable|boolean',
            'eta_date' => 'nullable|date',
            'eta_message' => 'nullable|string|max:255',
            'update_estimate_delivery' => 'nullable|boolean',
            'estimate_delivery_date' => 'nullable|date',
            'estimate_delivery_message' => 'nullable|string|max:255',
        ];
    }
}
