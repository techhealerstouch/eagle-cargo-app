<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class DeclarationFormSubmittedNotification extends Notification implements ShouldQueue
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
        return [
            'type' => 'booking',
            'booking_id' => $this->booking->id,
            'title' => __('Declaration Form Submitted'),
            'message' => __('Customs declaration form submitted for booking :ref.', [
                'ref' => $this->booking->reference_number,
            ]),
            'url' => '/admin/bookings/'.$this->booking->id,
        ];
    }
}
