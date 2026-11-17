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
        Schema::table('bookings', function (Blueprint $table) {
            $table->json('empty_box_items')->nullable()->after('empty_box_fee');
            $table->foreignId('source_empty_box_booking_id')->nullable()->after('empty_box_items')->constrained('bookings')->nullOnDelete();
            $table->decimal('empty_box_deposit_credit', 10, 2)->default(0.00)->after('source_empty_box_booking_id');
            $table->boolean('is_ready_for_pickup')->default(true)->after('empty_box_deposit_credit');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_empty_box_booking_id');
            $table->dropColumn([
                'empty_box_items',
                'empty_box_deposit_credit',
                'is_ready_for_pickup',
            ]);
        });
    }
};
