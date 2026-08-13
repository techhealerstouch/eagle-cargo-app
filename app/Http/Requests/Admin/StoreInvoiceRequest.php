<?php

namespace App\Http\Requests\Admin;

use App\Enums\InvoiceStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'booking_id' => 'required|exists:bookings,id|unique:invoices,booking_id',
            'amount' => 'required|numeric|min:0',
            'status' => ['required', new Enum(InvoiceStatus::class)],
        ];
    }
}
