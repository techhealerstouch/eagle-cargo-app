<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Ensure the 6 core areas exist
        $areaNames = ['Metro Manila', 'Outer NCR', 'Luzon', 'Visayas', 'Mindanao', 'Inter-Island'];

        foreach ($areaNames as $name) {
            $exists = DB::table('areas')->where('name', $name)->exists();
            if (! $exists) {
                DB::table('areas')->insert([
                    'name'       => $name,
                    'is_active'  => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // Retrieve IDs
        $areas = DB::table('areas')->whereIn('name', $areaNames)->pluck('id', 'name');
        $outerNcrId   = $areas['Outer NCR'];
        $mindanaoId   = $areas['Mindanao'];

        // 2. Re-map "Outer NCR" provinces (currently sitting in Luzon)
        $outerNcrProvinces = ['Bulacan', 'Cavite', 'Laguna', 'Rizal'];
        DB::table('provinces')
            ->whereIn('name', $outerNcrProvinces)
            ->update(['area_id' => $outerNcrId, 'updated_at' => now()]);

        // 3. Merge "Davao City" area into "Mindanao"
        //    First, re-point any recipients whose area_id points to the Davao City area
        $davaoArea = DB::table('areas')->where('name', 'Davao City')->first();
        if ($davaoArea) {
            DB::table('recipients')
                ->where('area_id', $davaoArea->id)
                ->update(['area_id' => $mindanaoId, 'updated_at' => now()]);

            // Re-point the "Davao City" province row to Mindanao (if it exists and is active)
            DB::table('provinces')
                ->where('name', 'Davao City')
                ->update(['area_id' => $mindanaoId, 'is_active' => true, 'updated_at' => now()]);

            // Deactivate the "Davao City" area
            DB::table('areas')
                ->where('id', $davaoArea->id)
                ->update(['is_active' => false, 'updated_at' => now()]);
        }
    }

    /**
     * Reverse the migrations.
     *
     * Note: province remapping is best-effort; re-running ConfigSeeder/ProvinceSeeder
     * on a fresh environment will restore the canonical state.
     */
    public function down(): void
    {
        // Restore Outer NCR provinces back to Luzon
        $luzonId = DB::table('areas')->where('name', 'Luzon')->value('id');

        if ($luzonId) {
            $outerNcrProvinces = ['Bulacan', 'Cavite', 'Laguna', 'Rizal'];
            DB::table('provinces')
                ->whereIn('name', $outerNcrProvinces)
                ->update(['area_id' => $luzonId, 'updated_at' => now()]);
        }

        // Re-activate Davao City area
        DB::table('areas')
            ->where('name', 'Davao City')
            ->update(['is_active' => true, 'updated_at' => now()]);

        // Remove Outer NCR and Inter-Island areas (only if they have no bookings)
        DB::table('areas')
            ->whereIn('name', ['Outer NCR', 'Inter-Island'])
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('recipients')
                    ->whereColumn('recipients.area_id', 'areas.id');
            })
            ->delete();
    }
};
