<?php

namespace Tests\Feature\Admin;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Area;
use App\Models\AreaMilestone;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\Courier;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RunsheetCourierAreaRestrictionTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $courierUser;
    protected User $picker;
    protected Area $manilaArea;
    protected Area $luzonArea;
    protected Sender $sender;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => Role::Admin]);
        $this->courierUser = User::factory()->create(['role' => Role::Courier]);
        $this->picker = User::factory()->create(['role' => Role::Picker]);
        $this->sender = Sender::factory()->create();
        $this->manilaArea = Area::factory()->create(['name' => 'Manila Hub']);
        $this->luzonArea = Area::factory()->create(['name' => 'Luzon Hub']);
    }

    public function test_it_enforces_delivery_runsheet_booking_matches_courier_area(): void
    {
        // 1. Create a courier profile with Manila Hub area
        Courier::create([
            'user_id' => $this->courierUser->id,
            'area_id' => $this->manilaArea->id,
            'first_name' => 'Manila',
            'last_name' => 'Courier',
            'email' => 'courier@example.com',
            'mobile' => '1234567890',
            'address' => '123 Manila St',
        ]);

        // 2. Create bookings in Manila Hub and Luzon Hub
        $manilaBooking = $this->createBookingInArea($this->manilaArea);
        $luzonBooking = $this->createBookingInArea($this->luzonArea);

        // 3. Create a delivery runsheet assigned to this courier in Assigned status
        $runsheet = Runsheet::create([
            'courier_id' => $this->courierUser->id,
            'scheduled_date' => now()->addDay(),
            'area_description' => 'Manila Route',
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Delivery,
        ]);

        // 4. Attaching the Manila booking should succeed
        $response1 = $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $runsheet), [
                'booking_ids' => [$manilaBooking->id],
            ]);
        $response1->assertSessionHas('success');

        // 5. Attaching the Luzon booking should fail
        $response2 = $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $runsheet), [
                'booking_ids' => [$luzonBooking->id],
            ]);
        $response2->assertSessionHas('error');
    }

    public function test_it_allows_any_booking_area_if_courier_has_no_area(): void
    {
        // Courier has no Courier profile or no area_id
        $manilaBooking = $this->createBookingInArea($this->manilaArea);
        $luzonBooking = $this->createBookingInArea($this->luzonArea);

        $runsheet = Runsheet::create([
            'courier_id' => $this->courierUser->id,
            'scheduled_date' => now()->addDay(),
            'area_description' => 'Any Route',
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Delivery,
        ]);

        // Attaching Manila booking should succeed
        $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $runsheet), [
                'booking_ids' => [$manilaBooking->id],
            ])
            ->assertSessionHas('success');

        // Attaching Luzon booking to a new runsheet should succeed (since courier has no hub restriction)
        $runsheet2 = Runsheet::create([
            'courier_id' => $this->courierUser->id,
            'scheduled_date' => now()->addDay(),
            'area_description' => 'Any Route 2',
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Delivery,
        ]);

        $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $runsheet2), [
                'booking_ids' => [$luzonBooking->id],
            ])
            ->assertSessionHas('success');
    }

    private function createBookingInArea(Area $area): Booking
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
            'status' => BoxStatus::Pending,
        ]);

        $this->attachCompletedPickupRunsheet($booking);
        $this->addWarehouseHandoffUpdate($booking, $this->picker);

        return $booking;
    }

    private function attachCompletedPickupRunsheet(Booking $booking): Runsheet
    {
        $runsheet = Runsheet::create([
            'picker_id' => $this->picker->id,
            'scheduled_date' => now()->subDay(),
            'area_description' => 'Pickup Area',
            'status' => RunsheetStatus::Completed,
            'type' => RunsheetType::Pickup,
        ]);

        $runsheet->bookings()->attach($booking->id);

        return $runsheet;
    }

    private function addWarehouseHandoffUpdate(Booking $booking, User $updatedBy): void
    {
        $booking->loadMissing('boxes.recipient');

        foreach ($booking->boxes as $box) {
            $milestone = AreaMilestone::create([
                'area_id' => $box->recipient->area_id,
                'name' => 'Warehouse Handoff',
                'location' => 'Main Warehouse',
                'sequence_order' => 1,
                'is_warehouse_handoff' => true,
                'is_final_delivery' => false,
            ]);

            BoxUpdate::create([
                'box_id' => $box->id,
                'area_milestone_id' => $milestone->id,
                'status' => BoxStatus::InTransit->value,
                'updated_by' => $updatedBy->id,
            ]);
        }
    }
}
