<?php

namespace Database\Factories;

use App\Models\Area;
use App\Models\BoxPrice;
use App\Models\BoxType;
use Illuminate\Database\Eloquent\Factories\Factory;

class BoxPriceFactory extends Factory
{
    protected $model = BoxPrice::class;

    public function definition(): array
    {
        return [
            'area_id' => Area::factory(),
            'box_type_id' => BoxType::factory(),
            'price' => $this->faker->randomFloat(2, 50, 300),
        ];
    }
}
