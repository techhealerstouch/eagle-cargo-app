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
            $table->boolean('is_bulging')->default(false)->after('actual_cbm');
            $table->decimal('oversized_surcharge', 10, 2)->default(0.00)->after('is_bulging');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('boxes', function (Blueprint $table) {
            $table->dropColumn(['is_bulging', 'oversized_surcharge']);
        });
    }
};
