<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\Province;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class BookingFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake(); // Prevent actual jobs from running
    }

    public function test_it_can_create_a_booking_with_multiple_new_recipients()
    {
        // Setup Areas
        $manila = Area::create(['name' => 'Metro Manila', 'is_active' => true]);
        $cebu = Area::create(['name' => 'Cebu City', 'is_active' => true]);

        // Setup Box Types
        $jumbo = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);
        $regular = BoxType::create(['name' => 'Regular', 'dimensions' => '20x20x20', 'is_active' => true]);

        // Setup Box Prices
        BoxPrice::create(['area_id' => $manila->id, 'box_type_id' => $jumbo->id, 'price' => 100.00]);
        BoxPrice::create(['area_id' => $cebu->id, 'box_type_id' => $regular->id, 'price' => 80.00]);

        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john.doe@example.com',
            'mobile' => '+61412345678',
            'address' => '123 Test Street',
            'suburb' => 'Test Suburb',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d H:i:s'),
            'payment_method' => 'stripe',
            'boxes' => [
                [
                    'area_id' => $manila->id,
                    'box_type_id' => $jumbo->id,
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Doe Manila',
                    'recipient_email' => 'jane.manila@example.com',
                    'recipient_address' => '456 Manila Ave',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '+639123456789',
                ],
                [
                    'area_id' => $cebu->id,
                    'box_type_id' => $regular->id,
                    'recipient_first_name' => 'John',
                    'recipient_last_name' => 'Cebu',
                    'recipient_email' => 'john.cebu@example.com',
                    'recipient_address' => '789 Cebu St',
                    'recipient_city' => 'Cebu City',
                    'recipient_province' => 'Cebu',
                    'recipient_zip_code' => '6000',
                    'recipient_phone' => '+639987654321',
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('bookings.store'), $payload);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        // Assert sender was created/updated
        $this->assertDatabaseHas('senders', [
            'email' => 'john.doe@example.com',
            'first_name' => 'John',
            'last_name' => 'Doe',
        ]);

        $sender = Sender::where('email', 'john.doe@example.com')->first();

        // Assert booking exists
        $this->assertDatabaseCount('bookings', 1);
        $this->assertDatabaseHas('bookings', [
            'sender_id' => $sender->id,
        ]);

        // Assert recipients were created and linked to sender
        $this->assertDatabaseCount('recipients', 2);
        $this->assertDatabaseHas('recipients', [
            'sender_id' => $sender->id,
            'name' => 'Jane Doe Manila',
        ]);
        $this->assertDatabaseHas('recipients', [
            'sender_id' => $sender->id,
            'name' => 'John Cebu',
        ]);

        // Assert boxes were created with correct pricing
        $this->assertDatabaseCount('boxes', 2);

        $janeRecipient = Recipient::where('name', 'Jane Doe Manila')->first();
        $this->assertDatabaseHas('boxes', [
            'recipient_id' => $janeRecipient->id,
            'box_type_id' => $jumbo->id,
            'price_charged' => 100.00,
        ]);

        $johnRecipient = Recipient::where('name', 'John Cebu')->first();
        $this->assertDatabaseHas('boxes', [
            'recipient_id' => $johnRecipient->id,
            'box_type_id' => $regular->id,
            'price_charged' => 80.00,
        ]);
    }

    public function test_it_can_create_a_booking_with_saved_recipient()
    {
        $manila = Area::create(['name' => 'Metro Manila', 'is_active' => true]);
        $jumbo = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);
        BoxPrice::create(['area_id' => $manila->id, 'box_type_id' => $jumbo->id, 'price' => 100.00]);

        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $sender = $user->sender;
        $sender->update([
            'first_name' => 'Old',
            'last_name' => 'Sender',
            'email' => 'old@example.com',
            'mobile' => '+61412000000',
            'address' => 'Old Street',
        ]);

        $savedRecipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $manila->id,
            'name' => 'Saved Recipient',
            'address' => 'Saved Address',
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'zip_code' => '1000',
        ]);

        $payload = [
            'first_name' => 'Old',
            'last_name' => 'Sender',
            'email' => 'old@example.com',
            'mobile' => '+61412000000',
            'address' => 'Old Street',
            'suburb' => 'Old Suburb',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d H:i:s'),
            'payment_method' => 'stripe',
            'boxes' => [
                [
                    'area_id' => $manila->id,
                    'box_type_id' => $jumbo->id,
                    'recipient_id' => $savedRecipient->id,
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('bookings.store'), $payload);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $this->assertDatabaseCount('bookings', 1);
        $this->assertDatabaseCount('recipients', 1); // No new recipient created

        $this->assertDatabaseHas('boxes', [
            'recipient_id' => $savedRecipient->id,
            'box_type_id' => $jumbo->id,
            'price_charged' => 100.00,
        ]);
    }

    public function test_cash_on_pickup_booking_returns_to_sender_bookings()
    {
        $manila = Area::create(['name' => 'Metro Manila', 'is_active' => true]);
        $jumbo = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);
        BoxPrice::create(['area_id' => $manila->id, 'box_type_id' => $jumbo->id, 'price' => 100.00]);

        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john.doe@example.com',
            'mobile' => '+61412345678',
            'address' => '123 Test Street',
            'suburb' => 'Test Suburb',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d H:i:s'),
            'payment_method' => 'cash_on_pickup',
            'boxes' => [
                [
                    'area_id' => $manila->id,
                    'box_type_id' => $jumbo->id,
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Doe',
                    'recipient_email' => 'jane@example.com',
                    'recipient_address' => '456 Manila Ave',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '+639123456789',
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('bookings.store'), $payload);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect(route('sender.bookings'));
        $response->assertSessionHas('success', 'Booking confirmed! Payment will be collected on pickup.');

        $this->assertDatabaseHas('bookings', [
            'payment_method' => 'cash_on_pickup',
            'payment_status' => PaymentStatus::CashOnPickup->value,
        ]);
    }

    public function test_admin_booking_show_includes_box_recipient_name_for_label()
    {
        /** @var User $user */
        $user = User::factory()->create(['role' => Role::Admin->value]);

        $sender = Sender::create([
            'first_name' => 'Admin',
            'last_name' => 'Sender',
            'email' => 'admin@example.com',
            'mobile' => '+61412123456',
            'address' => 'Admin Street',
        ]);

        $area = Area::create(['name' => 'Metro Manila', 'is_active' => true]);

        $recipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'Label Recipient',
            'address' => '123 Label Ave',
            'city' => 'Tagoloan',
            'province' => 'Mis Or',
            'zip_code' => '9000',
        ]);

        $booking = Booking::create([
            'sender_id' => $sender->id,
            'status' => 'confirmed',
            'payment_status' => 'paid',
            'declaration_form_status' => 'missing',
        ]);

        $box = Box::create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => 'pending',
        ]);

        $response = $this->actingAs($user)
            ->get(route('admin.bookings.show', $booking));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/bookings/show')
                ->where('booking.boxes.0.recipient.name', 'Label Recipient')
            );
    }

    public function test_booking_pricing_derives_area_from_province_instead_of_trusting_posted_area_id(): void
    {
        $manila = Area::create(['name' => 'Metro Manila', 'is_active' => true]);
        $cebu = Area::create(['name' => 'Cebu City', 'is_active' => true]);
        Province::create(['name' => 'Metro Manila', 'area_id' => $manila->id, 'is_active' => true]);
        Province::create(['name' => 'Cebu', 'area_id' => $cebu->id, 'is_active' => true]);

        $boxType = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);
        BoxPrice::create(['area_id' => $manila->id, 'box_type_id' => $boxType->id, 'price' => 10.00]);
        BoxPrice::create(['area_id' => $cebu->id, 'box_type_id' => $boxType->id, 'price' => 80.00]);

        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $payload = $this->bookingPayload([
            'area_id' => $manila->id,
            'box_type_id' => $boxType->id,
            'recipient_city' => 'Cebu City',
            'recipient_province' => 'Cebu',
        ]);

        $response = $this->actingAs($user)->post(route('bookings.store'), $payload);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('recipients', [
            'province' => 'Cebu',
            'area_id' => $cebu->id,
        ]);
        $this->assertDatabaseHas('boxes', [
            'box_type_id' => $boxType->id,
            'price_charged' => 80.00,
        ]);
    }

    public function test_davao_city_overrides_davao_del_sur_province_area(): void
    {
        $mindanao = Area::create(['name' => 'Mindanao', 'is_active' => true]);
        $davao = Area::create(['name' => 'Davao City', 'is_active' => true]);
        Province::create(['name' => 'Davao del Sur', 'area_id' => $mindanao->id, 'is_active' => true]);

        $boxType = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);
        BoxPrice::create(['area_id' => $mindanao->id, 'box_type_id' => $boxType->id, 'price' => 140.00]);
        BoxPrice::create(['area_id' => $davao->id, 'box_type_id' => $boxType->id, 'price' => 200.00]);

        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $payload = $this->bookingPayload([
            'area_id' => $mindanao->id,
            'box_type_id' => $boxType->id,
            'recipient_city' => 'Davao City',
            'recipient_province' => 'Davao del Sur',
        ]);

        $response = $this->actingAs($user)->post(route('bookings.store'), $payload);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('recipients', [
            'city' => 'Davao City',
            'province' => 'Davao del Sur',
            'area_id' => $davao->id,
        ]);
        $this->assertDatabaseHas('boxes', [
            'box_type_id' => $boxType->id,
            'price_charged' => 200.00,
        ]);
    }

    public function test_unknown_recipient_province_is_rejected_when_province_reference_data_exists(): void
    {
        $manila = Area::create(['name' => 'Metro Manila', 'is_active' => true]);
        Province::create(['name' => 'Metro Manila', 'area_id' => $manila->id, 'is_active' => true]);

        $boxType = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);
        BoxPrice::create(['area_id' => $manila->id, 'box_type_id' => $boxType->id, 'price' => 100.00]);

        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $payload = $this->bookingPayload([
            'area_id' => $manila->id,
            'box_type_id' => $boxType->id,
            'recipient_city' => 'Cebu City',
            'recipient_province' => 'Cebuu',
        ]);

        $response = $this->actingAs($user)->post(route('bookings.store'), $payload);

        $response->assertSessionHasErrors('boxes.0.recipient_province');
        $this->assertDatabaseCount('bookings', 0);
    }

    private function bookingPayload(array $boxOverrides = []): array
    {
        return [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john.doe@example.com',
            'mobile' => '+61412345678',
            'address' => '123 Test Street',
            'suburb' => 'Test Suburb',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d H:i:s'),
            'payment_method' => 'stripe',
            'boxes' => [
                array_merge([
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Doe',
                    'recipient_email' => 'jane@example.com',
                    'recipient_address' => '456 Recipient Ave',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '+639123456789',
                ], $boxOverrides),
            ],
        ];
    }
}
