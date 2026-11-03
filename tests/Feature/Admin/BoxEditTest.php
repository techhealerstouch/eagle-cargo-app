<?php

namespace Tests\Feature\Admin;

use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class BoxEditTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private Booking $booking;
    private Box $box;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);

        $this->admin = User::factory()->create(['role' => Role::Admin]);
        $this->booking = Booking::factory()->create();
        $this->box = Box::factory()->create([
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'tracking_step_key' => 'received_by_branch',
        ]);
    }

    public function test_admin_can_view_box_edit_page_when_booking_sender_is_soft_deleted(): void
    {
        $sender = Sender::factory()->create();
        $bookingWithDeletedSender = Booking::factory()->create(['sender_id' => $sender->id]);
        $sender->delete(); // Soft delete

        $response = $this->actingAs($this->admin)->get(route('admin.boxes.edit', $this->box));

        $response->assertOk();
    }

    public function test_admin_can_update_box_status_to_cancelled(): void
    {
        $response = $this->actingAs($this->admin)->put(route('admin.boxes.update', $this->box), [
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::Cancelled->value,
            'tracking_step_key' => 'cancelled',
            'courier_notes' => 'Customer requested cancellation',
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->box->refresh();
        $this->assertEquals(BoxStatus::Cancelled, $this->box->status);
    }

    public function test_admin_can_update_box_status_to_damaged(): void
    {
        $response = $this->actingAs($this->admin)->put(route('admin.boxes.update', $this->box), [
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::Damaged->value,
            'tracking_step_key' => 'damaged',
            'courier_notes' => 'Damaged during unloading',
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->box->refresh();
        $this->assertEquals(BoxStatus::Damaged, $this->box->status);
    }

    public function test_admin_can_update_box_status_to_held(): void
    {
        $response = $this->actingAs($this->admin)->put(route('admin.boxes.update', $this->box), [
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::Held->value,
            'tracking_step_key' => 'held',
            'courier_notes' => 'Held for inspection',
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->box->refresh();
        $this->assertEquals(BoxStatus::Held, $this->box->status);
    }

    public function test_admin_cannot_move_tracking_step_backward_without_valid_state(): void
    {
        $this->box->update([
            'status' => BoxStatus::InTransit,
            'tracking_step_key' => 'sorting',
        ]);

        $response = $this->actingAs($this->admin)->put(route('admin.boxes.update', $this->box), [
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => 'in_transit_sea',
            'courier_notes' => 'Attempting regression',
        ]);

        $response->assertSessionHasErrors('tracking_step_key');
    }

    public function test_admin_can_move_tracking_step_backward_with_valid_admin_correction_reason(): void
    {
        $this->box->bypassStatusValidation = true;
        $this->box->update([
            'status' => BoxStatus::UnloadedManila,
            'tracking_step_key' => 'received_manila_warehouse',
        ]);
        $this->box->bypassStatusValidation = false;

        $response = $this->actingAs($this->admin)->put(route('admin.boxes.update', $this->box), [
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => 'in_transit_sea',
            'admin_correction_reason' => 'Accidentally marked as unloaded in Manila warehouse instead of sailing',
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->box->refresh();
        $this->assertEquals(BoxStatus::InTransit, $this->box->status);
        $this->assertEquals('in_transit_sea', $this->box->tracking_step_key);

        $this->assertDatabaseHas('box_updates', [
            'box_id' => $this->box->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => 'in_transit_sea',
            'is_admin_override' => true,
        ]);
    }
}
