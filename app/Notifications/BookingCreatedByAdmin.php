<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookingCreatedByAdmin extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public Booking $booking
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $appName = config('app.name');
        
        $mail = (new MailMessage)
            ->subject('New Booking Created - ' . $this->booking->reference_number)
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line('Our administrative team has created a new booking for you.')
            ->line('**Booking Reference:** ' . $this->booking->reference_number);

        $trackingNumbers = $this->booking->boxes()->pluck('tracking_number')->filter();

        if ($trackingNumbers->count() > 1) {
            $mail->line('**Tracking Numbers:** ' . $trackingNumbers->implode(', '));
            $mail->line('Please paste your tracking numbers at the tracking panel to track your packages.');
        } elseif ($trackingNumbers->count() === 1) {
            $mail->line('**Tracking Number:** ' . $trackingNumbers->first());
            $mail->line('Please paste the tracking number at the tracking panel to track your package.');
        } else {
            $mail->line('Tracking numbers will be assigned shortly.');
        }

        return $mail
            ->line('You can also log in to your account to view the full booking details and for real-time BOC monitoring.')
            ->action('Tracking Panel', url('/track'))
            ->line('Thank you for using ' . $appName . '!');
    }
}
