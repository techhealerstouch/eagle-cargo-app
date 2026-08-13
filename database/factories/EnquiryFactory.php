<?php

namespace Database\Factories;

use App\Models\Enquiry;
use Illuminate\Database\Eloquent\Factories\Factory;

class EnquiryFactory extends Factory
{
    protected $model = Enquiry::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->name(),
            'email' => $this->faker->safeEmail(),
            'mobile' => '+614'.$this->faker->numerify('########'),
            'message' => $this->faker->paragraph(),
            'is_read' => false,
        ];
    }

    public function read(): static
    {
        return $this->state(fn () => ['is_read' => true, 'read_at' => now()]);
    }
}
