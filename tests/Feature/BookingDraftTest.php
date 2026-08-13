<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Models\Area;
use App\Models\Booking;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class BookingDraftTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed basic data
        Area::create(['name' => 'Metro Manila', 'is_active' => true]);
        BoxType::create(['name' => 'Jumbo', 'is_active' => true]);
        BoxPrice::create([
            'area_id' => Area::first()->id,
            'box_type_id' => BoxType::first()->id,
            'price' => 100,
        ]);
    }

    #[Test]
    public function a_user_can_save_a_booking_as_a_draft()
    {
        $user = User::factory()->create();

        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john@example.com',
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->toDateTimeString(),
            'payment_method' => 'stripe',
            'status' => 'draft',
            'boxes' => [
                [
                    'box_type_id' => BoxType::first()->id,
                    'area_id' => Area::first()->id,
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Smith',
                    'recipient_email' => 'jane@example.com',
                    'recipient_phone' => '09123456789',
                    'recipient_address' => '456 PH St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                ],
            ],
        ];

        $response = $this->actingAs($user)->postJson(route('bookings.draft'), $payload);

        $response->assertSuccessful();
        $response->assertJson(['success' => true]);

        $this->assertDatabaseHas('bookings', [
            'status' => BookingStatus::Draft->value,
            'sender_id' => Sender::where('user_id', $user->id)->first()->id,
        ]);
    }

    #[Test]
    public function a_user_can_update_a_draft_booking()
    {
        $user = User::factory()->create();
        $sender = $user->sender;
        $sender->update([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => $user->email,
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
        ]);

        $booking = Booking::create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Draft,
            'preferred_date' => now()->addDays(3),
        ]);

        $payload = [
            'draft_id' => $booking->id,
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => $user->email,
            'mobile' => '0412345678',
            'address' => '123 Updated St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(4)->toDateTimeString(),
            'payment_method' => 'stripe',
            'status' => 'draft',
            'boxes' => [
                [
                    'box_type_id' => BoxType::first()->id,
                    'area_id' => Area::first()->id,
                    'recipient_first_name' => 'Updated Jane',
                    'recipient_last_name' => 'Smith',
                    'recipient_email' => 'jane@example.com',
                    'recipient_phone' => '09123456789',
                    'recipient_address' => '456 PH St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                ],
            ],
        ];

        $response = $this->actingAs($user)->postJson(route('bookings.draft'), $payload);

        $response->assertSuccessful();
        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => BookingStatus::Draft->value,
        ]);
        $this->assertDatabaseHas('senders', [
            'id' => $sender->id,
            'address' => '123 Updated St',
        ]);
    }

    #[Test]
    public function a_user_can_finalize_a_draft_booking()
    {
        $user = User::factory()->create();
        $sender = $user->sender;
        $sender->update([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => $user->email,
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
        ]);

        $booking = Booking::create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Draft,
            'preferred_date' => now()->addDays(3),
        ]);

        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => $user->email,
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->toDateTimeString(),
            'payment_method' => 'stripe',
            'status' => 'pending', // Changing from draft to pending
            'boxes' => [
                [
                    'box_type_id' => BoxType::first()->id,
                    'area_id' => Area::first()->id,
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Smith',
                    'recipient_email' => 'jane@example.com',
                    'recipient_phone' => '09123456789',
                    'recipient_address' => '456 PH St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('bookings.submit-draft', $booking), $payload);

        // stripe redirects to pay
        $response->assertRedirect(route('bookings.pay', $booking));
        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => BookingStatus::Pending->value,
        ]);
    }

    #[Test]
    public function a_user_can_finalize_a_draft_booking_with_payment_on_pickup()
    {
        $user = User::factory()->create();
        $sender = $user->sender;
        $sender->update([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => $user->email,
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
        ]);

        $booking = Booking::create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Draft,
            'preferred_date' => now()->addDays(3),
        ]);

        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => $user->email,
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->toDateTimeString(),
            'payment_method' => 'cash_on_pickup',
            'status' => 'pending',
            'boxes' => [
                [
                    'box_type_id' => BoxType::first()->id,
                    'area_id' => Area::first()->id,
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Smith',
                    'recipient_email' => 'jane@example.com',
                    'recipient_phone' => '09123456789',
                    'recipient_address' => '456 PH St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('bookings.submit-draft', $booking), $payload);

        $response->assertRedirect(route('sender.bookings'));
        $response->assertSessionHas('success', 'Booking confirmed! Payment will be collected on pickup.');
        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => BookingStatus::Pending->value,
            'payment_method' => 'cash_on_pickup',
            'payment_status' => PaymentStatus::CashOnPickup->value,
        ]);
    }

    #[Test]
    public function stale_autosave_after_finalizing_a_draft_does_not_create_a_new_draft()
    {
        $user = User::factory()->create();
        $sender = $user->sender;
        $sender->update([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => $user->email,
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
        ]);

        $booking = Booking::create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Draft,
            'preferred_date' => now()->addDays(3),
        ]);

        $payload = [
            'draft_id' => $booking->id,
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => $user->email,
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->toDateTimeString(),
            'payment_method' => 'cash_on_pickup',
            'boxes' => [
                [
                    'box_type_id' => BoxType::first()->id,
                    'area_id' => Area::first()->id,
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Smith',
                    'recipient_email' => 'jane@example.com',
                    'recipient_phone' => '09123456789',
                    'recipient_address' => '456 PH St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                ],
            ],
        ];

        $this->actingAs($user)->post(route('bookings.submit-draft', $booking), $payload)
            ->assertRedirect(route('sender.bookings'));

        $this->actingAs($user)->postJson(route('bookings.draft'), $payload)
            ->assertSuccessful()
            ->assertJson([
                'success' => true,
                'draft_id' => null,
            ]);

        $this->assertSame(1, Booking::where('sender_id', $sender->id)->count());
        $this->assertSame(0, Booking::where('sender_id', $sender->id)->where('status', BookingStatus::Draft->value)->count());
        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => BookingStatus::Pending->value,
        ]);
    }
}
