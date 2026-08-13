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
        Schema::table('payments', function (Blueprint $table) {
            $table->timestamp('confirmed_at')->nullable()->after('collected_by');
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete()->after('confirmed_at');
            $table->boolean('is_cash_payment')->default(false)->after('confirmed_by');
            $table->text('confirmation_note')->nullable()->after('is_cash_payment');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['confirmation_note', 'is_cash_payment', 'confirmed_by', 'confirmed_at']);
        });
    }
};
