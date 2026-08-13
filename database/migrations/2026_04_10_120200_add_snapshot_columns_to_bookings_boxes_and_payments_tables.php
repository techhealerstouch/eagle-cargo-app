<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->json('sender_snapshot')->nullable()->after('sender_id');
            $table->json('primary_recipient_snapshot')->nullable()->after('sender_snapshot');
            $table->foreignId('sender_version_id')->nullable()->after('primary_recipient_snapshot')->constrained('entity_versions')->nullOnDelete();
            $table->foreignId('recipient_version_id')->nullable()->after('sender_version_id')->constrained('entity_versions')->nullOnDelete();
            $table->timestamp('snapshot_taken_at')->nullable()->after('recipient_version_id');
        });

        Schema::table('boxes', function (Blueprint $table) {
            $table->json('recipient_snapshot')->nullable()->after('recipient_id');
            $table->decimal('price_snapshot', 10, 2)->nullable()->after('price_charged');
            $table->foreignId('recipient_version_id')->nullable()->after('price_snapshot')->constrained('entity_versions')->nullOnDelete();
            $table->timestamp('snapshot_taken_at')->nullable()->after('recipient_version_id');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->json('invoice_snapshot')->nullable()->after('invoice_id');
            $table->foreignId('invoice_version_id')->nullable()->after('invoice_snapshot')->constrained('entity_versions')->nullOnDelete();
            $table->timestamp('snapshot_taken_at')->nullable()->after('invoice_version_id');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invoice_version_id');
            $table->dropColumn('snapshot_taken_at');
            $table->dropColumn('invoice_snapshot');
        });

        Schema::table('boxes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recipient_version_id');
            $table->dropColumn('snapshot_taken_at');
            $table->dropColumn('price_snapshot');
            $table->dropColumn('recipient_snapshot');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recipient_version_id');
            $table->dropConstrainedForeignId('sender_version_id');
            $table->dropColumn('snapshot_taken_at');
            $table->dropColumn('primary_recipient_snapshot');
            $table->dropColumn('sender_snapshot');
        });
    }
};
