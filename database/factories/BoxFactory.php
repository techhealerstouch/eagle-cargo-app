<?php

namespace Database\Factories;

use App\Enums\BoxStatus;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\Recipient;
use Illuminate\Database\Eloquent\Factories\Factory;

class BoxFactory extends Factory
{
    protected $model = Box::class;

    public function definition(): array
    {
        return [
            'booking_id' => Booking::factory(),
            'recipient_id' => Recipient::factory(),
            'box_type_id' => BoxType::factory(),
            'status' => $this->faker->randomElement(BoxStatus::cases()),
            'weight' => $this->faker->optional()->randomFloat(2, 1, 50),
            'tracking_number' => null,
            'serial_number' => null,
            'courier_notes' => $this->faker->optional()->sentence(),
        ];
    }
}
