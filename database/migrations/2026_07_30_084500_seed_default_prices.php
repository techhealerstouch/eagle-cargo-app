<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Automatically run the BoxPriceSeeder to ensure all default prices 
        // across all regions are placed.
        Artisan::call('db:seed', [
            '--class' => 'BoxPriceSeeder',
            '--force' => true, 
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 
    }
};
