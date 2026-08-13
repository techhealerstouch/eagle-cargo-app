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
        Schema::table('senders', function (Blueprint $table) {
            $table->string('zoho_contact_id')->nullable()->after('mobile');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->string('zoho_invoice_id')->nullable()->after('invoice_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('senders', function (Blueprint $table) {
            $table->dropColumn('zoho_contact_id');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('zoho_invoice_id');
        });
    }
};
