<?php

namespace App\Notifications;

use App\Notifications\Channels\BrevoSmsMessage;
use App\Models\Booking;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class PickupReminderSms extends Notification implements ShouldQueue
{
    use Queueable;

    public $booking;

    public ?array $channels = null;

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    public function __construct(Booking $booking)
    {
        $this->booking = $booking;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param  mixed  $notifiable
     * @return array
     */
    public function via($notifiable)
    {
        if (isset($this->channels)) {
            return $this->channels;
        }

        return ['brevo']; // Using Brevo for SMS
    }

    /**
     * Get the Brevo / SMS representation of the notification.
     *
     * @param  mixed  $notifiable
     * @return BrevoSmsMessage
     */
    public function toBrevo($notifiable)
    {
        $date = $this->booking->preferred_date instanceof CarbonInterface
            ? $this->booking->preferred_date->format('M d, Y')
            : ($this->booking->preferred_date ? date('M d, Y', strtotime($this->booking->preferred_date)) : __('messages.defaults.upcoming_date'));

        return (new BrevoSmsMessage)
            ->content(__('messages.notifications.pickup_reminder.sms', [
                'appName' => config('app.name'),
                'reference' => $this->booking->reference_number,
                'date' => $date,
            ]));
    }
}
