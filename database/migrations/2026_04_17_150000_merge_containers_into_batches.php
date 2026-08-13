<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Merges the "containers" table into "batches" so that
     * 1 Batch = 1 Container = ~340 boxes.
     */
    public function up(): void
    {
        // 1. Add container-specific columns to batches
        Schema::table('batches', function (Blueprint $table) {
            $table->string('container_number', 20)->nullable()->unique()->after('branch_name');
            $table->string('seal_number', 50)->nullable()->after('container_number');
            $table->string('container_size', 20)->default('40ft_hc')->after('seal_number');
            $table->timestamp('sailed_at')->nullable()->after('closed_at');
        });

        // 2. Copy container_number from linked containers into their batches
        if (Schema::hasTable('containers')) {
            DB::statement('
                UPDATE batches
                SET container_number = (
                    SELECT c.container_number
                    FROM containers c
                    WHERE c.batch_id = batches.id
                    LIMIT 1
                ),
                container_size = (
                    SELECT c.size
                    FROM containers c
                    WHERE c.batch_id = batches.id
                    LIMIT 1
                )
            ');
        }

        // 3. Add batch_id directly to boxes
        Schema::table('boxes', function (Blueprint $table) {
            $table->foreignId('batch_id')->nullable()->after('container_id')->constrained()->nullOnDelete();
        });

        // 4. Migrate box→container→batch into box→batch
        if (Schema::hasTable('containers')) {
            DB::statement('
                UPDATE boxes
                SET batch_id = (
                    SELECT c.batch_id
                    FROM containers c
                    WHERE c.id = boxes.container_id
                )
                WHERE boxes.container_id IS NOT NULL
            ');
        }

        // 5. Drop the old container_id FK from boxes
        Schema::table('boxes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('container_id');
        });

        // 6. Drop the containers table entirely
        Schema::dropIfExists('containers');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Re-create containers table
        Schema::create('containers', function (Blueprint $table) {
            $table->id();
            $table->string('container_number')->unique();
            $table->foreignId('batch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('size')->default('40ft');
            $table->string('status')->default('loading');
            $table->timestamps();
        });

        // Re-add container_id to boxes
        Schema::table('boxes', function (Blueprint $table) {
            $table->foreignId('container_id')->nullable()->after('price_snapshot')->constrained()->onDelete('set null');
        });

        // Drop batch_id from boxes
        Schema::table('boxes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('batch_id');
        });

        // Drop container columns from batches
        Schema::table('batches', function (Blueprint $table) {
            $table->dropUnique(['container_number']);
            $table->dropColumn(['container_number', 'seal_number', 'container_size', 'sailed_at']);
        });
    }
};
