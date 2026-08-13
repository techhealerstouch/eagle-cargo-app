<?php

namespace Database\Factories;

use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Runsheet;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class RunsheetFactory extends Factory
{
    protected $model = Runsheet::class;

    public function definition(): array
    {
        $areas = ['Metro South Route', 'North Region', 'CBD Loop', 'Western Suburbs', 'Eastern Corridor', 'Parramatta Area', 'Southern Highlands'];

        return [
            'courier_id' => User::factory(),
            'scheduled_date' => $this->faker->dateTimeBetween('now', '+14 days'),
            'area_description' => $this->faker->randomElement($areas),
            'status' => $this->faker->randomElement([
                RunsheetStatus::Draft->value,
                RunsheetStatus::Assigned->value,
                RunsheetStatus::InProgress->value,
                RunsheetStatus::Completed->value,
            ]),
            'type' => RunsheetType::Delivery->value,
        ];
    }

    public function active(): static
    {
        return $this->state(fn () => [
            'status' => RunsheetStatus::Assigned->value,
            'scheduled_date' => today(),
        ]);
    }
}
