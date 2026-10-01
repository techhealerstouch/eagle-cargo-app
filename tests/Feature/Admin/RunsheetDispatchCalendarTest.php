<?php

namespace Tests\Feature\Admin;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\PickupZone;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RunsheetDispatchCalendarTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $picker;
    protected User $courier;
    protected Sender $sender;
    protected PickupZone $pickupZone;
    protected Area $area;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => Role::Admin]);
        $this->picker = User::factory()->create(['role' => Role::Picker]);
        $this->courier = User::factory()->create(['role' => Role::Courier]);
        $this->pickupZone = PickupZone::create([
            'name' => 'Sydney West',
            'code' => 'SYD-W',
            'is_active' => true,
        ]);
        $this->area = Area::factory()->create(['name' => 'Cavite']);
        $this->sender = Sender::factory()->create(['pickup_zone_id' => $this->pickupZone->id]);
    }

    public function test_admin_can_access_pickup_calendar_page(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('admin.runsheets.pickups.calendar'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('admin/runsheets/pickups/calendar')
            ->has('initialData')
            ->has('pickers')
            ->has('pickupZones')
        );
    }

    public function test_admin_can_access_delivery_calendar_page(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('admin.runsheets.deliveries.calendar'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('admin/runsheets/deliveries/calendar')
            ->has('initialData')
            ->has('couriers')
            ->has('areas')
        );
    }

    public function test_pickup_calendar_feed_returns_collections_and_runsheets(): void
    {
        $tomorrow = now()->addDay()->format('Y-m-d');

        // Create a confirmed booking with preferred pickup date tomorrow
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'preferred_date' => $tomorrow,
            'pickup_zone_id' => $this->pickupZone->id,
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending,
        ]);

        // Create a pickup runsheet scheduled for tomorrow
        $runsheet = Runsheet::factory()->create([
            'picker_id' => $this->picker->id,
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Assigned,
            'scheduled_date' => $tomorrow,
            'area_description' => 'Sydney West Hub',
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson(route('admin.runsheets.calendar.feed', [
                'type' => 'pickup',
                'start' => now()->startOfMonth()->toDateString(),
                'end' => now()->endOfMonth()->addDays(5)->toDateString(),
            ]));

        $response->assertOk();
        $response->assertJsonStructure([
            'type',
            'start',
            'end',
            'runsheets',
            'pending_items',
            'daily_summaries',
            'metrics',
        ]);

        $data = $response->json();

        // Verify runsheet is returned
        $this->assertCount(1, $data['runsheets']);
        $this->assertSame($runsheet->id, $data['runsheets'][0]['id']);
        $this->assertSame($tomorrow, $data['runsheets'][0]['scheduled_date']);
        $this->assertSame($this->picker->name, $data['runsheets'][0]['driver']['name']);

        // Verify pending unassigned booking is returned
        $this->assertCount(1, $data['pending_items']);
        $this->assertSame($booking->id, $data['pending_items'][0]['id']);
        $this->assertFalse($data['pending_items'][0]['is_assigned']);

        // Verify daily summary reflects the day
        $this->assertArrayHasKey($tomorrow, $data['daily_summaries']);
        $this->assertGreaterThanOrEqual(1, $data['daily_summaries'][$tomorrow]['unassigned_count']);
    }

    public function test_delivery_calendar_feed_returns_deliveries_and_runsheets(): void
    {
        $targetDate = now()->addDays(2)->format('Y-m-d');

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $this->courier->id,
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::InProgress,
            'scheduled_date' => $targetDate,
            'area_description' => 'Cavite Metro',
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson(route('admin.runsheets.calendar.feed', [
                'type' => 'delivery',
                'start' => now()->startOfMonth()->toDateString(),
                'end' => now()->endOfMonth()->addDays(5)->toDateString(),
            ]));

        $response->assertOk();
        $data = $response->json();

        $this->assertCount(1, $data['runsheets']);
        $this->assertSame($runsheet->id, $data['runsheets'][0]['id']);
        $this->assertSame('delivery', $data['runsheets'][0]['type']);
        $this->assertSame($this->courier->name, $data['runsheets'][0]['driver']['name']);
    }

    public function test_calendar_feed_filters_by_driver(): void
    {
        $date = now()->addDays(3)->format('Y-m-d');

        $picker2 = User::factory()->create(['role' => Role::Picker]);

        $runsheet1 = Runsheet::factory()->create([
            'picker_id' => $this->picker->id,
            'type' => RunsheetType::Pickup,
            'scheduled_date' => $date,
        ]);

        $runsheet2 = Runsheet::factory()->create([
            'picker_id' => $picker2->id,
            'type' => RunsheetType::Pickup,
            'scheduled_date' => $date,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson(route('admin.runsheets.calendar.feed', [
                'type' => 'pickup',
                'driver_id' => $this->picker->id,
                'start' => now()->startOfMonth()->toDateString(),
                'end' => now()->endOfMonth()->addDays(5)->toDateString(),
            ]));

        $response->assertOk();
        $data = $response->json();

        $this->assertCount(1, $data['runsheets']);
        $this->assertSame($runsheet1->id, $data['runsheets'][0]['id']);
    }
}
