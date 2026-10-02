<?php

namespace Database\Factories;

use App\Enums\CalendarEventCategory;
use App\Enums\CalendarEventType;
use App\Enums\CalendarEventVisibility;
use App\Models\CalendarEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CalendarEvent>
 */
class CalendarEventFactory extends Factory
{
    protected $model = CalendarEvent::class;

    public function definition(): array
    {
        return [
            'title' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'event_type' => CalendarEventType::Custom,
            'category' => CalendarEventCategory::Operations,
            'visibility' => CalendarEventVisibility::Public,
            'start_date' => now()->addDays(fake()->numberBetween(1, 30)),
            'end_date' => null,
            'is_all_day' => true,
            'is_blocking' => false,
            'color_hex' => '#3B82F6',
            'badge_label' => 'Notice',
            'location' => fake()->city(),
            'batch_id' => null,
            'runsheet_id' => null,
            'pickup_zone_id' => null,
            'area_id' => null,
            'created_by' => null,
        ];
    }

    public function blackout(): static
    {
        return $this->state(fn () => [
            'is_blocking' => true,
            'event_type' => CalendarEventType::Holiday,
            'category' => CalendarEventCategory::Holiday,
            'color_hex' => '#E11D48',
        ]);
    }

    public function adminOnly(): static
    {
        return $this->state(fn () => [
            'visibility' => CalendarEventVisibility::AdminOnly,
        ]);
    }

    public function staffOnly(): static
    {
        return $this->state(fn () => [
            'visibility' => CalendarEventVisibility::StaffOnly,
        ]);
    }
}
