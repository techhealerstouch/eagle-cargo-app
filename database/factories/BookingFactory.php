<?php

namespace Database\Factories;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Sender;
use Illuminate\Database\Eloquent\Factories\Factory;

class BookingFactory extends Factory
{
    protected $model = Booking::class;

    public function definition(): array
    {
        return [
            'sender_id' => Sender::factory(),
            'status' => $this->faker->randomElement(BookingStatus::cases()),
            'service_type' => $this->faker->randomElement(['Balikbayan Box', 'Home Delivery', 'Express', 'Bulk Freight']),
            'booking_type' => $this->faker->randomElement(['drop_off', 'home_pickup']),
            'preferred_date' => $this->faker->dateTimeBetween('now', '+30 days'),
            'payment_status' => $this->faker->randomElement(PaymentStatus::cases()),
            'declaration_form_status' => $this->faker->randomElement(['missing', 'submitted_online', 'physical_copy_received']),
            'notes' => $this->faker->optional()->sentence(),
            'admin_notes' => $this->faker->optional()->sentence(),
        ];
    }

    public function pending(): static
    {
        return $this->state(fn () => [
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
        ]);
    }

    public function confirmed(): static
    {
        return $this->state(fn () => [
            'status' => BookingStatus::Confirmed,
            'confirmed_at' => now(),
        ]);
    }

    public function paid(): static
    {
        return $this->state(fn () => [
            'payment_status' => PaymentStatus::Paid,
        ]);
    }
}
