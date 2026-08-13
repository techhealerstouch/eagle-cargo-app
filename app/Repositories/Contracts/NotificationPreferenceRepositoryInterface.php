<?php

namespace App\Repositories\Contracts;

use App\Enums\NotificationChannel;
use App\Enums\NotificationEvent;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Support\Collection;

interface NotificationPreferenceRepositoryInterface
{
    public function getForUser(User $user): Collection;

    public function isEnabled(User $user, NotificationChannel $channel, NotificationEvent $event): bool;

    public function setPreference(
        User $user,
        NotificationChannel $channel,
        NotificationEvent $event,
        bool $enabled
    ): NotificationPreference;

    public function bulkSetForUser(User $user, array $preferences): void;

    public function getEnabledChannelsForEvent(User $user, NotificationEvent $event): array;
}
