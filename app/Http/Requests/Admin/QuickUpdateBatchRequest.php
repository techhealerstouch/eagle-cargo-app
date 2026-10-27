<?php

namespace App\Http\Requests\Admin;

use App\Enums\BatchStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class QuickUpdateBatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $batchId = $this->route('batch')?->id;

        return [
            'status' => ['nullable', 'string', Rule::enum(BatchStatus::class)],
            'tracking_phase' => ['nullable', 'string'],
            'tracking_description' => ['nullable', 'string', 'max:500'],
            'container_number' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('batches', 'container_number')->ignore($batchId),
            ],
            'seal_number' => ['nullable', 'string', 'max:50'],
            'vessel_name' => ['nullable', 'string', 'max:255'],
            'voyage_number' => ['nullable', 'string', 'max:50'],
            'eta_at' => ['nullable', 'date'],
            'override_note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
