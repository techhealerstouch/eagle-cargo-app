<?php

namespace App\Http\Requests\Picker;

use App\Enums\OperationalMessageCategory;
use App\Enums\OperationalThreadPriority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOperationalThreadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:5000'],
            'category' => ['required', 'string', Rule::enum(OperationalMessageCategory::class)],
            'priority' => ['nullable', 'string', Rule::enum(OperationalThreadPriority::class)],
            'runsheet_id' => ['nullable', 'integer', 'exists:runsheets,id'],
            'booking_id' => ['nullable', 'integer', 'exists:bookings,id'],
        ];
    }
}
