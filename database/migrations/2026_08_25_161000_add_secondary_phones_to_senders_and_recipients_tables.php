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
            if (! Schema::hasColumn('senders', 'secondary_mobile')) {
                $table->string('secondary_mobile', 50)->nullable()->after('mobile');
            }
        });

        Schema::table('recipients', function (Blueprint $table) {
            if (! Schema::hasColumn('recipients', 'secondary_phone_number')) {
                $table->string('secondary_phone_number', 50)->nullable()->after('phone_number');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('senders', function (Blueprint $table) {
            if (Schema::hasColumn('senders', 'secondary_mobile')) {
                $table->dropColumn('secondary_mobile');
            }
        });

        Schema::table('recipients', function (Blueprint $table) {
            if (Schema::hasColumn('recipients', 'secondary_phone_number')) {
                $table->dropColumn('secondary_phone_number');
            }
        });
    }
};
