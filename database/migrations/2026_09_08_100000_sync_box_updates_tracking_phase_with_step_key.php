<?php

use App\Enums\TrackingPhase;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Sync box_updates where tracking_step_key matches a valid TrackingPhase value
        foreach (TrackingPhase::cases() as $phase) {
            DB::table('box_updates')
                ->where('tracking_step_key', $phase->value)
                ->where('tracking_phase', '!=', $phase->value)
                ->update(['tracking_phase' => $phase->value]);
        }

        // 2. Fix box_updates where tracking_step_key was not recorded or was 'sorting', but description contains sorting
        DB::table('box_updates')
            ->where(function ($query) {
                $query->where('tracking_step_key', 'sorting')
                    ->orWhere('description', 'LIKE', '%Sorting%')
                    ->orWhere('description', 'LIKE', '%sorting%');
            })
            ->where('tracking_phase', 'in_transit_sea')
            ->update([
                'tracking_phase' => 'sorting',
                'tracking_step_key' => 'sorting',
            ]);

        // 3. Ensure any box currently marked with tracking_step_key = 'sorting' has its latest update synced
        $sortingBoxIds = DB::table('boxes')
            ->where('tracking_step_key', 'sorting')
            ->pluck('id');

        foreach ($sortingBoxIds as $boxId) {
            $latestUpdateId = DB::table('box_updates')
                ->where('box_id', $boxId)
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->value('id');

            if ($latestUpdateId) {
                DB::table('box_updates')
                    ->where('id', $latestUpdateId)
                    ->update([
                        'tracking_phase' => 'sorting',
                        'tracking_step_key' => 'sorting',
                    ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No destructive reversal needed for data synchronization
    }
};
