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
        Schema::table('area_milestones', function (Blueprint $table) {
            $table->boolean('is_warehouse_handoff')
                ->default(false)
                ->after('is_final_delivery');

            $table->index(['area_id', 'is_warehouse_handoff'], 'area_milestones_area_handoff_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('area_milestones', function (Blueprint $table) {
            $table->dropIndex('area_milestones_area_handoff_index');
            $table->dropColumn('is_warehouse_handoff');
        });
    }
};
