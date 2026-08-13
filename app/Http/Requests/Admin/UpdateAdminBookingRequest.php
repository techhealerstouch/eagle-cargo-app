<?php

namespace App\Http\Requests\Admin;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAdminBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Auth checked by route middleware
    }

    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $newStatus = $this->input('status');
            $booking = $this->route('booking');

            if ($booking && $newStatus) {
                $statusEnum = BookingStatus::tryFrom($newStatus);
                if ($statusEnum && $booking->status !== $statusEnum && ! $booking->status->canTransitionTo($statusEnum)) {
                    $validator->errors()->add('status', "Unauthorized transition from {$booking->status->value} to {$newStatus}.");
                }
            }
        });
    }

    public function rules(): array
    {
        $isPaid = $this->payment_status === 'paid' || $this->payment_status === PaymentStatus::Paid->value;
        $isCash = in_array($this->payment_method, ['cash', 'cash_on_pickup'], true);

        return [
            'sender_id'               => 'required|exists:senders,id',
            'status'                   => 'required|in:pending,confirmed,collected,shipped,delivered,cancelled',
            'recipient_name'           => 'required|string|max:255',
            'recipient_address'        => 'nullable|string|max:255',
            'recipient_city'           => 'nullable|string|max:100',
            'recipient_province'       => 'nullable|string|max:100',
            'recipient_zip_code'       => 'nullable|string|max:20',
            'destination'              => 'nullable|string|max:255',
            'preferred_date'           => 'nullable|date',
            'pickup_zone_id'           => 'nullable|exists:pickup_zones,id',
            'payment_status'           => ['required', Rule::enum(PaymentStatus::class)],
            'payment_method'           => [$isPaid ? 'required' : 'nullable', 'string', Rule::in(['cash', 'stripe', 'cash_on_pickup', 'bank_transfer', 'pay_id', 'afterpay', 'square', 'cheque'])],
            'payment_reference'        => [$isPaid && ! $isCash ? 'required' : 'nullable', 'string', 'max:255'],
            'proof_of_payment'         => [
                $isPaid && empty($this->route('booking')?->proof_of_payment) ? 'required' : 'nullable',
                'file',
                'mimes:jpeg,png,jpg,pdf',
                'max:5120',
            ],
            'declaration_form_status'  => 'required|in:missing,submitted_online,physical_copy_received',
            'notes'                    => 'nullable|string',
            'admin_notes'              => 'nullable|string',
            'declaration_data'         => 'nullable|array',
        ];
    }

    public function messages(): array
    {
        return [
            'sender_id.required' => __('messages.validation.admin_booking.sender_id.required'),
            'sender_id.exists' => __('messages.validation.admin_booking.sender_id.exists'),
            'status.required' => __('messages.validation.admin_booking.status.required'),
            'status.in' => __('messages.validation.admin_booking.status.in'),
            'recipient_name.required' => __('messages.validation.admin_booking.recipient_name.required'),
            'recipient_address.required' => __('messages.validation.admin_booking.recipient_address.required'),
            'payment_status.required' => __('messages.validation.admin_booking.payment_status.required'),
            'payment_status.in' => __('messages.validation.admin_booking.payment_status.in'),
            'payment_method.required' => 'Payment method is required when booking payment status is Paid.',
            'payment_reference.required' => 'A reference / transaction number is required when payment status is Paid (optional for Cash payments).',
            'proof_of_payment.required' => 'A proof of payment file (image or PDF) is required when marking booking payment status as Paid.',
            'declaration_form_status.required' => __('messages.validation.admin_booking.declaration_form_status.required'),
            'declaration_form_status.in' => __('messages.validation.admin_booking.declaration_form_status.in'),
        ];
    }
}
