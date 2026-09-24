<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->boolean('is_guest')->default(false)->index()->after('guest_token');
        });

        // Backfill existing guest bookings:
        // 1. Bookings that have a guest_token
        DB::table('bookings')
            ->whereNotNull('guest_token')
            ->update(['is_guest' => true]);

        // 2. Bookings whose sender has no linked user_id
        DB::table('bookings')
            ->whereIn('sender_id', function ($query) {
                $query->select('id')->from('senders')->whereNull('user_id');
            })
            ->update(['is_guest' => true]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('is_guest');
        });
    }
};
