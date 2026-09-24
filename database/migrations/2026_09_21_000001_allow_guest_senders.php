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
        // 1. Make user_id nullable on senders table
        Schema::table('senders', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });

        Schema::table('senders', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->change();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        // 2. Add guest_token to bookings table
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('guest_token', 64)->nullable()->unique()->after('reference_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('guest_token');
        });

        Schema::table('senders', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });

        Schema::table('senders', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable(false)->change();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
