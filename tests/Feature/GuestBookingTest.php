<?php

namespace Tests\Feature;

use App\Actions\Fortify\CreateNewUser;
use App\Enums\Role;
use App\Models\Area;
use App\Models\Booking;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\PickupZone;
use App\Models\Province;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class GuestBookingTest extends TestCase
{
    use RefreshDatabase;

    protected Area $area;
    protected BoxType $boxType;
    protected PickupZone $pickupZone;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);

        $this->area = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);
        Province::firstOrCreate(['name' => 'Metro Manila'], ['area_id' => $this->area->id, 'is_active' => true]);

        $this->boxType = BoxType::firstOrCreate(['name' => 'Jumbo'], ['dimensions' => '24x24x24', 'is_active' => true]);

        $this->pickupZone = PickupZone::firstOrCreate([
            'name' => 'Sydney Metro',
        ], [
            'code' => 'SYD-METRO',
            'is_active' => true,
        ]);

        BoxPrice::firstOrCreate([
            'area_id' => $this->area->id,
            'box_type_id' => $this->boxType->id,
            'pickup_zone_id' => $this->pickupZone->id,
        ], [
            'price' => 120.00,
        ]);
    }

    public function test_guest_can_view_booking_page()
    {
        $response = $this->get(route('guest.book'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('guest/Book')
            ->has('areas')
            ->has('provinces')
            ->has('boxTypes')
            ->has('boxPrices')
            ->has('pickupZones')
        );
    }

    public function test_guest_can_submit_booking_successfully()
    {
        $payload = [
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'maria.santos@example.com',
            'mobile' => '+61412345678',
            'address' => '123 Campbell Street',
            'suburb' => 'Blacktown',
            'state' => 'NSW',
            'postcode' => '2148',
            'pickup_zone_id' => $this->pickupZone->id,
            'preferred_date' => now()->addDays(3)->format('Y-m-d'),
            'payment_method' => 'cash_on_pickup',
            'notes' => 'Ring bell upon arrival',
            'boxes' => [
                [
                    'recipient_first_name' => 'Juan',
                    'recipient_last_name' => 'Dela Cruz',
                    'recipient_email' => 'juan@example.ph',
                    'recipient_phone' => '+639171234567',
                    'recipient_address' => 'Block 5 Lot 10 Sampaguita St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'area_id' => $this->area->id,
                    'box_type_id' => $this->boxType->id,
                    'is_custom_size' => false,
                ],
            ],
        ];

        $response = $this->post(route('guest.bookings.store'), $payload);

        $response->assertRedirect();

        // Check booking was created
        $booking = Booking::first();
        $this->assertNotNull($booking);
        $this->assertStringStartsWith('BK-', $booking->reference_number);
        $this->assertNotNull($booking->guest_token);
        $this->assertTrue($booking->is_guest);
        $this->assertTrue($booking->isGuest());
        $this->assertFalse($booking->isRegistered());
        $this->assertEquals('pending', $booking->status->value);

        // Check sender has no linked user_id
        $sender = Sender::find($booking->sender_id);
        $this->assertNotNull($sender);
        $this->assertNull($sender->user_id);
        $this->assertEquals('maria.santos@example.com', $sender->email);

        // Check redirection goes to confirmation page with guest token
        $response->assertRedirect(route('guest.booking.confirmed', ['token' => $booking->guest_token]));
    }

    public function test_guest_booking_validation_fails_when_fields_are_missing()
    {
        $response = $this->post(route('guest.bookings.store'), []);

        $response->assertSessionHasErrors([
            'first_name',
            'last_name',
            'email',
            'mobile',
            'address',
            'suburb',
            'state',
            'postcode',
            'preferred_date',
            'payment_method',
            'boxes',
        ]);
    }

    public function test_guest_booking_honeypot_triggers_silent_redirect()
    {
        $payload = [
            'website' => 'http://spambot.com',
            'first_name' => 'Bot',
            'last_name' => 'Spam',
            'email' => 'bot@spam.com',
            'mobile' => '+61412345678',
            'address' => 'Fake St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d'),
            'payment_method' => 'cash_on_pickup',
            'boxes' => [],
        ];

        $response = $this->from(route('guest.book'))->post(route('guest.bookings.store'), $payload);

        $response->assertRedirect(route('guest.book'));
        $this->assertEquals(0, Booking::count());
    }

    public function test_guest_can_view_confirmed_page_with_valid_token()
    {
        $sender = Sender::create([
            'user_id' => null,
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'maria@example.com',
            'mobile' => '+61412345678',
            'address' => '123 Main St',
        ]);

        $booking = $sender->bookings()->create([
            'guest_token' => 'test-guest-token-12345',
            'reference_number' => 'BK-2026-999',
            'status' => 'pending',
            'preferred_date' => now()->addDays(3),
            'payment_method' => 'cash_on_pickup',
            'payment_status' => 'pending',
        ]);

        $response = $this->get(route('guest.booking.confirmed', ['token' => 'test-guest-token-12345']));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('guest/BookingConfirmed')
            ->where('booking.reference_number', 'BK-2026-999')
            ->where('booking.sender.email', 'maria@example.com')
        );
    }

    public function test_confirmed_page_returns_404_for_invalid_token()
    {
        $response = $this->get(route('guest.booking.confirmed', ['token' => 'non-existent-token']));

        $response->assertNotFound();
    }

    public function test_guest_booking_links_to_new_user_account_on_registration()
    {
        // 1. Guest creates a booking
        $guestSender = Sender::create([
            'user_id' => null,
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'maria.registered@example.com',
            'mobile' => '+61412345678',
            'address' => '123 Campbell Street',
            'suburb' => 'Blacktown',
            'state' => 'NSW',
            'postcode' => '2148',
        ]);

        $guestBooking = $guestSender->bookings()->create([
            'reference_number' => 'BK-2026-101',
            'status' => 'pending',
            'preferred_date' => now()->addDays(3),
            'payment_method' => 'cash_on_pickup',
            'guest_token' => 'token-abc',
        ]);

        $this->assertNull($guestSender->user_id);

        // 2. User registers using the same email
        $creator = new CreateNewUser();
        $newUser = $creator->create([
            'name' => 'Maria Santos',
            'email' => 'maria.registered@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => Role::Sender->value,
            'mobile' => '+61412345678',
            'address' => '123 Campbell Street',
            'suburb' => 'Blacktown',
            'state' => 'NSW',
            'postcode' => '2148',
            'country' => 'Australia',
        ]);

        // 3. Verify sender record is claimed by the new user
        $guestSender->refresh();
        $this->assertEquals($newUser->id, $guestSender->user_id);

        // 4. Verify the new user's sender profile has the booking
        $this->assertCount(1, $newUser->sender->bookings);
        $this->assertEquals('BK-2026-101', $newUser->sender->bookings->first()->reference_number);
    }

    public function test_booking_is_guest_scopes_and_helpers()
    {
        $guestSender = Sender::create([
            'user_id' => null,
            'first_name' => 'Guest',
            'last_name' => 'User',
            'email' => 'guest.tester@example.com',
            'mobile' => '+61412345678',
            'address' => '123 Test St',
        ]);

        $registeredUser = User::factory()->create(['role' => Role::Sender]);
        $registeredSender = Sender::create([
            'user_id' => $registeredUser->id,
            'first_name' => 'Registered',
            'last_name' => 'User',
            'email' => $registeredUser->email,
            'mobile' => '+61412345679',
            'address' => '456 Test St',
        ]);

        $guestBooking = $guestSender->bookings()->create([
            'reference_number' => 'BK-2026-GUEST',
            'status' => 'pending',
            'is_guest' => true,
            'guest_token' => 'guest-token-123',
        ]);

        $memberBooking = $registeredSender->bookings()->create([
            'reference_number' => 'BK-2026-MEMBER',
            'status' => 'pending',
            'is_guest' => false,
        ]);

        // Helpers
        $this->assertTrue($guestBooking->isGuest());
        $this->assertFalse($guestBooking->isRegistered());
        $this->assertFalse($memberBooking->isGuest());
        $this->assertTrue($memberBooking->isRegistered());

        // Scopes
        $guestResults = Booking::guest()->pluck('reference_number')->toArray();
        $this->assertContains('BK-2026-GUEST', $guestResults);
        $this->assertNotContains('BK-2026-MEMBER', $guestResults);

        $registeredResults = Booking::registered()->pluck('reference_number')->toArray();
        $this->assertContains('BK-2026-MEMBER', $registeredResults);
        $this->assertNotContains('BK-2026-GUEST', $registeredResults);
    }

    public function test_admin_can_filter_bookings_by_guest_customer_type()
    {
        $admin = User::factory()->create(['role' => Role::Admin]);

        $guestSender = Sender::create([
            'user_id' => null,
            'first_name' => 'GuestFilter',
            'last_name' => 'User',
            'email' => 'guest.filter@example.com',
            'mobile' => '+61412345678',
            'address' => '123 Test St',
        ]);

        $registeredUser = User::factory()->create(['role' => Role::Sender]);
        $registeredSender = Sender::create([
            'user_id' => $registeredUser->id,
            'first_name' => 'MemberFilter',
            'last_name' => 'User',
            'email' => $registeredUser->email,
            'mobile' => '+61412345679',
            'address' => '456 Test St',
        ]);

        $guestBooking = $guestSender->bookings()->create([
            'reference_number' => 'BK-FILTER-GUEST',
            'status' => 'confirmed',
            'is_guest' => true,
            'guest_token' => 'token-guest-filter',
        ]);

        $memberBooking = $registeredSender->bookings()->create([
            'reference_number' => 'BK-FILTER-MEMBER',
            'status' => 'confirmed',
            'is_guest' => false,
        ]);

        // Filter guest
        $responseGuest = $this->actingAs($admin)->get(route('admin.bookings.index', ['customer_type' => 'guest']));
        $responseGuest->assertOk();
        $responseGuest->assertInertia(fn (Assert $page) => $page
            ->component('admin/bookings/index')
            ->where('filters.customer_type', 'guest')
        );

        // Filter registered
        $responseRegistered = $this->actingAs($admin)->get(route('admin.bookings.index', ['customer_type' => 'registered']));
        $responseRegistered->assertOk();
        $responseRegistered->assertInertia(fn (Assert $page) => $page
            ->component('admin/bookings/index')
            ->where('filters.customer_type', 'registered')
        );
    }
}
