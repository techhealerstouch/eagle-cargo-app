<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Payment;
use App\Models\User;

class PaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function view(User $user, Payment $payment): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function create(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function update(User $user, Payment $payment): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function delete(User $user, Payment $payment): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function forceDelete(User $user, Payment $payment): bool
    {
        return $user->role === Role::SuperAdmin;
    }
}
