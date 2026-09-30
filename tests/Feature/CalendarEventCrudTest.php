<?php

namespace Tests\Feature;

use App\Enums\CalendarEventCategory;
use App\Enums\CalendarEventType;
use App\Enums\CalendarEventVisibility;
use App\Enums\Role;
use App\Models\CalendarEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class CalendarEventCrudTest extends TestCase
{
    use DatabaseTransactions;

    protected function createAdmin(): User
    {
        return User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);
    }

    protected function createSender(): User
    {
        return User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);
    }

    public function test_admin_can_view_calendar_page(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)
            ->get(route('admin.calendar.index'));

        $response->assertOk();
    }

    public function test_admin_can_create_custom_calendar_event(): void
    {
        $admin = $this->createAdmin();

        $eventData = [
            'title' => 'Pasko Early Bird Promo',
            'description' => 'Discounts on jumbo boxes booked early.',
            'event_type' => CalendarEventType::Promo->value,
            'category' => CalendarEventCategory::Marketing->value,
            'visibility' => CalendarEventVisibility::Public->value,
            'start_date' => now()->addDays(5)->toDateTimeString(),
            'end_date' => now()->addDays(10)->toDateTimeString(),
            'is_all_day' => true,
            'is_blocking' => false,
            'color_hex' => '#D97706',
            'badge_label' => 'Promo',
            'location' => 'Sydney Hub',
        ];

        $response = $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class)
            ->actingAs($admin)
            ->post(route('admin.calendar.store'), $eventData);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->assertDatabaseHas('calendar_events', [
            'title' => 'Pasko Early Bird Promo',
            'event_type' => CalendarEventType::Promo->value,
            'category' => CalendarEventCategory::Marketing->value,
            'created_by' => $admin->id,
        ]);
    }

    public function test_admin_can_update_calendar_event(): void
    {
        $admin = $this->createAdmin();
        $event = CalendarEvent::factory()->create([
            'title' => 'Initial Title',
            'created_by' => $admin->id,
        ]);

        $response = $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class)
            ->actingAs($admin)
            ->put(route('admin.calendar.update', $event), [
                'title' => 'Updated Title',
                'event_type' => $event->event_type->value,
                'category' => $event->category->value,
                'visibility' => $event->visibility->value,
                'start_date' => $event->start_date->toDateTimeString(),
                'is_all_day' => true,
                'is_blocking' => true,
                'color_hex' => '#DC2626',
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertEquals('Updated Title', $event->fresh()->title);
        $this->assertTrue($event->fresh()->is_blocking);
    }

    public function test_admin_can_delete_calendar_event(): void
    {
        $admin = $this->createAdmin();
        $event = CalendarEvent::factory()->create(['created_by' => $admin->id]);

        $response = $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class)
            ->actingAs($admin)
            ->delete(route('admin.calendar.destroy', $event));

        $response->assertSessionHasNoErrors();
        $this->assertSoftDeleted('calendar_events', ['id' => $event->id]);
    }

    public function test_calendar_feed_api_returns_json_events(): void
    {
        $admin = $this->createAdmin();

        CalendarEvent::factory()->create([
            'title' => 'Feed Event',
            'start_date' => now()->addDays(2),
            'visibility' => CalendarEventVisibility::Public,
        ]);

        $response = $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class)
            ->actingAs($admin)
            ->getJson(route('admin.calendar.feed', [
                'start' => now()->startOfMonth()->toDateString(),
                'end' => now()->endOfMonth()->toDateString(),
            ]));

        $response->assertOk();
        $response->assertJsonStructure(['events']);
        $this->assertCount(1, $response->json('events'));
    }

    public function test_sender_cannot_mutate_admin_calendar_events(): void
    {
        $sender = $this->createSender();
        $event = CalendarEvent::factory()->create();

        $response = $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class)
            ->actingAs($sender)
            ->delete(route('admin.calendar.destroy', $event));

        $response->assertForbidden();
    }
}
