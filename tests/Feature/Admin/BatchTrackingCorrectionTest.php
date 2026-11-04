<?php

namespace Tests\Feature\Admin;

use App\Enums\BatchStatus;
use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Enums\TrackingPhase;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Sender;
use App\Models\User;
use App\Notifications\BoxStatusChanged;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class BatchTrackingCorrectionTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private User $staff;
    private Batch $batch;
    private Box $box1;
    private Box $deliveredBox;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);

        $this->admin = User::factory()->create(['role' => Role::Admin]);
        $this->staff = User::factory()->create(['role' => Role::Warehouse]);

        $this->batch = Batch::factory()->create([
            'status' => BatchStatus::ReceivedAtWarehouse,
            'container_number' => 'CONT-TEST-001',
            'seal_number' => 'SEAL-001',
        ]);

        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create(['sender_id' => $sender->id]);

        $this->box1 = Box::factory()->create([
            'batch_id' => $this->batch->id,
            'booking_id' => $booking->id,
            'status' => BoxStatus::UnloadedManila,
            'tracking_step_key' => TrackingPhase::RECEIVED_MANILA_WAREHOUSE->value,
        ]);

        $this->deliveredBox = Box::factory()->create([
            'batch_id' => $this->batch->id,
            'booking_id' => $booking->id,
            'status' => BoxStatus::Delivered,
            'tracking_step_key' => TrackingPhase::DELIVERED->value,
        ]);
    }

    public function test_admin_can_revert_batch_tracking_phase_with_correction_reason(): void
    {
        Notification::fake();

        $response = $this->actingAs($this->admin)->post(
            route('admin.batches.bulkUpdateTrackingPhase', $this->batch),
            [
                'tracking_phase' => TrackingPhase::IN_TRANSIT_SEA->value,
                'is_correction' => true,
                'correction_reason' => 'Accidentally marked as unloaded in Manila; container is still sailing.',
            ]
        );

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->batch->refresh();
        $this->box1->refresh();
        $this->deliveredBox->refresh();

        // Batch status realigned to Sailed
        $this->assertEquals(BatchStatus::Sailed, $this->batch->status);
        $this->assertStringContainsString('Admin Correction', $this->batch->override_note);

        // Box 1 realigned to InTransit
        $this->assertEquals(BoxStatus::InTransit, $this->box1->status);
        $this->assertEquals(TrackingPhase::IN_TRANSIT_SEA->value, $this->box1->tracking_step_key);

        // Delivered box protected from regression
        $this->assertEquals(BoxStatus::Delivered, $this->deliveredBox->status);

        // Audit update record created with is_admin_override = true
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $this->box1->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => TrackingPhase::IN_TRANSIT_SEA->value,
            'is_admin_override' => true,
        ]);

        // Senders NOT spammed with box status change notifications during correction
        $sender = $this->box1->booking->sender;
        $notifiable = $sender->user ?? $sender;
        Notification::assertNotSentTo($notifiable, BoxStatusChanged::class);
    }

    public function test_correction_requires_minimum_reason_length(): void
    {
        $response = $this->actingAs($this->admin)->post(
            route('admin.batches.bulkUpdateTrackingPhase', $this->batch),
            [
                'tracking_phase' => TrackingPhase::IN_TRANSIT_SEA->value,
                'is_correction' => true,
                'correction_reason' => 'Too short',
            ]
        );

        $response->assertSessionHasErrors('correction_reason');
    }

    public function test_non_admin_cannot_perform_tracking_correction(): void
    {
        $response = $this->actingAs($this->staff)->post(
            route('admin.batches.bulkUpdateTrackingPhase', $this->batch),
            [
                'tracking_phase' => TrackingPhase::IN_TRANSIT_SEA->value,
                'is_correction' => true,
                'correction_reason' => 'Non-admin attempting to correct milestone.',
            ]
        );

        $this->assertTrue($response->isForbidden() || session()->has('error'));
    }

    public function test_admin_can_revert_batch_via_quick_update_status_only_and_sync_boxes(): void
    {
        Notification::fake();

        $response = $this->actingAs($this->admin)->patch(
            route('admin.batches.quickUpdate', $this->batch),
            [
                'status' => BatchStatus::Sailed->value,
                'override_note' => 'Reverting batch status via modal; container is still sailing.',
            ]
        );

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->batch->refresh();
        $this->box1->refresh();
        $this->deliveredBox->refresh();

        $this->assertEquals(BatchStatus::Sailed, $this->batch->status);
        $this->assertEquals(BoxStatus::InTransit, $this->box1->status);
        $this->assertEquals(TrackingPhase::IN_TRANSIT_SEA->value, $this->box1->tracking_step_key);
        $this->assertEquals(BoxStatus::Delivered, $this->deliveredBox->status);
    }

    public function test_admin_can_revert_mixed_batch_when_newly_added_box_is_at_lower_phase(): void
    {
        $newBox = Box::factory()->create([
            'batch_id' => $this->batch->id,
            'booking_id' => $this->box1->booking_id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'tracking_step_key' => TrackingPhase::RECEIVED_BY_WAREHOUSE->value,
        ]);

        $response = $this->actingAs($this->admin)->patch(
            route('admin.batches.quickUpdate', $this->batch),
            [
                'tracking_phase' => TrackingPhase::IN_TRANSIT_SEA->value,
                'override_note' => 'Reverting mixed batch with newly added box to ocean transit.',
            ]
        );

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->batch->refresh();
        $this->box1->refresh();
        $newBox->refresh();

        $this->assertEquals(BatchStatus::Sailed, $this->batch->status);
        $this->assertEquals(BoxStatus::InTransit, $this->box1->status);
        $this->assertEquals(TrackingPhase::IN_TRANSIT_SEA->value, $this->box1->tracking_step_key);
        $this->assertEquals(BoxStatus::InTransit, $newBox->status);
        $this->assertEquals(TrackingPhase::IN_TRANSIT_SEA->value, $newBox->tracking_step_key);
    }

    public function test_admin_can_revert_batch_to_pre_departure_origin_phase(): void
    {
        $response = $this->actingAs($this->admin)->post(
            route('admin.batches.bulkUpdateTrackingPhase', $this->batch),
            [
                'tracking_phase' => TrackingPhase::PICKED_UP->value,
                'is_correction' => true,
                'correction_reason' => 'Reverting batch back to origin picked up status.',
            ]
        );

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->batch->refresh();
        $this->box1->refresh();

        $this->assertEquals(BatchStatus::Open, $this->batch->status);
        $this->assertEquals(BoxStatus::Collected, $this->box1->status);
        $this->assertEquals(TrackingPhase::PICKED_UP->value, $this->box1->tracking_step_key);
    }
}
