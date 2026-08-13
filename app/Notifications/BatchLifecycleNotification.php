<?php

namespace App\Notifications;

use App\Enums\BatchStatus;
use App\Models\Batch;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BatchLifecycleNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public ?array $channels = null;

    public function __construct(
        protected Batch $batch,
        protected BatchStatus $newStatus
    ) {}

    public function via(object $notifiable): array
    {
        if (isset($this->channels)) {
            return $this->channels;
        }

        return ['database', 'mail', 'broadcast'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $subject = $this->getSubject();
        $message = $this->getMessage();
        $appName = config('app.name');

        return (new MailMessage)
            ->subject($subject)
            ->line($message)
            ->line(__('messages.notifications.batch.details', [
                'batch_number' => $this->batch->batch_number,
                'voyage' => $this->batch->voyage_number ?? 'N/A',
                'route' => $this->getRouteDescription(),
            ]))
            ->action(__('messages.notifications.batch.action'), url('/admin/batches'))
            ->line(__('messages.notifications.batch.closing', ['appName' => $appName]));
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'batch_lifecycle',
            'batch_id' => $this->batch->id,
            'batch_number' => $this->batch->batch_number,
            'status' => $this->newStatus->value,
            'status_label' => $this->newStatus->label(),
            'title' => $this->getTitle(),
            'message' => $this->getMessage(),
            'url' => '/admin/batches/'.$this->batch->id.'/edit',
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }

    private function getSubject(): string
    {
        return match ($this->newStatus) {
            BatchStatus::ReadyToClose => __('messages.notifications.batch.subject.ready_to_close', [
                'batch' => $this->batch->batch_number,
            ]),
            BatchStatus::Sailed => __('messages.notifications.batch.subject.departed', [
                'batch' => $this->batch->batch_number,
            ]),
            BatchStatus::Arrived => __('messages.notifications.batch.subject.arrived', [
                'batch' => $this->batch->batch_number,
            ]),
            default => __('messages.notifications.batch.subject.default', [
                'batch' => $this->batch->batch_number,
            ]),
        };
    }

    private function getTitle(): string
    {
        return match ($this->newStatus) {
            BatchStatus::ReadyToClose => 'Batch Ready to Close',
            BatchStatus::Sailed => 'Batch Sailed',
            BatchStatus::Arrived => 'Batch Arrived',
            BatchStatus::Delivered => 'Batch Delivered',
            default => 'Batch Status Updated',
        };
    }

    private function getMessage(): string
    {
        return match ($this->newStatus) {
            BatchStatus::ReadyToClose => __('messages.notifications.batch.message.ready_to_close', [
                'batch' => $this->batch->batch_number,
                'box_count' => $this->batch->current_box_count,
            ]),
            BatchStatus::Sailed => __('messages.notifications.batch.message.departed', [
                'batch' => $this->batch->batch_number,
                'port' => $this->batch->origin_port ?? 'origin',
            ]),
            BatchStatus::Arrived => __('messages.notifications.batch.message.arrived', [
                'batch' => $this->batch->batch_number,
                'port' => $this->batch->destination_port ?? 'destination',
            ]),
            default => __('messages.notifications.batch.message.default', [
                'batch' => $this->batch->batch_number,
                'status' => $this->newStatus->label(),
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
