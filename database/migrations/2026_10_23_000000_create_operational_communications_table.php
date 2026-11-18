<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('operational_threads', function (Blueprint $table) {
            $table->id();
            $table->string('subject');
            $table->string('category', 50)->default('general');
            $table->string('priority', 20)->default('normal');
            $table->string('status', 20)->default('open');
            $table->foreignId('picker_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('creator_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('runsheet_id')->nullable()->constrained('runsheets')->nullOnDelete();
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->nullOnDelete();
            $table->timestamp('last_message_at')->nullable()->index();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('resolution_note')->nullable();
            $table->timestamps();

            $table->index(['picker_id', 'status']);
            $table->index(['category', 'status']);
            $table->index(['status', 'priority']);
            $table->index(['runsheet_id', 'booking_id']);
        });

        Schema::create('operational_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('thread_id')->constrained('operational_threads')->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->restrictOnDelete();
            $table->text('message');
            $table->string('attachment_path')->nullable();
            $table->timestamp('read_at')->nullable()->index();
            $table->timestamps();

            $table->index(['thread_id', 'created_at']);
            $table->index(['sender_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operational_messages');
        Schema::dropIfExists('operational_threads');
    }
};
