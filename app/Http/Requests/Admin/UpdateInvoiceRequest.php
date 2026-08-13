<?php

namespace App\Http\Requests\Admin;

use App\Enums\InvoiceStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rule;

class UpdateInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isPaid = $this->status === 'paid' || $this->status === InvoiceStatus::Paid->value;
        $isCash = in_array($this->payment_method, ['cash', 'cash_on_pickup'], true);

        return [
            'amount' => 'required|numeric|min:0',
            'status' => ['required', new Enum(InvoiceStatus::class)],
            'or_number' => 'nullable|string|max:255',
            'due_date' => 'nullable|date',
            'payment_method' => [$isPaid ? 'required' : 'nullable', 'string'],
            'reference_number' => [$isPaid && ! $isCash ? 'required' : 'nullable', 'string', 'max:255'],
            'proof_of_payment' => [
                $isPaid && empty($this->route('invoice')?->booking?->proof_of_payment) ? 'required' : 'nullable',
                'file',
                'mimes:jpeg,png,jpg,pdf',
                'max:5120',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'payment_method.required' => 'A payment method is required when marking the invoice as Paid.',
            'reference_number.required' => 'A reference / transaction number is required when marking the invoice as Paid (optional for Cash payments).',
            'proof_of_payment.required' => 'A proof of payment file (image or PDF) is required when marking the invoice as Paid.',
        ];
    }
}
