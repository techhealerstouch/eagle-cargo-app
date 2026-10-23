<?php

namespace App\Services;

use App\Models\PickupNote;
use App\Models\Runsheet;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PickupNoteService
{
    public function create(Runsheet $runsheet, int $bookingId, User $picker, string $note): PickupNote
    {
        return DB::transaction(function () use ($runsheet, $bookingId, $picker, $note): PickupNote {
            $lockedRunsheet = Runsheet::query()->lockForUpdate()->findOrFail($runsheet->id);

            if ((int) $lockedRunsheet->picker_id !== (int) $picker->id
                || ! $lockedRunsheet->bookings()->whereKey($bookingId)->exists()) {
                throw ValidationException::withMessages([
                    'booking_id' => 'This customer is not assigned to your pickup runsheet.',
                ]);
            }

            return PickupNote::query()->create([
                'runsheet_id' => $lockedRunsheet->id,
                'booking_id' => $bookingId,
                'picker_id' => $picker->id,
                'note' => trim($note),
            ]);
        });
    }
}
