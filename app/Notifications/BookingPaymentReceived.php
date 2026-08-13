<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookingPaymentReceived extends Notification implements ShouldQueue
{
    use Queueable;

    public ?array $channels = null;

    public function __construct(
        protected Booking $booking,
        protected Invoice $invoice,
    ) {}

    public function via(object $notifiable): array
    {
        if (isset($this->channels)) {
            return $this->channels;
        }

        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $recipientName = '';
        if ($notifiable instanceof \App\Models\Sender) {
            $recipientName = trim((string) ($notifiable->first_name ?? ''));
        } elseif ($notifiable instanceof \App\Models\User) {
            $recipientName = trim((string) ($notifiable->name ?? ''));
        }

        if ($recipientName === '') {
            $recipientName = __('messages.defaults.recipient_name');
        }

        return (new MailMessage)
            ->subject(__('messages.notifications.booking_payment.subject', [
                'reference' => $this->booking->reference_number,
            ]))
            ->greeting(__('messages.notifications.booking_payment.greeting', [
                'name' => $recipientName,
            ]))
            ->line(__('messages.notifications.booking_payment.line_paid', [
                'reference' => $this->booking->reference_number,
            ]))
            ->line(__('messages.notifications.booking_payment.line_invoice', [
                'invoice' => $this->invoice->invoice_number,
            ]))
            ->line(__('messages.notifications.booking_payment.line_copy_required'))
            ->action(
                __('messages.notifications.booking_payment.action'),
                url('/bookings')
            )
            ->line(__('messages.notifications.booking_payment.closing', ['appName' => config('app.name')]));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'payment',
            'booking_id' => $this->booking->id,
            'reference' => $this->booking->reference_number,
            'invoice_id' => $this->invoice->id,
            'invoice_number' => $this->invoice->invoice_number,
            'title' => __('Payment Received'),
            'message' => __('Payment received for booking :reference (Invoice :invoice).', [
                'reference' => $this->booking->reference_number,
                'invoice' => $this->invoice->invoice_number,
            ]),
            'url' => '/bookings?highlight='.$this->booking->reference_number,
        ];
    }
}
