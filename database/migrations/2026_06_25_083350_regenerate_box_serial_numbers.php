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
        DB::table('boxes')
            ->orderBy('id')
            ->select(['id'])
            ->chunkById(500, function ($boxes) {
                foreach ($boxes as $box) {
                    do {
                        $serialNumber = (string) random_int(100000, 999999);
                    } while (DB::table('boxes')->where('serial_number', $serialNumber)->exists());

                    DB::table('boxes')
                        ->where('id', $box->id)
                        ->update([
                            'serial_number' => $serialNumber,
                        ]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert back to the old LBB-YYYY-0000ID format
        DB::table('boxes')
            ->orderBy('id')
            ->select(['id', 'created_at'])
            ->chunkById(500, function ($boxes) {
                foreach ($boxes as $box) {
                    $year = $box->created_at
                        ? date('Y', strtotime((string) $box->created_at))
                        : date('Y');

                    DB::table('boxes')
                        ->where('id', $box->id)
                        ->update([
                            'serial_number' => sprintf('LBB-%s-%06d', $year, $box->id),
                        ]);
                }
            });
    }
};
