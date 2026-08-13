<?php

namespace Tests\Feature;

use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
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

class RunsheetAutoTransitionTest extends TestCase
{
    use RefreshDatabase;

    protected User $picker;

    protected RunsheetService $runsheetService;

    protected function setUp(): void
    {
        parent::setUp();
        \Illuminate\Support\Facades\Notification::fake();
        $this->picker = User::factory()->create(['role' => Role::Picker->value]);
        $this->runsheetService = app(RunsheetService::class);
    }

    public function test_runsheet_auto_starts_when_box_leaves_pending(): void
    {
        $booking = Booking::factory()->create([
            'payment_status' => PaymentStatus::Paid,
            'status' => 'confirmed',
        ]);

        $box1 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending->value,
        ]);

        $box2 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending->value,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $this->picker->id,
            'courier_id' => null,
            'type' => RunsheetType::Pickup->value,
            'status' => RunsheetStatus::Assigned->value,
        ]);

        $runsheet->bookings()->attach($booking->id);

        // Simulate updating box1 to Collected
        $box1->update(['status' => BoxStatus::Collected]);
        $box1->refresh();
        $this->runsheetService->syncRelatedRunsheets($box1);

        // Runsheet should now be InProgress
        $this->assertEquals(
            RunsheetStatus::InProgress,
            $runsheet->fresh()->status,
            'Runsheet should auto-transition to InProgress when a box is collected.'
        );
    }

    public function test_runsheet_stays_in_progress_until_all_boxes_terminal(): void
    {
        $booking = Booking::factory()->create([
            'payment_status' => PaymentStatus::Paid,
            'status' => 'confirmed',
        ]);

        $box1 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending->value,
        ]);

        $box2 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending->value,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $this->picker->id,
            'courier_id' => null,
            'type' => RunsheetType::Pickup->value,
            'status' => RunsheetStatus::Assigned->value,
        ]);

        $runsheet->bookings()->attach($booking->id);

        // Collect box1 → auto-start
        $box1->update(['status' => BoxStatus::Collected]);
        $box1->refresh();
        $this->runsheetService->syncRelatedRunsheets($box1);

        $this->assertEquals(RunsheetStatus::InProgress, $runsheet->fresh()->status);

        // Receive box1 at branch → still InProgress (box2 is pending)
        $box1->update(['status' => BoxStatus::ReceivedByWarehouse]);
        $box1->refresh();
        $this->runsheetService->syncRelatedRunsheets($box1);

        $this->assertEquals(
            RunsheetStatus::InProgress,
            $runsheet->fresh()->status,
            'Runsheet should remain InProgress while box2 is still pending.'
        );
    }

    public function test_runsheet_auto_completes_when_all_boxes_received_by_warehouse(): void
    {
        $booking = Booking::factory()->create([
            'payment_status' => PaymentStatus::Paid,
            'status' => 'confirmed',
        ]);

        $box1 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending->value,
        ]);

        $box2 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending->value,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $this->picker->id,
            'courier_id' => null,
            'type' => RunsheetType::Pickup->value,
            'status' => RunsheetStatus::Assigned->value,
        ]);

        $runsheet->bookings()->attach($booking->id);

        // Move both boxes through the full pickup lifecycle
        $box1->update(['status' => BoxStatus::Collected]);
        $box1->refresh();
        $this->runsheetService->syncRelatedRunsheets($box1);

        $box2->update(['status' => BoxStatus::Collected]);
        $box2->refresh();
        $this->runsheetService->syncRelatedRunsheets($box2);

        $box1->update(['status' => BoxStatus::ReceivedByWarehouse]);
        $box1->refresh();
        $this->runsheetService->syncRelatedRunsheets($box1);

        // Still InProgress — box2 is only Collected
        $this->assertEquals(RunsheetStatus::InProgress, $runsheet->fresh()->status);

        $box2->update(['status' => BoxStatus::ReceivedByWarehouse]);
        $box2->refresh();
        $this->runsheetService->syncRelatedRunsheets($box2);

        // Now all boxes are at the branch → Completed
        $this->assertEquals(
            RunsheetStatus::Completed,
            $runsheet->fresh()->status,
            'Runsheet should auto-complete when all boxes are ReceivedByWarehouse.'
        );
    }

    public function test_runsheet_auto_completes_with_mix_of_received_and_cancelled(): void
    {
        $booking = Booking::factory()->create([
            'payment_status' => PaymentStatus::Paid,
            'status' => 'confirmed',
        ]);

        $box1 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending->value,
        ]);

        $box2 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending->value,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $this->picker->id,
            'courier_id' => null,
            'type' => RunsheetType::Pickup->value,
            'status' => RunsheetStatus::InProgress->value,
        ]);

        $runsheet->bookings()->attach($booking->id);

        // box1: Pending → Collected → ReceivedByWarehouse
        $box1->update(['status' => BoxStatus::Collected]);
        $box1->refresh();
        $this->runsheetService->syncRelatedRunsheets($box1);

        $box1->update(['status' => BoxStatus::ReceivedByWarehouse]);
        $box1->refresh();
        $this->runsheetService->syncRelatedRunsheets($box1);

        $this->assertEquals(RunsheetStatus::InProgress, $runsheet->fresh()->status);

        // box2: Pending → Cancelled
        $box2->update(['status' => BoxStatus::Cancelled]);
        $box2->refresh();
        $this->runsheetService->syncRelatedRunsheets($box2);

        $this->assertEquals(
            RunsheetStatus::Completed,
            $runsheet->fresh()->status,
            'Runsheet should auto-complete with a mix of ReceivedByWarehouse and Cancelled.'
        );
    }

    public function test_does_not_transition_already_completed_runsheet(): void
    {
        $booking = Booking::factory()->create([
            'payment_status' => PaymentStatus::Paid,
            'status' => 'confirmed',
        ]);

        $box1 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse->value,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $this->picker->id,
            'courier_id' => null,
            'type' => RunsheetType::Pickup->value,
            'status' => RunsheetStatus::Completed->value,
        ]);

        $runsheet->bookings()->attach($booking->id);

        // Should not error or change anything
        $this->runsheetService->syncRelatedRunsheets($box1);

        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }

    public function test_delivery_runsheet_auto_completes_only_on_delivery(): void
    {
        $booking = Booking::factory()->create([
            'payment_status' => PaymentStatus::Paid,
            'status' => 'shipped',
        ]);

        $box1 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::InTransit->value,
        ]);

        $courier = User::factory()->create(['role' => Role::Courier->value]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $courier->id,
            'picker_id' => null,
            'type' => RunsheetType::Delivery->value,
            'status' => RunsheetStatus::InProgress->value,
        ]);

        $runsheet->bookings()->attach($booking->id);

        // Update to a non-terminal delivery state (Arrived)
        $box1->update(['status' => BoxStatus::Arrived]);
        $box1->refresh();
        $this->runsheetService->syncRelatedRunsheets($box1);

        $this->assertEquals(
            RunsheetStatus::InProgress,
            $runsheet->fresh()->status,
            'Delivery runsheet should NOT complete when box is Arrived'
        );

        // Update to terminal delivery state (Delivered)
        $box1->update(['status' => BoxStatus::Delivered]);
        $box1->refresh();
        $this->runsheetService->syncRelatedRunsheets($box1);

        $this->assertEquals(
            RunsheetStatus::Completed,
            $runsheet->fresh()->status,
            'Delivery runsheet should complete when box is Delivered'
        );
    }
}
