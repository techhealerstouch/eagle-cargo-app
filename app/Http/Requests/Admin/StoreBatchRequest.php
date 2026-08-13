<?php

namespace App\Http\Requests\Admin;

use App\Enums\BatchStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

class StoreBatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $batchId = $this->route('batch')?->id;

        return [
            'batch_number' => [
                'nullable',
                'string',
                'max:40',
                'regex:/^(?:.*-[a-zA-Z0-9]{1,4}|[a-zA-Z0-9]{1,4})$/',
                Rule::unique('batches', 'batch_number')->ignore($batchId),
            ],
            'branch_name' => ['nullable', 'string', 'max:255'],
            'container_number' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('batches', 'container_number')->ignore($batchId),
            ],
            'seal_number' => ['nullable', 'string', 'max:50'],
            'container_size' => ['required', 'string', 'in:20ft,40ft,40ft_hc'],
            'vessel_name' => ['nullable', 'string', 'max:255'],
            'shipping_line' => ['required', 'string', 'max:255'],
            'voyage_number' => ['nullable', 'string', 'max:50'],
            'origin_port' => ['required', 'string', 'max:100'],
            'destination_port' => ['required', 'string', 'max:100'],
            'capacity_boxes' => ['required', 'integer', 'min:1'],
            'capacity_weight_kg' => ['nullable', 'numeric', 'min:0.01'],
            'capacity_cbm' => ['nullable', 'numeric', 'min:0.001'],
            'cutoff_at' => ['required', 'date'],
            'eta_at' => ['required', 'date'],
            'status' => [
                'nullable',
                new Enum(BatchStatus::class),
                Rule::when($this->isMethod('POST'), [
                    Rule::in([BatchStatus::Open->value, BatchStatus::Loading->value]),
                ]),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'batch_number.regex' => 'The last sequence segment of the batch number must not exceed 4 digits (e.g. LBB-2609-0001).',
        ];
    }
}
