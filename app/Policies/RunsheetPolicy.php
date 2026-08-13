<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Runsheet;
use App\Models\User;

class RunsheetPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin, Role::Courier]);
    }

    public function view(User $user, Runsheet $runsheet): bool
    {
        if (in_array($user->role, [Role::SuperAdmin, Role::Admin])) {
            return true;
        }

        return $user->role === Role::Courier && $runsheet->courier_id === $user->id;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function update(User $user, Runsheet $runsheet): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function delete(User $user, Runsheet $runsheet): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function forceDelete(User $user, Runsheet $runsheet): bool
    {
        return $user->role === Role::SuperAdmin;
    }
}
