<?php

namespace App\Notifications;

use App\Enums\NotificationEvent;
use App\Enums\RunsheetType;
use App\Models\Runsheet;
use App\Notifications\Channels\BrevoSmsMessage;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RunsheetAssigned extends Notification implements ShouldQueue
{
    use Queueable;

    public ?array $channels = null;

    public function __construct(protected Runsheet $runsheet) {}

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        if (isset($this->channels)) {
            return $this->channels;
        }

        $service = app(NotificationService::class);

        return $service->getEnabledChannels($notifiable, NotificationEvent::RunsheetAssigned);
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $isPicker = $this->runsheet->type === RunsheetType::Pickup;
        $dateStr = $this->runsheet->scheduled_date ? $this->runsheet->scheduled_date->format('Y-m-d') : 'upcoming';
        
        $recipientName = trim((string) ($notifiable->name ?? ''));
        if ($recipientName === '') {
            $recipientName = __('messages.defaults.recipient_name');
        }

        $message = $isPicker
            ? __('messages.notifications.runsheet_assigned.line_commission', ['date' => $dateStr])
            : __('messages.notifications.runsheet_assigned.line_delivery', ['date' => $dateStr]);

        $url = $isPicker
            ? url('/picker/runsheet/' . $this->runsheet->id)
            : url('/courier/runsheet/' . $this->runsheet->id);

        return (new MailMessage)
            ->subject(__('messages.notifications.runsheet_assigned.subject', ['date' => $dateStr]))
            ->greeting(__('messages.notifications.runsheet_assigned.greeting', ['name' => $recipientName]))
            ->line($message)
            ->action(__('messages.notifications.runsheet_assigned.action'), $url)
            ->line(__('messages.notifications.runsheet_assigned.closing'));
    }

    /**
     * Get the SMS representation of the notification using Brevo.
     */
    public function toBrevo(object $notifiable): BrevoSmsMessage
    {
        $isPicker = $this->runsheet->type === RunsheetType::Pickup;
        $dateStr = $this->runsheet->scheduled_date ? $this->runsheet->scheduled_date->format('Y-m-d') : 'upcoming';
        
        $url = $isPicker
            ? url('/picker/runsheet/' . $this->runsheet->id)
            : url('/courier/runsheet/' . $this->runsheet->id);

        $contentKey = $isPicker ? 'sms_commission' : 'sms_delivery';

        return (new BrevoSmsMessage)
            ->content(__('messages.notifications.runsheet_assigned.' . $contentKey, [
                'appName' => config('app.name'),
                'date' => $dateStr,
                'url' => $url,
            ]));
    }

    /**
     * Get the array representation of the notification for database storing.
     */
    public function toArray(object $notifiable): array
    {
        $isPicker = $this->runsheet->type === RunsheetType::Pickup;
        $dateStr = $this->runsheet->scheduled_date ? $this->runsheet->scheduled_date->format('Y-m-d') : 'upcoming';
        
        $title = $isPicker
            ? __('messages.notifications.runsheet_assigned.subject', ['date' => $dateStr]) . ' (Earn Commission)'
            : __('messages.notifications.runsheet_assigned.subject', ['date' => $dateStr]);
        
        $message = $isPicker
            ? __('messages.notifications.runsheet_assigned.line_commission', ['date' => $dateStr])
            : __('messages.notifications.runsheet_assigned.line_delivery', ['date' => $dateStr]);

        $url = $isPicker
            ? '/picker/runsheet/' . $this->runsheet->id
            : '/courier/runsheet/' . $this->runsheet->id;

        return [
            'type' => 'runsheet_assigned',
            'runsheet_id' => $this->runsheet->id,
            'scheduled_date' => $dateStr,
            'title' => $title,
            'message' => $message,
            'url' => $url,
        ];
    }

    /**
     * Get the broadcast representation of the notification.
     */
    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
