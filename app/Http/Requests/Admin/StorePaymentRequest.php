<?php

namespace App\Http\Requests\Admin;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Models\Booking;
use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'invoice_id' => 'required_without:booking_id|exists:invoices,id',
            'booking_id' => 'nullable|exists:bookings,id',
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'nullable|string|max:50',
            'reference_number' => 'nullable|string|max:100',
            'paid_at' => 'nullable|date',
            'idempotency_key' => 'nullable|string|max:128',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $invoice = $this->resolveTargetInvoice();
            if (! $invoice) {
                return;
            }

            if ($invoice->status === InvoiceStatus::Voided) {
                $validator->errors()->add('invoice_id', 'Cannot record payment for a voided invoice.');

                return;
            }

            $booking = $invoice->booking;
            if ($booking && $booking->status === BookingStatus::Cancelled) {
                $validator->errors()->add('booking_id', 'Cannot record payment for a cancelled booking.');

                return;
            }

            $outstanding = max((float) $invoice->amount - $this->settledPaymentsTotal($invoice), 0.0);

            if ($invoice->status === InvoiceStatus::Paid || $outstanding <= 0.0) {
                $validator->errors()->add('invoice_id', 'This invoice is already fully paid.');

                return;
            }

            $amount = (float) $this->input('amount');
            if ($amount > $outstanding + 0.00001) {
                $validator->errors()->add('amount', sprintf(
                    'Amount cannot exceed the outstanding balance of %.2f.',
                    $outstanding
                ));
            }
        });
    }

    public function messages(): array
    {
        return [
            'invoice_id.required' => __('messages.validation.payment.invoice_id.required'),
            'invoice_id.exists' => __('messages.validation.payment.invoice_id.exists'),
            'amount.required' => __('messages.validation.payment.amount.required'),
            'amount.min' => __('messages.validation.payment.amount.min'),
        ];
    }

    private function resolveTargetInvoice(): ?Invoice
    {
        if ($this->filled('invoice_id')) {
            return Invoice::query()->find((int) $this->input('invoice_id'));
        }

        if (! $this->filled('booking_id')) {
            return null;
        }

        $booking = Booking::query()->with('invoice')->find((int) $this->input('booking_id'));

        return $booking?->invoice;
    }

    private function settledPaymentsTotal(Invoice $invoice): float
    {
        return (float) $invoice->payments()
            ->where(function ($query) {
                $query->whereNotNull('paid_at')
                    ->orWhere('stripe_status', 'succeeded');
            })
            ->sum('amount');
    }
}
