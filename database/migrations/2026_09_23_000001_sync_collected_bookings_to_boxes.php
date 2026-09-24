<?php

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\TrackingPhase;
use App\Models\Booking;
use App\Models\BoxUpdate;
use App\Services\TrackingCacheService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Find all bookings with status 'collected' that have boxes still in 'pending' status
        $collectedBookings = Booking::with('boxes')
            ->where('status', BookingStatus::Collected)
            ->get();

        $cacheService = app(TrackingCacheService::class);

        foreach ($collectedBookings as $booking) {
            foreach ($booking->boxes as $box) {
                $statusVal = $box->status instanceof BoxStatus ? $box->status->value : (string) $box->status;
                if ($statusVal === BoxStatus::Pending->value) {
                    $box->update([
                        'status' => BoxStatus::Collected,
                        'courier_notes' => 'Collected as part of booking collection',
                    ]);

                    BoxUpdate::create([
                        'box_id' => $box->id,
                        'status' => BoxStatus::Collected->value,
                        'tracking_phase' => TrackingPhase::PICKED_UP->value,
                        'description' => 'Collected as part of booking collection',
                        'location' => 'Pickup Location',
                    ]);

                    $cacheService->forgetBox($box);
                }
            }
            $cacheService->forgetBooking($booking);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No destructive reversal needed
    }
};
