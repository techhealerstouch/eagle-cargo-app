<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class EdgeCasesRobustnessTest extends TestCase
{
    use RefreshDatabase;

    // ---------------------------------------------------------------
    // 1. Concurrent Operations
    // ---------------------------------------------------------------

    public function test_concurrent_invoice_generation_produces_single_invoice(): void
    {
        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'price_charged' => 100.00,
        ]);

        // Simulate concurrent invoice generation
        DB::transaction(function () use ($booking) {
            $i1 = Invoice::generateForBooking($booking);
            $i2 = Invoice::generateForBooking($booking);
            $this->assertEquals($i1->id, $i2->id);
        });

        $this->assertSame(1, Invoice::where('booking_id', $booking->id)->count());
    }

    // ---------------------------------------------------------------
    // 2. File Upload Validation
    // ---------------------------------------------------------------

    public function test_proof_of_payment_upload_validates_file_type(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);
        $sender = $user->sender ?? Sender::factory()->create(['user_id' => $user->id]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => \App\Enums\PaymentStatus::Pending,
        ]);

        Storage::fake('public');

        // Try uploading an executable file
        $file = UploadedFile::fake()->create('malware.exe', 100, 'application/x-msdownload');

        $response = $this->actingAs($user)
            ->post(route('bookings.upload-proof', $booking), [
                'proof_of_payment' => $file,
            ]);

        // Validation should reject non-image/PDF files
        $response->dump();
        dump([
            'test_user_id' => $user->id,
            'test_sender_id' => $sender->id,
            'test_booking_id' => $booking->id,
            'test_booking_sender_id' => $booking->sender_id,
        ]);
        $response->assertSessionHasErrors();
    }

    public function test_declaration_upload_validates_max_size(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);
        $sender = $user->sender ?? Sender::factory()->create(['user_id' => $user->id]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
        ]);

        Storage::fake('public');

        // Create a file larger than 5MB
        $file = UploadedFile::fake()->create('declaration.pdf', 6000); // 6MB > 5MB limit

        $response = $this->actingAs($user)
            ->post(route('track.upload-declaration'), [
                'booking_id' => $booking->id,
                'declaration_form' => $file,
            ]);

        $response->assertSessionHasErrors('declaration_form');
    }

    // ---------------------------------------------------------------
    // 3. Booking Ownership
    // ---------------------------------------------------------------

    public function test_sender_cannot_edit_other_senders_booking(): void
    {
        /** @var User $userA */
        $userA = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);
        $senderA = $userA->sender ?? Sender::factory()->create(['user_id' => $userA->id]);

        /** @var User $userB */
        $userB = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);
        $userB->sender ?? Sender::factory()->create(['user_id' => $userB->id]);

        $booking = Booking::factory()->create([
            'sender_id' => $senderA->id,
            'status' => BookingStatus::Pending,
        ]);

        $response = $this->actingAs($userB)
            ->get(route('bookings.edit', $booking));

        // Controller redirects to sender.bookings with error, doesn't abort 403
        $response->assertRedirect(route('sender.bookings'));
    }

    // ---------------------------------------------------------------
    // 4. Soft Delete & Restoration
    // ---------------------------------------------------------------

    public function test_booking_soft_delete_preserves_record(): void
    {
        $booking = Booking::factory()->create(['status' => BookingStatus::Cancelled]);

        $booking->delete();

        $this->assertSoftDeleted($booking);
        $this->assertNotNull($booking->fresh()->deleted_at);
    }

    public function test_soft_deleted_booking_can_be_restored(): void
    {
        $booking = Booking::factory()->create(['status' => BookingStatus::Cancelled]);
        $booking->delete();

        $booking->restore();

        $this->assertNull($booking->fresh()->deleted_at);
    }

    public function test_booking_soft_delete_does_not_delete_boxes(): void
    {
        $booking = Booking::factory()->create();
        $box = Box::factory()->create(['booking_id' => $booking->id]);

        $booking->delete();

        $this->assertSoftDeleted($booking);
        $this->assertNotSoftDeleted($box); // Box is not cascade-deleted
    }

    public function test_sender_force_delete_blocked_if_bookings_exist(): void
    {
        $sender = Sender::factory()->create();
        Booking::factory()->create(['sender_id' => $sender->id]);

        $this->expectException(\LogicException::class);
        $this->expectExceptionMessage('Cannot force-delete Sender');

        $sender->forceDelete();
    }

    // ---------------------------------------------------------------
    // 5. Transaction Snapshot Immutability
    // ---------------------------------------------------------------

    public function test_invoice_snapshot_is_captured_at_creation(): void
    {
        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'price_charged' => 150.00,
        ]);

        $invoice = Invoice::generateForBooking($booking);

        // Verify snapshot data exists
        $this->assertIsArray($invoice->sender_snapshot);
        $this->assertIsArray($invoice->booking_snapshot);
        $this->assertIsArray($invoice->line_items_snapshot);
        $this->assertNotNull($invoice->snapshot_taken_at);
    }

    // ---------------------------------------------------------------
    // 6. Pickup Date Validation
    // ---------------------------------------------------------------

    public function test_booking_requires_future_pickup_date(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);
        $user->sender ?? Sender::factory()->create(['user_id' => $user->id]);

        $response = $this->actingAs($user)
            ->post(route('bookings.store'), [
                'first_name' => 'Test',
                'last_name' => 'User',
                'email' => 'test@example.com',
                'mobile' => '+61412345678',
                'address' => '123 Test St',
                'preferred_date' => now()->subDay()->format('Y-m-d H:i:s'), // Past date!
                'payment_method' => 'stripe',
                'boxes' => [],
            ]);

        $response->assertSessionHasErrors('preferred_date');
    }

    // ---------------------------------------------------------------
    // 7. Maximum Boxes per Booking
    // ---------------------------------------------------------------

    public function test_booking_with_excessive_boxes_is_handled(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);
        $user->sender ?? Sender::factory()->create(['user_id' => $user->id]);

        // Create many boxes in payload — should be validated
        $boxes = [];
        for ($i = 0; $i < 50; $i++) {
            $boxes[] = [
                'area_id' => 1,
                'box_type_id' => 1,
                'recipient_first_name' => 'Recipient ' . $i,
                'recipient_last_name' => 'Test',
                'recipient_address' => 'Address ' . $i,
                'recipient_city' => 'City',
                'recipient_province' => 'Province',
                'recipient_zip_code' => '1000',
                'recipient_phone' => '+639123456789',
            ];
        }

        $response = $this->actingAs($user)
            ->post(route('bookings.store'), [
                'first_name' => 'Test',
                'last_name' => 'User',
                'email' => 'test@example.com',
                'mobile' => '+61412345678',
                'address' => '123 Test St',
                'preferred_date' => now()->addDays(3)->format('Y-m-d H:i:s'),
                'payment_method' => 'stripe',
                'boxes' => $boxes,
            ]);

        // May pass validation (app may not limit box count) or fail with errors
        // This test verifies the app handles large inputs without crashing
        $this->assertNotEquals(500, $response->getStatusCode(),
            'App should not crash with many boxes');
    }
}
