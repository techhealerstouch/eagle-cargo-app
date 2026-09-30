<?php

namespace Database\Seeders;

use App\Enums\Feature;
use App\Models\FeatureFlag;
use Illuminate\Database\Seeder;

class FeatureFlagSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Feature::cases() as $feature) {
            $audiences = array_map(function ($aud) {
                return strtolower(str_replace(' ', '_', $aud));
            }, $feature->audiences());

            FeatureFlag::firstOrCreate(
                ['feature_key' => $feature->value],
                [
                    'name' => $feature->name(),
                    'description' => $feature->description(),
                    'status' => 'hidden',
                    'audiences' => $audiences,
                    'is_system' => true,
                    'enabled' => false,
                ]
            );
        }
    }
}
