<?php

namespace App\Observers;

use App\Enums\Role;
use App\Models\Sender;
use App\Models\User;

class UserObserver
{
    /**
     * Handle the User "created" event.
     */
    public function created(User $user): void
    {
        $role = $user->role instanceof Role ? $user->role->value : $user->role;
        if ($role === 'sender') {
            $existingSender = Sender::where('user_id', $user->id)
                ->orWhere('email', $user->email)
                ->first();

            if ($existingSender) {
                if (! $existingSender->user_id) {
                    $existingSender->update(['user_id' => $user->id]);
                }
                return;
            }

            Sender::create([
                'user_id' => $user->id,
                'first_name' => explode(' ', $user->name)[0] ?? $user->name,
                'last_name' => count(explode(' ', $user->name)) > 1 ? implode(' ', array_slice(explode(' ', $user->name), 1)) : '',
                'email' => $user->email,
                'mobile' => '0000000000', // Default or prompt elsewhere
                'address' => 'Update Address',
            ]);
        }
    }

    /**
     * Handle the User "updated" event.
     */
    public function updated(User $user): void
    {
        // Update sender if user details change?
        // For now, we only handle creation side-effects.
    }

    /**
     * Handle the User "deleted" event.
     */
    public function deleted(User $user): void
    {
        // Handle related data on delete if needed
    }

    /**
     * Handle the User "restored" event.
     */
    public function restored(User $user): void
    {
        //
    }

    /**
     * Handle the User "force deleted" event.
     */
    public function forceDeleted(User $user): void
    {
        //
    }
}
