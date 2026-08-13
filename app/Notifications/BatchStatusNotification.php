<?php

namespace App\Notifications;

use App\Enums\BatchStatus;
use App\Enums\NotificationEvent;
use App\Models\Batch;
use App\Notifications\Channels\BrevoSmsMessage;
use App\Notifications\Channels\BrevoSmsChannel;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BatchStatusNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public ?array $channels = null;

    public function __construct(
        protected Batch $batch,
        protected BatchStatus $status
    ) {}

    public function via(object $notifiable): array
    {
        if (isset($this->channels)) {
            return $this->channels;
        }

        $event = $this->mapStatusToEvent();

        if ($event === null) {
            return ['database', 'mail', 'broadcast'];
        }

        $service = app(NotificationService::class);

        return $service->getEnabledChannels($notifiable, $event);
    }

    public function toMail(object $notifiable): MailMessage
    {
        $subject = $this->getSubject();
        $message = $this->getMessage();
        $appName = config('app.name');

        return (new MailMessage)
            ->subject($subject)
            ->greeting(__('notifications.greeting', ['name' => $notifiable->name ?? 'Customer']))
            ->line($message)
            ->line(__('messages.notifications.batch.details', [
                'batch_number' => $this->batch->batch_number,
                'voyage' => $this->batch->voyage_number ?? 'N/A',
                'route' => $this->getRouteDescription(),
            ]))
            ->action(__('notifications.track_action'), url('/tracking'))
            ->line(__('notifications.closing', ['appName' => $appName]));
    }

    public function toArray(object $notifiable): array
    {
        $url = '/tracking';
        try {
            if (isset($notifiable->sender)) {
                $sender = $notifiable->sender;
                if ($sender) {
                    $box = \App\Models\Box::where('batch_id', $this->batch->id)
                        ->whereHas('booking', function ($q) use ($sender) {
                            $q->where('sender_id', $sender->id);
                        })
                        ->first();
                    if ($box) {
                        $url = '/track/' . $box->tracking_number . '?highlight=1';
                    }
                }
            }
        } catch (\Exception $e) {
            // Fallback
        }

        return [
            'type' => 'batch_status',
            'batch_id' => $this->batch->id,
            'batch_number' => $this->batch->batch_number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'title' => $this->getTitle(),
            'message' => $this->getMessage(),
            'url' => $url,
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }

    public function toBrevo(object $notifiable): BrevoSmsMessage
    {
        $statusLabel = $this->status->label();
        $appName = config('app.name', 'Love Balikbayan');
        $trackingUrl = url('/tracking');

        $message = match ($this->status) {
            BatchStatus::Sailed => __('notifications.batch.message.departed', [
                'batch' => $this->batch->batch_number,
                'port' => $this->batch->origin_port ?? 'origin',
                'eta' => $this->batch->eta_at?->format('M d, Y') ?? 'soon',
            ]),
            BatchStatus::Arrived => __('notifications.batch.message.arrived', [
                'batch' => $this->batch->batch_number,
                'port' => $this->batch->destination_port ?? 'destination',
            ]),
            BatchStatus::Delivered => __('notifications.batch.message.delivered', [
                'batch' => $this->batch->batch_number,
            ]),
            default => __('notifications.batch.message.update', [
                'batch' => $this->batch->batch_number,
                'status' => $statusLabel,
            ]),
        };

        return (new BrevoSmsMessage)
            ->content("{$appName}: {$message} Track: {$trackingUrl}");
    }

    private function mapStatusToEvent(): ?NotificationEvent
    {
        return match ($this->status) {
            BatchStatus::Sailed => NotificationEvent::BatchSailed,
            BatchStatus::Arrived => NotificationEvent::BatchArrived,
            BatchStatus::Delivered => NotificationEvent::BatchDelivered,
            default => null,
        };
    }

    private function getSubject(): string
    {
        return match ($this->status) {
            BatchStatus::Sailed => __('notifications.batch.subject.departed', [
                'batch' => $this->batch->batch_number,
            ]),
            BatchStatus::Arrived => __('notifications.batch.subject.arrived', [
                'batch' => $this->batch->batch_number,
            ]),
            BatchStatus::Delivered => __('notifications.batch.subject.delivered', [
                'batch' => $this->batch->batch_number,
            ]),
            default => __('notifications.batch.subject.update', [
                'batch' => $this->batch->batch_number,
            ]),
        };
    }

    private function getTitle(): string
    {
        return match ($this->status) {
            BatchStatus::Sailed => 'Your Package is On Its Way!',
            BatchStatus::Arrived => 'Your Package Has Arrived!',
            BatchStatus::Delivered => 'Package Delivered!',
            default => 'Shipment Update',
        };
    }

    private function getMessage(): string
    {
        return match ($this->status) {
            BatchStatus::Sailed => __('notifications.batch.message.departed', [
                'batch' => $this->batch->batch_number,
                'port' => $this->batch->origin_port ?? 'origin',
                'eta' => $this->batch->eta_at?->format('M d, Y') ?? 'soon',
            ]),
            BatchStatus::Arrived => __('notifications.batch.message.arrived', [
                'batch' => $this->batch->batch_number,
                'port' => $this->batch->destination_port ?? 'destination',
            ]),
            BatchStatus::Delivered => __('notifications.batch.message.delivered', [
                'batch' => $this->batch->batch_number,
            ]),
            default => __('notifications.batch.message.update', [
                'batch' => $this->batch->batch_number,
                'status' => $this->status->label(),
            ]),
        };
    }

    private function getRouteDescription(): string
    {
        $origin = $this->batch->origin_port ?? 'Origin';
        $destination = $this->batch->destination_port ?? 'Destination';

        return "{$origin} → {$destination}";
    }
}
