<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->string('code', 10)->nullable()->after('name');
        });

        DB::table('branches')->orderBy('id')->get()->each(function ($branch) {
            $base = Str::upper((string) preg_replace('/[^A-Z0-9]/', '', Str::of((string) $branch->name)->substr(0, 4)));
            if ($base === '') {
                $base = 'BR';
            }

            $candidate = $base;
            $suffix = 1;
            while (DB::table('branches')->where('code', $candidate)->where('id', '!=', $branch->id)->exists()) {
                $candidate = substr($base, 0, 6).$suffix;
                $suffix++;
            }

            DB::table('branches')->where('id', $branch->id)->update(['code' => $candidate]);
        });

        Schema::table('branches', function (Blueprint $table) {
            $table->unique('code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->dropUnique(['code']);
            $table->dropColumn('code');
        });
    }
};
