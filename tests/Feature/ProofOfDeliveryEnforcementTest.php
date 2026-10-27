<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\Runsheet;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProofOfDeliveryEnforcementTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

    public function test_courier_cannot_mark_delivered_without_delivery_proof(): void
    {
        [$courier, $box] = $this->assignedCourierBox();

        $response = $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'tracking_step_key' => 'delivered',
                'courier_notes' => 'Delivered to recipient.',
                'signature' => 'data:image/png;base64,'.base64_encode('signature'),
            ]);

        $response->assertSessionHasErrors('delivery_proof');
        $this->assertSame(BoxStatus::Arrived, $box->fresh()->status);
    }

    public function test_courier_can_mark_delivered_without_signature(): void
    {
        Storage::fake('public');
        [$courier, $box] = $this->assignedCourierBox();

        $response = $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'tracking_step_key' => 'delivered',
                'courier_notes' => 'Delivered to recipient.',
                'delivery_proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
            ]);

        $response->assertSessionHas('success');
        $box->refresh();

        $this->assertSame(BoxStatus::Delivered, $box->status);
        $this->assertNotNull($box->delivery_proof_path);
        $this->assertNull($box->signature_path);
        $this->assertTrue(Storage::disk('public')->exists($box->delivery_proof_path));
    }

    public function test_courier_can_mark_delivered_with_proof_and_signature(): void
    {
        Storage::fake('public');
        [$courier, $box] = $this->assignedCourierBox();

        $response = $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'tracking_step_key' => 'delivered',
                'courier_notes' => 'Delivered to recipient.',
                'delivery_proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
                'signature' => 'data:image/png;base64,'.base64_encode('signature'),
            ]);

        $response->assertSessionHas('success');
        $box->refresh();

        $this->assertSame(BoxStatus::Delivered, $box->status);
        $this->assertNotNull($box->delivery_proof_path);
        $this->assertNotNull($box->signature_path);
        $this->assertTrue(Storage::disk('public')->exists($box->delivery_proof_path));
        $this->assertTrue(Storage::disk('public')->exists($box->signature_path));
    }

    public function test_courier_records_recipient_id_and_relationship_in_delivery_audit_notes(): void
    {
        Storage::fake('public');
        [$courier, $box] = $this->assignedCourierBox();

        $response = $this->actingAs($courier)
            ->put(route('courier.box.update', $box), [
                'tracking_step_key' => 'delivered',
                'recipient_name' => 'Maria Santos',
                'recipient_relationship' => 'Spouse',
                'recipient_id_type' => 'National ID (PhilSys)',
                'recipient_id_number' => '4321',
                'courier_notes' => 'Received at doorstep.',
                'delivery_proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
            ]);

        $response->assertSessionHas('success');
        $box->refresh();

        $this->assertSame(BoxStatus::Delivered, $box->status);
        $this->assertStringContainsString('Delivered to Maria Santos (Spouse) [ID: National ID (PhilSys) - 4321]', $box->courier_notes);

        $latestUpdate = BoxUpdate::where('box_id', $box->id)->latest('id')->first();
        $this->assertNotNull($latestUpdate);
        $this->assertStringContainsString('Delivered to Maria Santos (Spouse) [ID: National ID (PhilSys) - 4321]', $latestUpdate->description);
    }

    public function test_admin_can_deliver_without_override_reason_when_proof_uploaded(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => Role::Admin]);
        [$courier, $box] = $this->adminEditableBoxWithCourier();

        $response = $this->actingAs($admin)
            ->post(route('admin.boxes.update-status', $box), [
                'status' => BoxStatus::Delivered->value,
                'courier_notes' => 'Delivered with proof.',
                'delivery_proof' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
            ]);

        $response->assertSessionHas('success');
        $this->assertSame(BoxStatus::Delivered, $box->fresh()->status);
    }

    public function test_admin_override_reason_is_recorded_when_delivering_without_evidence(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $box = $this->adminEditableBox();

        $response = $this->actingAs($admin)
            ->put(route('admin.boxes.update', $box), [
                'booking_id' => $box->booking_id,
                'status' => BoxStatus::Delivered->value,
                'courier_notes' => 'Manual delivery update.',
                'admin_delivery_override_reason' => 'Recipient confirmed delivery by phone; proof will be attached later.',
            ]);

        $response->assertSessionHas('success');
        $this->assertSame(BoxStatus::Delivered, $box->fresh()->status);
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box->id,
            'status' => BoxStatus::Delivered->value,
            'updated_by' => $admin->id,
        ]);
        $this->assertStringContainsString(
            'Admin proof override: Recipient confirmed delivery by phone',
            BoxUpdate::where('box_id', $box->id)->latest()->firstOrFail()->description,
        );
    }

    public function test_admin_can_update_to_out_for_delivery_without_proof(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        [$courier, $box] = $this->adminEditableBoxWithCourier();

        $response = $this->actingAs($admin)
            ->post(route('admin.boxes.update-status', $box), [
                'status' => BoxStatus::OutForDelivery->value,
                'courier_notes' => 'Out for delivery.',
            ]);

        $response->assertSessionHas('success');
        $this->assertSame(BoxStatus::OutForDelivery, $box->fresh()->status);
    }

    public function test_admin_cannot_deliver_without_proof_and_no_existing_proof(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        [$courier, $box] = $this->adminEditableBoxWithCourier();

        $response = $this->actingAs($admin)
            ->post(route('admin.boxes.update-status', $box), [
                'status' => BoxStatus::Delivered->value,
                'courier_notes' => 'Manual delivery update.',
            ]);

        $response->assertSessionHasErrors('delivery_proof');
        $this->assertSame(BoxStatus::Arrived, $box->fresh()->status);
    }

    private function assignedCourierBox(): array
    {
        $courier = User::factory()->create(['role' => Role::Courier]);
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Shipped,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $courier->id,
            'status' => RunsheetStatus::InProgress,
            'type' => RunsheetType::Delivery,
        ]);
        $runsheet->bookings()->attach($booking->id);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Arrived,
        ]);
        $runsheet->boxes()->attach($box->id);

        return [$courier, $box];
    }

    /**
     * Create a box eligible for admin status update via the modal (POST route).
     * Requires an active courier on a delivery runsheet to pass isEligibleForAdminStatusUpdate().
     */
    private function adminEditableBoxWithCourier(): array
    {
        $courier = User::factory()->create(['role' => Role::Courier]);
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Shipped,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $courier->id,
            'status' => RunsheetStatus::InProgress,
            'type' => RunsheetType::Delivery,
        ]);
        $runsheet->bookings()->attach($booking->id);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Arrived,
        ]);
        $runsheet->boxes()->attach($box->id);

        return [$courier, $box];
    }

    /**
     * Create a box eligible for admin edit page (PUT route).
     * No courier required — the edit page uses UpdateBoxRequest validation, not isEligibleForAdminStatusUpdate().
     */
    private function adminEditableBox(): Box
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Shipped,
            'payment_status' => PaymentStatus::Paid,
        ]);

        return Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
        ]);
    }
}
