<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Runsheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PickerRoleTest extends TestCase
{
    use RefreshDatabase;

    protected User $picker;

    protected function setUp(): void
    {
        parent::setUp();
        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $this->picker = $picker;
    }

    public function test_picker_can_access_picker_dashboard()
    {
        $response = $this->actingAs($this->picker)
            ->get(route('picker.dashboard'));

        $response->assertStatus(200);
    }

    public function test_shared_dashboard_redirects_picker_to_picker_dashboard()
    {
        $response = $this->actingAs($this->picker)
            ->get(route('dashboard'));

        $response->assertRedirect(route('picker.dashboard'));
    }

    public function test_picker_can_start_and_complete_assigned_runsheet()
    {
        $booking = Booking::factory()->create();

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $this->picker->id,
            'courier_id' => null,
            'type' => RunsheetType::Pickup->value,
            'status' => RunsheetStatus::Assigned->value,
        ]);
        $runsheet->bookings()->attach($booking->id);

        // Start Runsheet
        $response = $this->actingAs($this->picker)
            ->post(route('picker.runsheet.start', $runsheet));

        $response->assertRedirect();
        $this->assertEquals(RunsheetStatus::InProgress, $runsheet->fresh()->status);

        // Complete Runsheet
        $response = $this->actingAs($this->picker)
            ->post(route('picker.runsheet.complete', $runsheet));

        $response->assertRedirect();
        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }

    public function test_admin_can_create_pickup_runsheet_with_picker()
    {
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin->value]);

        $response = $this->actingAs($admin)
            ->post(route('admin.runsheets.store'), [
                'picker_id' => $this->picker->id,
                'scheduled_date' => now()->addDay()->toDateString(),
                'area_description' => 'Test Pickup Area',
                'status' => RunsheetStatus::Draft->value,
                'type' => RunsheetType::Pickup->value,
                'booking_ids' => [],
            ]);

        $response->assertRedirect(route('admin.runsheets.pickups'));
        $this->assertDatabaseHas('runsheets', [
            'picker_id' => $this->picker->id,
            'type' => RunsheetType::Pickup->value,
        ]);
    }

    public function test_admin_can_create_delivery_runsheet_with_courier()
    {
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin->value]);
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier->value]);

        $response = $this->actingAs($admin)
            ->post(route('admin.runsheets.store'), [
                'courier_id' => $courier->id,
                'scheduled_date' => now()->addDay()->toDateString(),
                'area_description' => 'Test Delivery Area',
                'status' => RunsheetStatus::Draft->value,
                'type' => RunsheetType::Delivery->value,
                'booking_ids' => [],
            ]);

        $response->assertRedirect(route('admin.runsheets.deliveries'));
        $this->assertDatabaseHas('runsheets', [
            'courier_id' => $courier->id,
            'type' => RunsheetType::Delivery->value,
        ]);
    }
}
