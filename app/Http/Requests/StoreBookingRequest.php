<?php

namespace App\Http\Requests;

use App\Rules\ValidPickupDate;
use App\Rules\Phone;
use App\Services\ReferenceDataService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreBookingRequest extends FormRequest
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

            if (! is_array($box) || ! empty($box['recipient_id'])) {
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
        $senderId = $this->user()?->sender?->id;

        return [
            'booking_id' => ['nullable', 'exists:bookings,id'],
            'initialization_key' => ['nullable', 'uuid'],
            // Sender (Sender) details
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'mobile' => [
                'required',
                'string',
                'max:50',
                new Phone('contact phone'),
            ],
            'address' => ['required', 'string', 'max:500'],
            'suburb' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'max:100'],
            'postcode' => ['required', 'string', 'max:10'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],

            // Shared Booking details
            'booking_type' => ['nullable', 'string', 'max:50'],
            'preferred_date' => ['required', 'date', new ValidPickupDate($this->route('booking'))],
            'pickup_zone_id' => ['nullable', 'exists:pickup_zones,id'],
            'payment_method' => ['required', 'string', 'in:cash,stripe,cash_on_pickup,bank_transfer,pay_id,afterpay,square'],
            'notes' => ['nullable', 'string', 'max:1000'],

            // Array of boxes, each containing recipient details and size
            'boxes' => ['required', 'array', 'min:1'],
            'boxes.*.recipient_id' => [
                'nullable',
                Rule::exists('recipients', 'id')->where(function ($query) use ($senderId) {
                    if ($senderId) {
                        $query->where('sender_id', $senderId);
                    }
                }),
            ],
            'boxes.*.recipient_first_name' => ['nullable', 'required_without:boxes.*.recipient_id', 'string', 'max:100'],
            'boxes.*.recipient_last_name' => ['nullable', 'required_without:boxes.*.recipient_id', 'string', 'max:100'],
            'boxes.*.recipient_email' => ['nullable', 'required_without:boxes.*.recipient_id', 'string', 'email', 'max:255'],
            'boxes.*.recipient_address' => ['nullable', 'required_without:boxes.*.recipient_id', 'string', 'max:500'],
            'boxes.*.recipient_city' => ['nullable', 'required_without:boxes.*.recipient_id', 'string', 'max:100'],
            'boxes.*.recipient_province' => array_values(array_filter([
                'nullable',
                'required_without:boxes.*.recipient_id',
                'string',
                'max:100',
                app(ReferenceDataService::class)->hasActiveProvinces()
                    ? Rule::exists('provinces', 'name')->where(fn ($query) => $query->where('is_active', true))
                    : null,
            ])),
            'boxes.*.recipient_zip_code' => ['nullable', 'required_without:boxes.*.recipient_id', 'string', 'max:20'],
            'boxes.*.recipient_phone' => [
                'nullable',
                'required_without:boxes.*.recipient_id',
                'string',
                'max:50',
                new Phone('receiver phone'),
            ],
            'boxes.*.recipient_landmarks' => ['nullable', 'string', 'max:500'],
            'boxes.*.recipient_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'boxes.*.recipient_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'boxes.*.area_id' => ['required', 'exists:areas,id'],
            // box_type_id is nullable — per-item validation in withValidator() enforces it
            // when is_custom_size is false.
            'boxes.*.box_type_id' => ['nullable', 'exists:box_types,id'],
            'boxes.*.is_custom_size' => ['nullable', 'boolean'],
            'boxes.*.custom_length' => ['nullable', 'numeric', 'min:1', 'max:500'],
            'boxes.*.custom_width' => ['nullable', 'numeric', 'min:1', 'max:500'],
            'boxes.*.custom_height' => ['nullable', 'numeric', 'min:1', 'max:500'],
        ];
    }

    /**
     * Add per-item custom-size validation after the standard rules.
     *
     * For each box:
     *  - If is_custom_size = true  → L/W/H are required; box_type_id must be absent.
     *  - If is_custom_size = false → box_type_id is required.
     */
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

                if (! empty($box['recipient_id'])) {
                    continue;
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
