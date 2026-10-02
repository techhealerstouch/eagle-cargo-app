<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Expand the type enum to include 'buy_x_get_y_free'
        DB::statement("ALTER TABLE promotions MODIFY COLUMN type ENUM('fixed_discount', 'percentage_discount', 'per_box_discount', 'waive_empty_box_fee', 'buy_x_get_y_free') NOT NULL");

        Schema::table('promotions', function (Blueprint $table) {
            $table->unsignedInteger('buy_quantity')->nullable()->after('min_box_count');
            $table->unsignedInteger('free_quantity')->nullable()->after('buy_quantity');
        });
    }

    public function down(): void
    {
        // Remove rows of the new type first to avoid constraint violations
        DB::table('promotions')->where('type', 'buy_x_get_y_free')->delete();

        DB::statement("ALTER TABLE promotions MODIFY COLUMN type ENUM('fixed_discount', 'percentage_discount', 'per_box_discount', 'waive_empty_box_fee') NOT NULL");

        Schema::table('promotions', function (Blueprint $table) {
            $table->dropColumn(['buy_quantity', 'free_quantity']);
        });
    }
};
