<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SaveDraftBookingRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->filled('sender_name') && ! $this->filled('first_name') && ! $this->filled('last_name')) {
            $parts = preg_split('/\s+/', trim($this->input('sender_name')), 2, PREG_SPLIT_NO_EMPTY);
            $this->merge([
                'first_name' => $parts[0] ?? '',
                'last_name' => $parts[1] ?? '',
            ]);
        }
        if ($this->filled('sender_email') && ! $this->filled('email')) {
            $this->merge(['email' => $this->input('sender_email')]);
        }
        if ($this->filled('sender_phone') && ! $this->filled('mobile')) {
            $this->merge(['mobile' => $this->input('sender_phone')]);
        }
        if ($this->filled('sender_address') && ! $this->filled('address')) {
            $this->merge(['address' => $this->input('sender_address')]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    /**
     * Relaxed rules: all fields are optional so a draft can be saved
     * at any point during the multi-step booking form.
     */
    public function rules(): array
    {
        return [
            // Sender details (all optional for drafts)
            'first_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'mobile' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:500'],
            'suburb' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'postcode' => ['nullable', 'string', 'max:10'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],

            // Booking details (optional)
            'preferred_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string', 'in:stripe,cash_on_pickup,bank_transfer,pay_id,afterpay,square'],
            'notes' => ['nullable', 'string', 'max:1000'],

            // Boxes (optional — sender may not have added any yet)
            'boxes' => ['nullable', 'array'],
            'boxes.*.recipient_id' => ['nullable'],
            'boxes.*.recipient_first_name' => ['nullable', 'string', 'max:100'],
            'boxes.*.recipient_last_name' => ['nullable', 'string', 'max:100'],
            'boxes.*.recipient_email' => ['nullable', 'string', 'email', 'max:255'],
            'boxes.*.recipient_address' => ['nullable', 'string', 'max:500'],
            'boxes.*.recipient_city' => ['nullable', 'string', 'max:100'],
            'boxes.*.recipient_province' => ['nullable', 'string', 'max:100'],
            'boxes.*.recipient_zip_code' => ['nullable', 'string', 'max:20'],
            'boxes.*.recipient_phone' => ['nullable', 'string', 'max:50'],
            'boxes.*.recipient_landmarks' => ['nullable', 'string', 'max:500'],
            'boxes.*.recipient_latitude' => ['nullable', 'numeric'],
            'boxes.*.recipient_longitude' => ['nullable', 'numeric'],
            'boxes.*.area_id' => ['nullable', 'exists:areas,id'],
            'boxes.*.box_type_id' => ['nullable', 'exists:box_types,id'],

            // Which draft booking to update (if resuming)
            'draft_id' => ['nullable', 'integer'],
        ];
    }
}
