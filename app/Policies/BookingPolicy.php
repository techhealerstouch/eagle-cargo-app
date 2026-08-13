<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Booking;
use App\Models\User;

class BookingPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin, Role::Sender]);
    }

    public function view(User $user, Booking $booking): bool
    {
        if (in_array($user->role, [Role::SuperAdmin, Role::Admin])) {
            return true;
        }

        // Senders can only view their own bookings
        return $user->sender && $booking->sender_id === $user->sender->id;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin, Role::Sender]);
    }

    public function update(User $user, Booking $booking): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function delete(User $user, Booking $booking): bool
    {
        return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
    }

    public function forceDelete(User $user, Booking $booking): bool
    {
        return $user->role === Role::SuperAdmin;
    }
}
