<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('pickers', function (Blueprint $table) {
            $table->foreignId('pickup_zone_id')
                ->nullable()
                ->after('suburb')
                ->constrained('pickup_zones')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pickers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pickup_zone_id');
        });
    }
};
