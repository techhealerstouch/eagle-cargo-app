<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class NewOnlineBookingReceived extends Notification implements ShouldQueue
{
    use Queueable;

    public ?array $channels = null;

    public function __construct(
        protected Booking $booking,
    ) {}

    public function via(object $notifiable): array
    {
        if (isset($this->channels)) {
            return $this->channels;
        }

        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $senderName = $this->booking->sender?->full_name
            ?? $this->booking->sender?->user?->name
            ?? 'Customer';

        return [
            'type' => 'booking',
            'booking_id' => $this->booking->id,
            'title' => __('New Online Booking'),
            'message' => __('New booking :ref received from :sender.', [
                'ref' => $this->booking->reference_number,
                'sender' => $senderName,
            ]),
            'url' => '/admin/bookings/'.$this->booking->id,
        ];
    }
}
