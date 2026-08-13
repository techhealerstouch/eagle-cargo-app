<?php

namespace App\Notifications;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CashPaymentPendingConfirmation extends Notification implements ShouldQueue
{
    use Queueable;

    public ?array $channels = null;

    public function __construct(
        protected Payment $payment,
    ) {}

    public function via(object $notifiable): array
    {
        if (isset($this->channels)) {
            return $this->channels;
        }

        return ['database']; // We will just send it via database for now to show up on the admin panel
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'payment',
            'payment_id' => $this->payment->id,
            'invoice_id' => $this->payment->invoice_id,
            'title' => __('Cash Payment Confirmation'),
            'message' => __('Cash payment of $:amount collected by :collector requires confirmation.', [
                'amount' => number_format($this->payment->amount, 2),
                'collector' => $this->payment->collectedBy->name ?? 'Picker',
            ]),
            'url' => '/admin/payments?search=' . urlencode($this->payment->invoice->invoice_number ?? ''),
        ];
    }
}
