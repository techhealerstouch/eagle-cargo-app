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
        Schema::table('boxes', function (Blueprint $table) {
            $table->unsignedBigInteger('tracking_views_count')->default(0)->after('status')->index();
            $table->timestamp('last_tracked_at')->nullable()->after('tracking_views_count');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->unsignedBigInteger('tracking_views_count')->default(0)->after('status')->index();
            $table->timestamp('last_tracked_at')->nullable()->after('tracking_views_count');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('boxes', function (Blueprint $table) {
            $table->dropIndex(['tracking_views_count']);
            $table->dropColumn(['tracking_views_count', 'last_tracked_at']);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['tracking_views_count']);
            $table->dropColumn(['tracking_views_count', 'last_tracked_at']);
        });
    }
};
