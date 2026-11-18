<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class NewOnlineBookingReceived extends Notification
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

        return ['database', 'broadcast'];
    }

    public function broadcastType(): string
    {
        return 'booking';
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return (new BroadcastMessage($this->toArray($notifiable)))
            ->onConnection('sync');
    }

    public function toArray(object $notifiable): array
    {
        $sender = $this->booking->sender;
        $senderFullName = trim(($sender?->first_name ?? '').' '.($sender?->last_name ?? ''));
        $senderName = $senderFullName !== ''
            ? $senderFullName
            : ($sender?->user?->name ?? 'Customer');

        $isGuest = (bool) $this->booking->is_guest;
        $isEmptyBoxOrder = ! empty($this->booking->empty_box_items)
            || ((int) $this->booking->empty_box_count > 0
                && ($this->booking->relationLoaded('boxes')
                    ? $this->booking->boxes->isEmpty()
                    : ! $this->booking->boxes()->exists()));

        $title = $isGuest ? __('New Guest Booking') : __('New Online Booking');

        $message = $isEmptyBoxOrder
            ? __('New empty box order :ref received from :sender.', [
                'ref' => $this->booking->reference_number,
                'sender' => $senderName,
            ])
            : __('New booking :ref received from :sender.', [
                'ref' => $this->booking->reference_number,
                'sender' => $senderName,
            ]);

        return [
            'type' => 'booking',
            'booking_id' => $this->booking->id,
            'reference' => $this->booking->reference_number,
            'is_guest' => $isGuest,
            'title' => $title,
            'message' => $message,
            'url' => '/admin/bookings/'.$this->booking->id,
        ];
    }
}
