<?php

namespace Database\Factories;

use App\Enums\Role;
use App\Models\Courier;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Courier>
 */
class CourierFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = Courier::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->state(['role' => Role::Courier]),
            'first_name' => $this->faker->firstName(),
            'last_name' => $this->faker->lastName(),
            'email' => $this->faker->unique()->safeEmail(),
            'mobile' => $this->faker->phoneNumber(),
            'address' => $this->faker->streetAddress(),
            'suburb' => $this->faker->city(),
            'state' => $this->faker->stateAbbr(),
            'postcode' => $this->faker->postcode(),
        ];
    }
}
