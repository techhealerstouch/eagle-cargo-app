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
        Schema::table('invoices', function (Blueprint $table) {
            $table->date('due_date')->nullable()->after('status');
            $table->string('or_number', 50)->nullable()->after('invoice_number');
            $table->decimal('vat_amount', 10, 2)->default(0)->after('amount');
            $table->decimal('vatable_revenue', 10, 2)->default(0)->after('vat_amount');
            $table->decimal('vat_exempt_revenue', 10, 2)->default(0)->after('vatable_revenue');
            $table->boolean('is_vat_inclusive')->default(true)->after('vat_exempt_revenue');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['due_date', 'or_number', 'vat_amount', 'vatable_revenue', 'vat_exempt_revenue', 'is_vat_inclusive']);
        });
    }
};
