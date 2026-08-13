<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Create pickup_zones table
        Schema::create('pickup_zones', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 2. Seed initial Victoria pickup zones
        $now = now();
        $zones = [
            [
                'name' => 'Metro Melbourne',
                'code' => 'metro_melbourne',
                'description' => 'Inner, Inner West, East, Inner East, Western Melbourne, Northern, North-East, Wyndham',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Ballarat / Geelong / Kyneton',
                'code' => 'ballarat_geelong_kyneton',
                'description' => 'Geelong, Surf Coast, Ballarat, Bacchus Marsh, Kyneton, Woodend, Castlemaine',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Shepparton / Gippsland / Bendigo',
                'code' => 'shepparton_gippsland_bendigo',
                'description' => 'Bendigo, Eaglehawk, Gippsland West (Traralgon, Warragul, Moe), Shepparton, Cobram',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Western Victoria',
                'code' => 'western_victoria',
                'description' => 'Ararat, Horsham, Hamilton, Warrnambool, Portland, Colac, Camperdown, Nhill, Stawell, Halls Gap',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('pickup_zones')->insert($zones);

        // 3. Add pickup_zone_id to box_prices, senders, and bookings
        Schema::table('box_prices', function (Blueprint $table) {
            $table->foreignId('pickup_zone_id')->nullable()->after('area_id')->constrained('pickup_zones')->nullOnDelete();
        });

        Schema::table('senders', function (Blueprint $table) {
            $table->foreignId('pickup_zone_id')->nullable()->after('user_id')->constrained('pickup_zones')->nullOnDelete();
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('pickup_zone_id')->nullable()->after('sender_id')->constrained('pickup_zones')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['pickup_zone_id']);
            $table->dropColumn('pickup_zone_id');
        });

        Schema::table('senders', function (Blueprint $table) {
            $table->dropForeign(['pickup_zone_id']);
            $table->dropColumn('pickup_zone_id');
        });

        Schema::table('box_prices', function (Blueprint $table) {
            $table->dropForeign(['pickup_zone_id']);
            $table->dropColumn('pickup_zone_id');
        });

        Schema::dropIfExists('pickup_zones');
    }
};
