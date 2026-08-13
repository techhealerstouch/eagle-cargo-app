<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Runsheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RunsheetEmptyBookingValidationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected User $courier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => Role::Admin->value]);
        $this->courier = User::factory()->create(['role' => Role::Courier->value]);
    }

    public function test_it_allows_creating_draft_delivery_runsheet_without_bookings(): void
    {
        $response = $this->actingAs($this->admin)
            ->post(route('admin.runsheets.store'), [
                'courier_id' => $this->courier->id,
                'scheduled_date' => now()->addDay()->toDateString(),
                'area_description' => 'Draft Area',
                'status' => RunsheetStatus::Draft->value,
                'type' => RunsheetType::Delivery->value,
                'booking_ids' => [],
            ]);

        $response->assertRedirect(route('admin.runsheets.deliveries'));

        $this->assertDatabaseHas('runsheets', [
            'courier_id' => $this->courier->id,
            'status' => RunsheetStatus::Draft->value,
            'type' => RunsheetType::Delivery->value,
            'area_description' => 'Draft Area',
        ]);
    }

    public function test_it_rejects_creating_assigned_delivery_runsheet_without_bookings(): void
    {
        $response = $this->actingAs($this->admin)
            ->post(route('admin.runsheets.store'), [
                'courier_id' => $this->courier->id,
                'scheduled_date' => now()->addDay()->toDateString(),
                'area_description' => 'Assigned Area',
                'status' => RunsheetStatus::Assigned->value,
                'type' => RunsheetType::Delivery->value,
                'box_ids' => [],
            ]);

        $response->assertSessionHasErrors('box_ids');

        $this->assertDatabaseMissing('runsheets', [
            'courier_id' => $this->courier->id,
            'status' => RunsheetStatus::Assigned->value,
            'type' => RunsheetType::Delivery->value,
            'area_description' => 'Assigned Area',
        ]);
    }

    public function test_it_rejects_creating_in_progress_delivery_runsheet_without_bookings(): void
    {
        $response = $this->actingAs($this->admin)
            ->post(route('admin.runsheets.store'), [
                'courier_id' => $this->courier->id,
                'scheduled_date' => now()->addDay()->toDateString(),
                'area_description' => 'In Progress Area',
                'status' => RunsheetStatus::InProgress->value,
                'type' => RunsheetType::Delivery->value,
                'box_ids' => [],
            ]);

        $response->assertSessionHasErrors('box_ids');

        $this->assertDatabaseMissing('runsheets', [
            'courier_id' => $this->courier->id,
            'status' => RunsheetStatus::InProgress->value,
            'type' => RunsheetType::Delivery->value,
            'area_description' => 'In Progress Area',
        ]);
    }

    public function test_it_rejects_emptying_an_assigned_runsheet_via_update(): void
    {
        $booking = Booking::factory()->create();
        $box = \App\Models\Box::factory()->create(['booking_id' => $booking->id]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $this->courier->id,
            'status' => RunsheetStatus::Assigned->value,
            'type' => RunsheetType::Delivery->value,
        ]);
        $runsheet->boxes()->attach($box->id);

        $response = $this->actingAs($this->admin)
            ->put(route('admin.runsheets.update', $runsheet), [
                'courier_id' => $this->courier->id,
                'scheduled_date' => $runsheet->scheduled_date->toDateString(),
                'area_description' => $runsheet->area_description,
                'status' => RunsheetStatus::Assigned->value,
                'type' => RunsheetType::Delivery->value,
                'box_ids' => [],
            ]);

        $response->assertSessionHasErrors('box_ids');

        $this->assertDatabaseHas('box_runsheet', [
            'box_id' => $box->id,
            'runsheet_id' => $runsheet->id,
        ]);
    }
}
