<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->json('sender_snapshot')->nullable()->after('zoho_invoice_id');
            $table->json('booking_snapshot')->nullable()->after('sender_snapshot');
            $table->json('line_items_snapshot')->nullable()->after('booking_snapshot');
            $table->timestamp('snapshot_taken_at')->nullable()->after('line_items_snapshot');
            $table->foreignId('booking_version_id')->nullable()->after('snapshot_taken_at')->constrained('entity_versions')->nullOnDelete();
            $table->foreignId('sender_version_id')->nullable()->after('booking_version_id')->constrained('entity_versions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sender_version_id');
            $table->dropConstrainedForeignId('booking_version_id');
            $table->dropColumn('snapshot_taken_at');
            $table->dropColumn('line_items_snapshot');
            $table->dropColumn('booking_snapshot');
            $table->dropColumn('sender_snapshot');
        });
    }
};
