<?php

namespace Database\Factories;

use App\Enums\BatchStatus;
use App\Models\Batch;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Batch>
 */
class BatchFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $branchName = fake()->city().' Hub';
        $prefix = Str::upper((string) preg_replace('/[^A-Z0-9]/', '', $branchName));
        $prefix = $prefix !== '' ? substr($prefix, 0, 8) : 'BATCH';
        $year = (int) now()->format('Y');

        return [
            'batch_number' => sprintf('%s-%d-%03d', $prefix, $year, fake()->unique()->numberBetween(1, 999)),
            'branch_name' => $branchName,
            'vessel_name' => fake()->company().' Vessel',
            'shipping_line' => fake()->company().' Shipping',
            'voyage_number' => 'VY-'.fake()->numerify('####'),
            'origin_port' => fake()->city(),
            'destination_port' => fake()->city(),
            'capacity_boxes' => fake()->numberBetween(250, 450),
            'capacity_weight_kg' => fake()->randomFloat(2, 4000, 25000),
            'capacity_cbm' => fake()->randomFloat(3, 20, 70),
            'current_box_count' => 0,
            'current_weight_kg' => 0,
            'current_cbm' => 0,
            'cutoff_at' => now()->addDays(7),
            'eta_at' => now()->addDays(45),
            'status' => BatchStatus::Open,
        ];
    }
}
