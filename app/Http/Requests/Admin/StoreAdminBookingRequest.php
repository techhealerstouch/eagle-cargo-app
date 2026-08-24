<?php

namespace App\Http\Requests\Admin;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Rules\SecureFile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreAdminBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Auth checked by route middleware
    }

    public function rules(): array
    {
        return [
            'is_new_sender' => 'boolean',
            'sender_id' => 'required_without:is_new_sender|nullable|exists:senders,id',
            'sender_first_name' => 'required_if:is_new_sender,true|nullable|string|max:255',
            'sender_last_name' => 'required_if:is_new_sender,true|nullable|string|max:255',
            'sender_email' => 'exclude_unless:is_new_sender,true|required|email|max:255|unique:users,email',
            'sender_mobile' => 'required_if:is_new_sender,true|nullable|string|max:20',
            'sender_address' => 'required_if:is_new_sender,true|nullable|string|max:500',
            'sender_suburb' => 'nullable|string|max:100',
            'sender_state' => 'nullable|string|max:100',
            'sender_postcode' => 'nullable|string|max:10',
            'status' => ['required', new Enum(BookingStatus::class)],
            'picker_id' => 'required_if:status,collected|nullable|exists:users,id',
            
            // Boxes Array
            'boxes' => 'required|array|min:1',
            'boxes.*.area_id' => 'required|exists:areas,id',
            'boxes.*.is_custom_size' => 'boolean',
            'boxes.*.is_door_to_door' => 'boolean',
            'boxes.*.box_type_id' => 'required_if:boxes.*.is_custom_size,false|nullable|exists:box_types,id',
            'boxes.*.custom_length' => 'required_if:boxes.*.is_custom_size,true|nullable|numeric|min:0.1',
            'boxes.*.custom_width' => 'required_if:boxes.*.is_custom_size,true|nullable|numeric|min:0.1',
            'boxes.*.custom_height' => 'required_if:boxes.*.is_custom_size,true|nullable|numeric|min:0.1',

            // Recipient Details per Box (assuming we support existing recipients or new ones)
            'boxes.*.recipient_id' => 'nullable|exists:recipients,id',
            'boxes.*.recipient_first_name' => 'required_without:boxes.*.recipient_id|nullable|string|max:255',
            'boxes.*.recipient_last_name' => 'required_without:boxes.*.recipient_id|nullable|string|max:255',
            'boxes.*.recipient_email' => 'nullable|email|max:255',
            'boxes.*.recipient_address' => 'required_without:boxes.*.recipient_id|nullable|string|max:255',
            'boxes.*.recipient_city' => 'required_without:boxes.*.recipient_id|nullable|string|max:100',
            'boxes.*.recipient_province' => 'required_without:boxes.*.recipient_id|nullable|string|max:100',
            'boxes.*.recipient_zip_code' => 'required_without:boxes.*.recipient_id|nullable|string|max:20',
            'boxes.*.recipient_phone' => 'required_without:boxes.*.recipient_id|nullable|string|max:20',
            'boxes.*.recipient_landmarks' => 'nullable|string|max:255',

            // Pickup & Scheduling
            'preferred_date' => 'nullable|date',
            
            // Payment & Declaration
            'pickup_zone_id' => 'nullable|exists:pickup_zones,id',
            'payment_status' => ['required', new Enum(PaymentStatus::class)],
            'payment_method' => ['nullable', 'string', \Illuminate\Validation\Rule::in(['cash', 'stripe', 'cash_on_pickup', 'bank_transfer', 'pay_id', 'afterpay', 'square'])],
            'payment_reference' => 'nullable|string|max:255',
            'proof_of_payment' => ['nullable', 'file', 'mimes:jpeg,png,jpg,pdf', 'max:5120', new SecureFile],
            'declaration_form_status' => 'required|in:missing,submitted_online,physical_copy_received',
            'declaration_form' => ['nullable', 'file', 'mimes:jpeg,png,jpg,pdf', 'max:10240', new SecureFile],
            
            // Empty Box Purchase Request
            'empty_box_count' => 'nullable|integer|min:0',
            'empty_box_fee' => 'nullable|numeric|min:0',

            // Notes
            'notes' => 'nullable|string',
            'admin_notes' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'sender_id.required_without' => __('messages.validation.admin_booking.sender_id.required'),
            'sender_id.exists' => __('messages.validation.admin_booking.sender_id.exists'),
            'sender_first_name.required_if' => 'The sender first name is required when creating a new sender.',
            'sender_last_name.required_if' => 'The sender last name is required when creating a new sender.',
            'sender_email.required_if' => 'The sender email is required when creating a new sender.',
            'sender_mobile.required_if' => 'The sender mobile is required when creating a new sender.',
            'sender_address.required_if' => 'The sender address is required when creating a new sender.',
            'status.required' => __('messages.validation.admin_booking.status.required'),
            'status.in' => __('messages.validation.admin_booking.status.in'),
            'picker_id.required_if' => 'The picker is required when status is collected.',
            
            'boxes.required' => 'At least one box is required.',
            'boxes.*.area_id.required' => 'The destination area is required for all boxes.',
            'boxes.*.box_type_id.required_if' => 'The box type is required unless using custom dimensions.',
            'boxes.*.custom_length.required_if' => 'The length is required for custom boxes.',
            'boxes.*.custom_width.required_if' => 'The width is required for custom boxes.',
            'boxes.*.custom_height.required_if' => 'The height is required for custom boxes.',
            
            'boxes.*.recipient_first_name.required_without' => 'The recipient first name is required.',
            'boxes.*.recipient_last_name.required_without' => 'The recipient last name is required.',
            'boxes.*.recipient_address.required_without' => 'The recipient address is required.',
            'boxes.*.recipient_city.required_without' => 'The recipient city is required.',
            'boxes.*.recipient_province.required_without' => 'The recipient province is required.',
            'boxes.*.recipient_zip_code.required_without' => 'The recipient zip code is required.',
            'boxes.*.recipient_phone.required_without' => 'The recipient phone is required.',

            'payment_status.required' => __('messages.validation.admin_booking.payment_status.required'),
            'payment_status.in' => __('messages.validation.admin_booking.payment_status.in'),
            'declaration_form_status.required' => __('messages.validation.admin_booking.declaration_form_status.required'),
            'declaration_form_status.in' => __('messages.validation.admin_booking.declaration_form_status.in'),
            
            'proof_of_payment.max' => 'The proof of payment must not be greater than 5MB.',
            'declaration_form.max' => 'The declaration form must not be greater than 10MB.',
        ];
    }
}
