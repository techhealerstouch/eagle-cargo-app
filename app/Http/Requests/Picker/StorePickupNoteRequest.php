<?php

namespace App\Http\Requests\Picker;

use Illuminate\Foundation\Http\FormRequest;

class StorePickupNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
            'note' => ['required', 'string', 'max:2000'],
        ];
    }
}
