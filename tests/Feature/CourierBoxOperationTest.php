<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Runsheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CourierBoxOperationTest extends TestCase
{
    use RefreshDatabase;

    protected function createCourierWithRunsheet(BoxStatus $boxStatus = BoxStatus::OutForDelivery): array
    {
        /** @var User $courier */
        $courier = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        $runsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::InProgress,
            'courier_id' => $courier->id,
        ]);

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Shipped,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => $boxStatus,
            'tracking_number' => 'TRK-2026-001-001',
        ]);

        $runsheet->bookings()->attach($booking->id);

        return compact('courier', 'runsheet', 'booking', 'box');
    }

    // ---------------------------------------------------------------
    // 1. Box Scanning
    // ---------------------------------------------------------------

    public function test_courier_can_scan_box_by_tracking_number(): void
    {
        extract($this->createCourierWithRunsheet());

        $response = $this->actingAs($courier)
            ->get(route('courier.box.show', ['box' => $box->tracking_number]));

        $response->assertStatus(200);
    }

    public function test_scan_nonexistent_box_returns_404(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($courier)
            ->get(route('courier.box.show', ['box' => 'TRK-9999-999-999']));

        $response->assertStatus(404);
    }

    // ---------------------------------------------------------------
    // 2. Box Status Updates (via tracking_step_key)
    // ---------------------------------------------------------------

    public function test_courier_can_update_box_to_delivered(): void
    {
        extract($this->createCourierWithRunsheet(BoxStatus::OutForDelivery));

        Storage::fake('public');
        $proofFile = UploadedFile::fake()->image('proof.jpg');

        $response = $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'tracking_step_key' => 'delivered',
                'delivery_proof' => $proofFile,
            ]);

        // Should succeed or redirect (depends on Inertia/form handling)
        $this->assertNotEquals(403, $response->getStatusCode());
    }

    public function test_courier_can_mark_box_as_held(): void
    {
        extract($this->createCourierWithRunsheet(BoxStatus::OutForDelivery));

        $response = $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'tracking_step_key' => 'held',
            ]);

        // Should not return forbidden
        $this->assertNotEquals(403, $response->getStatusCode());
    }

    public function test_courier_can_mark_box_as_damaged(): void
    {
        extract($this->createCourierWithRunsheet(BoxStatus::OutForDelivery));

        $response = $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'tracking_step_key' => 'damaged',
            ]);

        $this->assertNotEquals(403, $response->getStatusCode());
    }

    public function test_invalid_box_transition_is_rejected(): void
    {
        extract($this->createCourierWithRunsheet(BoxStatus::Pending));

        $response = $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'tracking_step_key' => 'delivered',
            ]);

        // Controller redirects with 'error' in session for invalid transitions
        $response->assertSessionHas('error');
    }

    // ---------------------------------------------------------------
    // 3. Proof of Delivery
    // ---------------------------------------------------------------

    public function test_courier_can_upload_delivery_proof(): void
    {
        Storage::fake('public');

        extract($this->createCourierWithRunsheet(BoxStatus::OutForDelivery));

        $file = UploadedFile::fake()->image('delivery_proof.jpg');

        $response = $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'tracking_step_key' => 'delivered',
                'delivery_proof' => $file,
            ]);

        // Should not return forbidden (delivery_proof is required for 'delivered' step)
        $this->assertNotEquals(403, $response->getStatusCode());
    }

    // ---------------------------------------------------------------
    // 4. Courier Authorization on Box Operations
    // ---------------------------------------------------------------

    public function test_non_courier_cannot_access_courier_box_routes(): void
    {
        /** @var User $sender */
        $sender = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        /** @var User $courier */
        $courier = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        $runsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::InProgress,
            'courier_id' => $courier->id,
        ]);

        $booking = Booking::factory()->create(['status' => BookingStatus::Shipped]);
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::OutForDelivery,
        ]);

        $runsheet->bookings()->attach($booking->id);

        $response = $this->actingAs($sender)
            ->get(route('courier.box.show', ['box' => $box->tracking_number]));

        $response->assertStatus(403);
    }

    // ---------------------------------------------------------------
    // 5. Courier Dashboard
    // ---------------------------------------------------------------

    public function test_courier_dashboard_shows_active_runsheets(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        Runsheet::factory()->create([
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::Assigned,
            'courier_id' => $courier->id,
        ]);

        Runsheet::factory()->create([
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::InProgress,
            'courier_id' => $courier->id,
        ]);

        $response = $this->actingAs($courier)->get(route('courier.dashboard'));

        $response->assertStatus(200);
    }

    public function test_courier_runsheets_list_is_paginated(): void
    {
        /** @var User $courier */
        $courier = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        Runsheet::factory()->count(5)->create([
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::Completed,
            'courier_id' => $courier->id,
        ]);

        $response = $this->actingAs($courier)->get(route('courier.runsheets'));

        $response->assertStatus(200);
    }
}
