<?php

namespace App\Http\Requests;

use App\Rules\Phone;
use App\Rules\ValidPickupDate;
use App\Services\ReferenceDataService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreGuestBookingRequest extends FormRequest
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
        if ($this->filled('mobile')) {
            $this->merge(['mobile' => preg_replace('/[\s\-\(\)]+/', '', $this->input('mobile'))]);
        }
        if ($this->filled('secondary_mobile')) {
            $this->merge(['secondary_mobile' => preg_replace('/[\s\-\(\)]+/', '', $this->input('secondary_mobile'))]);
        }
        if ($this->filled('sender_address') && ! $this->filled('address')) {
            $this->merge(['address' => $this->input('sender_address')]);
        }

        $boxes = $this->input('boxes');
        if (! is_array($boxes)) {
            return;
        }

        $referenceData = app(ReferenceDataService::class);
        $hasActiveProvinces = $referenceData->hasActiveProvinces();

        foreach ($boxes as $index => $box) {
            if (is_array($box) && isset($box['recipient_phone'])) {
                $boxes[$index]['recipient_phone'] = preg_replace('/[\s\-\(\)]+/', '', $box['recipient_phone']);
            }
            if (is_array($box) && isset($box['recipient_secondary_phone'])) {
                $boxes[$index]['recipient_secondary_phone'] = preg_replace('/[\s\-\(\)]+/', '', $box['recipient_secondary_phone']);
            }

            if (! is_array($box)) {
                continue;
            }

            $province = $referenceData->provinceByName($box['recipient_province'] ?? null);
            if ($province) {
                $boxes[$index]['recipient_province'] = $province->name;
            }

            $areaId = $referenceData->resolveDestinationAreaId(
                $boxes[$index]['recipient_province'] ?? null,
                $box['recipient_city'] ?? null,
                $box['area_id'] ?? null,
            );

            if ($areaId !== null) {
                $boxes[$index]['area_id'] = $areaId;
            } elseif ($hasActiveProvinces) {
                unset($boxes[$index]['area_id']);
            }
        }

        $this->merge(['boxes' => $boxes]);
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Optional honeypot for spam bots
            'website' => ['nullable', 'max:0'],

            // Sender details
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'mobile' => [
                'required',
                'string',
                'max:50',
                new Phone('contact phone'),
            ],
            'secondary_mobile' => [
                'nullable',
                'string',
                'max:50',
                function ($attribute, $value, $fail) {
                    if (! empty($value)) {
                        (new Phone('secondary contact phone'))->validate($attribute, $value, $fail);
                    }
                },
            ],
            'address' => ['required', 'string', 'max:500'],
            'suburb' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'max:100'],
            'postcode' => ['required', 'string', 'max:10'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],

            // Booking details
            'booking_id' => ['nullable', 'integer', 'exists:bookings,id'],
            'initialization_key' => ['nullable', 'string', 'max:100'],
            'booking_type' => ['nullable', 'string', 'max:50'],
            'preferred_date' => ['required', 'date', new ValidPickupDate(null)],
            'pickup_zone_id' => ['nullable', 'exists:pickup_zones,id'],
            'payment_method' => ['required', 'string', 'in:cash,stripe,cash_on_pickup,bank_transfer,pay_id,afterpay,square'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'request_empty_box' => ['nullable', 'boolean'],
            'empty_box_count' => ['nullable', 'integer', 'min:0'],
            'empty_box_fee' => ['nullable', 'numeric', 'min:0'],

            // Boxes
            'boxes' => ['required', 'array', 'min:1'],
            'boxes.*.is_door_to_door' => ['nullable', 'boolean'],
            'boxes.*.recipient_first_name' => ['required', 'string', 'max:100'],
            'boxes.*.recipient_last_name' => ['required', 'string', 'max:100'],
            'boxes.*.recipient_email' => ['nullable', 'string', 'email', 'max:255'],
            'boxes.*.recipient_address' => ['required', 'string', 'max:500'],
            'boxes.*.recipient_city' => ['required', 'string', 'max:100'],
            'boxes.*.recipient_province' => array_values(array_filter([
                'required',
                'string',
                'max:100',
                app(ReferenceDataService::class)->hasActiveProvinces()
                    ? Rule::exists('provinces', 'name')->where(fn ($query) => $query->where('is_active', true))
                    : null,
            ])),
            'boxes.*.recipient_zip_code' => ['required', 'string', 'max:20'],
            'boxes.*.recipient_phone' => [
                'required',
                'string',
                'max:50',
                new Phone('receiver phone'),
            ],
            'boxes.*.recipient_secondary_phone' => [
                'nullable',
                'string',
                'max:50',
                function ($attribute, $value, $fail) {
                    if (! empty($value)) {
                        (new Phone('secondary receiver phone'))->validate($attribute, $value, $fail);
                    }
                },
            ],
            'boxes.*.recipient_landmarks' => ['nullable', 'string', 'max:500'],
            'boxes.*.recipient_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'boxes.*.recipient_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'boxes.*.area_id' => ['required', 'exists:areas,id'],
            'boxes.*.box_type_id' => ['nullable', 'exists:box_types,id'],
            'boxes.*.is_custom_size' => ['nullable', 'boolean'],
            'boxes.*.custom_length' => ['nullable', 'numeric', 'min:1', 'max:500'],
            'boxes.*.custom_width' => ['nullable', 'numeric', 'min:1', 'max:500'],
            'boxes.*.custom_height' => ['nullable', 'numeric', 'min:1', 'max:500'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $boxes = $this->input('boxes', []);

            foreach ($boxes as $index => $box) {
                $isCustom = filter_var($box['is_custom_size'] ?? false, FILTER_VALIDATE_BOOLEAN);

                if ($isCustom) {
                    foreach (['custom_length', 'custom_width', 'custom_height'] as $dim) {
                        if (empty($box[$dim]) || ! is_numeric($box[$dim]) || (float) $box[$dim] <= 0) {
                            $label = str_replace('_', ' ', $dim);
                            $v->errors()->add("boxes.{$index}.{$dim}", "The {$label} is required for custom-size boxes and must be greater than 0.");
                        }
                    }
                } else {
                    if (empty($box['box_type_id'])) {
                        $v->errors()->add("boxes.{$index}.box_type_id", 'Please select a box type or enable custom size.');
                    }
                }

                $referenceData = app(ReferenceDataService::class);
                if (! $referenceData->hasActiveProvinces()) {
                    continue;
                }

                $derivedAreaId = $referenceData->resolveDestinationAreaId(
                    $box['recipient_province'] ?? null,
                    $box['recipient_city'] ?? null,
                );

                if ($derivedAreaId === null) {
                    $v->errors()->add("boxes.{$index}.area_id", 'Select a supported recipient province and city.');
                    continue;
                }

                if (! empty($box['area_id']) && (int) $box['area_id'] !== $derivedAreaId) {
                    $v->errors()->add("boxes.{$index}.area_id", 'The selected province and city do not match the pricing area.');
                }
            }
        });
    }

    public function messages(): array
    {
        return [
            'mobile.regex' => 'The contact phone must be a valid Australian mobile number (e.g. 04XXXXXXXX or +614XXXXXXXX).',
            'boxes.*.recipient_phone.regex' => 'The receiver phone must be a valid Philippine mobile number (e.g. 09XXXXXXXXX or +639XXXXXXXXX).',
        ];
    }
}
