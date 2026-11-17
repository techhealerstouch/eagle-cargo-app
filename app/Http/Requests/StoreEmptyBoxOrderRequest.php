<?php

namespace App\Http\Requests;

use App\Enums\Role;
use App\Rules\Phone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmptyBoxOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user) {
            return true;
        }

        $roleVal = $user->role instanceof \BackedEnum ? $user->role->value : (string) $user->role;

        return $roleVal === Role::Sender->value || in_array($roleVal, ['admin', 'super_admin'], true);
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('contact_number')) {
            $this->merge([
                'contact_number' => preg_replace('/[\s\-\(\)]+/', '', (string) $this->input('contact_number')),
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $isGuest = ! $this->user();

        return [
            'first_name' => [$isGuest ? 'required' : 'nullable', 'string', 'max:100'],
            'last_name' => [$isGuest ? 'required' : 'nullable', 'string', 'max:100'],
            'email' => $isGuest
                ? ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')]
                : ['nullable', 'email', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.box_type_id' => ['required', 'integer', 'exists:box_types,id'],
            'items.*.quantity' => ['required', 'integer', 'min:0'],
            'address' => ['required', 'string', 'max:500'],
            'suburb' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'max:100'],
            'postcode' => ['required', 'string', 'max:10'],
            'contact_number' => ['required', 'string', 'max:50', new Phone('contact number')],
            'delivery_date' => ['required', 'date', 'after_or_equal:today'],
            'payment_method' => ['required', 'string', 'in:cash_on_pickup,cash,bank_transfer,stripe,pay_id,afterpay,square'],
            'delivery_notes' => ['nullable', 'string', 'max:1000'],
            'website' => ['nullable', 'max:0'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $items = $this->input('items', []);
            $totalQuantity = 0;
            if (is_array($items)) {
                foreach ($items as $item) {
                    $totalQuantity += (int) ($item['quantity'] ?? 0);
                }
            }

            if ($totalQuantity < 1) {
                $validator->errors()->add('items', 'Please select at least 1 empty box to order.');
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.unique' => 'An account with this email already exists. Please log in to place your order.',
        ];
    }
}
