<?php

namespace Tests\Feature\Admin;

use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Enums\TrackingPhase;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\User;
use App\Repositories\Contracts\TrackingRepositoryInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class BoxStatusUpdateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

    public function test_admin_can_update_box_status_without_contradiction_or_future_problem()
    {
        // 1. Arrange: Setup user, booking, and an eligible box.
        // For a box to be eligible, it must be ReceivedByWarehouse or have an active courier.
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $booking = Booking::factory()->create();
        
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse, // This makes it eligible
        ]);

        // We want to transition to InTransit, which is a valid transition from ReceivedByWarehouse.
        $newStatus = BoxStatus::InTransit->value;
        $notes = 'Status smoothly updated to In Transit by admin';

        // 2. Act: Admin submits a status update request
        $response = $this->actingAs($admin)->post(route('admin.boxes.update-status', $box), [
            'status' => $newStatus,
            'courier_notes' => $notes,
        ]);

        // 3. Assert: Request was successful and no contradiction/future problem occurred
        $response->assertRedirect();
        $response->assertSessionHas('success', 'Box status updated successfully.');
        $response->assertSessionHasNoErrors();

        $box->refresh();

        $this->assertEquals(BoxStatus::InTransit, $box->status);
        $this->assertEquals($notes, $box->courier_notes);
        
        // Assert that a BoxUpdate tracking record was created
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box->id,
            'status' => BoxStatus::InTransit->value,
            'description' => $notes,
            'updated_by' => $admin->id,
        ]);
    }

    public function test_admin_cannot_update_box_status_with_invalid_transition()
    {
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $booking = Booking::factory()->create();
        
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse, // Eligible
        ]);

        // Attempt to transition back to Pending, which is invalid from ReceivedByWarehouse
        $invalidStatus = BoxStatus::Pending->value;

        // Act
        $response = $this->actingAs($admin)->post(route('admin.boxes.update-status', $box), [
            'status' => $invalidStatus,
            'courier_notes' => 'Invalid backward transition',
        ]);

        // Assert: Should return back with error (caught from RuntimeException in controller)
        $response->assertRedirect();
        $response->assertSessionHas('error'); // The controller catches RuntimeException and sets an error session
        
        $box->refresh();
        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $box->status); // Status should remain unchanged
    }

    public function test_admin_box_edit_page_loads_with_latest_update_and_tracking_step_key()
    {
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $booking = Booking::factory()->create();

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'tracking_step_key' => 'received_by_branch',
        ]);

        \App\Models\BoxUpdate::create([
            'box_id' => $box->id,
            'status' => BoxStatus::ReceivedByWarehouse->value,
            'tracking_step_key' => 'received_by_branch',
            'description' => 'Received at warehouse',
            'updated_by' => $admin->id,
        ]);

        $response = $this->actingAs($admin)->get(route('admin.boxes.edit', $box));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('admin/boxes/edit')
            ->has('box')
            ->where('box.id', $box->id)
            ->where('box.status', BoxStatus::ReceivedByWarehouse->value)
            ->where('box.tracking_step_key', 'received_by_branch')
            ->has('box.latest_update')
        );
    }

    public function test_admin_can_update_box_via_edit_form_and_save_tracking_step_key()
    {
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $booking = Booking::factory()->create();

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'tracking_step_key' => 'received_by_branch',
        ]);

        $response = $this->actingAs($admin)->put(route('admin.boxes.update', $box), [
            'booking_id' => $booking->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => 'in_transit_sea',
            'courier_notes' => 'Loaded for ocean transit',
        ]);

        $response->assertRedirect();
        $box->refresh();

        $this->assertEquals(BoxStatus::InTransit, $box->status);
        $this->assertEquals('in_transit_sea', $box->tracking_step_key);
        $this->assertEquals('Loaded for ocean transit', $box->courier_notes);
    }

    public function test_admin_status_update_with_sorting_step_syncs_tracking_phase_and_public_label()
    {
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $booking = Booking::factory()->create();

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'tracking_step_key' => 'received_by_branch',
        ]);

        $response = $this->actingAs($admin)->post(route('admin.boxes.update-status', $box), [
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => 'sorting',
            'courier_notes' => 'Sorting at distribution center',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $box->refresh();

        $this->assertEquals(BoxStatus::InTransit, $box->status);
        $this->assertEquals('sorting', $box->tracking_step_key);

        $latestUpdate = BoxUpdate::where('box_id', $box->id)->latest('id')->first();
        $this->assertNotNull($latestUpdate);
        $this->assertEquals('sorting', $latestUpdate->tracking_step_key);
        $this->assertEquals(TrackingPhase::SORTING, $latestUpdate->tracking_phase);

        /** @var TrackingRepositoryInterface $trackingRepo */
        $trackingRepo = app(TrackingRepositoryInterface::class);
        $trackingData = $trackingRepo->getTrackingData($box->tracking_number);

        $this->assertNotNull($trackingData);
        $this->assertEquals('At Sorting Facility', $trackingData['status_label']);
        $this->assertEquals('sorting', $trackingData['tracking_step_key']);
    }

    public function test_admin_bulk_status_update_with_sorting_step_syncs_tracking_phase_and_public_label()
    {
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $booking = Booking::factory()->create();

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'tracking_step_key' => 'received_by_branch',
        ]);

        $response = $this->actingAs($admin)->post(route('admin.boxes.bulk-update-status'), [
            'ids' => [$box->id],
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => 'sorting',
            'courier_notes' => 'Bulk sorted at hub',
        ]);

        $response->assertRedirect();
        $box->refresh();

        $this->assertEquals(BoxStatus::InTransit, $box->status);
        $this->assertEquals('sorting', $box->tracking_step_key);

        $latestUpdate = BoxUpdate::where('box_id', $box->id)->latest('id')->first();
        $this->assertNotNull($latestUpdate);
        $this->assertEquals('sorting', $latestUpdate->tracking_step_key);
        $this->assertEquals(TrackingPhase::SORTING, $latestUpdate->tracking_phase);

        /** @var TrackingRepositoryInterface $trackingRepo */
        $trackingRepo = app(TrackingRepositoryInterface::class);
        $trackingData = $trackingRepo->getTrackingData($box->tracking_number);

        $this->assertNotNull($trackingData);
        $this->assertEquals('At Sorting Facility', $trackingData['status_label']);
        $this->assertEquals('sorting', $trackingData['tracking_step_key']);
    }

    public function test_admin_bulk_assign_to_batch_loads_box_to_container()
    {
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        $booking = Booking::factory()->create([
            'status' => \App\Enums\BookingStatus::Confirmed,
            'payment_status' => \App\Enums\PaymentStatus::Paid,
            'declaration_form_status' => 'submitted_online',
        ]);

        $batch = \App\Models\Batch::factory()->create();

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending,
        ]);

        $response = $this->actingAs($admin)->post(route('admin.boxes.bulk-assign-to-batch'), [
            'ids' => [$box->id],
            'batch_id' => $batch->id,
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success');

        $box->refresh();
        $this->assertEquals(BoxStatus::LoadedToContainer, $box->status);
        $this->assertEquals('loading_container', $box->tracking_step_key);
        $this->assertEquals($batch->id, $box->batch_id);
    }
}

