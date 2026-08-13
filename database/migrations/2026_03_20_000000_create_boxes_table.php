<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boxes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recipient_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('box_type_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('price_charged', 10, 2)->nullable();
            $table->string('tracking_number', 30)->unique();
            $table->string('allocation_number', 50)->nullable();
            $table->foreignId('container_id')->nullable()->constrained()->onDelete('set null');
            $table->decimal('weight', 8, 2)->nullable();
            $table->string('status')->default('pending');
            $table->text('courier_notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boxes');
    }
};
