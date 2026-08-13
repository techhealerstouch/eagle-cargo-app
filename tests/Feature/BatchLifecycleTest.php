<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\BoxStatus;
use App\Enums\TrackingPhase;
use App\Models\Batch;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\User;
use App\Services\BatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BatchLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_batch_becomes_ready_to_close_when_box_capacity_is_reached()
    {
        $service = app(BatchService::class);

        $batch = $service->create([
            'branch_name' => 'Sydney Hub',
            'capacity_boxes' => 1,
            'cutoff_at' => now()->addDay(),
            'status' => BatchStatus::Open,
        ]);

        $boxType = BoxType::factory()->create(['dimensions' => '24x24x24']);

        Box::factory()->create([
            'batch_id' => $batch->id,
            'box_type_id' => $boxType->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'weight' => 10,
        ]);

        $this->assertSame(BatchStatus::ReadyToClose, $batch->fresh()->status);
        $this->assertSame(1, $batch->fresh()->current_box_count);
    }

    public function test_confirm_manifest_transitions_batch_to_sailed()
    {
        $branchName = 'Melbourne Hub';
        $vesselName = 'Ever Given';
        $service = app(BatchService::class);

        $batch = $service->create([
            'branch_name' => $branchName,
            'vessel_name' => $vesselName,
            'shipping_line' => 'Harbor Freight Lines',
            'voyage_number' => 'VY-2026-101',
            'origin_port' => 'Melbourne',
            'destination_port' => 'Manila',
            'capacity_boxes' => 1,
            'status' => BatchStatus::Open,
        ]);

        Box::factory()->create([
            'batch_id' => $batch->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'weight' => 8,
        ]);

        /** @var User $actor */
        $actor = User::factory()->create();
        $this->actingAs($actor);

        $batch->refresh();
        $this->assertSame(BatchStatus::ReadyToClose, $batch->status);

        $sailedBatch = $service->confirmManifest($batch);

        $this->assertSame(BatchStatus::Sailed, $sailedBatch->fresh()->status);
        $this->assertNotNull($sailedBatch->fresh()->sailed_at);

        // A next batch should be auto-created from template
        $this->assertSame(2, Batch::count());
    }

    public function test_invalid_direct_transition_is_rejected()
    {
        $service = app(BatchService::class);

        $batch = $service->create([
            'branch_name' => 'Los Angeles Hub',
            'status' => BatchStatus::Open,
        ]);

        $this->expectException(\InvalidArgumentException::class);

        $service->update($batch, [
            'status' => BatchStatus::Sailed,
        ]);
    }

    public function test_moving_box_between_batches_refreshes_both_batches_automatically(): void
    {
        $sourceBatch = Batch::factory()->create([
            'status' => BatchStatus::Open,
        ]);
        $targetBatch = Batch::factory()->create([
            'status' => BatchStatus::Open,
        ]);

        $box = Box::factory()->create([
            'batch_id' => $sourceBatch->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'weight' => 12,
        ]);

        $this->assertSame(1, $sourceBatch->fresh()->current_box_count);
        $this->assertSame(0, $targetBatch->fresh()->current_box_count);

        $box->update(['batch_id' => $targetBatch->id]);

        $this->assertSame(0, $sourceBatch->fresh()->current_box_count);
        $this->assertSame(1, $targetBatch->fresh()->current_box_count);
    }

    public function test_cancelled_boxes_are_removed_from_batch_metrics_and_reactivated_boxes_are_counted_again(): void
    {
        /** @var User $actor */
        $actor = User::factory()->create();
        $this->actingAs($actor);

        $batch = Batch::factory()->create([
            'status' => BatchStatus::Open,
        ]);

        $box = Box::factory()->create([
            'batch_id' => $batch->id,
            'status' => BoxStatus::Pending,
            'weight' => 9,
        ]);

        $this->assertSame(1, $batch->fresh()->current_box_count);

        $box->update(['status' => BoxStatus::Cancelled]);
        $this->assertSame(0, $batch->fresh()->current_box_count);

        $box->update(['status' => BoxStatus::Pending]);
        $this->assertSame(1, $batch->fresh()->current_box_count);
    }

    public function test_soft_deleted_boxes_are_removed_and_restored_boxes_are_recounted(): void
    {
        $batch = Batch::factory()->create([
            'status' => BatchStatus::Open,
        ]);

        $box = Box::factory()->create([
            'batch_id' => $batch->id,
            'status' => BoxStatus::Pending,
            'weight' => 7,
        ]);

        $this->assertSame(1, $batch->fresh()->current_box_count);

        $box->delete();
        $this->assertSame(0, $batch->fresh()->current_box_count);

        $box->restore();
        $this->assertSame(1, $batch->fresh()->current_box_count);
    }

    public function test_marking_batch_sailed_cascades_box_status_and_tracking_phase(): void
    {
        /** @var User $actor */
        $actor = User::factory()->create();
        $this->actingAs($actor);

        $batch = Batch::factory()->create([
            'status' => BatchStatus::ReadyToClose,
        ]);

        $box = Box::factory()->create([
            'batch_id' => $batch->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'weight' => 8,
        ]);

        $batch->update(['status' => BatchStatus::Sailed]);

        $this->assertSame(BoxStatus::InTransit, $box->fresh()->status);
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_phase' => TrackingPhase::IN_TRANSIT_SEA->value,
            'updated_by' => $actor->id,
        ]);
    }

    public function test_marking_batch_arrived_cascades_box_status_and_tracking_phase(): void
    {
        /** @var User $actor */
        $actor = User::factory()->create();
        $this->actingAs($actor);

        $batch = Batch::factory()->create([
            'status' => BatchStatus::Sailed,
        ]);

        $box = Box::factory()->create([
            'batch_id' => $batch->id,
            'status' => BoxStatus::InTransit,
            'weight' => 8,
        ]);

        $batch->update(['status' => BatchStatus::Arrived]);

        $this->assertSame(BoxStatus::Arrived, $box->fresh()->status);
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box->id,
            'status' => BoxStatus::Arrived->value,
            'tracking_phase' => TrackingPhase::ARRIVED_MANILA_PORT->value,
            'updated_by' => $actor->id,
        ]);
    }
}
