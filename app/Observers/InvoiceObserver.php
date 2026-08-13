<?php

namespace App\Observers;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Jobs\SyncInvoiceToZoho;
use App\Models\Invoice;

class InvoiceObserver
{
    public function creating(Invoice $invoice): void
    {
        if (! $invoice->booking_id) {
            return;
        }

        $booking = $invoice->booking()->with(['sender', 'boxes.boxType', 'boxes.recipient'])->first();
        if (! $booking) {
            return;
        }

        $snapshotPayload = Invoice::buildSnapshotPayload($booking);

        $invoice->sender_snapshot = $invoice->sender_snapshot ?? $snapshotPayload['sender_snapshot'];
        $invoice->booking_snapshot = $invoice->booking_snapshot ?? $snapshotPayload['booking_snapshot'];
        $invoice->line_items_snapshot = $invoice->line_items_snapshot ?? $snapshotPayload['line_items_snapshot'];
        $invoice->snapshot_taken_at = $invoice->snapshot_taken_at ?? $snapshotPayload['snapshot_taken_at'];
        $invoice->booking_version_id = $invoice->booking_version_id ?? $snapshotPayload['booking_version_id'];
        $invoice->sender_version_id = $invoice->sender_version_id ?? $snapshotPayload['sender_version_id'];
    }

    /**
     * Handle the Invoice "created" event.
     */
    public function created(Invoice $invoice): void
    {
        if (! app()->environment('testing')) {
            SyncInvoiceToZoho::dispatch($invoice);
        }

        $this->syncBookingPaymentStatus($invoice);
    }

    /**
     * Handle the Invoice "updated" event.
     */
    public function updated(Invoice $invoice): void
    {
        if ($invoice->wasChanged('status')) {
            $this->syncBookingPaymentStatus($invoice);
        }
    }

    /**
     * Synchronize the invoice status back to the associated booking's payment status.
     */
    protected function syncBookingPaymentStatus(Invoice $invoice): void
    {
        if (! $invoice->booking_id) {
            return;
        }

        $booking = $invoice->booking()->first();
        if (! $booking) {
            return;
        }

        if ($invoice->status === InvoiceStatus::Paid) {
            if ($booking->payment_status !== PaymentStatus::Paid) {
                $booking->update(['payment_status' => PaymentStatus::Paid]);
            }
        } elseif ($invoice->status === InvoiceStatus::Partial) {
            if ($booking->payment_status !== PaymentStatus::PartiallyPaid) {
                $booking->update(['payment_status' => PaymentStatus::PartiallyPaid]);
            }
        } elseif ($invoice->status === InvoiceStatus::Unpaid) {
            $hasPendingCash = $invoice->payments()
                ->where('is_cash_payment', true)
                ->whereNotNull('paid_at')
                ->whereNull('confirmed_at')
                ->exists();

            if ($hasPendingCash) {
                if ($booking->payment_status !== PaymentStatus::CashCollected) {
                    $booking->update(['payment_status' => PaymentStatus::CashCollected]);
                }
            } elseif ($booking->payment_status === PaymentStatus::Paid || $booking->payment_status === PaymentStatus::PartiallyPaid) {
                $booking->update(['payment_status' => PaymentStatus::Pending]);
            }
        }
    }
}
