<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\Area;
use App\Models\BoxType;
use App\Models\Booking;
use App\Models\Box;
use App\Models\User;
use App\Notifications\BookingCreatedByAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminBookingCreateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_booking_with_multiple_boxes_and_payment_reference(): void
    {
        Notification::fake();
        Storage::fake('public');

        $admin = User::factory()->create(['role' => Role::Admin]);
        $area = Area::factory()->create();
        $boxType = BoxType::factory()->create();

        $proofOfPayment = UploadedFile::fake()->create('receipt.jpg', 10, 'image/jpeg');
        $declarationForm = UploadedFile::fake()->create('declaration.pdf', 50, 'application/pdf');

        $payload = [
            'is_new_sender' => true,
            'sender_first_name' => 'John',
            'sender_last_name' => 'Doe',
            'sender_email' => 'john.doe@example.com',
            'sender_mobile' => '+61412345678',
            'sender_address' => '123 Fake Street',
            'sender_suburb' => 'Sydney',
            'sender_state' => 'NSW',
            'sender_postcode' => '2000',
            
            'status' => 'confirmed',
            'preferred_date' => '2026-10-10 10:00:00',
            
            'payment_status' => 'paid',
            'payment_reference' => 'TEST-PAY-1234',
            'proof_of_payment' => $proofOfPayment,
            
            'declaration_form_status' => 'submitted_online',
            'declaration_form' => $declarationForm,
            
            'boxes' => [
                [
                    'area_id' => $area->id,
                    'box_type_id' => $boxType->id,
                    'is_custom_size' => false,
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Doe',
                    'recipient_address' => '456 Real Avenue',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '+639123456789',
                ],
                [
                    'area_id' => $area->id,
                    'is_custom_size' => true,
                    'custom_length' => 50,
                    'custom_width' => 50,
                    'custom_height' => 50,
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Doe',
                    'recipient_address' => '456 Real Avenue',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '+639123456789',
                ]
            ],
            
            'notes' => 'Customer paid in cash in advance',
            'admin_notes' => 'VIP customer',
        ];

        $response = $this->withoutMiddleware()->actingAs($admin)->post('/admin/bookings', $payload);

        $response->assertRedirect('/admin/bookings');

        $this->assertDatabaseHas('senders', ['email' => 'john.doe@example.com']);
        $this->assertDatabaseCount('senders', 1);
        $this->assertDatabaseCount('bookings', 1);
        $this->assertDatabaseHas('recipients', ['first_name' => 'Jane']);
        $this->assertDatabaseCount('boxes', 2);

        $booking = Booking::with('boxes.recipient')->first();

        // Verify booking fields
        $this->assertEquals('confirmed', $booking->status->value ?? $booking->status);
        $this->assertEquals('paid', $booking->payment_status->value ?? $booking->payment_status);
        $this->assertEquals('TEST-PAY-1234', $booking->payment_reference);
        $this->assertEquals('Customer paid in cash in advance', $booking->notes);
        $this->assertEquals('VIP customer', $booking->admin_notes);
        $this->assertNotNull($booking->proof_of_payment);
        $this->assertNotNull($booking->declaration_form_path);

        // Verify uploaded files exist
        Storage::disk('public')->assertExists($booking->proof_of_payment);
        Storage::disk('public')->assertExists($booking->declaration_form_path);

        // Verify boxes (all linked to single recipient)
        $this->assertCount(2, $booking->boxes);
        
        $standardBox = $booking->boxes->where('is_custom_size', false)->first();
        $this->assertEquals($boxType->id, $standardBox->box_type_id);
        $this->assertEquals('Jane', $standardBox->recipient->first_name);

        $customBox = $booking->boxes->where('is_custom_size', true)->first();
        $this->assertEquals(50, $customBox->custom_length);
        $this->assertEquals(50, $customBox->custom_width);
        $this->assertEquals(50, $customBox->custom_height);
        $this->assertEquals('Jane', $customBox->recipient->first_name);

        // Verify user creation and email notification
        $user = User::where('email', 'john.doe@example.com')->first();
        $this->assertNotNull($user);

        Notification::assertSentTo($user, BookingCreatedByAdmin::class, function ($notification) use ($booking) {
            return $notification->booking->id === $booking->id;
        });
    }
}
