<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pickup_zones', function (Blueprint $table) {
            $table->json('pickup_windows')->nullable()->after('is_active');
            $table->json('blackout_dates')->nullable()->after('pickup_windows');
            $table->unsignedInteger('lead_time_days')->nullable()->after('blackout_dates');
        });
    }

    public function down(): void
    {
        Schema::table('pickup_zones', function (Blueprint $table) {
            $table->dropColumn(['pickup_windows', 'blackout_dates', 'lead_time_days']);
        });
    }
};
