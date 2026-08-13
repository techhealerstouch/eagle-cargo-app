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
        if (Schema::hasTable('batches') && ! Schema::hasColumn('batches', 'vessel_name')) {
            Schema::table('batches', function (Blueprint $table) {
                $table->string('vessel_name')->nullable()->after('branch_id');
            });
        }

        if (Schema::hasTable('batches') && Schema::hasColumn('batches', 'vessel_id')) {
            Schema::table('batches', function (Blueprint $table) {
                $table->dropConstrainedForeignId('vessel_id');
            });
        }

        if (Schema::hasTable('containers') && Schema::hasColumn('containers', 'vessel_id')) {
            Schema::table('containers', function (Blueprint $table) {
                $table->dropConstrainedForeignId('vessel_id');
            });
        }

        if (Schema::hasTable('vessels')) {
            Schema::drop('vessels');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('vessels')) {
            Schema::create('vessels', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('imo_number')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('batches') && ! Schema::hasColumn('batches', 'vessel_id')) {
            Schema::table('batches', function (Blueprint $table) {
                $table->foreignId('vessel_id')->nullable()->after('branch_id')->constrained()->nullOnDelete();
            });
        }

        if (Schema::hasTable('batches') && Schema::hasColumn('batches', 'vessel_name')) {
            Schema::table('batches', function (Blueprint $table) {
                $table->dropColumn('vessel_name');
            });
        }

        if (Schema::hasTable('containers') && ! Schema::hasColumn('containers', 'vessel_id')) {
            Schema::table('containers', function (Blueprint $table) {
                $table->foreignId('vessel_id')->nullable()->after('container_number')->constrained()->nullOnDelete();
            });
        }
    }
};
