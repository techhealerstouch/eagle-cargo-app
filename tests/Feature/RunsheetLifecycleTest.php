<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Runsheet;
use App\Models\User;
use App\Services\RunsheetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RunsheetLifecycleTest extends TestCase
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

    protected function createRunsheetWithBooking(
        RunsheetType $type = RunsheetType::Pickup,
        RunsheetStatus $status = RunsheetStatus::Draft,
        ?User $courier = null,
        int $bookingCount = 1,
        BoxStatus $boxStatus = BoxStatus::Pending
    ): Runsheet {
        $runsheet = Runsheet::factory()->create([
            'type' => $type,
            'status' => $status,
            'courier_id' => $courier?->id,
        ]);

        for ($i = 0; $i < $bookingCount; $i++) {
            $booking = Booking::factory()->create([
                'status' => BookingStatus::Confirmed,
            ]);

            $box = Box::factory()->create([
                'booking_id' => $booking->id,
                'status' => $boxStatus,
            ]);

            if ($type === RunsheetType::Delivery) {
                $runsheet->boxes()->attach($box->id, ['sequence' => $i + 1]);
            } else {
                $runsheet->bookings()->attach($booking->id, ['sequence' => $i + 1]);
            }
        }

        return $runsheet;
    }

    // ---------------------------------------------------------------
    // 1. Runsheet Status Transitions
    // ---------------------------------------------------------------

    public function test_runsheet_transitions_draft_to_assigned(): void
    {
        $runsheet = $this->createRunsheetWithBooking(RunsheetType::Pickup, RunsheetStatus::Draft);

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::Assigned);

        $this->assertEquals(RunsheetStatus::Assigned, $runsheet->fresh()->status);
    }

    public function test_runsheet_transitions_assigned_to_in_progress(): void
    {
        $runsheet = $this->createRunsheetWithBooking(RunsheetType::Pickup, RunsheetStatus::Assigned);

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::InProgress);

        $this->assertEquals(RunsheetStatus::InProgress, $runsheet->fresh()->status);
    }

    public function test_runsheet_transitions_in_progress_to_completed(): void
    {
        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Pickup,
            RunsheetStatus::InProgress,
            boxStatus: BoxStatus::ReceivedByWarehouse
        );

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::Completed);

        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }

    public function test_invalid_transition_is_rejected(): void
    {
        $runsheet = $this->createRunsheetWithBooking(RunsheetType::Pickup, RunsheetStatus::Draft);

        $this->expectException(\InvalidArgumentException::class);

        // Draft → InProgress is invalid (must go Draft → Assigned → InProgress)
        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::InProgress);
    }

    public function test_completed_runsheet_cannot_transition_further(): void
    {
        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Pickup,
            RunsheetStatus::Completed,
            boxStatus: BoxStatus::ReceivedByWarehouse
        );

        $this->expectException(\InvalidArgumentException::class);

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::InProgress);
    }

    // ---------------------------------------------------------------
    // 2. Empty Runsheet Prevention
    // ---------------------------------------------------------------

    public function test_cannot_assign_empty_runsheet(): void
    {
        $runsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Draft,
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('At least one booking is required');

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::Assigned);
    }

    public function test_cannot_start_empty_runsheet(): void
    {
        $runsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Assigned,
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('At least one booking is required');

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::InProgress);
    }

    // ---------------------------------------------------------------
    // 3. Pickup Runsheet Completion Validation
    // ---------------------------------------------------------------

    public function test_pickup_runsheet_cannot_complete_with_uncollected_boxes(): void
    {
        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Pickup,
            RunsheetStatus::InProgress,
            boxStatus: BoxStatus::Pending // Not received by warehouse
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('All boxes must be Received by Warehouse or Cancelled');

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::Completed);
    }

    public function test_pickup_runsheet_can_complete_when_all_boxes_received(): void
    {
        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Pickup,
            RunsheetStatus::InProgress,
            boxStatus: BoxStatus::ReceivedByWarehouse
        );

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::Completed);

        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }

    public function test_pickup_runsheet_can_complete_with_cancelled_boxes(): void
    {
        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Pickup,
            RunsheetStatus::InProgress,
            boxStatus: BoxStatus::Cancelled
        );

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::Completed);

        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }

    // ---------------------------------------------------------------
    // 4. Delivery Runsheet Completion Validation
    // ---------------------------------------------------------------

    public function test_delivery_runsheet_cannot_complete_with_unresolved_boxes(): void
    {
        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Delivery,
            RunsheetStatus::InProgress,
            boxStatus: BoxStatus::OutForDelivery // Not delivered/cancelled/held/damaged
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('unresolved boxes');

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::Completed);
    }

    public function test_delivery_runsheet_can_complete_when_all_boxes_delivered(): void
    {
        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Delivery,
            RunsheetStatus::InProgress,
            boxStatus: BoxStatus::Delivered
        );

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::Completed);

        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }

    public function test_delivery_runsheet_can_complete_with_held_boxes(): void
    {
        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Delivery,
            RunsheetStatus::InProgress,
            boxStatus: BoxStatus::Held
        );

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::Completed);

        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }

    public function test_delivery_runsheet_can_complete_with_damaged_boxes(): void
    {
        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Delivery,
            RunsheetStatus::InProgress,
            boxStatus: BoxStatus::Damaged
        );

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::Completed);

        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }

    public function test_delivery_runsheet_can_complete_with_mixed_terminal_statuses(): void
    {
        $runsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::InProgress,
        ]);

        $booking = Booking::factory()->create(['status' => BookingStatus::Confirmed]);

        Box::factory()->create(['booking_id' => $booking->id, 'status' => BoxStatus::Delivered]);
        Box::factory()->create(['booking_id' => $booking->id, 'status' => BoxStatus::Held]);
        Box::factory()->create(['booking_id' => $booking->id, 'status' => BoxStatus::Cancelled]);

        $runsheet->bookings()->attach($booking->id);

        app(RunsheetService::class)->transition($runsheet, RunsheetStatus::Completed);

        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }

    // ---------------------------------------------------------------
    // 5. Attach Bookings to Runsheet
    // ---------------------------------------------------------------

    public function test_attach_bookings_sets_sequence(): void
    {
        $runsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Draft,
        ]);

        $booking1 = Booking::factory()->create(['status' => BookingStatus::Confirmed]);
        $booking2 = Booking::factory()->create(['status' => BookingStatus::Confirmed]);

        Box::factory()->create(['booking_id' => $booking1->id, 'status' => BoxStatus::Pending]);
        Box::factory()->create(['booking_id' => $booking2->id, 'status' => BoxStatus::Pending]);

        app(RunsheetService::class)->attachBookings($runsheet, [$booking1->id, $booking2->id]);

        $runsheet->refresh();
        $this->assertSame(2, $runsheet->bookings()->count());

        // Bookings should have sequence numbers
        $pivotData = $runsheet->bookings()->get();
        $sequences = $pivotData->pluck('pivot.sequence')->toArray();
        $this->assertContains(1, $sequences);
        $this->assertContains(2, $sequences);
    }

    // ---------------------------------------------------------------
    // 6. Reorder Bookings
    // ---------------------------------------------------------------

    public function test_reorder_bookings_updates_sequence(): void
    {
        $runsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Draft,
        ]);

        $booking1 = Booking::factory()->create(['status' => BookingStatus::Confirmed]);
        $booking2 = Booking::factory()->create(['status' => BookingStatus::Confirmed]);
        $booking3 = Booking::factory()->create(['status' => BookingStatus::Confirmed]);

        Box::factory()->create(['booking_id' => $booking1->id, 'status' => BoxStatus::Pending]);
        Box::factory()->create(['booking_id' => $booking2->id, 'status' => BoxStatus::Pending]);
        Box::factory()->create(['booking_id' => $booking3->id, 'status' => BoxStatus::Pending]);

        $runsheet->bookings()->attach([$booking1->id, $booking2->id, $booking3->id]);

        // Reverse the order
        app(RunsheetService::class)->reorderBookings($runsheet, [
            $booking3->id,
            $booking1->id,
            $booking2->id,
        ]);

        $runsheet->refresh();
        $bookings = $runsheet->bookings()->orderByPivot('sequence')->get();

        $this->assertEquals($booking3->id, $bookings[0]->id);
        $this->assertEquals($booking1->id, $bookings[1]->id);
        $this->assertEquals($booking2->id, $bookings[2]->id);
    }

    public function test_reorder_requires_all_bookings_present(): void
    {
        $runsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Draft,
        ]);

        $booking1 = Booking::factory()->create(['status' => BookingStatus::Confirmed]);
        $booking2 = Booking::factory()->create(['status' => BookingStatus::Confirmed]);
        $booking3 = Booking::factory()->create(['status' => BookingStatus::Confirmed]);

        Box::factory()->create(['booking_id' => $booking1->id]);
        Box::factory()->create(['booking_id' => $booking2->id]);
        Box::factory()->create(['booking_id' => $booking3->id]);

        $runsheet->bookings()->attach([$booking1->id, $booking2->id, $booking3->id]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Stop order must include every booking');

        // Missing booking3 — only providing 2 of 3
        app(RunsheetService::class)->reorderBookings($runsheet, [
            $booking1->id,
            $booking2->id,
        ]);
    }

    // ---------------------------------------------------------------
    // 7. Courier-Specific Runsheet Operations
    // ---------------------------------------------------------------

    public function test_courier_can_start_assigned_runsheet(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Delivery,
            RunsheetStatus::Assigned,
            courier: $courier
        );

        $response = $this->actingAs($courier)
            ->post(route('courier.runsheet.start', $runsheet));

        $response->assertSessionHasNoErrors();
        $this->assertEquals(RunsheetStatus::InProgress, $runsheet->fresh()->status);
    }

    public function test_courier_can_complete_runsheet_with_all_boxes_delivered(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Delivery,
            RunsheetStatus::InProgress,
            courier: $courier,
            boxStatus: BoxStatus::Delivered
        );

        $response = $this->actingAs($courier)
            ->post(route('courier.runsheet.complete', $runsheet));

        $response->assertSessionHasNoErrors();
        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }

    // ---------------------------------------------------------------
    // 8. Runsheet Courier Authorization
    // ---------------------------------------------------------------

    public function test_courier_cannot_access_unassigned_runsheet(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        /** @var User $otherCourier */
        $otherCourier = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        $runsheet = $this->createRunsheetWithBooking(
            RunsheetType::Delivery,
            RunsheetStatus::Assigned,
            courier: $otherCourier
        );

        $response = $this->actingAs($courier)
            ->get(route('courier.runsheet', $runsheet));

        $response->assertStatus(403);
    }
}
