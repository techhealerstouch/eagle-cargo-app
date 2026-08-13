<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Sender;
use App\Models\User;

class SenderPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function view(User $user, Sender $sender): bool
    {
        if (in_array($user->role, [Role::SuperAdmin, Role::Admin])) {
            return true;
        }

        return $user->sender && $user->sender->id === $sender->id;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function update(User $user, Sender $sender): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function delete(User $user, Sender $sender): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function forceDelete(User $user, Sender $sender): bool
    {
        return $user->role === Role::SuperAdmin;
    }
}
