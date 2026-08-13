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
        Schema::table('runsheets', function (Blueprint $table) {
            $table->foreignId('picker_id')
                ->nullable()
                ->after('courier_id')
                ->constrained('users')
                ->nullOnDelete();
        });

        DB::table('runsheets')
            ->where('type', 'pickup')
            ->whereNull('picker_id')
            ->update([
                'picker_id' => DB::raw('courier_id'),
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('runsheets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('picker_id');
        });
    }
};
