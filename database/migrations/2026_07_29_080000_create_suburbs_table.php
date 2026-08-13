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
        // Drop the JSON suburbs column from pickup_zones
        if (Schema::hasColumn('pickup_zones', 'suburbs')) {
            Schema::table('pickup_zones', function (Blueprint $table) {
                $table->dropColumn('suburbs');
            });
        }

        Schema::create('suburbs', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('postcode')->nullable();
            $table->foreignId('pickup_zone_id')->nullable()->constrained('pickup_zones')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('suburbs');

        if (!Schema::hasColumn('pickup_zones', 'suburbs')) {
            Schema::table('pickup_zones', function (Blueprint $table) {
                $table->json('suburbs')->nullable()->after('is_active');
            });
        }
    }
};
