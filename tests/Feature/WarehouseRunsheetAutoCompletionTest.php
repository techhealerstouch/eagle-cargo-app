<?php

namespace Tests\Feature;

use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Runsheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WarehouseRunsheetAutoCompletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_receiving_all_boxes_completes_pickup_runsheet()
    {
        $warehouseUser = User::factory()->create(['role' => Role::Warehouse->value]);
        $picker = User::factory()->create(['role' => Role::Picker->value]);

        $booking = Booking::factory()->create([
            'payment_status' => \App\Enums\PaymentStatus::Paid,
        ]);
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Collected,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'type' => RunsheetType::Pickup->value,
            'status' => RunsheetStatus::InProgress->value,
        ]);
        $runsheet->bookings()->attach($booking->id);

        $this->actingAs($warehouseUser)
            ->post(route('warehouse.receive'), [
                'tracking_number' => $box->tracking_number,
                'tracking_step_key' => 'received_by_branch',
            ]);

        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $box->fresh()->status);
        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }
}
