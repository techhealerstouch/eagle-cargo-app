<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\User;
use App\Services\BatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WarehouseOperationTest extends TestCase
{
    use RefreshDatabase;

    protected function createWarehouseUser(): User
    {
        return User::factory()->create([
            'role' => Role::Warehouse,
            'email_verified_at' => now(),
        ]);
    }

    protected function createAdminUser(): User
    {
        return User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);
    }

    protected function createBoxWithBooking(BoxStatus $status = BoxStatus::Collected): Box
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => \App\Enums\PaymentStatus::Paid,
            'declaration_form_status' => 'submitted_online',
        ]);

        return Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => $status,
            'weight' => 20.0,
        ]);
    }

    // ---------------------------------------------------------------
    // 1. Bulk Box Status Updates
    // ---------------------------------------------------------------

    public function test_warehouse_can_bulk_update_box_status(): void
    {
        $warehouse = $this->createWarehouseUser();
        $this->actingAs($warehouse);

        $box1 = $this->createBoxWithBooking(BoxStatus::Collected);
        $box2 = $this->createBoxWithBooking(BoxStatus::Collected);
        $box3 = $this->createBoxWithBooking(BoxStatus::Collected);

        $response = $this->post(route('admin.boxes.bulk-update-status'), [
            'ids' => [$box1->id, $box2->id, $box3->id],
            'status' => BoxStatus::ReceivedByWarehouse->value,
        ]);

        $response->assertSessionHasNoErrors();

        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $box1->fresh()->status);
        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $box2->fresh()->status);
        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $box3->fresh()->status);
    }

    public function test_bulk_update_with_invalid_transition_is_rejected(): void
    {
        $admin = $this->createAdminUser();
        $this->actingAs($admin);

        $box = $this->createBoxWithBooking(BoxStatus::Pending);

        $response = $this->post(route('admin.boxes.bulk-update-status'), [
            'ids' => [$box->id],
            'status' => BoxStatus::Delivered->value, // Invalid: Pending → Delivered
        ]);

        $response->assertSessionHas('error');
    }

    // ---------------------------------------------------------------
    // 2. Bulk Assign Boxes to Batch
    // ---------------------------------------------------------------

    public function test_warehouse_can_bulk_assign_boxes_to_batch(): void
    {
        $warehouse = $this->createWarehouseUser();
        $this->actingAs($warehouse);

        $batch = app(BatchService::class)->create([
            'branch_name' => 'Sydney Hub',
            'capacity_boxes' => 10,
            'status' => BatchStatus::Open,
        ]);

        $box1 = $this->createBoxWithBooking(BoxStatus::ReceivedByWarehouse);
        $box2 = $this->createBoxWithBooking(BoxStatus::ReceivedByWarehouse);

        $response = $this->post(route('admin.boxes.bulk-assign-to-batch'), [
            'ids' => [$box1->id, $box2->id],
            'batch_id' => $batch->id,
        ]);

        $response->assertSessionHasNoErrors();

        $this->assertEquals($batch->id, $box1->fresh()->batch_id);
        $this->assertEquals($batch->id, $box2->fresh()->batch_id);
        $this->assertSame(2, $batch->fresh()->current_box_count);
    }

    public function test_bulk_assign_skips_ineligible_boxes(): void
    {
        $warehouse = $this->createWarehouseUser();
        $this->actingAs($warehouse);

        $batch = app(BatchService::class)->create([
            'branch_name' => 'Sydney Hub',
            'capacity_boxes' => 10,
            'status' => BatchStatus::Open,
        ]);

        $box1 = $this->createBoxWithBooking(BoxStatus::ReceivedByWarehouse);
        // Valid

        $booking2 = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => \App\Enums\PaymentStatus::Paid,
            'declaration_form_status' => 'missing',
        ]);
        $box2 = Box::factory()->create([
            'booking_id' => $booking2->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'weight' => 20.0,
        ]);
        // Missing declaration

        $booking3 = Booking::factory()->create([
            'status' => BookingStatus::Cancelled,
            'payment_status' => \App\Enums\PaymentStatus::Paid,
            'declaration_form_status' => 'submitted_online',
        ]);
        $box3 = Box::factory()->create([
            'booking_id' => $booking3->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'weight' => 20.0,
        ]);
        // Cancelled booking

        $response = $this->post(route('admin.boxes.bulk-assign-to-batch'), [
            'ids' => [$box1->id, $box2->id, $box3->id],
            'batch_id' => $batch->id,
        ]);

        // Box2 and Box3 should be skipped, generating a warning flash message
        $response->assertSessionHas('warning');

        $this->assertEquals($batch->id, $box1->fresh()->batch_id);
        $this->assertNull($box2->fresh()->batch_id);
        $this->assertNull($box3->fresh()->batch_id);
        $this->assertSame(1, $batch->fresh()->current_box_count);
    }

    // ---------------------------------------------------------------
    // 3. Load Boxes into Batch
    // ---------------------------------------------------------------

    public function test_admin_can_load_boxes_into_batch(): void
    {
        $admin = $this->createAdminUser();
        $this->actingAs($admin);

        $batch = app(BatchService::class)->create([
            'branch_name' => 'Sydney Hub',
            'capacity_boxes' => 10,
            'status' => BatchStatus::Open,
        ]);

        $box1 = $this->createBoxWithBooking(BoxStatus::ReceivedByWarehouse);
        $box2 = $this->createBoxWithBooking(BoxStatus::ReceivedByWarehouse);

        $response = $this->post(route('admin.batches.loadBoxes', $batch), [
            'box_ids' => [$box1->id, $box2->id],
        ]);

        $response->assertSessionHasNoErrors();

        $this->assertEquals($batch->id, $box1->fresh()->batch_id);
        $this->assertEquals($batch->id, $box2->fresh()->batch_id);
    }

    // ---------------------------------------------------------------
    // 4. Warehouse Dashboard Access
    // ---------------------------------------------------------------

    public function test_warehouse_can_access_dashboard(): void
    {
        $warehouse = $this->createWarehouseUser();

        $response = $this->actingAs($warehouse)->get('/dashboard');

        $response->assertRedirect(route('warehouse.dashboard'));
    }

    // ---------------------------------------------------------------
    // 5. Box Warehouse Location Tracking
    // ---------------------------------------------------------------

    public function test_box_warehouse_location_is_tracked(): void
    {
        $box = Box::factory()->create([
            'status' => BoxStatus::ReceivedByWarehouse,
            'warehouse_location' => 'Aisle 5, Rack B, Shelf 3',
        ]);

        $this->assertEquals('Aisle 5, Rack B, Shelf 3', $box->warehouse_location);
    }

    // ---------------------------------------------------------------
    // 6. Authorization: Sender cannot access warehouse routes
    // ---------------------------------------------------------------

    public function test_sender_cannot_bulk_update_box_status(): void
    {
        /** @var User $sender */
        $sender = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($sender)
            ->post(route('admin.boxes.bulk-update-status'), [
                'ids' => [1],
                'status' => BoxStatus::ReceivedByWarehouse->value,
            ]);

        $response->assertStatus(403);
    }
}
