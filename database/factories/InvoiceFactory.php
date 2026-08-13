<?php

namespace Database\Factories;

use App\Enums\InvoiceStatus;
use App\Models\Booking;
use App\Models\Invoice;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Invoice>
 */
class InvoiceFactory extends Factory
{
    protected $model = Invoice::class;

    public function definition(): array
    {
        return [
            'booking_id' => Booking::factory(),
            'invoice_number' => 'INV-' . now()->format('Y') . '-' . str_pad((string) fake()->unique()->numberBetween(1, 99999), 5, '0', STR_PAD_LEFT),
            'amount' => fake()->randomFloat(2, 50, 500),
            'vat_amount' => 0,
            'vatable_revenue' => 0,
            'vat_exempt_revenue' => 0,
            'is_vat_inclusive' => false,
            'status' => InvoiceStatus::Unpaid,
            'due_date' => now()->addDays(7),
        ];
    }

    public function paid(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => InvoiceStatus::Paid,
        ]);
    }

    public function voided(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => InvoiceStatus::Voided,
        ]);
    }

    public function partial(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => InvoiceStatus::Partial,
        ]);
    }
}
