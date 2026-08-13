<?php

namespace Database\Seeders;

use App\Models\Setting;
use App\Services\TrackingStepService;
use Illuminate\Database\Seeder;

class TrackingStepSeeder extends Seeder
{
    /**
     * Seed the default tracking steps into the settings table.
     */
    public function run(): void
    {
        Setting::updateOrCreate(
            ['key' => 'tracking_steps'],
            [
                'value' => json_encode(TrackingStepService::getDefaults()),
                'type' => 'json',
                'group' => 'tracking',
                'display_name' => 'Tracking Journey Steps',
            ]
        );
    }
}
