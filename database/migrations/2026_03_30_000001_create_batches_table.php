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
        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->string('batch_number', 40)->unique();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vessel_id')->nullable()->constrained()->nullOnDelete();
            $table->string('shipping_line')->nullable();
            $table->string('voyage_number', 50)->nullable();
            $table->string('origin_port', 100)->nullable();
            $table->string('destination_port', 100)->nullable();
            $table->unsignedInteger('capacity_boxes')->nullable();
            $table->decimal('capacity_weight_kg', 12, 2)->nullable();
            $table->decimal('capacity_cbm', 12, 3)->nullable();
            $table->unsignedInteger('current_box_count')->default(0);
            $table->decimal('current_weight_kg', 12, 2)->default(0);
            $table->decimal('current_cbm', 12, 3)->default(0);
            $table->timestamp('cutoff_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('departed_at')->nullable();
            $table->timestamp('eta_at')->nullable();
            $table->timestamp('arrived_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->string('status', 30)->default('open');
            $table->timestamps();

            $table->index(['status', 'cutoff_at']);
            $table->index(['branch_id', 'status']);
            $table->index(['departed_at', 'eta_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('batches');
    }
};
