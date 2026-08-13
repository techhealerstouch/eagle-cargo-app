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
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingAssignmentTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $picker;

    protected User $courier;

    protected Sender $sender;

    protected Area $area;

    protected Area $secondArea;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => Role::Admin->value]);
        $this->picker = User::factory()->create(['role' => Role::Picker->value]);
        $this->courier = User::factory()->create(['role' => Role::Courier->value]);

        $this->sender = Sender::factory()->create();
        $this->area = Area::factory()->create(['name' => 'Primary Test Area']);
        $this->secondArea = Area::factory()->create(['name' => 'Secondary Test Area']);
    }

    public function test_it_allows_assigning_picker_to_pending_booking(): void
    {
        $booking = $this->createBookingWithBox(PaymentStatus::Pending, BookingStatus::Confirmed);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.bookings.assignPicker', $booking), [
                'picker_id' => $this->picker->id,
            ]);

        $response->assertSessionHas('success', 'Picker assigned successfully.');

        $runsheet = $booking->fresh()->runsheets()->where('type', RunsheetType::Pickup->value)->first();

        $this->assertNotNull($runsheet);
        $this->assertEquals($this->picker->id, $runsheet->picker_id);
        $this->assertEquals(RunsheetStatus::Assigned, $runsheet->status);
    }

    public function test_it_prevents_assigning_unpaid_booking_to_courier(): void
    {
        $booking = $this->createBookingWithBox(PaymentStatus::Pending, BookingStatus::Confirmed);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.bookings.assignCourier', $booking), [
                'courier_id' => $this->courier->id,
            ]);

        $response->assertSessionHas('error', 'This booking must be paid before a courier can be assigned.');
        $this->assertDatabaseMissing('booking_runsheet', ['booking_id' => $booking->id]);
    }

    public function test_it_prevents_assigning_courier_before_pickup_completed(): void
    {
        $booking = $this->createBookingWithBox(PaymentStatus::Paid, BookingStatus::Confirmed);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.bookings.assignCourier', $booking), [
                'courier_id' => $this->courier->id,
            ]);

        $response->assertSessionHas('error', 'Assign a picker and complete pickup before assigning a courier.');
        $this->assertDatabaseMissing('booking_runsheet', ['booking_id' => $booking->id]);
    }

    public function test_it_prevents_assigning_courier_before_warehouse_handoff(): void
    {
        $booking = $this->createBookingWithBox(PaymentStatus::Paid, BookingStatus::Confirmed);
        $this->attachCompletedPickupRunsheet($booking);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.bookings.assignCourier', $booking), [
                'courier_id' => $this->courier->id,
            ]);

        $response->assertSessionHas('error', 'Courier can only be assigned after warehouse handoff is complete.');
        $this->assertNull($booking->fresh()->runsheets()->where('type', RunsheetType::Delivery->value)->first());
    }

    public function test_it_prevents_attaching_unpaid_booking_to_delivery_runsheet(): void
    {
        $booking = $this->createBookingWithBox(PaymentStatus::Pending, BookingStatus::Confirmed);

        $runsheet = Runsheet::create([
            'courier_id' => $this->courier->id,
            'scheduled_date' => now()->addDays(1),
            'area_description' => 'Test Area',
            'status' => RunsheetStatus::Draft,
            'type' => RunsheetType::Delivery,
        ]);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.runsheets.attachBookings', $runsheet), [
                'booking_ids' => [$booking->id],
            ]);

        $response->assertSessionHas('error', "Booking {$booking->reference_number} must be paid before its boxes can be assigned to a courier.");
        $this->assertDatabaseMissing('booking_runsheet', [
            'booking_id' => $booking->id,
            'runsheet_id' => $runsheet->id,
        ]);
    }

    public function test_it_allows_assigning_picker_to_paid_booking(): void
    {
        $booking = $this->createBookingWithBox(PaymentStatus::Paid, BookingStatus::Confirmed);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.bookings.assignPicker', $booking), [
                'picker_id' => $this->picker->id,
            ]);

        $response->assertSessionHas('success', 'Picker assigned successfully.');

        $runsheet = $booking->fresh()->runsheets()->where('type', RunsheetType::Pickup->value)->first();

        $this->assertNotNull($runsheet);
        $this->assertEquals($this->picker->id, $runsheet->picker_id);
        $this->assertEquals(RunsheetStatus::Assigned, $runsheet->status);
    }

    public function test_it_allows_assigning_picker_to_cash_on_pickup_booking(): void
    {
        $booking = $this->createBookingWithBox(PaymentStatus::CashOnPickup, BookingStatus::Confirmed);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.bookings.assignPicker', $booking), [
                'picker_id' => $this->picker->id,
            ]);

        $response->assertSessionHas('success', 'Picker assigned successfully.');

        $runsheet = $booking->fresh()->runsheets()->where('type', RunsheetType::Pickup->value)->first();

        $this->assertNotNull($runsheet);
        $this->assertEquals($this->picker->id, $runsheet->picker_id);
        $this->assertEquals(RunsheetStatus::Assigned, $runsheet->status);
    }

    public function test_it_allows_assigning_courier_after_pickup_and_warehouse_handoff(): void
    {
        $booking = $this->createBookingWithBox(PaymentStatus::Paid, BookingStatus::Confirmed);
        $this->attachCompletedPickupRunsheet($booking);
        $this->addWarehouseHandoffUpdate($booking, $this->picker);

        $response = $this->actingAs($this->admin)
            ->post(route('admin.bookings.assignCourier', $booking), [
                'courier_id' => $this->courier->id,
            ]);

        $response->assertSessionHas('success', 'Booking assigned successfully.');

        $box = $booking->fresh()->boxes()->firstOrFail();
        $runsheet = $box->runsheets()->where('type', RunsheetType::Delivery->value)->first();

        $this->assertNotNull($runsheet);
        $this->assertEquals($this->courier->id, $runsheet->courier_id);
        $this->assertEquals(RunsheetStatus::Assigned, $runsheet->status);
        $this->assertEquals(RunsheetType::Delivery, $runsheet->type);
        $this->assertDatabaseHas('box_runsheet', [
            'box_id' => $box->id,
            'runsheet_id' => $runsheet->id,
        ]);
    }

    public function test_it_blocks_assigning_picker_to_existing_runsheet_with_different_area(): void
    {
        $firstBooking = $this->createBookingWithBox(PaymentStatus::Paid, BookingStatus::Confirmed, $this->area);
        $secondBooking = $this->createBookingWithBox(PaymentStatus::Paid, BookingStatus::Confirmed, $this->secondArea);

        $this->actingAs($this->admin)
            ->post(route('admin.bookings.assignPicker', $firstBooking), [
                'picker_id' => $this->picker->id,
            ])
            ->assertSessionHas('success', 'Picker assigned successfully.');

        $pickupRunsheet = $firstBooking->fresh()
            ->runsheets()
            ->where('type', RunsheetType::Pickup->value)
            ->firstOrFail();

        $this->actingAs($this->admin)
            ->post(route('admin.bookings.assignPicker', $secondBooking), [
                'picker_id' => $this->picker->id,
                'runsheet_id' => $pickupRunsheet->id,
            ])
            ->assertSessionHas('error', fn (string $message) => str_contains($message, 'Cannot mix bookings from different areas in the same runsheet.'));

        $this->assertDatabaseMissing('booking_runsheet', [
            'booking_id' => $secondBooking->id,
            'runsheet_id' => $pickupRunsheet->id,
        ]);
    }

    public function test_it_blocks_assigning_courier_to_existing_runsheet_with_different_area(): void
    {
        $firstBooking = $this->createBookingWithBox(PaymentStatus::Paid, BookingStatus::Confirmed, $this->area);
        $this->attachCompletedPickupRunsheet($firstBooking);
        $this->addWarehouseHandoffUpdate($firstBooking, $this->picker);

        $this->actingAs($this->admin)
            ->post(route('admin.bookings.assignCourier', $firstBooking), [
                'courier_id' => $this->courier->id,
            ])
            ->assertSessionHas('success', 'Booking assigned successfully.');

        $deliveryRunsheet = $firstBooking->fresh()
            ->boxes()
            ->firstOrFail()
            ->runsheets()
            ->where('type', RunsheetType::Delivery->value)
            ->firstOrFail();

        $secondBooking = $this->createBookingWithBox(PaymentStatus::Paid, BookingStatus::Confirmed, $this->secondArea);
        $this->attachCompletedPickupRunsheet($secondBooking);
        $this->addWarehouseHandoffUpdate($secondBooking, $this->picker);

        $this->actingAs($this->admin)
            ->post(route('admin.bookings.assignCourier', $secondBooking), [
                'courier_id' => $this->courier->id,
                'runsheet_id' => $deliveryRunsheet->id,
            ])
            ->assertSessionHas('error', fn (string $message) => str_contains($message, 'Cannot mix bookings from different areas in the same runsheet.'));

        $secondBox = $secondBooking->fresh()->boxes()->firstOrFail();
        $this->assertDatabaseMissing('box_runsheet', [
            'box_id' => $secondBox->id,
            'runsheet_id' => $deliveryRunsheet->id,
        ]);
    }

    private function createBookingWithBox(PaymentStatus $paymentStatus, BookingStatus $bookingStatus, ?Area $area = null): Booking
    {
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => $bookingStatus->value,
            'payment_status' => $paymentStatus->value,
        ]);

        $targetArea = $area ?? $this->area;

        $recipient = Recipient::factory()->create([
            'sender_id' => $this->sender->id,
            'area_id' => $targetArea->id,
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => BoxStatus::Pending->value,
        ]);

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
