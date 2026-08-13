<?php

namespace App\Repositories\Eloquent;

use App\Enums\NotificationChannel;
use App\Enums\NotificationEvent;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Repositories\Contracts\NotificationPreferenceRepositoryInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class NotificationPreferenceRepository implements NotificationPreferenceRepositoryInterface
{
    public function getForUser(User $user): Collection
    {
        return NotificationPreference::where('user_id', $user->id)->get();
    }

    public function isEnabled(User $user, NotificationChannel $channel, NotificationEvent $event): bool
    {
        $preference = NotificationPreference::where('user_id', $user->id)
            ->where('channel', $channel->value)
            ->where('event_type', $event->value)
            ->first();

        // Default to enabled if no preference exists
        return $preference?->enabled ?? true;
    }

    public function setPreference(
        User $user,
        NotificationChannel $channel,
        NotificationEvent $event,
        bool $enabled
    ): NotificationPreference {
        return NotificationPreference::updateOrCreate(
            [
                'user_id' => $user->id,
                'channel' => $channel->value,
                'event_type' => $event->value,
            ],
            ['enabled' => $enabled]
        );
    }

    public function bulkSetForUser(User $user, array $preferences): void
    {
        DB::transaction(function () use ($user, $preferences) {
            foreach ($preferences as $pref) {
                $this->setPreference(
                    $user,
                    NotificationChannel::from($pref['channel']),
                    NotificationEvent::from($pref['event_type']),
                    $pref['enabled']
                );
            }
        });
    }

    public function getEnabledChannelsForEvent(User $user, NotificationEvent $event): array
    {
        $preferences = NotificationPreference::where('user_id', $user->id)
            ->where('event_type', $event->value)
            ->where('enabled', true)
            ->pluck('channel')
            ->map(function ($channel) {
                if ($channel instanceof NotificationChannel) {
                    return $channel->value;
                }

                return (string) $channel;
            })
            ->filter()
            ->values()
            ->toArray();

        // If no preferences exist, default to all channels enabled
        if (empty($preferences)) {
            return NotificationChannel::values();
        }

        return $preferences;
    }
}
