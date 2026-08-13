<?php

namespace App\Observers;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\Invoice;
use App\Models\Payment;

class PaymentObserver
{
    public function creating(Payment $payment): void
    {
        $this->captureInvoiceSnapshot($payment);
    }

    public function updating(Payment $payment): void
    {
        if ($payment->isDirty('invoice_id')) {
            $this->captureInvoiceSnapshot($payment);
        }
    }

    /**
     * Handle the Payment "created" event.
     */
    public function created(Payment $payment): void
    {
        $this->syncPaymentStatus($payment);
    }

    public function updated(Payment $payment): void
    {
        $this->syncPaymentStatus($payment);
    }

    public function deleted(Payment $payment): void
    {
        $this->syncPaymentStatus($payment);
    }

    public function restored(Payment $payment): void
    {
        $this->syncPaymentStatus($payment);
    }

    public function forceDeleted(Payment $payment): void
    {
        $this->syncPaymentStatus($payment);
    }

    protected function syncPaymentStatus(Payment $payment): void
    {
        \Illuminate\Support\Facades\DB::transaction(function () use ($payment) {
            // Always fetch a fresh invoice from DB — never rely on Eloquent's
            // cached relationship which may hold stale status/amount values
            // from earlier in the request lifecycle (route model binding, eager loads, etc.).
            $invoice = Invoice::whereKey($payment->invoice_id)->lockForUpdate()->first();
            if (! $invoice) {
                return;
            }

            // Never overwrite a voided invoice — it has been financially cancelled
            if ($invoice->status === InvoiceStatus::Voided) {
                return;
            }

            $totalPaid = $this->settledPaymentsTotal($invoice);
            $invoiceAmount = (string) $invoice->amount;

            // Use bccomp for precise decimal comparison — avoids float rounding
            // issues like 129.9999999 failing a >= 130.00 check.
            $cmp = bccomp($totalPaid, $invoiceAmount, 2);

            if ($cmp >= 0) {
                $invoiceStatus = InvoiceStatus::Paid;
            } elseif (bccomp($totalPaid, '0', 2) > 0) {
                $invoiceStatus = InvoiceStatus::Partial;
            } else {
                $invoiceStatus = InvoiceStatus::Unpaid;
            }

            if ($invoice->status !== $invoiceStatus) {
                $invoice->update(['status' => $invoiceStatus]);
            }

            // Fresh booking query to avoid stale cached relationship
            $booking = $invoice->booking()->lockForUpdate()->first();
            if ($booking) {
                if ($invoiceStatus === InvoiceStatus::Paid) {
                    if ($booking->payment_status !== PaymentStatus::Paid) {
                        $booking->update(['payment_status' => PaymentStatus::Paid]);
                    }
                } else {
                    // Check if there's an unconfirmed cash payment (picker collected but admin hasn't confirmed)
                    $hasPendingCash = $invoice->payments()
                        ->where('is_cash_payment', true)
                        ->whereNotNull('paid_at')
                        ->whereNull('confirmed_at')
                        ->exists();

                    if ($hasPendingCash) {
                        if ($booking->payment_status !== PaymentStatus::CashCollected) {
                            $booking->update(['payment_status' => PaymentStatus::CashCollected]);
                        }
                    } elseif ($booking->payment_status === PaymentStatus::Paid) {
                        $booking->update(['payment_status' => PaymentStatus::Pending]);
                    }
                }
            }
        });
    }

    /**
     * Calculate the total settled amount for an invoice using a DB aggregate query.
     *
     * Pushes the "is settled?" logic into SQL so we never rely on Eloquent model
     * hydration, cached collections, or PHP float arithmetic.
     *
     * Settled means:
     *  - Non-cash payments (is_cash_payment = false or NULL): paid_at is set
     *  - Cash payments (is_cash_payment = true): confirmed_at is set
     */
    private function settledPaymentsTotal(Invoice $invoice): string
    {
        return (string) $invoice->payments()
            ->where(function ($query) {
                $query
                    // Non-cash payments: settled when paid_at is present
                    ->where(function ($q) {
                        $q->where(function ($inner) {
                            $inner->where('is_cash_payment', false)
                                  ->orWhereNull('is_cash_payment');
                        })->whereNotNull('paid_at');
                    })
                    // Cash payments: settled only when admin has confirmed
                    ->orWhere(function ($q) {
                        $q->where('is_cash_payment', true)
                          ->whereNotNull('confirmed_at');
                    });
            })
            ->sum('amount');
    }

    private function captureInvoiceSnapshot(Payment $payment): void
    {
        $invoice = $payment->invoice()->with('booking')->first();
        if (! $invoice) {
            return;
        }

        $snapshotPayload = Payment::buildSnapshotPayloadForInvoice($invoice);
        $payment->invoice_snapshot = $snapshotPayload['invoice_snapshot'];
        $payment->invoice_version_id = $snapshotPayload['invoice_version_id'];
        $payment->snapshot_taken_at = $snapshotPayload['snapshot_taken_at'];
    }
}
