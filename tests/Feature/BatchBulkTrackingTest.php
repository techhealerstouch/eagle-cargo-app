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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class BatchBulkTrackingTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_bulk_update_tracking_phase_for_boxes_in_a_batch(): void
    {
        Notification::fake();

        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->actingAs($admin);

        $batch = Batch::factory()->create([
            'status' => BatchStatus::Sailed,
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

        $this->assertDatabaseCount('box_updates', 2);

        foreach ($boxes as $box) {
            $this->assertDatabaseHas('box_updates', [
                'box_id' => $box->id,
                'status' => BoxStatus::Arrived->value,
                'tracking_phase' => TrackingPhase::RELEASED_BY_BOC->value,
                'description' => 'Released by BOC in Manila.',
                'updated_by' => $admin->id,
            ]);

            $this->assertSame(BoxStatus::Arrived, $box->fresh()->status);
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
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_phase' => TrackingPhase::DISPATCHED_TO_LOCAL_HUB->value,
            'updated_by' => $warehouse->id,
        ]);
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
        $this->assertDatabaseCount('box_updates', 0);
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
        $this->assertDatabaseCount('box_updates', 0);
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
        $this->assertDatabaseCount('box_updates', 1);
    }
}
