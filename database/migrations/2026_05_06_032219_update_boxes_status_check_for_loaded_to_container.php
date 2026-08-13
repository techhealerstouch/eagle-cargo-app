<?php

use App\Enums\BoxStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (config('database.default') === 'sqlite') {
            return;
        }

        try {
            if (config('database.default') === 'mysql') {
                DB::statement('ALTER TABLE boxes DROP CONSTRAINT boxes_status_check');
            } else {
                DB::statement('ALTER TABLE boxes DROP CONSTRAINT IF EXISTS boxes_status_check');
            }
        } catch (Exception $e) {
            // Ignore if constraint doesn't exist
        }

        $statuses = array_map(fn ($case) => "'{$case->value}'", BoxStatus::cases());
        $statusList = implode(', ', $statuses);

        DB::statement("ALTER TABLE boxes ADD CONSTRAINT boxes_status_check CHECK (status IN ({$statusList}))");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (config('database.default') === 'sqlite') {
            return;
        }

        try {
            if (config('database.default') === 'mysql') {
                DB::statement('ALTER TABLE boxes DROP CONSTRAINT boxes_status_check');
            } else {
                DB::statement('ALTER TABLE boxes DROP CONSTRAINT IF EXISTS boxes_status_check');
            }
        } catch (Exception $e) {
            // Ignore if constraint doesn't exist
        }

        // Without loaded_to_container
        $statuses = array_map(fn ($case) => "'{$case->value}'", array_filter(
            BoxStatus::cases(),
            fn ($case) => $case->value !== 'loaded_to_container'
        ));
        $statusList = implode(', ', $statuses);

        DB::statement("ALTER TABLE boxes ADD CONSTRAINT boxes_status_check CHECK (status IN ({$statusList}))");
    }
};
