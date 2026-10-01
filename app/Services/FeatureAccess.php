<?php

namespace App\Services;

use App\Enums\Feature;
use App\Models\FeatureFlag;
use App\Models\User;

class FeatureAccess
{
    public function __construct(private readonly DeveloperAccess $developerAccess) {}

    public function getFlag(Feature|string $feature): ?FeatureFlag
    {
        $key = $feature instanceof Feature ? $feature->value : (string) $feature;

        return FeatureFlag::query()->where('feature_key', $key)->first();
    }

    public function getStatus(Feature|string $feature): string
    {
        $flag = $this->getFlag($feature);

        if (! $flag) {
            return 'hidden';
        }

        return $flag->status ?? ($flag->enabled ? 'released' : 'hidden');
    }

    public function getMaintenanceMessage(Feature|string $feature): ?string
    {
        return $this->getFlag($feature)?->maintenance_message;
    }

    public function isReleased(Feature|string $feature): bool
    {
        $flag = $this->getFlag($feature);

        if (! $flag) {
            return false;
        }

        return $flag->isReleased();
    }

    public function isUnderMaintenance(Feature|string $feature): bool
    {
        $flag = $this->getFlag($feature);

        return $flag?->isUnderMaintenance() ?? false;
    }

    public function isHidden(Feature|string $feature): bool
    {
        $flag = $this->getFlag($feature);

        if (! $flag) {
            return true;
        }

        return $flag->isHidden();
    }

    public function canAccess(?User $user, Feature|string $feature): bool
    {
        // 1. Developer bypass (direct or impersonated preview mode)
        if ($this->developerAccess->isDeveloper($user)) {
            return true;
        }

        if (request()->hasSession() &&
            request()->session()->get('impersonated_by_developer') &&
            request()->session()->get('developer_preview_mode', true)) {
            return true;
        }

        // 2. Lookup flag
        $flag = $this->getFlag($feature);
        if (! $flag) {
            return false;
        }

        // 3. If hidden or under maintenance, normal user cannot access
        if (! $flag->isReleased()) {
            return false;
        }

        // 4. Role audience check
        return $flag->allowsRole($user?->role);
    }
}
