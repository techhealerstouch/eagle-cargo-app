<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boxes', function (Blueprint $table) {
            $table->string('tracking_step_key')->nullable()->after('status');
            $table->date('eta_date')->nullable()->after('tracking_step_key');
            $table->string('eta_message')->nullable()->after('eta_date');
        });

        Schema::table('box_updates', function (Blueprint $table) {
            $table->string('tracking_step_key')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('boxes', function (Blueprint $table) {
            $table->dropColumn(['tracking_step_key', 'eta_date', 'eta_message']);
        });

        Schema::table('box_updates', function (Blueprint $table) {
            $table->dropColumn('tracking_step_key');
        });
    }
};
