<?php

namespace Tests\Feature\Admin;

use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Box;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class BoxUnloadedManilaTransitionTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);

        $this->admin = User::factory()->create(['role' => Role::Admin]);
        $this->booking = Booking::factory()->create();
    }

    public function test_admin_can_update_unloaded_manila_box_to_sorting(): void
    {
        $box = Box::factory()->create([
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::UnloadedManila,
            'tracking_step_key' => 'received_manila_warehouse',
        ]);

        $response = $this->actingAs($this->admin)->put(route('admin.boxes.update', $box), [
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => 'sorting',
            'courier_notes' => 'Box is being sorted at Manila regional hub.',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');
        $response->assertSessionHasNoErrors();

        $box->refresh();
        $this->assertEquals(BoxStatus::InTransit, $box->status);
        $this->assertEquals('sorting', $box->tracking_step_key);

        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => 'sorting',
            'updated_by' => $this->admin->id,
        ]);
    }

    public function test_admin_can_update_unloaded_manila_box_to_dispatched_to_local_hub(): void
    {
        $box = Box::factory()->create([
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::UnloadedManila,
            'tracking_step_key' => 'received_manila_warehouse',
        ]);

        $response = $this->actingAs($this->admin)->put(route('admin.boxes.update', $box), [
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => 'dispatched_to_local_hub',
            'courier_notes' => 'Dispatched to provincial delivery hub via linehaul.',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');
        $response->assertSessionHasNoErrors();

        $box->refresh();
        $this->assertEquals(BoxStatus::InTransit, $box->status);
        $this->assertEquals('dispatched_to_local_hub', $box->tracking_step_key);
    }

    public function test_admin_can_update_unloaded_manila_box_to_out_for_delivery(): void
    {
        $box = Box::factory()->create([
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::UnloadedManila,
            'tracking_step_key' => 'received_manila_warehouse',
        ]);

        $response = $this->actingAs($this->admin)->put(route('admin.boxes.update', $box), [
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::OutForDelivery->value,
            'tracking_step_key' => 'out_for_delivery',
            'courier_notes' => 'Out for doorstep delivery today.',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');
        $response->assertSessionHasNoErrors();

        $box->refresh();
        $this->assertEquals(BoxStatus::OutForDelivery, $box->status);
        $this->assertEquals('out_for_delivery', $box->tracking_step_key);
    }

    public function test_admin_can_update_unloaded_manila_box_to_delivered_with_override(): void
    {
        $box = Box::factory()->create([
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::UnloadedManila,
            'tracking_step_key' => 'received_manila_warehouse',
        ]);

        $response = $this->actingAs($this->admin)->put(route('admin.boxes.update', $box), [
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::Delivered->value,
            'tracking_step_key' => 'delivered',
            'admin_delivery_override_reason' => 'Customer confirmed delivery by phone; physical sign-off pending.',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');
        $response->assertSessionHasNoErrors();

        $box->refresh();
        $this->assertEquals(BoxStatus::Delivered, $box->status);
        $this->assertEquals('delivered', $box->tracking_step_key);
    }

    public function test_admin_can_bulk_update_unloaded_manila_boxes_to_in_transit(): void
    {
        $boxes = Box::factory()->count(3)->create([
            'booking_id' => $this->booking->id,
            'status' => BoxStatus::UnloadedManila,
            'tracking_step_key' => 'received_manila_warehouse',
        ]);

        $response = $this->actingAs($this->admin)->post(route('admin.boxes.bulk-update-status'), [
            'ids' => $boxes->pluck('id')->all(),
            'status' => BoxStatus::InTransit->value,
            'tracking_step_key' => 'sorting',
            'courier_notes' => 'Bulk sorted at Manila sorting center.',
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        foreach ($boxes as $box) {
            $box->refresh();
            $this->assertEquals(BoxStatus::InTransit, $box->status);
            $this->assertEquals('sorting', $box->tracking_step_key);
        }
    }
}
