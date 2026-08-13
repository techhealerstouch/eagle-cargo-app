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
        if (Schema::hasTable('batches') && ! Schema::hasColumn('batches', 'branch_name')) {
            Schema::table('batches', function (Blueprint $table) {
                $table->string('branch_name')->nullable()->after('batch_number');
            });
        }

        if (Schema::hasTable('batches') && Schema::hasColumn('batches', 'branch_id')) {
            try {
                Schema::table('batches', function (Blueprint $table) {
                    $table->dropIndex('batches_branch_id_status_index');
                });
            } catch (Throwable) {
                // The index may already be absent depending on migration history.
            }

            Schema::table('batches', function (Blueprint $table) {
                $table->dropConstrainedForeignId('branch_id');
            });
        }

        if (Schema::hasTable('branches')) {
            Schema::drop('branches');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('branches')) {
            Schema::create('branches', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code', 10)->nullable()->unique();
                $table->string('location')->nullable();
                $table->string('address')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('batches') && ! Schema::hasColumn('batches', 'branch_id')) {
            Schema::table('batches', function (Blueprint $table) {
                $table->foreignId('branch_id')->nullable()->after('batch_number')->constrained()->nullOnDelete();
                $table->index(['branch_id', 'status']);
            });
        }

        if (Schema::hasTable('batches') && Schema::hasColumn('batches', 'branch_name')) {
            Schema::table('batches', function (Blueprint $table) {
                $table->dropColumn('branch_name');
            });
        }
    }
};
