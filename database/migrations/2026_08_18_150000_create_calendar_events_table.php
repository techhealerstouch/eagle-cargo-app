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
        Schema::create('calendar_events', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('event_type')->index(); // cutoff, sailing, arrival, pickup_run, delivery_run, holiday, promo, community, maintenance, custom
            $table->string('category')->index(); // logistics, marketing, operations, holiday, disruption
            $table->string('visibility')->default('public')->index(); // public, customer_only, staff_only, admin_only
            $table->dateTime('start_date')->index();
            $table->dateTime('end_date')->nullable();
            $table->boolean('is_all_day')->default(true);
            $table->boolean('is_blocking')->default(false)->index();
            $table->string('color_hex', 20)->default('#3B82F6');
            $table->string('badge_label')->nullable();
            $table->string('location')->nullable();

            // Operational & Reference Relationships
            $table->foreignId('batch_id')->nullable()->constrained('batches')->onDelete('cascade');
            $table->foreignId('runsheet_id')->nullable()->constrained('runsheets')->onDelete('set null');
            $table->foreignId('pickup_zone_id')->nullable()->constrained('pickup_zones')->onDelete('set null');
            $table->foreignId('area_id')->nullable()->constrained('areas')->onDelete('set null');
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');

            $table->timestamps();
            $table->softDeletes();

            $table->index(['start_date', 'end_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('calendar_events');
    }
};
