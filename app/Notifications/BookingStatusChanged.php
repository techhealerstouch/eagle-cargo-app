<?php

namespace App\Notifications;

use App\Enums\BookingStatus;
use App\Notifications\Channels\BrevoSmsMessage;
use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookingStatusChanged extends Notification implements ShouldQueue
{
    use Queueable;

    protected $booking;

    public ?array $channels = null;

    public function __construct(Booking $booking)
    {
        $this->booking = $booking;
    }

    public function via(object $notifiable): array
    {
        if (isset($this->channels)) {
            return $this->channels;
        }

        $channels = ['mail', 'database'];

        // SMS for critical stage updates
        $statusValue = $this->booking->status instanceof BookingStatus ? $this->booking->status->value : $this->booking->status;
        if (in_array($statusValue, ['confirmed', 'collected'])) {
            $channels[] = 'brevo';
        }

        return $channels;
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

        $statusLabel = $this->booking->status instanceof BookingStatus ? $this->booking->status->label() : ucfirst($this->booking->status);

        $appName = config('app.name');

        return (new MailMessage)
            ->subject(__('messages.notifications.booking_status.subject', [
                'reference' => $this->booking->reference_number,
            ]))
            ->greeting(__('messages.notifications.booking_status.greeting', [
                'name' => $recipientName,
            ]))
            ->line(__('messages.notifications.booking_status.line_status', [
                'status' => $statusLabel,
            ]))
            ->line(__('messages.notifications.booking_status.line_reference', [
                'reference' => $this->booking->reference_number,
            ]))
            ->action(
                __('messages.notifications.booking_status.action'),
                url('/tracking/'.$this->booking->reference_number)
            )
            ->line(__('messages.notifications.booking_status.closing', ['appName' => $appName]));
    }

    public function toBrevo(object $notifiable): BrevoSmsMessage
    {
        $statusLabel = $this->booking->status instanceof BookingStatus ? $this->booking->status->label() : ucfirst((string) $this->booking->status);

        return (new BrevoSmsMessage)
            ->content(__('messages.notifications.booking_status.sms', [
                'appName' => config('app.name'),
                'reference' => $this->booking->reference_number,
                'status' => $statusLabel,
                'url' => url('/tracking/'.$this->booking->reference_number.'?highlight=1'),
            ]));
    }

    public function toArray(object $notifiable): array
    {
        $statusLabel = $this->booking->status instanceof BookingStatus
            ? $this->booking->status->label()
            : ucfirst((string) $this->booking->status);

        return [
            'type' => 'booking',
            'booking_id' => $this->booking->id,
            'status' => $this->booking->status instanceof BookingStatus
                ? $this->booking->status->value
                : $this->booking->status,
            'status_label' => $statusLabel,
            'reference' => $this->booking->reference_number,
            'title' => __('Booking :status', ['status' => $statusLabel]),
            'message' => __('Your booking :reference status has been updated to :status.', [
                'reference' => $this->booking->reference_number,
                'status' => $statusLabel,
            ]),
            'url' => '/tracking/' . $this->booking->reference_number . '?highlight=1',
        ];
    }
}
