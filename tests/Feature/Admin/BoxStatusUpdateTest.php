<?php

namespace Tests\Feature\Admin;

use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Box;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class BoxStatusUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_update_box_status_without_contradiction_or_future_problem()
    {
        // 1. Arrange: Setup user, booking, and an eligible box.
        // For a box to be eligible, it must be ReceivedByWarehouse or have an active courier.
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
}
