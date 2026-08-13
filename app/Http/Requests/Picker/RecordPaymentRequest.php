<?php

namespace App\Http\Requests\Picker;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetType;
use App\Http\Controllers\PickerController;
use App\Models\Booking;
use App\Models\Invoice;
use App\Models\Runsheet;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Validator;

class RecordPaymentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $runsheet = $this->route('runsheet');
        $user = Auth::user();
        $role = $user?->role;

        if (! $user || $role !== Role::Picker) {
            return false;
        }

        if (! app(PickerController::class)->isAssignedToRunsheet($runsheet)) {
            return false;
        }

        if ($runsheet->type !== RunsheetType::Pickup) {
            return false;
        }

        $booking = Booking::findOrFail($this->booking_id);

        // Block if booking is already fully paid
        if ($booking->payment_status === PaymentStatus::Paid) {
            return false;
        }

        // Check booking belongs to this runsheet and is awaiting payment
        return $runsheet->bookings()->where('bookings.id', $booking->id)->exists()
            && in_array($booking->payment_status, [PaymentStatus::CashOnPickup, PaymentStatus::Pending]);
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
            'invoice_id' => ['nullable', 'integer', 'exists:invoices,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'paid_at' => ['nullable', 'date'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'booking_id.required' => 'Booking is required.',
            'booking_id.exists' => 'Invalid booking.',
            'amount.required' => 'Payment amount is required.',
            'amount.numeric' => 'Amount must be a number.',
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

    private function resolveTargetInvoice(): ?Invoice
    {
        if ($this->filled('invoice_id')) {
            return Invoice::query()->find((int) $this->input('invoice_id'));
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
