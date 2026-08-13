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
        Schema::table('box_updates', function (Blueprint $table) {
            $table->string('tracking_phase')->nullable()->comment('App\\Enums\\TrackingPhase');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('box_updates', function (Blueprint $table) {
            $table->dropColumn('tracking_phase');
        });
    }
};
