<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Area;
use App\Models\Booking;
use App\Models\BoxType;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingDuplicateDetectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_can_detect_potential_duplicate_bookings_with_same_creation_time()
    {
        // Setup base data
        $area = Area::create(['name' => 'Metro Manila', 'is_active' => true]);
        $boxType = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);

        $sender = Sender::create([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john@example.com',
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Test Suburb',
            'state' => 'NSW',
            'postcode' => '2000',
        ]);

        $recipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'Jane Smith',
            'phone_number' => '09123456789',
            'address' => '456 Manila St',
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'zip_code' => '1000',
        ]);

        // Create first booking
        $booking1 = Booking::create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-2024-001',
            'status' => 'pending',
            'created_at' => now()->subMinutes(5),
        ]);
        $booking1->boxes()->create([
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 100,
        ]);

        // Create second booking (potential duplicate)
        $booking2 = Booking::create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-2024-002',
            'status' => 'pending',
            'created_at' => now(),
        ]);
        $booking2->boxes()->create([
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 100,
        ]);

        // Refresh to load relations
        $booking2->load('boxes');
        $booking1->load('boxes');

        $this->assertTrue($booking2->isPotentialDuplicate());
        $this->assertFalse($booking1->isPotentialDuplicate());
    }

    public function test_it_does_not_flag_older_bookings_as_duplicates()
    {
        $area = Area::create(['name' => 'Metro Manila', 'is_active' => true]);
        $boxType = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);

        $sender = Sender::create([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john@example.com',
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Test Suburb',
            'state' => 'NSW',
            'postcode' => '2000',
        ]);

        $recipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'Jane Smith',
            'phone_number' => '09123456789',
            'address' => '456 Manila St',
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'zip_code' => '1000',
        ]);

        // Create first booking in the past
        $booking1 = Booking::create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-2024-001',
            'status' => 'pending',
            'created_at' => now()->subHours(25), // Outside 24h window
        ]);
        $booking1->boxes()->create([
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 100,
        ]);

        $booking1->setCreatedAt(now()->subHours(25))->save();

        // Create second booking now
        $booking2 = Booking::create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-2024-002',
            'status' => 'pending',
            'created_at' => now(),
        ]);
        $booking2->boxes()->create([
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 100,
        ]);

        $booking2->setCreatedAt(now())->save();

        $booking2->load('boxes');

        $this->assertFalse($booking2->isPotentialDuplicate());
    }

    public function test_admin_index_includes_duplicate_flag()
    {
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);

        $area = Area::create(['name' => 'Metro Manila', 'is_active' => true]);
        $boxType = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);

        $sender = Sender::create([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john@example.com',
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Test Suburb',
            'state' => 'NSW',
            'postcode' => '2000',
        ]);

        $recipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'Jane Smith',
            'phone_number' => '09123456789',
            'address' => '456 Manila St',
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'zip_code' => '1000',
        ]);

        // Create two bookings for the same recipient
        $b1 = Booking::create([
            'sender_id' => $sender->id,
            'reference_number' => 'B1',
            'status' => 'pending',
            'created_at' => now()->subMinutes(10),
        ]);
        $b1->boxes()->create(['recipient_id' => $recipient->id, 'box_type_id' => $boxType->id, 'price_charged' => 100]);

        $b2 = Booking::create([
            'sender_id' => $sender->id,
            'reference_number' => 'B2',
            'status' => 'pending',
            'created_at' => now(),
        ]);
        $b2->boxes()->create(['recipient_id' => $recipient->id, 'box_type_id' => $boxType->id, 'price_charged' => 100]);

        $response = $this->actingAs($admin)->get(route('admin.bookings.index'));

        $response->assertStatus(200);

        // Check if Inertia data contains the duplicate flag
        // Note: The index usually results in the latest booking (B2) being first (index 0)
        $response->assertInertia(fn ($page) => $page
            ->has('bookings.data', 2)
            ->where('bookings.data.0.is_potential_duplicate', true) // B2 is duplicate of B1
            ->where('bookings.data.1.is_potential_duplicate', false) // B1 is the original
        );
    }
}
