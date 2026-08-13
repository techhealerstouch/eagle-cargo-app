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
            $table->boolean('is_read')->default(false)->after('status');
            $table->boolean('is_payment_read')->default(false)->after('payment_status');
        });

        Schema::table('batches', function (Blueprint $table) {
            $table->boolean('is_read')->default(false)->after('status');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->boolean('is_read')->default(false)->after('amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['is_read', 'is_payment_read']);
        });

        Schema::table('batches', function (Blueprint $table) {
            $table->dropColumn('is_read');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('is_read');
        });
    }
};
