<?php

namespace Database\Factories;

use App\Models\Suburb;
use Illuminate\Database\Eloquent\Factories\Factory;

class SuburbFactory extends Factory
{
    protected $model = Suburb::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->city,
            'postcode' => $this->faker->postcode,
            'pickup_zone_id' => null, // Can be overridden in tests
            'is_active' => true,
        ];
    }
}
