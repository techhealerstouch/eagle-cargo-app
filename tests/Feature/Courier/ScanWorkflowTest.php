<?php

namespace Tests\Feature\Courier;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ScanWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_assigned_courier_can_scan_and_redirect_to_box_detail(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier->value]);
        $box = $this->createBoxAssignedTo($courier, RunsheetStatus::Assigned, RunsheetType::Delivery);

        $this->actingAs($courier)
            ->post(route('courier.scan'), [
                'tracking_number' => $box->tracking_number,
            ])
            ->assertRedirect(route('courier.box.show', ['box' => $box->tracking_number]));

        $runsheet = $box->runsheets()->firstOrFail();
        $this->assertEquals(RunsheetStatus::InProgress, $runsheet->fresh()->status);
    }

    public function test_assigned_courier_can_scan_by_serial_number(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier->value]);
        $box = $this->createBoxAssignedTo($courier, RunsheetStatus::Assigned, RunsheetType::Delivery);
        $box->update(['serial_number' => '987654']);
        $box->refresh();

        $this->actingAs($courier)
            ->post(route('courier.scan'), [
                'tracking_number' => $box->serial_number,
            ])
            ->assertRedirect(route('courier.box.show', ['box' => $box->tracking_number]));
    }

    public function test_scan_returns_error_when_tracking_number_not_found(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier->value]);

        $this->actingAs($courier)
            ->from(route('courier.scan.page'))
            ->post(route('courier.scan'), [
                'tracking_number' => 'TRK-2099-999-999',
            ])
            ->assertRedirect(route('courier.scan.page'))
            ->assertSessionHasErrors(['tracking_number']);
    }

    public function test_unassigned_courier_cannot_scan_another_courier_box(): void
    {
        /** @var User $assignedCourier */
        $assignedCourier = User::factory()->create(['role' => Role::Courier->value]);
        /** @var User $otherCourier */
        $otherCourier = User::factory()->create(['role' => Role::Courier->value]);

        $box = $this->createBoxAssignedTo($assignedCourier, RunsheetStatus::Assigned, RunsheetType::Delivery);

        $this->actingAs($otherCourier)
            ->post(route('courier.scan'), [
                'tracking_number' => $box->tracking_number,
            ])
            ->assertForbidden();
    }

    public function test_assigned_courier_can_scan_completed_runsheet_box_for_view_only_access(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier->value]);
        $box = $this->createBoxAssignedTo($courier, RunsheetStatus::Completed, RunsheetType::Delivery);

        $this->actingAs($courier)
            ->post(route('courier.scan'), [
                'tracking_number' => $box->tracking_number,
            ])
            ->assertRedirect(route('courier.box.show', ['box' => $box->tracking_number]));

        $runsheet = $box->runsheets()->firstOrFail();
        $this->assertEquals(RunsheetStatus::InProgress, $runsheet->fresh()->status);
    }

    private function createBoxAssignedTo(User $assignee, RunsheetStatus $runsheetStatus, RunsheetType $runsheetType): Box
    {
        $sender = Sender::factory()->create();
        $area = Area::create([
            'name' => 'Scan Test Area '.Str::uuid(),
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
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => BoxStatus::Pending->value,
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
