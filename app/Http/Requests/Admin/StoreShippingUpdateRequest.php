<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreShippingUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => 'required|string|in:info,alert,success',
            'title' => 'required|string|max:255',
            'body' => 'required|string',
            'is_published' => 'boolean',
            'published_at' => 'nullable|date',
        ];
    }
}
