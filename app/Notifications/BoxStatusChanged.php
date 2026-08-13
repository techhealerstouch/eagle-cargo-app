<?php

namespace App\Notifications;

use App\Enums\BoxStatus;
use App\Enums\NotificationChannel;
use App\Enums\NotificationEvent;
use App\Models\Box;
use App\Models\NotificationPreference;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use App\Notifications\Channels\BrevoSmsMessage;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BoxStatusChanged extends Notification implements ShouldQueue
{
    use Queueable;

    protected array $overrideChannels = [];

    public function __construct(protected Box $box) {}

    /**
     * Override channels (used by NotificationService).
     */
    public function via(array|object|null $channels = null): array|self
    {
        // If called with an array, we're setting override channels
        if (is_array($channels)) {
            $this->overrideChannels = $channels;

            return $this;
        }

        // If override channels set, use them
        if (! empty($this->overrideChannels)) {
            return $this->overrideChannels;
        }

        // Default behavior: determine channels based on user preferences
        return $this->determineChannels($channels);
    }

    private function determineChannels(object $notifiable): array
    {
        $channels = ['database']; // Always store in-app

        $event = $this->mapStatusToEvent();
        if (! $event) {
            return $channels;
        }

        // Check user preferences for each channel
        if ($this->isChannelEnabled($notifiable, NotificationChannel::Email, $event)) {
            $channels[] = 'mail';
        }

        if ($this->isChannelEnabled($notifiable, NotificationChannel::Sms, $event) && $this->hasBrevoCredentials()) {
            $channels[] = 'brevo';
        }

        if ($this->isChannelEnabled($notifiable, NotificationChannel::Push, $event)) {
            $channels[] = 'broadcast';
        }

        return $channels;
    }

    private function mapStatusToEvent(): ?NotificationEvent
    {
        $status = $this->box->status instanceof BoxStatus
            ? $this->box->status
            : BoxStatus::tryFrom($this->box->status);

        return match ($status) {
            BoxStatus::Collected => NotificationEvent::BoxCollected,
            BoxStatus::ReceivedByWarehouse => NotificationEvent::BoxShipped,
            BoxStatus::InTransit => NotificationEvent::BoxInTransit,
            BoxStatus::Arrived => NotificationEvent::BoxArrived,
            BoxStatus::Delivered => NotificationEvent::BoxDelivered,
            default => null,
        };
    }

    private function isChannelEnabled(object $notifiable, NotificationChannel $channel, NotificationEvent $event): bool
    {
        // Determine correct user ID to check preferences for
        $userId = null;
        if ($notifiable instanceof \App\Models\User) {
            $userId = $notifiable->id;
        } elseif ($notifiable instanceof \App\Models\Sender) {
            $userId = $notifiable->user_id;
        } elseif (method_exists($notifiable, 'getKey')) {
            $userId = $notifiable->getKey();
        }

        // If we can't find a user ID, we can't check preferences, so allow by default
        if ($userId === null) {
            return true;
        }

        $preference = NotificationPreference::where('user_id', $userId)
            ->where('channel', $channel->value)
            ->where('event_type', $event->value)
            ->first();

        return $preference?->enabled ?? true;
    }

    private function hasBrevoCredentials(): bool
    {
        return (string) config('services.brevo.api_key', '') !== '';
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

        $statusLabel = $this->box->status instanceof BoxStatus ? $this->box->status->label() : ucfirst((string) $this->box->status);

        return (new MailMessage)
            ->subject(__('messages.notifications.box_status.subject', [
                'tracking' => $this->box->tracking_number,
            ]))
            ->greeting(__('messages.notifications.box_status.greeting', [
                'name' => $recipientName,
            ]))
            ->line(__('messages.notifications.box_status.line_status', [
                'box_type' => $this->box->boxType->name ?? __('messages.defaults.box_type'),
                'status' => $statusLabel,
            ]))
            ->line(__('messages.notifications.box_status.line_tracking', [
                'tracking' => $this->box->tracking_number,
            ]))
            ->action(
                __('messages.notifications.box_status.action'),
                url('/track/'.$this->box->tracking_number)
            )
            ->line(__('messages.notifications.box_status.closing'));
    }

    public function toBrevo(object $notifiable): BrevoSmsMessage
    {
        $statusLabel = $this->box->status instanceof BoxStatus ? $this->box->status->label() : ucfirst((string) $this->box->status);

        return (new BrevoSmsMessage)
            ->content(__('messages.notifications.box_status.sms', [
                'appName' => config('app.name'),
                'tracking' => $this->box->tracking_number,
                'status' => $statusLabel,
                'url' => url('/track/'.$this->box->tracking_number.'?highlight=1'),
            ]));
    }

    public function toArray(object $notifiable): array
    {
        $statusValue = $this->box->status instanceof BoxStatus
            ? $this->box->status->value
            : $this->box->status;

        $statusLabel = $this->box->status instanceof BoxStatus
            ? $this->box->status->label()
            : ucfirst((string) $this->box->status);

        return [
            'type' => 'box_status',
            'box_id' => $this->box->id,
            'tracking_number' => $this->box->tracking_number,
            'status' => $statusValue,
            'status_label' => $statusLabel,
            'title' => __('Box: :status', ['status' => $statusLabel]),
            'message' => __('messages.notifications.box_status.line_status', [
                'box_type' => $this->box->boxType->name ?? __('messages.defaults.box_type'),
                'status' => $statusLabel,
            ]),
            'url' => '/track/'.$this->box->tracking_number.'?highlight=1',
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
