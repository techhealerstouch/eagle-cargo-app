<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Enums\TrackingPhase;
use App\Models\Batch;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class BatchBulkTrackingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_admin_can_bulk_update_tracking_phase_for_boxes_in_a_batch(): void
    {
        Notification::fake();

        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->actingAs($admin);

        $batch = Batch::factory()->create([
            'status' => BatchStatus::Arrived,
        ]);

        $boxes = Box::factory()->count(2)->create([
            'batch_id' => $batch->id,
            'status' => BoxStatus::Arrived,
        ]);

        $response = $this->post(route('admin.batches.bulkUpdateTrackingPhase', $batch), [
            'tracking_phase' => TrackingPhase::RELEASED_BY_BOC->value,
            'description' => 'Released by BOC in Manila.',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertDatabaseCount('box_updates', 4);

        foreach ($boxes as $box) {
            $this->assertDatabaseHas('box_updates', [
                'box_id' => $box->id,
                'status' => BoxStatus::Arrived->value,
                'tracking_step_key' => TrackingPhase::RELEASED_BY_BOC->value,
                'tracking_phase' => TrackingPhase::RELEASED_BY_BOC->value,
                'description' => 'Released by BOC in Manila.',
                'updated_by' => $admin->id,
            ]);

            $this->assertSame(BoxStatus::Arrived, $box->fresh()->status);
            $this->assertSame(TrackingPhase::RELEASED_BY_BOC->value, $box->fresh()->tracking_step_key);
        }
    }

    public function test_warehouse_role_can_apply_allowed_destination_tracking_phase(): void
    {
        Notification::fake();

        /** @var User $warehouse */
        $warehouse = User::factory()->create(['role' => Role::Warehouse]);
        $this->actingAs($warehouse);

        $batch = Batch::factory()->create([
            'status' => BatchStatus::Arrived,
        ]);

        $box = Box::factory()->create([
            'batch_id' => $batch->id,
            'status' => BoxStatus::Arrived,
        ]);

        $response = $this->post(route('admin.batches.bulkUpdateTrackingPhase', $batch), [
            'tracking_phase' => TrackingPhase::DISPATCHED_TO_LOCAL_HUB->value,
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertSame(BoxStatus::InTransit, $box->fresh()->status);
        $this->assertSame(TrackingPhase::DISPATCHED_TO_LOCAL_HUB->value, $box->fresh()->tracking_step_key);
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => TrackingPhase::DISPATCHED_TO_LOCAL_HUB->value,
            'tracking_phase' => TrackingPhase::DISPATCHED_TO_LOCAL_HUB->value,
            'updated_by' => $warehouse->id,
        ]);
        $this->assertDatabaseCount('box_updates', 2);
    }

    public function test_warehouse_role_is_forbidden_from_admin_only_tracking_phase_updates(): void
    {
        Notification::fake();

        /** @var User $warehouse */
        $warehouse = User::factory()->create(['role' => Role::Warehouse]);
        $this->actingAs($warehouse);

        $batch = Batch::factory()->create([
            'status' => BatchStatus::Arrived,
        ]);

        Box::factory()->create([
            'batch_id' => $batch->id,
            'status' => BoxStatus::Arrived,
        ]);

        $response = $this->post(route('admin.batches.bulkUpdateTrackingPhase', $batch), [
            'tracking_phase' => TrackingPhase::RELEASED_BY_BOC->value,
        ]);

        $response->assertForbidden();
        $this->assertDatabaseCount('box_updates', 1);
    }

    public function test_bulk_tracking_phase_update_requires_valid_tracking_phase(): void
    {
        Notification::fake();

        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->actingAs($admin);

        $batch = Batch::factory()->create([
            'status' => BatchStatus::Sailed,
        ]);

        Box::factory()->create([
            'batch_id' => $batch->id,
            'status' => BoxStatus::InTransit,
        ]);

        $response = $this->post(route('admin.batches.bulkUpdateTrackingPhase', $batch), [
            'tracking_phase' => 'not-a-real-phase',
        ]);

        $response->assertSessionHasErrors('tracking_phase');
        $this->assertDatabaseCount('box_updates', 1);
    }

    public function test_bulk_tracking_phase_update_cannot_repeat_latest_phase(): void
    {
        Notification::fake();

        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->actingAs($admin);

        $batch = Batch::factory()->create([
            'status' => BatchStatus::Arrived,
        ]);

        $box = Box::factory()->create([
            'batch_id' => $batch->id,
            'status' => BoxStatus::InTransit,
        ]);

        BoxUpdate::create([
            'box_id' => $box->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_phase' => TrackingPhase::DISPATCHED_TO_LOCAL_HUB->value,
            'location' => 'Destination',
            'description' => 'Dispatched to local hub.',
            'updated_by' => $admin->id,
        ]);

        $response = $this->post(route('admin.batches.bulkUpdateTrackingPhase', $batch), [
            'tracking_phase' => TrackingPhase::DISPATCHED_TO_LOCAL_HUB->value,
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('error', 'This batch is already at or past that tracking phase. Select a later phase to continue.');
        $this->assertDatabaseCount('box_updates', 2);
    }

    public function test_batch_update_to_manila_warehouse_synchronizes_tracking_step_key_and_public_tracking(): void
    {
        Notification::fake();

        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->actingAs($admin);

        $batch = Batch::factory()->create([
            'status' => BatchStatus::UnderCustomsClearance,
        ]);

        $box = Box::factory()->create([
            'batch_id' => $batch->id,
            'tracking_number' => 'TRK-2026-BOC-001',
            'status' => BoxStatus::Arrived,
            'tracking_step_key' => 'under_customs_clearance',
        ]);

        BoxUpdate::create([
            'box_id' => $box->id,
            'status' => BoxStatus::Arrived->value,
            'tracking_step_key' => 'under_customs_clearance',
            'tracking_phase' => TrackingPhase::CUSTOMS_CLEARANCE->value,
            'location' => 'Manila Port',
            'description' => 'Under BOC clearance.',
            'updated_by' => $admin->id,
        ]);

        // Prior to update: Public tracking returns 'under_customs_clearance'
        $responseBefore = $this->get(route('track', ['tracking_number' => $box->tracking_number]));
        $responseBefore->assertOk();
        $responseBefore->assertInertia(fn ($page) => $page
            ->where('trackingData.tracking_step_key', 'under_customs_clearance')
            ->where('trackingData.status_label', 'Under BOC Clearance')
        );

        // Operator updates the batch to Manila Warehouse
        $response = $this->post(route('admin.batches.bulkUpdateTrackingPhase', $batch), [
            'tracking_phase' => TrackingPhase::RECEIVED_MANILA_WAREHOUSE->value,
            'description' => 'Container devanned at Manila warehouse.',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $boxFresh = $box->fresh();
        $this->assertSame(BoxStatus::UnloadedManila, $boxFresh->status);
        $this->assertSame(TrackingPhase::RECEIVED_MANILA_WAREHOUSE->value, $boxFresh->tracking_step_key);

        // After update: Public tracking immediately reflects 'received_manila_warehouse'
        $responseAfter = $this->get(route('track', ['tracking_number' => $box->tracking_number]));
        $responseAfter->assertOk();
        $responseAfter->assertInertia(fn ($page) => $page
            ->where('trackingData.tracking_step_key', 'received_manila_warehouse')
            ->where('trackingData.status_label', 'Received at Manila Warehouse')
        );
    }

    public function test_batch_status_cascade_to_received_at_warehouse_synchronizes_boxes_and_public_tracking(): void
    {
        Notification::fake();

        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->actingAs($admin);

        $batch = Batch::factory()->create([
            'status' => BatchStatus::ReleasedByBoc,
            'current_box_count' => 1,
        ]);

        $box = Box::factory()->create([
            'batch_id' => $batch->id,
            'tracking_number' => 'TRK-2026-BOC-002',
            'status' => BoxStatus::Arrived,
            'tracking_step_key' => 'under_customs_clearance',
        ]);

        $response = $this->patch(route('admin.batches.quickUpdate', $batch), [
            'status' => BatchStatus::ReceivedAtWarehouse->value,
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $boxFresh = $box->fresh();
        $this->assertSame(BoxStatus::UnloadedManila, $boxFresh->status);
        $this->assertSame(TrackingPhase::RECEIVED_MANILA_WAREHOUSE->value, $boxFresh->tracking_step_key);

        $trackResponse = $this->get(route('track', ['tracking_number' => $box->tracking_number]));
        $trackResponse->assertOk();
        $trackResponse->assertInertia(fn ($page) => $page
            ->where('trackingData.tracking_step_key', 'received_manila_warehouse')
            ->where('trackingData.status_label', 'Received at Manila Warehouse')
            ->where('trackingData.all_boxes.0.tracking_step_key', 'received_manila_warehouse')
            ->where('trackingData.all_boxes.0.status_label', 'Received at Manila Warehouse')
        );
    }

    public function test_legacy_desynced_box_with_stale_tracking_step_key_self_heals_from_audit_ledger(): void
    {
        $batch = Batch::factory()->create([
            'status' => BatchStatus::ReceivedAtWarehouse,
        ]);

        $box = Box::factory()->create([
            'batch_id' => $batch->id,
            'tracking_number' => 'TRK-2026-011-002',
            'status' => BoxStatus::Arrived,
            'tracking_step_key' => 'under_customs_clearance',
        ]);

        BoxUpdate::create([
            'box_id' => $box->id,
            'status' => BoxStatus::Arrived->value,
            'tracking_step_key' => 'under_customs_clearance',
            'tracking_phase' => TrackingPhase::CUSTOMS_CLEARANCE->value,
            'location' => 'International Transit',
            'description' => 'Import documentation submitted to BOC.',
        ]);

        BoxUpdate::create([
            'box_id' => $box->id,
            'status' => BoxStatus::Arrived->value,
            'tracking_step_key' => null,
            'tracking_phase' => TrackingPhase::RECEIVED_MANILA_WAREHOUSE->value,
            'location' => 'Destination',
            'description' => 'Container arrived at Manila Warehouse. Boxes safely unloaded for sorting and dispatch.',
        ]);

        $response = $this->get(route('track', ['tracking_number' => $box->tracking_number]));
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->where('trackingData.tracking_step_key', 'received_manila_warehouse')
            ->where('trackingData.status_label', 'Received at Manila Warehouse')
            ->where('trackingData.all_boxes.0.tracking_step_key', 'received_manila_warehouse')
            ->where('trackingData.all_boxes.0.status_label', 'Received at Manila Warehouse')
            ->where('trackingData.timeline.0.tracking_step_key', 'received_manila_warehouse')
            ->where('trackingData.timeline.0.status_label', 'Received at Manila Warehouse')
        );
    }
}
