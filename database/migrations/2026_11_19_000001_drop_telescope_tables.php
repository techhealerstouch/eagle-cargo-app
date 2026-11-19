<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Drops Laravel Telescope tables in non-local environments (production/staging)
     * to reclaim database storage while retaining Telescope locally for development.
     */
    public function up(): void
    {
        if (app()->environment('local')) {
            return;
        }

        Schema::dropIfExists('telescope_entries_tags');
        Schema::dropIfExists('telescope_entries');
        Schema::dropIfExists('telescope_monitoring');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Non-local Telescope tables are intentionally not recreated.
    }
};
