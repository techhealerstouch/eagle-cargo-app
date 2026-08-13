<?php

namespace Database\Factories;

use App\Models\Sender;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Sender>
 */
class SenderFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = Sender::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'email' => fake()->unique()->safeEmail(),
            'mobile' => fake()->phoneNumber(),
            'address' => fake()->streetAddress(),
            'suburb' => fake()->city(),
            'state' => fake()->stateAbbr(),
            'postcode' => fake()->postcode(),
        ];
    }
}
