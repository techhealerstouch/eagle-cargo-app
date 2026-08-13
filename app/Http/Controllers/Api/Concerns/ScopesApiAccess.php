<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

trait ScopesApiAccess
{
    private function scopeBookingsForUser(Builder $query, User $user): Builder
    {
        $role = $this->roleFor($user);

        if ($this->isPrivilegedApiUser($user)) {
            return $query;
        }

        if ($role === Role::Sender) {
            $senderId = $this->senderIdFor($user);

            return $senderId
                ? $query->where('sender_id', $senderId)
                : $query->whereRaw('1 = 0');
        }

        if ($role === Role::Recipient) {
            return $query->whereHas('boxes.recipient', fn (Builder $recipientQuery) => $recipientQuery
                ->where('user_id', $user->id));
        }

        if ($role === Role::Picker) {
            return $query->whereHas('runsheets', fn (Builder $runsheetQuery) => $runsheetQuery
                ->where('runsheets.type', RunsheetType::Pickup->value)
                ->where('runsheets.picker_id', $user->id));
        }

        if ($role === Role::Courier) {
            return $query->where(function (Builder $bookingQuery) use ($user) {
                $bookingQuery
                    ->whereHas('runsheets', fn (Builder $runsheetQuery) => $runsheetQuery
                        ->where('runsheets.type', RunsheetType::Delivery->value)
                        ->where('runsheets.courier_id', $user->id))
                    ->orWhereHas('boxes.runsheets', fn (Builder $runsheetQuery) => $runsheetQuery
                        ->where('runsheets.type', RunsheetType::Delivery->value)
                        ->where('runsheets.courier_id', $user->id));
            });
        }

        return $query->whereRaw('1 = 0');
    }

    private function scopeBoxesForUser($query, User $user)
    {
        $role = $this->roleFor($user);

        if ($this->isPrivilegedApiUser($user)) {
            return $query;
        }

        if ($role === Role::Sender) {
            $senderId = $this->senderIdFor($user);

            return $senderId
                ? $query->whereHas('booking', fn (Builder $bookingQuery) => $bookingQuery->where('sender_id', $senderId))
                : $query->whereRaw('1 = 0');
        }

        if ($role === Role::Recipient) {
            return $query->whereHas('recipient', fn (Builder $recipientQuery) => $recipientQuery
                ->where('user_id', $user->id));
        }

        if ($role === Role::Picker) {
            return $query->whereHas('booking.runsheets', fn (Builder $runsheetQuery) => $runsheetQuery
                ->where('runsheets.type', RunsheetType::Pickup->value)
                ->where('runsheets.picker_id', $user->id));
        }

        if ($role === Role::Courier) {
            return $query->where(function (Builder $boxQuery) use ($user) {
                $boxQuery
                    ->whereHas('booking.runsheets', fn (Builder $runsheetQuery) => $runsheetQuery
                        ->where('runsheets.type', RunsheetType::Delivery->value)
                        ->where('runsheets.courier_id', $user->id))
                    ->orWhereHas('runsheets', fn (Builder $runsheetQuery) => $runsheetQuery
                        ->where('runsheets.type', RunsheetType::Delivery->value)
                        ->where('runsheets.courier_id', $user->id));
            });
        }

        return $query->whereRaw('1 = 0');
    }

    private function scopeBatchesForUser(Builder $query, User $user): Builder
    {
        if ($this->isPrivilegedApiUser($user)) {
            return $query;
        }

        return $query->whereHas('boxes', fn (Builder $boxQuery) => $this->scopeBoxesForUser($boxQuery, $user));
    }

    private function canUpdateBookingViaApi(User $user, Booking $booking, array $fields): bool
    {
        $role = $this->roleFor($user);

        if (in_array($role, [Role::SuperAdmin, Role::Admin], true)) {
            return true;
        }

        if ($role !== Role::Sender || $booking->sender_id !== $this->senderIdFor($user)) {
            return false;
        }

        return empty(array_diff($fields, ['notes']));
    }

    private function canUpdateBoxViaApi(User $user, Box $box, array $fields): bool
    {
        if (in_array($this->roleFor($user), [Role::SuperAdmin, Role::Admin, Role::Warehouse], true)) {
            return true;
        }

        if (! empty(array_diff($fields, ['courier_notes']))) {
            return false;
        }

        return $this->isBoxAssignedToActiveCourierRunsheet($box, $user);
    }

    private function isBoxAssignedToActiveCourierRunsheet(Box $box, User $user): bool
    {
        return Box::query()
            ->whereKey($box->id)
            ->where(function (Builder $boxQuery) use ($user) {
                $boxQuery
                    ->whereHas('booking.runsheets', fn (Builder $runsheetQuery) => $runsheetQuery
                        ->where('runsheets.type', RunsheetType::Delivery->value)
                        ->where('runsheets.courier_id', $user->id)
                        ->whereIn('runsheets.status', RunsheetStatus::activeValues()))
                    ->orWhereHas('runsheets', fn (Builder $runsheetQuery) => $runsheetQuery
                        ->where('runsheets.type', RunsheetType::Delivery->value)
                        ->where('runsheets.courier_id', $user->id)
                        ->whereIn('runsheets.status', RunsheetStatus::activeValues()));
            })
            ->exists();
    }

    private function isPrivilegedApiUser(User $user): bool
    {
        return in_array($this->roleFor($user), [Role::SuperAdmin, Role::Admin, Role::Warehouse], true);
    }

    private function senderIdFor(User $user): ?int
    {
        return Sender::query()
            ->where('user_id', $user->id)
            ->value('id');
    }
    private function roleFor(User $user): ?Role
    {
        if ($user->role instanceof Role) {
            return $user->role;
        }

        return Role::tryFrom((string) $user->role);
    }
}
