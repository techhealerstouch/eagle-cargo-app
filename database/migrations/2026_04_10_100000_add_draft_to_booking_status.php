<?php

use App\Models\Booking;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * The bookings.status column is a VARCHAR/string, so adding 'draft' as a
     * valid value only requires documenting the change – no schema alteration.
     */
    public function up(): void
    {
        // No schema change needed – status is a string column.
        // This migration serves as an audit trail for the new 'draft' value
        // added to App\Enums\BookingStatus.
    }

    public function down(): void
    {
        // Optionally clean up draft bookings if rolling back.
        Booking::where('status', 'draft')->forceDelete();
    }
};
