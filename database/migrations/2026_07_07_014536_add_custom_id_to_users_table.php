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
        Schema::table('users', function (Blueprint $table) {
            $table->string('custom_id')->nullable()->unique()->after('id');
        });

        \Illuminate\Support\Facades\DB::table('users')->orderBy('id')->chunk(100, function ($users) {
            foreach ($users as $user) {
                do {
                    $customId = 'LBA-' . strtoupper(\Illuminate\Support\Str::random(6));
                    $exists = \Illuminate\Support\Facades\DB::table('users')->where('custom_id', $customId)->exists();
                } while ($exists);

                \Illuminate\Support\Facades\DB::table('users')->where('id', $user->id)->update(['custom_id' => $customId]);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('custom_id');
        });
    }
};
