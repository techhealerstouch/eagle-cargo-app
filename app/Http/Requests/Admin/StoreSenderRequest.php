<?php

namespace App\Http\Requests\Admin;

use App\Rules\Phone;
use Illuminate\Foundation\Http\FormRequest;

class StoreSenderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:senders',
            'mobile' => [
                'required',
                'string',
                'max:20',
                new Phone('mobile number'),
            ],
            'address' => 'required|string|max:500',
            'suburb' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postcode' => 'nullable|string|max:10',
        ];
    }
}
