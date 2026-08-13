<?php

namespace Tests\Feature\Admin;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RunsheetDuplicateAllocationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $courier;

    protected User $picker;

    protected Sender $sender;

    protected Area $areaOne;

    protected Area $areaTwo;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => Role::Admin]);
        $this->courier = User::factory()->create(['role' => Role::Courier]);
        $this->picker = User::factory()->create(['role' => Role::Picker]);
        $this->sender = Sender::factory()->create();
        $this->areaOne = Area::factory()->create(['name' => 'Area One']);
        $this->areaTwo = Area::factory()->create(['name' => 'Area Two']);

        // Seed serial numbers for tests
        for ($i = 1; $i <= 50; $i++) {
            \App\Models\SerialNumber::create([
                'serial_number' => 'SR-' . str_pad($i, 5, '0', STR_PAD_LEFT),
                'status' => \App\Enums\SerialNumberStatus::Available,
            ]);
        }
    }

    public function test_it_blocks_attaching_booking_from_different_area_to_existing_runsheet(): void
    {
        $firstBooking = $this->createPaidConfirmedBookingInArea($this->areaOne);
        $secondBooking = $this->createPaidConfirmedBookingInArea($this->areaTwo);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => null,
            'picker_id' => $this->picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
        ]);

        $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $runsheet), [
                'booking_ids' => [$firstBooking->id],
            ])
            ->assertSessionHas('success', 'Bookings attached to runsheet successfully.');

        $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $runsheet), [
                'booking_ids' => [$secondBooking->id],
            ])
            ->assertSessionHas('error', fn (string $message) => str_contains($message, 'Cannot mix bookings from different areas in the same runsheet.'));

        $this->assertDatabaseMissing('booking_runsheet', [
            'booking_id' => $secondBooking->id,
            'runsheet_id' => $runsheet->id,
        ]);
    }

    public function test_it_prevents_attaching_booking_to_multiple_active_runsheets(): void
    {
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $firstRunsheet = Runsheet::factory()->create([
            'courier_id' => null,
            'picker_id' => $this->picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
        ]);

        $secondRunsheet = Runsheet::factory()->create([
            'courier_id' => null,
            'picker_id' => $this->picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
        ]);

        $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $firstRunsheet), [
                'booking_ids' => [$booking->id],
            ])
            ->assertSessionHas('success', 'Bookings attached to runsheet successfully.');

        $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $secondRunsheet), [
                'booking_ids' => [$booking->id],
            ])
            ->assertSessionHas('error');

        $this->assertDatabaseHas('booking_runsheet', [
            'booking_id' => $booking->id,
            'runsheet_id' => $firstRunsheet->id,
        ]);

        $this->assertDatabaseMissing('booking_runsheet', [
            'booking_id' => $booking->id,
            'runsheet_id' => $secondRunsheet->id,
        ]);
    }

    public function test_it_prevents_duplicate_allocation_via_store_endpoint(): void
    {
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $existingRunsheet = Runsheet::factory()->create([
            'courier_id' => null,
            'picker_id' => $this->picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
        ]);

        $existingRunsheet->bookings()->attach($booking->id);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.runsheets.store'), [
                'picker_id' => $this->picker->id,
                'scheduled_date' => now()->addDay()->toDateString(),
                'area_description' => 'Metro South Route',
                'status' => RunsheetStatus::Assigned->value,
                'type' => RunsheetType::Pickup->value,
                'booking_ids' => [$booking->id],
            ]);

        $response->assertSessionHas('error');

        $this->assertDatabaseCount('runsheets', 1);
        $this->assertDatabaseHas('booking_runsheet', [
            'booking_id' => $booking->id,
            'runsheet_id' => $existingRunsheet->id,
        ]);
    }

    public function test_it_is_idempotent_when_attaching_same_booking_to_same_runsheet(): void
    {
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => null,
            'picker_id' => $this->picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
        ]);

        $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $runsheet), [
                'booking_ids' => [$booking->id],
            ])
            ->assertSessionHas('success', 'Bookings attached to runsheet successfully.');

        $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $runsheet), [
                'booking_ids' => [$booking->id],
            ])
            ->assertSessionHas('success', 'Bookings attached to runsheet successfully.');

        $pairCount = DB::table('booking_runsheet')
            ->where('booking_id', $booking->id)
            ->where('runsheet_id', $runsheet->id)
            ->count();

        $this->assertSame(1, $pairCount);
    }

    public function test_it_prevents_duplicate_delivery_assignment_after_completion(): void
    {
        // 1. Setup a booking that has completed pickup
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Shipped,
            'payment_status' => PaymentStatus::Paid,
        ]);

        // Mocking requirements for delivery assignment:
        // - Completed pickup runsheet
        // - Warehouse handoff
        $pickupRunsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Completed,
        ]);
        $pickupRunsheet->bookings()->attach($booking->id);

        $box = Box::factory()->create(['booking_id' => $booking->id]);
        \App\Models\BoxUpdate::create([
            'box_id' => $box->id,
            'status' => \App\Enums\BoxStatus::ReceivedByWarehouse,
            'tracking_phase' => \App\Enums\TrackingPhase::RECEIVED_MANILA_WAREHOUSE,
        ]);

        // 2. Create and complete a delivery runsheet for this booking
        $deliveryRunsheet1 = Runsheet::factory()->create([
            'courier_id' => $this->courier->id,
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::Completed,
        ]);
        $deliveryRunsheet1->bookings()->attach($booking->id);

        // 3. Attempt to assign the same booking to a NEW delivery runsheet
        $deliveryRunsheet2 = Runsheet::factory()->create([
            'courier_id' => $this->courier->id,
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::Assigned,
        ]);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $deliveryRunsheet2), [
                'booking_ids' => [$booking->id],
            ]);

        $response->assertSessionHas('error');
        $this->assertStringContainsString('already been assigned to a completed delivery runsheet', session('error'));

        $this->assertDatabaseMissing('booking_runsheet', [
            'booking_id' => $booking->id,
            'runsheet_id' => $deliveryRunsheet2->id,
        ]);
    }

    private function createPaidConfirmedBookingInArea(Area $area): Booking
    {
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $recipient = Recipient::factory()->create([
            'sender_id' => $this->sender->id,
            'area_id' => $area->id,
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
        ]);

        return $booking;
    }
}
