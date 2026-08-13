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
        // Automatically run the ProvinceSeeder when migrating on production.
        // This ensures the default areas and provinces are populated without requiring a manual db:seed command.
        Artisan::call('db:seed', [
            '--class' => 'ProvinceSeeder',
            '--force' => true, // Force the seeder to run even in production environment
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Data seed migrations usually do not have a down method.
    }
};
