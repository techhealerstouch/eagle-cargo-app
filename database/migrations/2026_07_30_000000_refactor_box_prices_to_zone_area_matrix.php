<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Refactor box_prices to make pickup_zone_id mandatory.
     *
     * Price is now determined by: pickup_zone (AU origin) × area (PH destination) × box_type.
     * Formula: base rate (from this matrix) + door-to-door add-on + empty box fee.
     */
    public function up(): void
    {
        // 1. Drop foreign keys on area_id and box_type_id FIRST. In MySQL/InnoDB,
        //    dropping a unique constraint fails if a foreign key constraint relies on
        //    that index. After dropping the unique index, we re-add the foreign keys.
        try {
            Schema::table('box_prices', function (Blueprint $table) {
                $table->dropForeign(['area_id']);
            });
        } catch (\Exception $e) {}

        try {
            Schema::table('box_prices', function (Blueprint $table) {
                $table->dropForeign(['box_type_id']);
            });
        } catch (\Exception $e) {}

        try {
            Schema::table('box_prices', function (Blueprint $table) {
                $table->dropUnique('box_prices_area_id_box_type_id_unique');
            });
        } catch (\Exception $e) {
            try {
                Schema::table('box_prices', function (Blueprint $table) {
                    $table->dropUnique(['area_id', 'box_type_id']);
                });
            } catch (\Exception $ex) {}
        }

        try {
            Schema::table('box_prices', function (Blueprint $table) {
                $table->foreign('area_id')->references('id')->on('areas')->cascadeOnDelete();
            });
        } catch (\Exception $e) {}

        try {
            Schema::table('box_prices', function (Blueprint $table) {
                $table->foreign('box_type_id')->references('id')->on('box_types')->cascadeOnDelete();
            });
        } catch (\Exception $e) {}

        // 2. For any existing rows without a pickup_zone_id, expand them
        //    to all active pickup zones so no data is lost.
        $orphanPrices = DB::table('box_prices')->whereNull('pickup_zone_id')->get();

        if ($orphanPrices->isNotEmpty()) {
            $zoneIds = DB::table('pickup_zones')->where('is_active', true)->pluck('id');

            foreach ($orphanPrices as $orphan) {
                foreach ($zoneIds as $zoneId) {
                    // Only insert if there isn't already a zone-specific price
                    $exists = DB::table('box_prices')
                        ->where('pickup_zone_id', $zoneId)
                        ->where('area_id', $orphan->area_id)
                        ->where('box_type_id', $orphan->box_type_id)
                        ->exists();

                    if (!$exists) {
                        DB::table('box_prices')->insert([
                            'pickup_zone_id' => $zoneId,
                            'area_id'        => $orphan->area_id,
                            'box_type_id'    => $orphan->box_type_id,
                            'price'          => $orphan->price,
                            'created_at'     => now(),
                            'updated_at'     => now(),
                        ]);
                    }
                }
            }

            // Remove the original orphan rows (no pickup_zone_id)
            DB::table('box_prices')->whereNull('pickup_zone_id')->delete();
        }

        // 3. Make pickup_zone_id mandatory and add the new 3-column unique constraint
        
        try {
            Schema::table('box_prices', function (Blueprint $table) {
                $table->dropForeign(['pickup_zone_id']);
            });
        } catch (\Exception $e) {
            // Ignore if already dropped
        }

        Schema::table('box_prices', function (Blueprint $table) {
            $table->unsignedBigInteger('pickup_zone_id')->nullable(false)->change();
        });
        
        try {
            Schema::table('box_prices', function (Blueprint $table) {
                $table->foreign('pickup_zone_id')->references('id')->on('pickup_zones')->cascadeOnDelete();
            });
        } catch (\Exception $e) {
            // Ignore
        }

        try {
            Schema::table('box_prices', function (Blueprint $table) {
                $table->unique(['pickup_zone_id', 'area_id', 'box_type_id'], 'box_prices_zone_area_type_unique');
            });
        } catch (\Exception $e) {
            // Ignore if index already exists
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('box_prices', function (Blueprint $table) {
            $table->dropUnique('box_prices_zone_area_type_unique');
        });

        Schema::table('box_prices', function (Blueprint $table) {
            $table->unsignedBigInteger('pickup_zone_id')->nullable()->change();
            $table->unique(['area_id', 'box_type_id']);
        });
    }
};
