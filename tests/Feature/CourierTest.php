<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\Runsheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CourierTest extends TestCase
{
    use RefreshDatabase;

    protected User $courier;

    protected function setUp(): void
    {
        parent::setUp();
        \Illuminate\Support\Facades\Notification::fake();
        $this->courier = User::factory()->create(['role' => Role::Courier]);
    }

    public function test_courier_can_access_dashboard()
    {
        $response = $this->actingAs($this->courier)
            ->get(route('courier.dashboard'));

        $response->assertStatus(200);
    }

    public function test_courier_dashboard_includes_box_based_delivery_runsheet_payload(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Arrived,
        ]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $this->courier->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Delivery,
        ]);
        $runsheet->boxes()->attach($box->id);

        $this->actingAs($this->courier)
            ->get(route('courier.dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('courier/Dashboard')
                ->where('stats.totalBoxes', 1)
                ->where('stats.activeRunsheets', 1)
                ->has('runsheets', 1)
                ->where('runsheets.0.boxes.0.id', $box->id)
            );
    }

    public function test_shared_dashboard_redirects_courier_to_courier_dashboard()
    {
        $response = $this->actingAs($this->courier)
            ->get(route('dashboard'));

        $response->assertRedirect(route('courier.dashboard'));
    }

    public function test_shared_dashboard_redirects_recipient_to_recipient_dashboard()
    {
        /** @var User $recipient */
        $recipient = User::factory()->create(['role' => Role::Recipient]);

        $response = $this->actingAs($recipient)
            ->get(route('dashboard'));

        $response->assertRedirect(route('recipient.dashboard'));
    }

    public function test_courier_can_start_and_complete_runsheet()
    {
        $booking = Booking::factory()->create();
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Delivered,
        ]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $this->courier->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Delivery,
        ]);
        $runsheet->boxes()->attach($box->id);

        // Start Runsheet
        $response = $this->actingAs($this->courier)
            ->post(route('courier.runsheet.start', $runsheet));

        $response->assertRedirect();
        $this->assertEquals(RunsheetStatus::InProgress, $runsheet->fresh()->status);

        // Complete Runsheet
        $response = $this->actingAs($this->courier)
            ->post(route('courier.runsheet.complete', $runsheet));

        $response->assertRedirect();
        $this->assertEquals(RunsheetStatus::Completed, $runsheet->fresh()->status);
    }

    public function test_courier_cannot_start_runsheet_from_draft()
    {
        $booking = Booking::factory()->create();
        $box = Box::factory()->create(['booking_id' => $booking->id]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $this->courier->id,
            'status' => RunsheetStatus::Draft,
            'type' => RunsheetType::Delivery,
        ]);
        $runsheet->boxes()->attach($box->id);

        $response = $this->actingAs($this->courier)
            ->post(route('courier.runsheet.start', $runsheet));

        $response->assertRedirect();
        $response->assertSessionHas('error');
        $this->assertEquals(RunsheetStatus::Draft, $runsheet->fresh()->status);
    }

    public function test_courier_cannot_complete_runsheet_without_starting()
    {
        $booking = Booking::factory()->create();
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Delivered,
        ]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $this->courier->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Delivery,
        ]);
        $runsheet->boxes()->attach($box->id);

        $response = $this->actingAs($this->courier)
            ->post(route('courier.runsheet.complete', $runsheet));

        $response->assertRedirect();
        $response->assertSessionHas('error');
        $this->assertEquals(RunsheetStatus::Assigned, $runsheet->fresh()->status);
    }

    public function test_courier_can_update_box_status()
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
        ]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $this->courier->id,
            'status' => RunsheetStatus::InProgress,
            'type' => RunsheetType::Delivery,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Arrived,
        ]);
        $runsheet->boxes()->attach($box->id);

        $response = $this->actingAs($this->courier)
            ->put(route('courier.box.update', $box), [
                'tracking_step_key' => 'out_for_delivery',
                'courier_notes' => 'Out for final delivery.',
            ]);

        $response->assertRedirect();
        $this->assertEquals(BoxStatus::OutForDelivery, $box->fresh()->status);
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box->id,
            'tracking_phase' => 'out_for_delivery',
            'updated_by' => $this->courier->id,
        ]);
    }

    public function test_courier_can_upload_delivery_proof_when_updating_box_status(): void
    {
        Storage::fake('public');

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
        ]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $this->courier->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Delivery,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Arrived,
        ]);
        $runsheet->boxes()->attach($box->id);

        $proofFile = UploadedFile::fake()->image('proof.jpg');

        $response = $this->actingAs($this->courier)
            ->put(route('courier.box.update', $box), [
                'tracking_step_key' => 'delivered',
                'courier_notes' => 'Delivered to recipient with photo proof.',
                'delivery_proof' => $proofFile,
                'signature' => 'data:image/png;base64,'.base64_encode('signature'),
            ]);

        $response->assertRedirect();

        $box->refresh();

        $this->assertEquals(BoxStatus::Delivered, $box->status);
        $this->assertNotNull($box->delivery_proof_path);
        $this->assertNotNull($box->signature_path);
        $this->assertTrue(Storage::disk('public')->exists($box->delivery_proof_path));
        $this->assertTrue(Storage::disk('public')->exists($box->signature_path));
        $this->assertSame(1, BoxUpdate::where('box_id', $box->id)->count());
    }

    public function test_courier_cannot_access_other_courier_runsheet()
    {
        $otherCourier = User::factory()->create(['role' => Role::Courier]);
        $runsheet = Runsheet::factory()->create([
            'courier_id' => $otherCourier->id,
            'status' => RunsheetStatus::Assigned,
        ]);

        $response = $this->actingAs($this->courier)
            ->get(route('courier.runsheet', $runsheet));

        $response->assertStatus(403);
    }
}
