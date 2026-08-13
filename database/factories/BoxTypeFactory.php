<?php

namespace Database\Factories;

use App\Models\BoxType;
use Illuminate\Database\Eloquent\Factories\Factory;

class BoxTypeFactory extends Factory
{
    protected $model = BoxType::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->randomElement(['Jumbo', 'Regular', 'Small', 'Extra Large']),
            'dimensions' => $this->faker->randomElement(['24x24x24', '20x20x20', '16x16x16', '30x30x30']),
            'is_active' => true,
        ];
    }
}
