<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boxes', function (Blueprint $table) {
            // Indicates the sender entered custom dimensions instead of picking a preset BoxType.
            $table->boolean('is_custom_size')->default(false)->after('box_type_id');
            // Custom dimensions in centimetres (nullable — only set when is_custom_size = true).
            $table->decimal('custom_length', 8, 2)->nullable()->after('is_custom_size');
            $table->decimal('custom_width',  8, 2)->nullable()->after('custom_length');
            $table->decimal('custom_height', 8, 2)->nullable()->after('custom_width');
            // Flags that price_charged is a CBM-based estimate, not a confirmed price.
            // Admin can review and override it on the booking detail page.
            $table->boolean('price_is_estimate')->default(false)->after('price_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('boxes', function (Blueprint $table) {
            $table->dropColumn([
                'is_custom_size',
                'custom_length',
                'custom_width',
                'custom_height',
                'price_is_estimate',
            ]);
        });
    }
};
