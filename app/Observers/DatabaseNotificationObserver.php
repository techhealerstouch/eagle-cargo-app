<?php

namespace App\Observers;

use App\Models\User;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Cache;

class DatabaseNotificationObserver
{
    public function created(DatabaseNotification $notification): void
    {
        $this->forgetUnreadCount($notification);
    }

    public function updated(DatabaseNotification $notification): void
    {
        if ($notification->wasChanged('read_at')) {
            $this->forgetUnreadCount($notification);
        }
    }

    public function deleted(DatabaseNotification $notification): void
    {
        $this->forgetUnreadCount($notification);
    }

    private function forgetUnreadCount(DatabaseNotification $notification): void
    {
        if ($notification->notifiable_type !== User::class || ! $notification->notifiable_id) {
            return;
        }

        Cache::forget("user.{$notification->notifiable_id}.unread_notifications");
    }
}
