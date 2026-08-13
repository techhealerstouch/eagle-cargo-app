<?php

namespace App\Observers;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Invoice;
use App\Notifications\BookingPaymentReceived;
use App\Notifications\BookingStatusChanged;
use App\Services\TrackingCacheService;
use Illuminate\Support\Str;

class BookingObserver
{
    /**
     * Handle the Booking "creating" event.
     */
    public function creating(Booking $booking): void
    {
        if (empty($booking->reference_number)) {
            // Use a unique placeholder until we have a persisted id.
            $booking->reference_number = 'TMP-'.Str::upper(Str::random(16));
        }

        $snapshotPayload = Booking::buildSnapshotPayload($booking);
        $booking->sender_snapshot = $booking->sender_snapshot ?? $snapshotPayload['sender_snapshot'];
        $booking->primary_recipient_snapshot = $booking->primary_recipient_snapshot ?? $snapshotPayload['primary_recipient_snapshot'];
        $booking->sender_version_id = $booking->sender_version_id ?? $snapshotPayload['sender_version_id'];
        $booking->recipient_version_id = $booking->recipient_version_id ?? $snapshotPayload['recipient_version_id'];
        $booking->snapshot_taken_at = $booking->snapshot_taken_at ?? $snapshotPayload['snapshot_taken_at'];
    }

    /**
     * Handle the Booking "created" event.
     */
    public function created(Booking $booking): void
    {
        app(TrackingCacheService::class)->forgetBooking($booking);

        if (! Str::startsWith($booking->reference_number, 'TMP-')) {
            return;
        }

        $year = $booking->created_at?->format('Y') ?? now()->format('Y');
        $referenceSuffix = str_pad((string) ($booking->id % 1000), 3, '0', STR_PAD_LEFT);
        $booking->reference_number = 'BK-'.$year.'-'.$referenceSuffix;
        $booking->saveQuietly();

    }

    /**
     * Handle the Booking "updating" event.
     */
    public function updating(Booking $booking): void
    {
        if ($booking->isDirty('sender_id')) {
            $snapshotPayload = Booking::buildSnapshotPayload($booking);
            $booking->sender_snapshot = $snapshotPayload['sender_snapshot'];
            $booking->primary_recipient_snapshot = $snapshotPayload['primary_recipient_snapshot'];
            $booking->sender_version_id = $snapshotPayload['sender_version_id'];
            $booking->recipient_version_id = $snapshotPayload['recipient_version_id'];
            $booking->snapshot_taken_at = now();
        }
    }

    /**
     * Handle the Booking "updated" event.
     */
    public function updated(Booking $booking): void
    {
        app(TrackingCacheService::class)->forgetBooking($booking);

        if ($booking->wasChanged('status')) {
            $oldStatus = $booking->getOriginal('status');
            $newStatus = $booking->status;

            // Skip all side effects if the booking is still a draft
            if ($newStatus === BookingStatus::Draft) {
                return;
            }

if ($newStatus === BookingStatus::Confirmed) {
                if (empty($booking->confirmed_at)) {
                    $booking->confirmed_at = now();
                    $booking->saveQuietly();
                }

                // Auto-generate invoice when confirmed
                Invoice::generateForBooking($booking);
            }
            if ($newStatus === BookingStatus::Shipped && empty($booking->shipped_at)) {
                $booking->shipped_at = now();
                $booking->saveQuietly();
            }

            // Handle Cancellation side effects (Items 2, 54)
            if ($newStatus === BookingStatus::Cancelled) {
                // Cancel all child boxes individually to trigger BoxObserver events
                $booking->boxes()->where('status', '!=', BoxStatus::Cancelled)->get()->each(function ($box) {
                    $box->update(['status' => BoxStatus::Cancelled]);
                });

                $hasRunsheet = $booking->runsheets()->exists();

                if ($booking->payment_status === PaymentStatus::CashOnPickup && $hasRunsheet) {
                    $invoice = $booking->invoice()->first();
                    if ($invoice) {
                        $settingsService = app(\App\Services\SettingsService::class);
                        $cancellationFee = (float) $settingsService->get('cancellation_flat_fee', 0);
                        
                        if ($cancellationFee > 0) {
                            $vatBreakdown = Invoice::calculateVatBreakdown($cancellationFee, (float) $settingsService->getInvoiceSettings()['taxRate']);
                            
                            $invoice->update([
                                'is_cancellation_fee' => true,
                                'amount' => $cancellationFee,
                                'vatable_revenue' => $vatBreakdown['vatable_revenue'],
                                'vat_amount' => $vatBreakdown['vat_amount'],
                                'vat_exempt_revenue' => $vatBreakdown['vat_exempt_revenue'],
                                'status' => InvoiceStatus::Unpaid,
                                'line_items_snapshot' => [
                                    [
                                        'tracking_number' => null,
                                        'description' => 'Cancellation Fee (Picker already dispatched)',
                                        'price_charged' => $cancellationFee,
                                    ]
                                ]
                            ]);
                        } else {
                            $invoice->update(['status' => InvoiceStatus::Voided]);
                        }
                    }
                } else {
                    // Void invoices
                    $booking->invoice()->update(['status' => InvoiceStatus::Voided]);
                }

                // Detach from ANY Runsheet (Item 2)
                $booking->runsheets()->detach();
            }

            // Trigger notification (skip if transitioning FROM draft, as notifications are sent in submitDraft)
            if ($booking->sender && $oldStatus !== BookingStatus::Draft->value) {
                $notifiable = $booking->sender->user ?? $booking->sender;
                $notifiable->notify(new BookingStatusChanged($booking));
            }
        }

        if ($booking->wasChanged('payment_status')) {
            $invoice = $booking->invoice()->first();

            if ($invoice) {
                if ($booking->payment_status === PaymentStatus::Paid) {
                    if ($invoice->status !== InvoiceStatus::Paid) {
                        $invoice->update(['status' => InvoiceStatus::Paid]);
                    }
                    if ($booking->sender) {
                        $notifiable = $booking->sender->user ?? $booking->sender;
                        $notifiable->notify(new BookingPaymentReceived($booking, $invoice));
                    }
                } elseif ($booking->payment_status === PaymentStatus::PartiallyPaid && $invoice->status !== InvoiceStatus::Partial) {
                    $invoice->update(['status' => InvoiceStatus::Partial]);
                } elseif ($booking->payment_status === PaymentStatus::Pending && in_array($invoice->status, [InvoiceStatus::Paid, InvoiceStatus::Partial])) {
                    $invoice->update(['status' => InvoiceStatus::Unpaid]);
                }
            }
        }

        // Recalculate invoice amount when payment_method changes (e.g. Afterpay surcharge)
        if ($booking->wasChanged('payment_method')) {
            $booking->invoice?->recalculateAmount();
        }
    }

    public function deleted(Booking $booking): void
    {
        app(TrackingCacheService::class)->forgetBooking($booking);
    }

    public function restored(Booking $booking): void
    {
        app(TrackingCacheService::class)->forgetBooking($booking);
    }

    public function forceDeleted(Booking $booking): void
    {
        app(TrackingCacheService::class)->forgetBooking($booking);
    }
}
