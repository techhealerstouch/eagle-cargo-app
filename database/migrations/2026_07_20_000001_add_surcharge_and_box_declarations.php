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
            $table->decimal('surcharge_amount', 10, 2)->default(0)->after('payment_reference');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->decimal('surcharge_amount', 10, 2)->default(0)->after('vat_exempt_revenue');
        });

        Schema::table('boxes', function (Blueprint $table) {
            $table->string('declaration_form_path')->nullable()->after('delivery_proof_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('surcharge_amount');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('surcharge_amount');
        });

        Schema::table('boxes', function (Blueprint $table) {
            $table->dropColumn('declaration_form_path');
        });
    }
};
