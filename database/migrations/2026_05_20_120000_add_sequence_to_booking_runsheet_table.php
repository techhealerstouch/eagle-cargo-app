<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_runsheet', function (Blueprint $table): void {
            $table->unsignedInteger('sequence')->nullable()->after('runsheet_id');
            $table->index(['runsheet_id', 'sequence'], 'booking_runsheet_runsheet_sequence_index');
        });

        DB::table('booking_runsheet')
            ->orderBy('runsheet_id')
            ->orderBy('id')
            ->get()
            ->groupBy('runsheet_id')
            ->each(function ($rows): void {
                foreach ($rows->values() as $index => $row) {
                    DB::table('booking_runsheet')
                        ->where('id', $row->id)
                        ->update(['sequence' => $index + 1]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('booking_runsheet', function (Blueprint $table): void {
            $table->dropIndex('booking_runsheet_runsheet_sequence_index');
            $table->dropColumn('sequence');
        });
    }
};
