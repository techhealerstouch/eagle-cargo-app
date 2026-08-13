<?php

namespace Tests\Feature\Courier;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Area;
use App\Models\AreaMilestone;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class BoxAccessControlTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        \Illuminate\Support\Facades\Notification::fake();
    }

    public function test_assigned_courier_can_view_box_details(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier->value]);
        $box = $this->createBoxAssignedTo($courier, RunsheetStatus::Assigned, RunsheetType::Delivery);

        $this->actingAs($courier)
            ->get(route('courier.box.show', ['box' => $box->tracking_number]))
            ->assertOk();
    }

    public function test_unassigned_courier_cannot_view_box_details(): void
    {
        /** @var User $assignedCourier */
        $assignedCourier = User::factory()->create(['role' => Role::Courier->value]);
        /** @var User $otherCourier */
        $otherCourier = User::factory()->create(['role' => Role::Courier->value]);
        $box = $this->createBoxAssignedTo($assignedCourier, RunsheetStatus::Assigned, RunsheetType::Delivery);

        $this->actingAs($otherCourier)
            ->get(route('courier.box.show', ['box' => $box->tracking_number]))
            ->assertForbidden();
    }

    public function test_assigned_courier_can_view_box_details_on_completed_runsheet(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier->value]);
        $box = $this->createBoxAssignedTo($courier, RunsheetStatus::Completed, RunsheetType::Delivery);

        $this->actingAs($courier)
            ->get(route('courier.box.show', ['box' => $box->tracking_number]))
            ->assertOk();
    }

    public function test_assigned_picker_can_update_box_status_on_active_runsheet(): void
    {
        Storage::fake('public');
        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createBoxAssignedTo($picker, RunsheetStatus::Assigned, RunsheetType::Pickup);

        $this->actingAs($picker)
            ->put(route('picker.box.update', $box), [
                'status' => BoxStatus::Collected->value,
                'courier_notes' => 'Picked up successfully.',
                'pickup_proof' => UploadedFile::fake()->image('pickup.jpg'),
                'serial_number' => 'TEST-SERIAL-12345',
            ])
            ->assertSessionHas('success');

        $this->assertDatabaseHas('boxes', [
            'id' => $box->id,
            'status' => BoxStatus::Collected->value,
        ]);
    }

    public function test_unassigned_picker_cannot_update_box_status(): void
    {
        /** @var User $assignedPicker */
        $assignedPicker = User::factory()->create(['role' => Role::Picker->value]);
        /** @var User $otherPicker */
        $otherPicker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createBoxAssignedTo($assignedPicker, RunsheetStatus::Assigned, RunsheetType::Pickup);

        $this->actingAs($otherPicker)
            ->put(route('picker.box.update', $box), [
                'status' => BoxStatus::Collected->value,
            ])
            ->assertForbidden();
    }

    public function test_assigned_user_cannot_update_box_status_when_runsheet_is_completed(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier->value]);
        $box = $this->createBoxAssignedTo($courier, RunsheetStatus::Completed, RunsheetType::Delivery);

        $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'status' => BoxStatus::Delivered->value,
            ])
            ->assertForbidden();
    }

    public function test_milestone_must_belong_to_box_recipient_area(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier->value]);
        $box = $this->createBoxAssignedTo($courier, RunsheetStatus::Assigned, RunsheetType::Delivery);

        $otherArea = Area::create([
            'name' => 'Other Area '.Str::uuid(),
            'is_active' => true,
        ]);
        $milestone = AreaMilestone::create([
            'area_id' => $otherArea->id,
            'name' => 'Wrong Area Milestone',
            'location' => 'Other Province',
            'sequence_order' => 1,
            'is_final_delivery' => false,
        ]);

        $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'area_milestone_id' => $milestone->id,
                'courier_notes' => 'Attempting wrong milestone.',
            ])
            ->assertSessionHas('error', 'Selected milestone does not belong to this recipient area.');

        $this->assertDatabaseMissing('box_updates', [
            'box_id' => $box->id,
            'area_milestone_id' => $milestone->id,
        ]);
    }

    public function test_milestone_update_accepts_legacy_placeholder_status_payload_when_transition_is_valid(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier->value]);
        $box = $this->createBoxAssignedTo($courier, RunsheetStatus::Assigned, RunsheetType::Delivery);
        $box->load('recipient');
        $box->update(['status' => BoxStatus::Collected->value]);
        $box->update(['status' => BoxStatus::ReceivedByWarehouse->value]);

        $milestone = AreaMilestone::create([
            'area_id' => $box->recipient->area_id,
            'name' => 'Regional Transfer',
            'location' => 'Regional Hub',
            'sequence_order' => 2,
            'is_final_delivery' => false,
        ]);

        $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'status' => 'milestone',
                'area_milestone_id' => $milestone->id,
                'courier_notes' => 'Legacy scanner payload.',
            ])
            ->assertSessionHas('success');

        $this->assertDatabaseHas('boxes', [
            'id' => $box->id,
            'status' => BoxStatus::InTransit->value,
        ]);

        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box->id,
            'area_milestone_id' => $milestone->id,
            'status' => BoxStatus::InTransit->value,
            'updated_by' => $courier->id,
        ]);
    }

    public function test_milestone_update_rejects_shortcut_when_prior_stages_are_not_completed(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier->value]);
        $box = $this->createBoxAssignedTo($courier, RunsheetStatus::Assigned, RunsheetType::Delivery);
        $box->load('recipient');

        $milestone = AreaMilestone::create([
            'area_id' => $box->recipient->area_id,
            'name' => 'Regional Transfer',
            'location' => 'Regional Hub',
            'sequence_order' => 2,
            'is_final_delivery' => false,
        ]);

        $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'status' => 'milestone',
                'area_milestone_id' => $milestone->id,
                'courier_notes' => 'Attempting to shortcut stages.',
            ])
            ->assertSessionHas('error', fn (?string $message) => $message && str_contains($message, 'Unauthorized transition'));

        $this->assertDatabaseHas('boxes', [
            'id' => $box->id,
            'status' => BoxStatus::Pending->value,
        ]);

        $this->assertDatabaseMissing('box_updates', [
            'box_id' => $box->id,
            'area_milestone_id' => $milestone->id,
            'status' => BoxStatus::InTransit->value,
        ]);
    }

    private function createBoxAssignedTo(User $assignee, RunsheetStatus $runsheetStatus, RunsheetType $runsheetType): Box
    {
        $sender = Sender::factory()->create();
        $area = Area::create([
            'name' => 'Assigned Area '.Str::uuid(),
            'is_active' => true,
        ]);

        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'declaration_form_status' => 'submitted_online',
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => BoxStatus::Pending->value,
            'weight' => 15.5,
        ]);

        $runsheetAttributes = [
            'status' => $runsheetStatus->value,
            'type' => $runsheetType->value,
        ];

        if ($runsheetType === RunsheetType::Pickup) {
            $runsheetAttributes['picker_id'] = $assignee->id;
            $runsheetAttributes['courier_id'] = null;
        } else {
            $runsheetAttributes['courier_id'] = $assignee->id;
        }

        $runsheet = Runsheet::factory()->create($runsheetAttributes);

        if ($runsheetType === RunsheetType::Pickup) {
            $runsheet->bookings()->attach($booking->id);
        } else {
            $runsheet->boxes()->attach($box->id);
        }

        return $box;
    }
}
