<?php

namespace Database\Factories;

use App\Models\Area;
use App\Models\Recipient;
use App\Models\Sender;
use Illuminate\Database\Eloquent\Factories\Factory;

class RecipientFactory extends Factory
{
    protected $model = Recipient::class;

    public function definition(): array
    {
        $cities = ['Manila', 'Cebu City', 'Davao City', 'Quezon City', 'Taguig', 'Makati', 'Baguio', 'Iloilo City', 'Cagayan de Oro', 'Zamboanga City'];
        $provinces = ['Metro Manila', 'Cebu', 'Davao del Sur', 'Rizal', 'Laguna', 'Benguet', 'Iloilo', 'Misamis Oriental', 'Zamboanga del Sur', 'Pampanga'];

        return [
            'sender_id' => Sender::factory(),
            'area_id' => Area::inRandomOrder()->first()?->id ?? Area::factory(),
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'phone_number' => '+639'.$this->faker->numerify('#########'),
            'address' => $this->faker->streetAddress(),
            'city' => $this->faker->randomElement($cities),
            'province' => $this->faker->randomElement($provinces),
            'zip_code' => $this->faker->numerify('####'),
        ];
    }
}
