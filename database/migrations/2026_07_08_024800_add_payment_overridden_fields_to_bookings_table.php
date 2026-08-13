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
            $table->timestamp('payment_overridden_at')->nullable()->after('payment_status');
            $table->foreignId('payment_overridden_by')->nullable()->after('payment_overridden_at')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['payment_overridden_by']);
            $table->dropColumn(['payment_overridden_at', 'payment_overridden_by']);
        });
    }
};
