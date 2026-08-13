<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boxes', function (Blueprint $table) {
            $table->string('serial_number', 30)->nullable()->unique()->after('tracking_number');
        });

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

    public function down(): void
    {
        Schema::table('boxes', function (Blueprint $table) {
            $table->dropUnique(['serial_number']);
            $table->dropColumn('serial_number');
        });
    }
};