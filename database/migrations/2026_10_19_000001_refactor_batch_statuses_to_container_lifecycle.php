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
        Schema::table('batches', function (Blueprint $table) {
            if (! Schema::hasColumn('batches', 'unloaded_at')) {
                $table->timestamp('unloaded_at')->nullable()->after('arrived_at');
            }
        });

        // Migrate historical 'delivered' batches to 'received_at_warehouse'
        DB::table('batches')
            ->where('status', 'delivered')
            ->update([
                'status' => 'received_at_warehouse',
                'unloaded_at' => DB::raw('COALESCE(delivered_at, updated_at)'),
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('batches')
            ->where('status', 'received_at_warehouse')
            ->update([
                'status' => 'delivered',
            ]);

        Schema::table('batches', function (Blueprint $table) {
            if (Schema::hasColumn('batches', 'unloaded_at')) {
                $table->dropColumn('unloaded_at');
            }
        });
    }
};
