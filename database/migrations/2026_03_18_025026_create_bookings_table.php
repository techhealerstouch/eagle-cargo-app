<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_id')->constrained()->cascadeOnDelete();
            $table->string('reference_number', 20)->unique()->comment('Auto-generated: BK-YYYY-###');
            $table->string('status')->default('pending');
            $table->date('preferred_date')->nullable();
            $table->string('payment_status')->default('pending');
            $table->string('declaration_form_status')->default('missing');
            $table->text('notes')->nullable();
            $table->text('admin_notes')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
