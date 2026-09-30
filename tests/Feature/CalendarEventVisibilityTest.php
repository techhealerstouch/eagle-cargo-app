<?php

namespace Tests\Feature;

use App\Enums\CalendarEventVisibility;
use App\Enums\Role;
use App\Models\CalendarEvent;
use App\Models\User;
use App\Services\CalendarEventService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class CalendarEventVisibilityTest extends TestCase
{
    use DatabaseTransactions;

    public function test_visibility_filtering_across_roles(): void
    {
        $service = app(CalendarEventService::class);

        $publicEvent = CalendarEvent::factory()->create([
            'title' => 'Public Event',
            'visibility' => CalendarEventVisibility::Public,
            'start_date' => now()->addDays(1),
        ]);

        $customerEvent = CalendarEvent::factory()->create([
            'title' => 'Customer Only Event',
            'visibility' => CalendarEventVisibility::CustomerOnly,
            'start_date' => now()->addDays(2),
        ]);

        $staffEvent = CalendarEvent::factory()->create([
            'title' => 'Staff Only Event',
            'visibility' => CalendarEventVisibility::StaffOnly,
            'start_date' => now()->addDays(3),
        ]);

        $adminEvent = CalendarEvent::factory()->create([
            'title' => 'Admin Only Event',
            'visibility' => CalendarEventVisibility::AdminOnly,
            'start_date' => now()->addDays(4),
        ]);

        $sender = User::factory()->create(['role' => Role::Sender]);
        $picker = User::factory()->create(['role' => Role::Picker]);
        $admin = User::factory()->create(['role' => Role::Admin]);

        $start = now()->subDays(5);
        $end = now()->addDays(30);

        // 1. Guest
        $guestEvents = $service->getEventsForRange($start, $end, null);
        $this->assertEquals(['Public Event'], $guestEvents->pluck('title')->all());

        // 2. Sender
        $senderEvents = $service->getEventsForRange($start, $end, $sender);
        $this->assertEqualsCanonicalizing(
            ['Public Event', 'Customer Only Event'],
            $senderEvents->pluck('title')->all()
        );

        // 3. Staff (Picker)
        $staffEvents = $service->getEventsForRange($start, $end, $picker);
        $this->assertEqualsCanonicalizing(
            ['Public Event', 'Customer Only Event', 'Staff Only Event'],
            $staffEvents->pluck('title')->all()
        );

        // 4. Admin
        $adminEvents = $service->getEventsForRange($start, $end, $admin);
        $this->assertCount(4, $adminEvents);
    }
}
