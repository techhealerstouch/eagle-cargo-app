<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Guard: drop the orphaned table left by the previous failed migration attempt
        // (table was created but the index failed, so it was never recorded in the migrations table)
        Schema::dropIfExists('guest_booking_access_challenges');

        Schema::create('guest_booking_access_challenges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('purpose', 40);
            $table->string('code_hash');
            $table->timestamp('expires_at');
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['booking_id', 'purpose', 'expires_at'], 'gbac_booking_purpose_expires_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guest_booking_access_challenges');
    }
};
