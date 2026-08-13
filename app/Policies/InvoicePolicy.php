<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Invoice;
use App\Models\User;

class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function view(User $user, Invoice $invoice): bool
    {
        if (in_array($user->role, [Role::SuperAdmin, Role::Admin])) {
            return true;
        }

        return $user->sender && $invoice->booking?->sender_id === $user->sender->id;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function forceDelete(User $user, Invoice $invoice): bool
    {
        return $user->role === Role::SuperAdmin;
    }
}
