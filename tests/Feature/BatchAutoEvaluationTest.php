<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\BoxStatus;
use App\Models\Batch;
use App\Models\Box;
use App\Models\BoxType;
use App\Services\BatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BatchAutoEvaluationTest extends TestCase
{
    use RefreshDatabase;

    protected function createBatchWithCapacity(int $boxCapacity, float $weightCapacity = 1000.0, float $cbmCapacity = 10.0): Batch
    {
        return app(BatchService::class)->create([
            'branch_name' => 'Sydney Hub',
            'capacity_boxes' => $boxCapacity,
            'capacity_weight_kg' => $weightCapacity,
            'capacity_cbm' => $cbmCapacity,
            'cutoff_at' => now()->addDay(),
            'status' => BatchStatus::Open,
        ]);
    }

    protected function addBoxToBatch(Batch $batch, float $weight = 10.0, float $cbm = 0.5, BoxStatus $status = BoxStatus::ReceivedByWarehouse): Box
    {
        $boxType = BoxType::factory()->create(['dimensions' => '24x24x24']);

        return Box::factory()->create([
            'batch_id' => $batch->id,
            'box_type_id' => $boxType->id,
            'status' => $status,
            'weight' => $weight,
            'actual_cbm' => $cbm,
        ]);
    }

    // ---------------------------------------------------------------
    // 1. Box Count Capacity
    // ---------------------------------------------------------------

    public function test_batch_becomes_ready_to_close_when_box_capacity_reached(): void
    {
        $batch = $this->createBatchWithCapacity(boxCapacity: 2);

        $this->addBoxToBatch($batch);
        $this->assertEquals(BatchStatus::Open, $batch->fresh()->status);

        $this->addBoxToBatch($batch);
        $this->assertEquals(BatchStatus::ReadyToClose, $batch->fresh()->status);
    }

    public function test_batch_does_not_close_before_capacity_reached(): void
    {
        $batch = $this->createBatchWithCapacity(boxCapacity: 5);

        $this->addBoxToBatch($batch);
        $this->addBoxToBatch($batch);
        $this->addBoxToBatch($batch);

        $this->assertEquals(BatchStatus::Open, $batch->fresh()->status);
        $this->assertSame(3, $batch->fresh()->current_box_count);
    }

    // ---------------------------------------------------------------
    // 2. Weight Capacity
    // ---------------------------------------------------------------

    public function test_batch_becomes_ready_to_close_when_weight_capacity_reached(): void
    {
        $batch = $this->createBatchWithCapacity(boxCapacity: 100, weightCapacity: 50.0);

        $this->addBoxToBatch($batch, weight: 30.0);
        $this->assertEquals(BatchStatus::Open, $batch->fresh()->status);

        $this->addBoxToBatch($batch, weight: 25.0);
        // Total: 55 > 50 capacity → Ready to Close
        $this->assertEquals(BatchStatus::ReadyToClose, $batch->fresh()->status);
    }

    // ---------------------------------------------------------------
    // 3. CBM Capacity
    // ---------------------------------------------------------------

    public function test_batch_becomes_ready_to_close_when_cbm_capacity_reached(): void
    {
        $batch = $this->createBatchWithCapacity(boxCapacity: 100, weightCapacity: 10000, cbmCapacity: 1.0);

        $this->addBoxToBatch($batch, cbm: 0.6);
        $this->assertEquals(BatchStatus::Open, $batch->fresh()->status);

        $this->addBoxToBatch($batch, cbm: 0.5);
        // Total: 1.1 > 1.0 → Ready to Close
        $this->assertEquals(BatchStatus::ReadyToClose, $batch->fresh()->status);
    }

    // ---------------------------------------------------------------
    // 4. Confirm Manifest
    // ---------------------------------------------------------------

    public function test_confirm_manifest_transitions_to_sailed(): void
    {
        $batch = $this->createBatchWithCapacity(boxCapacity: 1);
        $this->addBoxToBatch($batch);

        // Batch should be ready to close
        $this->assertEquals(BatchStatus::ReadyToClose, $batch->fresh()->status);

        $sailed = app(BatchService::class)->confirmManifest($batch->fresh());

        $this->assertEquals(BatchStatus::Sailed, $sailed->fresh()->status);
        $this->assertNotNull($sailed->fresh()->sailed_at);
    }

    public function test_confirm_manifest_fails_if_not_ready_to_close(): void
    {
        $batch = $this->createBatchWithCapacity(boxCapacity: 10);
        // No boxes added → still Open

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('not yet ready to close');

        app(BatchService::class)->confirmManifest($batch);
    }

    // ---------------------------------------------------------------
    // 5. Confirm Arrival
    // ---------------------------------------------------------------

    public function test_confirm_arrival_transitions_to_arrived(): void
    {
        $batch = $this->createBatchWithCapacity(boxCapacity: 1);
        $this->addBoxToBatch($batch);

        $batch = app(BatchService::class)->confirmManifest($batch->fresh());
        $this->assertEquals(BatchStatus::Sailed, $batch->fresh()->status);

        $arrived = app(BatchService::class)->confirmArrival($batch->fresh());

        $this->assertEquals(BatchStatus::Arrived, $arrived->fresh()->status);
        $this->assertNotNull($arrived->fresh()->arrived_at);
    }

    public function test_confirm_arrival_fails_for_non_sailed_batch(): void
    {
        $batch = $this->createBatchWithCapacity(boxCapacity: 10);

        $this->expectException(\InvalidArgumentException::class);

        app(BatchService::class)->confirmArrival($batch);
    }

    // ---------------------------------------------------------------
    // 6. Box Movement Between Batches
    // ---------------------------------------------------------------

    public function test_moving_box_between_batches_refreshes_both(): void
    {
        $batch1 = $this->createBatchWithCapacity(boxCapacity: 2);
        $batch2 = $this->createBatchWithCapacity(boxCapacity: 2);

        $box1 = $this->addBoxToBatch($batch1);
        $box2 = $this->addBoxToBatch($batch1);

        // batch1 is now full → ReadyToClose
        $this->assertEquals(BatchStatus::ReadyToClose, $batch1->fresh()->status);
        $this->assertSame(2, $batch1->fresh()->current_box_count);

        // Move box2 from batch1 to batch2
        $box2->update(['batch_id' => $batch2->id]);

        // batch1 should revert to Open (only 1 box now)
        $this->assertSame(1, $batch1->fresh()->current_box_count);
        // batch2 should now have 1 box, still Open
        $this->assertSame(1, $batch2->fresh()->current_box_count);
    }

    // ---------------------------------------------------------------
    // 7. Batch Status Blocked Detection
    // ---------------------------------------------------------------

    public function test_batch_cannot_skip_statuses(): void
    {
        $batch = $this->createBatchWithCapacity(boxCapacity: 10);

        $this->expectException(\InvalidArgumentException::class);

        // Open → Arrived is invalid (must go through Loading/ReadyToClose → Sailed → Arrived)
        app(BatchService::class)->update($batch, ['status' => BatchStatus::Arrived]);
    }

    // ---------------------------------------------------------------
    // 8. Bulk Box Status Update in Batch
    // ---------------------------------------------------------------

    public function test_bulk_update_tracking_phase_updates_all_boxes(): void
    {
        $batch = $this->createBatchWithCapacity(boxCapacity: 10);
        $this->addBoxToBatch($batch, status: BoxStatus::ReceivedByWarehouse);
        $this->addBoxToBatch($batch, status: BoxStatus::ReceivedByWarehouse);
        $this->addBoxToBatch($batch, status: BoxStatus::ReceivedByWarehouse);

        $updated = app(BatchService::class)->bulkUpdateTrackingPhase(
            $batch,
            \App\Enums\TrackingPhase::LOADING_CONTAINER
        );

        $this->assertSame(3, $updated);

        // All boxes should now be LoadedToContainer
        $batch->fresh()->boxes->each(function (Box $box) {
            $this->assertEquals(BoxStatus::LoadedToContainer, $box->status);
        });
    }

    public function test_bulk_update_tracking_phase_creates_box_updates(): void
    {
        $admin = \App\Models\User::factory()->create(['role' => \App\Enums\Role::Admin]);
        $batch = $this->createBatchWithCapacity(boxCapacity: 10);
        $this->addBoxToBatch($batch, status: BoxStatus::ReceivedByWarehouse);

        app(BatchService::class)->bulkUpdateTrackingPhase(
            $batch,
            \App\Enums\TrackingPhase::IN_TRANSIT_SEA,
            updatedBy: $admin->id,
            description: 'Container departed Sydney'
        );

        $this->assertDatabaseHas('box_updates', [
            'tracking_phase' => \App\Enums\TrackingPhase::IN_TRANSIT_SEA->value,
            'description' => 'Container departed Sydney',
        ]);
    }
}
