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
            'user_id' => \App\Models\User::factory()->state(['role' => \App\Enums\Role::Sender]),
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'email' => function (array $attributes) {
                return \App\Models\User::find($attributes['user_id'])->email ?? fake()->unique()->safeEmail();
            },
            'mobile' => fake()->phoneNumber(),
            'address' => fake()->streetAddress(),
            'suburb' => fake()->city(),
            'state' => fake()->stateAbbr(),
            'postcode' => fake()->postcode(),
        ];
    }
}
