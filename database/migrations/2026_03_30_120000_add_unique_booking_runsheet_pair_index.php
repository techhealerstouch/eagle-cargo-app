<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $duplicates = DB::table('booking_runsheet')
            ->select('booking_id', 'runsheet_id', DB::raw('MIN(id) as keep_id'))
            ->groupBy('booking_id', 'runsheet_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $duplicate) {
            DB::table('booking_runsheet')
                ->where('booking_id', $duplicate->booking_id)
                ->where('runsheet_id', $duplicate->runsheet_id)
                ->where('id', '!=', $duplicate->keep_id)
                ->delete();
        }

        Schema::table('booking_runsheet', function (Blueprint $table): void {
            $table->unique(['booking_id', 'runsheet_id'], 'booking_runsheet_booking_runsheet_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('booking_runsheet', function (Blueprint $table): void {
            $table->dropUnique('booking_runsheet_booking_runsheet_unique');
        });
    }
};
