<?php

use App\Enums\Feature;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('feature_flags', function (Blueprint $table) {
            $table->string('name')->nullable()->after('feature_key');
            $table->text('description')->nullable()->after('name');
            $table->string('status')->default('hidden')->after('description');
            $table->json('audiences')->nullable()->after('status');
            $table->text('maintenance_message')->nullable()->after('audiences');
            $table->boolean('is_system')->default(false)->after('maintenance_message');
        });

        // Backfill existing rows from Feature enum if any exist
        foreach (Feature::cases() as $feature) {
            $flag = DB::table('feature_flags')->where('feature_key', $feature->value)->first();
            $status = ($flag && $flag->enabled) ? 'released' : 'hidden';

            $audiences = array_map(function ($aud) {
                return strtolower(str_replace(' ', '_', $aud));
            }, $feature->audiences());

            DB::table('feature_flags')->updateOrInsert(
                ['feature_key' => $feature->value],
                [
                    'name' => $feature->name(),
                    'description' => $feature->description(),
                    'status' => $status,
                    'audiences' => json_encode($audiences),
                    'is_system' => true,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        Schema::table('feature_flags', function (Blueprint $table) {
            $table->dropColumn([
                'name',
                'description',
                'status',
                'audiences',
                'maintenance_message',
                'is_system',
            ]);
        });
    }
};
