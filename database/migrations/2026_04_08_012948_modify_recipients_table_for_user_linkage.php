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
        Schema::table('recipients', function (Blueprint $table) {
            if (! Schema::hasColumn('recipients', 'user_id')) {
                $table->foreignId('user_id')->nullable()->after('id')->constrained()->nullOnDelete();
            }
            $table->foreignId('sender_id')->nullable()->change();
            if (! Schema::hasColumn('recipients', 'first_name')) {
                $table->string('first_name')->nullable()->after('user_id');
            }
            if (! Schema::hasColumn('recipients', 'last_name')) {
                $table->string('last_name')->nullable()->after('first_name');
            }
            // email is added by a previous migration 2026_03_30_015219_add_email_to_recipients_table.php
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('recipients', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn(['user_id', 'first_name', 'last_name']);
            $table->foreignId('sender_id')->nullable(false)->change();
        });
    }
};
