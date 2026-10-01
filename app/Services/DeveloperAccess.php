<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\User;

class DeveloperAccess
{
    public function activeDeveloperCount(): int
    {
        return User::query()
            ->where('role', Role::Developer->value)
            ->count();
    }

    public function canProvisionAnother(): bool
    {
        return $this->activeDeveloperCount() < (int) config('features.max_developers', 2);
    }

    public function isDeveloper(?User $user): bool
    {
        if (! $user || $user->trashed() || ! $user->hasVerifiedEmail() || $user->role !== Role::Developer) {
            return false;
        }

        return $this->activeDeveloperCount() <= (int) config('features.max_developers', 2);
    }

    public function isDeveloperOrSuperAdmin(?User $user): bool
    {
        return $this->isDeveloper($user) || $user?->role === Role::SuperAdmin;
    }

    public function isDeveloperOrAdmin(?User $user): bool
    {
        return $this->isDeveloper($user) || in_array($user?->role, [Role::SuperAdmin, Role::Admin], true);
    }
}
