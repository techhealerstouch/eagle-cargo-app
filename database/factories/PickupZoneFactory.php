<?php

namespace Database\Factories;

use App\Models\PickupZone;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PickupZone>
 */
class PickupZoneFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = PickupZone::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->city() . ' Zone',
            'code' => strtoupper($this->faker->unique()->lexify('PZ-???')),
            'description' => $this->faker->sentence(),
            'is_active' => true,
            'lead_time_days' => $this->faker->numberBetween(1, 5),
        ];
    }
}
