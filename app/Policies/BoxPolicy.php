<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Box;
use App\Models\User;

class BoxPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin, Role::Courier]);
    }

    public function view(User $user, Box $box): bool
    {
        if (in_array($user->role, [Role::SuperAdmin, Role::Admin])) {
            return true;
        }

        if ($user->role === Role::Courier) {
            return true; // Couriers can view boxes on their runsheets
        }

        return $user->sender && $box->booking?->sender_id === $user->sender->id;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function update(User $user, Box $box): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin, Role::Courier]);
    }

    public function delete(User $user, Box $box): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function forceDelete(User $user, Box $box): bool
    {
        return $user->role === Role::SuperAdmin;
    }
}
