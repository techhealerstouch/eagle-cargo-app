<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class GuestBookingAccessCode extends Notification
{
    public function __construct(
        private readonly Booking $booking,
        private readonly string $purpose,
        private readonly string $code,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $label = match ($this->purpose) {
            'payment' => 'payment',
            'confirmation' => 'order confirmation',
            'declaration' => 'customs declaration',
            default => 'booking',
        };

        return (new MailMessage)
            ->subject('Your Eagle Express Cargo verification code')
            ->greeting('Verify your '.$label)
            ->line('Use this one-time code to continue with booking '.$this->booking->reference_number.'.')
            ->line('**'.$this->code.'**')
            ->line('This code expires in 10 minutes and can only be used once.')
            ->line('If you did not request this, you can safely ignore this email.');
    }
}
