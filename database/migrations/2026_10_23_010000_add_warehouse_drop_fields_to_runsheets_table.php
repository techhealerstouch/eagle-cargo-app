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
        Schema::table('runsheets', function (Blueprint $table) {
            $table->timestamp('warehouse_drop_initiated_at')->nullable()->after('status')->index();
            $table->string('warehouse_drop_bay', 50)->nullable()->after('warehouse_drop_initiated_at');
            $table->text('warehouse_drop_notes')->nullable()->after('warehouse_drop_bay');
            $table->string('warehouse_drop_photo_path')->nullable()->after('warehouse_drop_notes');
            $table->timestamp('warehouse_verified_at')->nullable()->after('warehouse_drop_photo_path');
            $table->foreignId('warehouse_verified_by')->nullable()->after('warehouse_verified_at')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('runsheets', function (Blueprint $table) {
            $table->dropForeign(['warehouse_verified_by']);
            $table->dropColumn([
                'warehouse_drop_initiated_at',
                'warehouse_drop_bay',
                'warehouse_drop_notes',
                'warehouse_drop_photo_path',
                'warehouse_verified_at',
                'warehouse_verified_by',
            ]);
        });
    }
};
