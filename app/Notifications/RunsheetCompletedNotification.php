<?php

namespace App\Notifications;

use App\Models\Runsheet;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class RunsheetCompletedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public ?array $channels = null;

    public function __construct(
        protected Runsheet $runsheet,
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
        $driverName = $this->runsheet->picker?->name
            ?? $this->runsheet->courier?->name
            ?? 'Driver';

        return [
            'type' => 'runsheet_assigned',
            'runsheet_id' => $this->runsheet->id,
            'title' => __('Runsheet Completed'),
            'message' => __('Runsheet :num completed by :driver.', [
                'num' => $this->runsheet->runsheet_number,
                'driver' => $driverName,
            ]),
            'url' => '/admin/runsheets/'.$this->runsheet->id,
        ];
    }
}
