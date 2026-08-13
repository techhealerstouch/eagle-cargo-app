<?php

namespace App\Console\Commands;

use App\Enums\BoxStatus;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Runsheet;
use App\Services\RunsheetService;
use Illuminate\Console\Command;

class CleanupStaleRunsheets extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'runsheets:cleanup-stale';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up stale pickup runsheets from previous days that were abandoned or forgotten by drivers.';

    /**
     * Execute the console command.
     */
    public function handle(RunsheetService $runsheetService)
    {
        $staleRunsheets = Runsheet::query()
            ->where('type', RunsheetType::Pickup->value)
            ->whereIn('status', [RunsheetStatus::Assigned->value, RunsheetStatus::InProgress->value])
            ->whereDate('scheduled_date', '<', today())
            ->get();

        $cleanedCount = 0;

        foreach ($staleRunsheets as $runsheet) {
            $this->info("Processing Runsheet ID: {$runsheet->id}");
            
            $bookings = $runsheet->bookings()->with('boxes')->get();
            $bookingsToDetach = [];

            foreach ($bookings as $booking) {
                // If every box in the booking is "Pending", it means the driver completely ignored this booking.
                $isCompletelyPending = $booking->boxes->every(function ($box) {
                    $statusValue = $box->status instanceof BoxStatus ? $box->status->value : (string) $box->status;
                    return $statusValue === BoxStatus::Pending->value;
                });

                if ($isCompletelyPending) {
                    $bookingsToDetach[] = $booking->id;
                }
            }

            if (!empty($bookingsToDetach)) {
                $runsheet->bookings()->detach($bookingsToDetach);
                $this->info("Detached " . count($bookingsToDetach) . " pending bookings from Runsheet ID: {$runsheet->id}");
                $cleanedCount++;
            }

            // Check how many bookings are left on the runsheet
            $remainingCount = $runsheet->bookings()->count();

            if ($remainingCount === 0) {
                // If nothing is left, set it back to Draft or delete it. Let's delete it softly.
                $this->info("Runsheet ID: {$runsheet->id} is now empty. Deleting.");
                $runsheet->delete();
            } else {
                // Re-evaluate runsheet status for remaining bookings.
                // If the remaining bookings are all 'Collected' or terminal, it will automatically complete.
                $runsheetService->syncRunsheetStatusFromBoxes($runsheet);
                $this->info("Re-evaluated status for Runsheet ID: {$runsheet->id}. New Status: {$runsheet->fresh()->status->value}");
            }
        }

        $this->info("Cleanup complete. Affected {$cleanedCount} runsheets.");
    }
}
