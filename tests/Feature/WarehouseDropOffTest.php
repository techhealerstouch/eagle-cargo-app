<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Enums\TrackingPhase;
use App\Events\SystemHealthUpdated;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\Runsheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WarehouseDropOffTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake([SystemHealthUpdated::class]);
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

    public function test_picker_can_initialize_warehouse_drop_off(): void
    {
        Storage::fake('public');

        $picker = User::factory()->create(['role' => Role::Picker]);

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Collected,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $box1 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Collected,
        ]);

        $box2 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Collected,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::InProgress,
        ]);
        $runsheet->bookings()->attach($booking->id, ['sequence' => 1]);

        $photo = UploadedFile::fake()->create('depot_bay.jpg', 100, 'image/jpeg');

        $response = $this->actingAs($picker)
            ->post(route('picker.runsheet.initialize-warehouse-drop', $runsheet), [
                'warehouse_drop_bay' => 'Bay 4',
                'warehouse_drop_notes' => 'Parked at loading dock 4 near conveyor.',
                'warehouse_drop_photo' => $photo,
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $runsheet->refresh();
        $this->assertNotNull($runsheet->warehouse_drop_initiated_at);
        $this->assertEquals('Bay 4', $runsheet->warehouse_drop_bay);
        $this->assertEquals('Parked at loading dock 4 near conveyor.', $runsheet->warehouse_drop_notes);
        $this->assertNotNull($runsheet->warehouse_drop_photo_path);
        Storage::disk('public')->assertExists($runsheet->warehouse_drop_photo_path);

        // Runsheet must stay InProgress until warehouse verifies
        $this->assertEquals(RunsheetStatus::InProgress, $runsheet->status);

        // Assert audit log on boxes: TrackingPhase::ARRIVED_AT_WAREHOUSE
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box1->id,
            'tracking_step_key' => TrackingPhase::ARRIVED_AT_WAREHOUSE->value,
        ]);
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box2->id,
            'tracking_step_key' => TrackingPhase::ARRIVED_AT_WAREHOUSE->value,
        ]);
    }

    public function test_warehouse_dashboard_lists_pending_driver_drops(): void
    {
        $warehouseUser = User::factory()->create(['role' => Role::Warehouse]);
        $picker = User::factory()->create(['role' => Role::Picker, 'name' => 'Driver Juan']);

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Collected,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Collected,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::InProgress,
            'warehouse_drop_initiated_at' => now(),
            'warehouse_drop_bay' => 'Bay 2',
            'warehouse_drop_notes' => 'Dropped off at Bay 2',
        ]);
        $runsheet->bookings()->attach($booking->id, ['sequence' => 1]);

        $response = $this->actingAs($warehouseUser)
            ->get(route('warehouse.dashboard'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('warehouse/Dashboard')
            ->has('pendingDriverDrops', 1)
            ->where('pendingDriverDrops.0.id', $runsheet->id)
            ->where('pendingDriverDrops.0.picker_name', 'Driver Juan')
            ->where('pendingDriverDrops.0.warehouse_drop_bay', 'Bay 2')
            ->where('pendingDriverDrops.0.pending_boxes', 1)
        );
    }

    public function test_warehouse_can_verify_and_accept_driver_drop_off(): void
    {
        $warehouseUser = User::factory()->create(['role' => Role::Warehouse]);
        $picker = User::factory()->create(['role' => Role::Picker]);

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Collected,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $box1 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Collected,
        ]);
        $box2 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Collected,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::InProgress,
            'warehouse_drop_initiated_at' => now(),
            'warehouse_drop_bay' => 'Bay 3',
        ]);
        $runsheet->bookings()->attach($booking->id, ['sequence' => 1]);

        $response = $this->actingAs($warehouseUser)
            ->post(route('warehouse.runsheet.verify-drop', $runsheet), [
                'warehouse_location' => 'Bay 3 - Bin A',
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        // Boxes must be ReceivedByWarehouse
        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $box1->fresh()->status);
        $this->assertEquals('Bay 3 - Bin A', $box1->fresh()->warehouse_location);
        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $box2->fresh()->status);
        $this->assertEquals('Bay 3 - Bin A', $box2->fresh()->warehouse_location);

        // Runsheet must be auto-completed
        $runsheet->refresh();
        $this->assertNotNull($runsheet->warehouse_verified_at);
        $this->assertEquals($warehouseUser->id, $runsheet->warehouse_verified_by);
        $this->assertEquals(RunsheetStatus::Completed, $runsheet->status);

        // Audit updates exist
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box1->id,
            'status' => BoxStatus::ReceivedByWarehouse->value,
            'tracking_step_key' => 'received_by_branch',
            'updated_by' => $warehouseUser->id,
        ]);
    }
}
