<?php

namespace Database\Factories;

use App\Enums\NotificationChannel;
use App\Enums\NotificationEvent;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<NotificationPreference>
 */
class NotificationPreferenceFactory extends Factory
{
    protected $model = NotificationPreference::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'channel' => fake()->randomElement(NotificationChannel::values()),
            'event_type' => fake()->randomElement(NotificationEvent::values()),
            'enabled' => true,
        ];
    }

    public function disabled(): static
    {
        return $this->state(fn (array $attributes) => [
            'enabled' => false,
        ]);
    }

    public function forChannel(NotificationChannel $channel): static
    {
        return $this->state(fn (array $attributes) => [
            'channel' => $channel->value,
        ]);
    }

    public function forEvent(NotificationEvent $event): static
    {
        return $this->state(fn (array $attributes) => [
            'event_type' => $event->value,
        ]);
    }
}
