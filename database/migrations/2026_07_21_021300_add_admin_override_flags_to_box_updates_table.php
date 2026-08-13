<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('box_updates', function (Blueprint $table) {
            $table->boolean('is_admin_override')->default(false)->after('updated_by');
            $table->unsignedSmallInteger('steps_bypassed')->default(0)->after('is_admin_override');
        });
    }

    public function down(): void
    {
        Schema::table('box_updates', function (Blueprint $table) {
            $table->dropColumn(['is_admin_override', 'steps_bypassed']);
        });
    }
};
