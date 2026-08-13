<?php

namespace App\Services;

use App\Enums\NotificationChannel;
use App\Enums\NotificationEvent;
use App\Models\User;
use App\Repositories\Contracts\NotificationPreferenceRepositoryInterface;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    public function __construct(
        private readonly NotificationPreferenceRepositoryInterface $preferenceRepository
    ) {}

    /**
     * Send notification to a user, respecting their channel preferences.
     */
    public function notify(User $user, Notification $notification, NotificationEvent $event): void
    {
        $enabledChannels = $this->preferenceRepository->getEnabledChannelsForEvent($user, $event);

        if (empty($enabledChannels)) {
            Log::debug('NotificationService: No channels enabled for user', [
                'user_id' => $user->id,
                'event' => $event->value,
            ]);

            return;
        }

        $laravelChannels = $this->mapToLaravelChannels($enabledChannels);

        // Check if the notification class has a way to accept custom channels
        // We use @var mixed to avoid PHPStan/IDE errors about undefined properties on the base Notification class
        /** @var mixed $notif */
        $notif = $notification;

        if (property_exists($notif, 'channels')) {
            $notif->channels = $laravelChannels;
        }

        $user->notify($notif);
        $this->forgetUnreadCount($user);
    }

    /**
     * Send notification to multiple users.
     */
    public function notifyMany(Collection $users, Notification $notification, NotificationEvent $event): void
    {
        $users->each(fn (User $user) => $this->notify($user, $notification, $event));
    }

    /**
     * Resolve enabled channels for a notifiable to Laravel channel names.
     */
    public function getEnabledChannels(object $notifiable, NotificationEvent $event): array
    {
        if (! $notifiable instanceof User) {
            return ['database'];
        }

        $enabledChannels = $this->preferenceRepository->getEnabledChannelsForEvent($notifiable, $event);
        $laravelChannels = $this->mapToLaravelChannels($enabledChannels);

        if (! in_array('database', $laravelChannels, true)) {
            $laravelChannels[] = 'database';
        }

        return array_values(array_unique($laravelChannels));
    }

    /**
     * Check if user has a specific channel enabled for an event.
     */
    public function isChannelEnabled(User $user, NotificationChannel $channel, NotificationEvent $event): bool
    {
        return $this->preferenceRepository->isEnabled($user, $channel, $event);
    }

    /**
     * Get user's unread notification count.
     */
    public function getUnreadCount(User $user): int
    {
        return Cache::remember(
            $this->unreadCountKey($user),
            now()->addMinutes(60),
            fn () => $user->unreadNotifications()->count(),
        );
    }

    /**
     * Get user's notifications (paginated).
     */
    public function getNotifications(User $user, int $perPage = 15): mixed
    {
        return $user->notifications()->paginate($perPage);
    }

    /**
     * Mark notification as read.
     */
    public function markAsRead(User $user, string $notificationId): bool
    {
        $updated = (bool) $user->unreadNotifications()
            ->where('id', $notificationId)
            ->update(['read_at' => now()]);

        if ($updated) {
            $this->forgetUnreadCount($user);
        }

        return $updated;
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(User $user): void
    {
        $user->unreadNotifications()->update(['read_at' => now()]);
        $this->forgetUnreadCount($user);
    }

    public function forgetUnreadCount(User $user): void
    {
        Cache::forget($this->unreadCountKey($user));
    }

    private function unreadCountKey(User $user): string
    {
        return "user.{$user->id}.unread_notifications";
    }

    /**
     * Map our channel enum values to Laravel notification channels.
     */
    private function mapToLaravelChannels(array $channels): array
    {
        $mapping = [
            NotificationChannel::Email->value => 'mail',
            NotificationChannel::Sms->value => 'brevo',
            NotificationChannel::Push->value => 'broadcast',
            NotificationChannel::InApp->value => 'database',
        ];

        return array_values(array_filter(
            array_map(fn ($channel) => $mapping[$channel] ?? null, $channels)
        ));
    }
}
