<?php

namespace App\Notifications;

use App\Enums\BoxStatus;
use App\Models\Box;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class BoxExceptionReported extends Notification implements ShouldQueue
{
    use Queueable;

    public ?array $channels = null;

    public function __construct(
        protected Box $box,
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
        $statusLabel = $this->box->status instanceof BoxStatus
            ? $this->box->status->label()
            : (string) $this->box->status;

        return [
            'type' => 'box_status',
            'box_id' => $this->box->id,
            'title' => __('Box Operational Exception'),
            'message' => __('Box :tracking status marked as :status.', [
                'tracking' => $this->box->tracking_number,
                'status' => $statusLabel,
            ]),
            'url' => '/admin/boxes/'.$this->box->id,
        ];
    }
}
