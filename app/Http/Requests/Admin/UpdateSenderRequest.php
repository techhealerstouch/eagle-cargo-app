<?php

namespace App\Http\Requests\Admin;

use App\Rules\Phone;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSenderRequest extends FormRequest
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
            'email' => 'required|string|email|max:255|unique:senders,email,'.$this->route('sender')->id,
            'mobile' => [
                'required',
                'string',
                'max:50',
                new Phone('mobile number'),
            ],
            'secondary_mobile' => [
                'nullable',
                'string',
                'max:50',
                function ($attribute, $value, $fail) {
                    if (! empty($value)) {
                        (new Phone('secondary phone number'))->validate($attribute, $value, $fail);
                    }
                },
            ],
            'address' => 'required|string|max:500',
            'suburb' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postcode' => 'nullable|string|max:10',
        ];
    }
}
