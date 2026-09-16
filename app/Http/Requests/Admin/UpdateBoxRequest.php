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
            'tracking_step_key' => [
                'nullable',
                'string',
                function ($attribute, $value, $fail) {
                    if (! empty($value)) {
                        $stepService = app(\App\Services\TrackingStepService::class);
                        if (! $stepService->isValidStepKey($value)) {
                            $fail("The selected tracking step key [{$value}] is invalid.");
                        }
                    }
                },
            ],
            'courier_notes' => 'nullable|string',
            'admin_delivery_override_reason' => 'nullable|string|min:10|max:1000',
            'weight' => 'nullable|numeric|min:0',
            'price_charged' => 'nullable|numeric|min:0',
        ];
    }
}
