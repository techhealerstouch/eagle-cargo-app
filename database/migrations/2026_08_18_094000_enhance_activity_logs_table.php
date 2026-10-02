<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('activity_logs', 'description')) {
                $table->string('description', 500)->nullable()->after('action');
            }
            if (! Schema::hasColumn('activity_logs', 'event_category')) {
                $table->string('event_category', 50)->default('general')->after('description');
            }
            if (! Schema::hasColumn('activity_logs', 'context')) {
                $table->string('context', 50)->default('web')->after('event_category');
            }
            if (! Schema::hasColumn('activity_logs', 'ip_address')) {
                $table->string('ip_address', 45)->nullable()->after('context');
            }
            if (! Schema::hasColumn('activity_logs', 'user_agent')) {
                $table->text('user_agent')->nullable()->after('ip_address');
            }
            if (! Schema::hasColumn('activity_logs', 'impersonator_id')) {
                $table->foreignId('impersonator_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropForeign(['impersonator_id']);
            $table->dropIndex(['event_category', 'created_at']);
            $table->dropIndex(['user_id', 'created_at']);
            $table->dropIndex(['action']);

            $table->dropColumn([
                'description',
                'event_category',
                'context',
                'ip_address',
                'user_agent',
                'impersonator_id',
            ]);
        });
    }
};
