<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\BoxUpdate;
use App\Models\User;
use App\Services\BatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WarehouseEnhancementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => Role::Admin]);
    }

    public function test_warehouse_staff_can_mark_box_as_damaged()
    {
        $box = Box::factory()->create(['status' => BoxStatus::ReceivedByWarehouse]);

        $response = $this->actingAs($this->admin)->post('/warehouse/mark-damaged', [
            'tracking_number' => $box->tracking_number,
            'notes' => 'Torn corner and wet bottom',
        ]);

        $response->assertRedirect();
        $this->assertEquals(BoxStatus::Damaged, $box->fresh()->status);

        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box->id,
            'status' => BoxStatus::Damaged->value,
            'description' => 'DAMAGED: Torn corner and wet bottom',
            'updated_by' => $this->admin->id,
        ]);
        $this->assertSame(1, BoxUpdate::where('box_id', $box->id)->count());
    }

    public function test_warehouse_staff_can_update_physicals_and_location()
    {
        $box = Box::factory()->create(['status' => BoxStatus::ReceivedByWarehouse]);

        $response = $this->actingAs($this->admin)->post('/warehouse/update-physicals', [
            'tracking_number' => $box->tracking_number,
            'weight' => 25.5,
            'actual_cbm' => 0.125,
            'warehouse_location' => 'BIN-99',
        ]);

        $response->assertRedirect();
        $box->refresh();
        $this->assertEquals(25.5, (float) $box->weight);
        $this->assertEquals(0.125, (float) $box->actual_cbm);
        $this->assertEquals('BIN-99', $box->warehouse_location);
    }

    public function test_unload_box_recalculates_batch_metrics()
    {
        $boxType = BoxType::factory()->create(['dimensions' => '50x50x50 cm']); // 0.125 CBM
        $batch = Batch::factory()->create([
            'status' => BatchStatus::Loading,
            'capacity_boxes' => 10,
            'capacity_cbm' => 2.0,
        ]);

        $box = Box::factory()->create([
            'status' => BoxStatus::InTransit,
            'batch_id' => $batch->id,
            'box_type_id' => $boxType->id,
            'weight' => 10.0,
        ]);

        // Manually trigger initial recalculation to set baseline
        app(BatchService::class)->refreshAndEvaluateById($batch->id);
        $batch->refresh();
        $this->assertEquals(1, $batch->current_box_count);
        $this->assertEquals(10.0, (float) $batch->current_weight_kg);
        $this->assertEquals(0.125, (float) $batch->current_cbm);

        // Act: Unload the box
        $response = $this->actingAs($this->admin)->post('/warehouse/unload', [
            'tracking_number' => $box->tracking_number,
        ]);

        $response->assertRedirect();
        $batch->refresh();
        $box->refresh();

        $this->assertNull($box->batch_id);
        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $box->status);
        $this->assertEquals(0, $batch->current_box_count);
        $this->assertEquals(0, (float) $batch->current_weight_kg);
        $this->assertEquals(0, (float) $batch->current_cbm);
    }

    public function test_actual_cbm_overrides_default_calculation()
    {
        $boxType = BoxType::factory()->create(['dimensions' => '50x50x50 cm']); // 0.125 CBM default
        $batch = Batch::factory()->create(['status' => BatchStatus::Loading]);

        $box = Box::factory()->create([
            'status' => BoxStatus::InTransit,
            'batch_id' => $batch->id,
            'box_type_id' => $boxType->id,
            'actual_cbm' => 0.500, // Override to 4x the default
        ]);

        app(BatchService::class)->refreshAndEvaluateById($batch->id);
        $batch->refresh();

        $this->assertEquals(0.500, (float) $batch->current_cbm);
    }

    public function test_warehouse_dashboard_includes_aging_buckets_and_missing_siblings(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $readyBox = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'warehouse_location' => 'BIN-ALPHA',
            'batch_id' => null,
        ]);
        $this->scan($readyBox, now()->subHours(49));

        $missingSibling = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Collected,
        ]);

        $response = $this->actingAs($this->admin)->get(route('warehouse.dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('warehouse/Dashboard')
            ->where('stats.aging.48_plus', 1)
            ->where('readyToLoad.0.tracking_number', $readyBox->tracking_number)
            ->where('readyToLoad.0.aging_bucket', '48_plus')
            ->where('readyToLoad.0.missing_siblings', 1)
            ->where('readyToLoad.0.missing_sibling_boxes.0.tracking_number', $missingSibling->tracking_number));
    }

    public function test_warehouse_dashboard_filters_by_location_status_batch_and_aging(): void
    {
        $matching = Box::factory()->create([
            'status' => BoxStatus::ReceivedByWarehouse,
            'warehouse_location' => 'BIN-FILTER',
            'batch_id' => null,
        ]);
        $this->scan($matching, now()->subHours(75));

        $other = Box::factory()->create([
            'status' => BoxStatus::ReceivedByWarehouse,
            'warehouse_location' => 'BIN-OTHER',
            'batch_id' => null,
        ]);
        $this->scan($other, now()->subHours(4));

        $response = $this->actingAs($this->admin)->get(route('warehouse.dashboard', [
            'warehouse_location' => 'FILTER',
            'status' => BoxStatus::ReceivedByWarehouse->value,
            'batch_assignment' => 'unbatched',
            'aging_bucket' => 'critical',
        ]));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->where('filters.warehouse_location', 'FILTER')
            ->where('filters.status', BoxStatus::ReceivedByWarehouse->value)
            ->where('filters.batch_assignment', 'unbatched')
            ->where('filters.aging_bucket', 'critical')
            ->has('readyToLoad', 1)
            ->where('readyToLoad.0.tracking_number', $matching->tracking_number));

        $this->assertNotSame($other->tracking_number, $matching->tracking_number);
    }

    private function scan(Box $box, \DateTimeInterface $createdAt): void
    {
        BoxUpdate::unguarded(fn () => BoxUpdate::create([
            'box_id' => $box->id,
            'status' => $box->status->value,
            'tracking_phase' => 'received_by_branch',
            'description' => 'Received at warehouse.',
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]));
    }
}
