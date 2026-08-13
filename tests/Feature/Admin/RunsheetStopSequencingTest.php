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
use App\Services\RunsheetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RunsheetStopSequencingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed serial numbers for tests
        for ($i = 1; $i <= 50; $i++) {
            \App\Models\SerialNumber::create([
                'serial_number' => 'SR-' . str_pad($i, 5, '0', STR_PAD_LEFT),
                'status' => \App\Enums\SerialNumberStatus::Available,
            ]);
        }
    }

    public function test_attached_bookings_receive_default_stop_sequence(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker]);
        $area = Area::factory()->create(['name' => 'Metro Manila']);
        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'courier_id' => null,
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Assigned,
        ]);

        $third = $this->pickupBooking($area, 'Rizal', 'Taytay');
        $first = $this->pickupBooking($area, 'Metro Manila', 'Makati');
        $second = $this->pickupBooking($area, 'Metro Manila', 'Taguig');

        app(RunsheetService::class)->attachBookings($runsheet, [$third->id, $second->id, $first->id]);

        $this->assertSame(
            [$first->id, $second->id, $third->id],
            $runsheet->fresh()->bookings()->pluck('bookings.id')->all()
        );

        $this->assertSame(1, $this->pivotSequence($runsheet, $first));
        $this->assertSame(2, $this->pivotSequence($runsheet, $second));
        $this->assertSame(3, $this->pivotSequence($runsheet, $third));
    }

    public function test_admin_can_reorder_pickup_runsheet_stops_from_show_page_payload(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $picker = User::factory()->create(['role' => Role::Picker]);
        $area = Area::factory()->create(['name' => 'Metro Manila']);
        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'courier_id' => null,
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Assigned,
        ]);

        $first = $this->pickupBooking($area, 'Metro Manila', 'Makati');
        $second = $this->pickupBooking($area, 'Metro Manila', 'Taguig');
        $third = $this->pickupBooking($area, 'Rizal', 'Taytay');

        app(RunsheetService::class)->attachBookings($runsheet, [$first->id, $second->id, $third->id]);

        $this->actingAs($admin)
            ->post(route('admin.runsheets.reorder', $runsheet), [
                'stop_sequence' => [$third->id, $first->id, $second->id],
            ])
            ->assertSessionHas('success', 'Stop order updated successfully.');

        $this->assertSame(
            [$third->id, $first->id, $second->id],
            $runsheet->fresh()->bookings()->pluck('bookings.id')->all()
        );
    }

    public function test_admin_can_reorder_delivery_runsheet_boxes_from_show_page_endpoint(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $courier = User::factory()->create(['role' => Role::Courier]);
        $area = Area::factory()->create(['name' => 'Metro Manila']);
        $runsheet = Runsheet::factory()->create([
            'picker_id' => null,
            'courier_id' => $courier->id,
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::Assigned,
        ]);

        $first = $this->deliveryBox($area);
        $second = $this->deliveryBox($area);
        $third = $this->deliveryBox($area);

        $runsheet->boxes()->attach($first->id, ['sequence' => 1]);
        $runsheet->boxes()->attach($second->id, ['sequence' => 2]);
        $runsheet->boxes()->attach($third->id, ['sequence' => 3]);

        $this->actingAs($admin)
            ->post(route('admin.runsheets.reorder', $runsheet), [
                'box_ids' => [$third->id, $first->id, $second->id],
            ])
            ->assertSessionHas('success', 'Stop order updated successfully.');

        $this->assertSame(
            [$third->id, $first->id, $second->id],
            $runsheet->fresh()->boxes()->pluck('boxes.id')->all()
        );
    }

    public function test_edit_update_persists_manual_stop_sequence(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $picker = User::factory()->create(['role' => Role::Picker]);
        $area = Area::factory()->create(['name' => 'Metro Manila']);
        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'courier_id' => null,
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Assigned,
            'scheduled_date' => today(),
            'timeslot' => 'Morning (9AM - 12PM)',
            'area_description' => 'Metro Manila',
        ]);

        $first = $this->pickupBooking($area, 'Metro Manila', 'Makati');
        $second = $this->pickupBooking($area, 'Metro Manila', 'Taguig');

        app(RunsheetService::class)->attachBookings($runsheet, [$first->id, $second->id]);

        $this->actingAs($admin)
            ->put(route('admin.runsheets.update', $runsheet), [
                'picker_id' => $picker->id,
                'courier_id' => null,
                'scheduled_date' => $runsheet->scheduled_date->toDateString(),
                'timeslot' => $runsheet->timeslot,
                'area_description' => $runsheet->area_description,
                'status' => RunsheetStatus::Assigned->value,
                'type' => RunsheetType::Pickup->value,
                'booking_ids' => [$first->id, $second->id],
                'stop_sequence' => [$second->id, $first->id],
            ])
            ->assertRedirect(route('admin.runsheets.pickups'));

        $this->assertSame(
            [$second->id, $first->id],
            $runsheet->fresh()->bookings()->pluck('bookings.id')->all()
        );
    }

    public function test_picker_runsheet_detail_receives_ordered_stops(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker]);
        $area = Area::factory()->create(['name' => 'Metro Manila']);
        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'courier_id' => null,
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Assigned,
        ]);

        $first = $this->pickupBooking($area, 'Metro Manila', 'Makati');
        $second = $this->pickupBooking($area, 'Metro Manila', 'Taguig');

        $runsheet->bookings()->attach($first->id, ['sequence' => 2]);
        $runsheet->bookings()->attach($second->id, ['sequence' => 1]);

        $this->actingAs($picker)
            ->get(route('picker.runsheet', $runsheet))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('picker/RunsheetDetail')
                ->where('runsheet.bookings.0.id', $second->id)
                ->where('runsheet.bookings.1.id', $first->id)
            );
    }

    private function pickupBooking(Area $area, string $province, string $city): Booking
    {
        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'created_at' => now(),
        ]);
        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'province' => $province,
            'city' => $city,
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
        ]);

        return $booking;
    }

    private function deliveryBox(Area $area): Box
    {
        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'created_at' => now(),
        ]);
        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
        ]);

        return Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
        ]);
    }

    private function pivotSequence(Runsheet $runsheet, Booking $booking): int
    {
        return (int) DB::table('booking_runsheet')
            ->where('runsheet_id', $runsheet->id)
            ->where('booking_id', $booking->id)
            ->value('sequence');
    }
}
