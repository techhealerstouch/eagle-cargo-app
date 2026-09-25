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
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
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

    public function test_guest_booking_supports_door_to_door_and_empty_box_delivery()
    {
        $this->area->update(['door_to_door_fee' => 15.00]);

        $payload = [
            'first_name' => 'Eduardo',
            'last_name' => 'Reyes',
            'email' => 'eduardo.reyes@example.com',
            'mobile' => '+61412345679',
            'address' => '456 Crown Street',
            'suburb' => 'Surry Hills',
            'state' => 'NSW',
            'postcode' => '2010',
            'pickup_zone_id' => $this->pickupZone->id,
            'preferred_date' => now()->addDays(3)->format('Y-m-d'),
            'payment_method' => 'cash_on_pickup',
            'request_empty_box' => true,
            'empty_box_count' => 2,
            'empty_box_fee' => 10.00,
            'boxes' => [
                [
                    'recipient_first_name' => 'Rosario',
                    'recipient_last_name' => 'Reyes',
                    'recipient_email' => 'rosario@example.ph',
                    'recipient_phone' => '+639171234568',
                    'recipient_address' => '789 Mabini St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'area_id' => $this->area->id,
                    'box_type_id' => $this->boxType->id,
                    'is_custom_size' => false,
                    'is_door_to_door' => true,
                ],
            ],
        ];

        $response = $this->post(route('guest.bookings.store'), $payload);

        $response->assertRedirect();

        $booking = Booking::whereHas('sender', fn ($q) => $q->where('email', 'eduardo.reyes@example.com'))->first();
        $this->assertNotNull($booking);
        $this->assertEquals(2, $booking->empty_box_count);
        $this->assertEquals(10.00, $booking->empty_box_fee);

        $box = $booking->boxes()->first();
        $this->assertNotNull($box);
        $this->assertTrue((bool) $box->is_door_to_door);
        // Price should be standard price ($120.00) + door_to_door_fee ($15.00) = $135.00
        $this->assertEquals(135.00, (float) $box->price_charged);
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

    public function test_guest_can_access_declaration_form_with_valid_token()
    {
        $guestSender = Sender::create([
            'first_name' => 'GuestDecl',
            'last_name' => 'Sender',
            'email' => 'guestdecl@example.com',
            'mobile' => '+61412345670',
            'address' => '123 Decl St',
        ]);

        $booking = $guestSender->bookings()->create([
            'reference_number' => 'BK-GUEST-DECL-01',
            'status' => 'confirmed',
            'is_guest' => true,
            'guest_token' => 'valid-guest-decl-token',
        ]);

        // Without token -> 403
        $forbiddenResponse = $this->get(route('track.declaration.form', $booking));
        $forbiddenResponse->assertForbidden();

        // With invalid token -> 403
        $invalidResponse = $this->get(route('track.declaration.form', ['booking' => $booking, 'token' => 'invalid-token']));
        $invalidResponse->assertForbidden();

        // With valid token -> OK
        $validResponse = $this->get(route('track.declaration.form', ['booking' => $booking, 'token' => 'valid-guest-decl-token']));
        $validResponse->assertOk();
        $validResponse->assertInertia(fn (Assert $page) => $page
            ->component('marketing/declaration')
            ->where('booking.id', $booking->id)
            ->where('isGuest', true)
            ->where('guestToken', 'valid-guest-decl-token')
        );
    }

    public function test_guest_can_save_declaration_data_with_token()
    {
        $guestSender = Sender::create([
            'first_name' => 'GuestSave',
            'last_name' => 'Sender',
            'email' => 'guestsave@example.com',
            'mobile' => '+61412345670',
            'address' => '123 Save St',
        ]);

        $booking = $guestSender->bookings()->create([
            'reference_number' => 'BK-GUEST-SAVE-01',
            'status' => 'confirmed',
            'is_guest' => true,
            'guest_token' => 'save-decl-token',
        ]);

        $postData = [
            'booking_id' => $booking->id,
            'token' => 'save-decl-token',
            'declaration_data' => [
                'shipment' => ['box_count' => '1'],
                'boxes' => [],
            ],
        ];

        $response = $this->post(route('track.declaration.save'), $postData);
        $response->assertRedirect(route('guest.booking.confirmed', ['token' => 'save-decl-token']));
        $response->assertSessionHas('success');

        $booking->refresh();
        $this->assertEquals('submitted_online', $booking->declaration_form_status);
        $this->assertNotNull($booking->declaration_data);
    }

    public function test_guest_can_upload_proof_of_payment_with_token()
    {
        Storage::fake('public');

        $guestSender = Sender::create([
            'first_name' => 'GuestProof',
            'last_name' => 'Sender',
            'email' => 'guestproof@example.com',
            'mobile' => '+61412345670',
            'address' => '123 Proof St',
        ]);

        $booking = $guestSender->bookings()->create([
            'reference_number' => 'BK-GUEST-PROOF-01',
            'status' => 'confirmed',
            'is_guest' => true,
            'guest_token' => 'valid-proof-token-123',
            'payment_method' => 'bank_transfer',
        ]);

        $file = UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf');

        $response = $this->post(route('guest.booking.upload-proof'), [
            'booking_id' => $booking->id,
            'token' => 'valid-proof-token-123',
            'proof_of_payment' => $file,
        ]);

        $response->assertRedirect(route('guest.booking.confirmed', ['token' => 'valid-proof-token-123']));
        $response->assertSessionHas('success');

        $booking->refresh();
        $this->assertNotNull($booking->proof_of_payment);
        Storage::disk('public')->assertExists($booking->proof_of_payment);
    }

    public function test_guest_cannot_upload_proof_of_payment_with_invalid_token()
    {
        Storage::fake('public');

        $guestSender = Sender::create([
            'first_name' => 'GuestProofInvalid',
            'last_name' => 'Sender',
            'email' => 'guestproofinv@example.com',
            'mobile' => '+61412345670',
            'address' => '123 Proof Inv St',
        ]);

        $booking = $guestSender->bookings()->create([
            'reference_number' => 'BK-GUEST-PROOF-02',
            'status' => 'confirmed',
            'is_guest' => true,
            'guest_token' => 'correct-token',
            'payment_method' => 'bank_transfer',
        ]);

        $file = UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf');

        $response = $this->post(route('guest.booking.upload-proof'), [
            'booking_id' => $booking->id,
            'token' => 'wrong-token',
            'proof_of_payment' => $file,
        ]);

        $response->assertForbidden();
        $booking->refresh();
        $this->assertNull($booking->proof_of_payment);
    }

    public function test_guest_can_initialize_booking_and_receive_token_and_bank_details()
    {
        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'johndoe@example.com',
            'mobile' => '+61412345678',
            'address' => '456 George St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $this->pickupZone->id,
            'preferred_date' => now()->addDays(2)->format('Y-m-d'),
            'payment_method' => 'bank_transfer',
            'initialization_key' => 'init-key-test-123',
            'boxes' => [
                [
                    'recipient_first_name' => 'Maria',
                    'recipient_last_name' => 'Santos',
                    'recipient_email' => 'maria@example.ph',
                    'recipient_phone' => '+639171234567',
                    'recipient_address' => '123 Rizal St',
                    'recipient_city' => 'Makati',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1200',
                    'area_id' => $this->area->id,
                    'box_type_id' => $this->boxType->id,
                    'is_custom_size' => false,
                ],
            ],
        ];

        $response = $this->postJson(route('guest.bookings.initialize'), $payload);

        $response->assertOk();
        $response->assertJsonStructure([
            'booking' => ['id', 'reference_number', 'status'],
            'guest_token',
            'bankDetails' => ['bank_name', 'bsb', 'account_number', 'company_name'],
        ]);

        $token = $response->json('guest_token');
        $this->assertNotEmpty($token);

        $booking = Booking::where('guest_token', $token)->first();
        $this->assertNotNull($booking);
        $this->assertTrue($booking->is_guest);
        $this->assertEquals('johndoe@example.com', $booking->sender->email);
    }

    public function test_guest_cannot_verify_stripe_payment_without_valid_guest_token()
    {
        $guestSender = Sender::create([
            'first_name' => 'StripeGuest',
            'last_name' => 'Test',
            'email' => 'stripeguest@example.com',
            'mobile' => '+61412345670',
            'address' => '789 Pitt St',
        ]);

        $booking = $guestSender->bookings()->create([
            'reference_number' => 'BK-STRIPE-GUEST-01',
            'status' => 'pending',
            'is_guest' => true,
            'guest_token' => 'secure-guest-token-abc',
            'payment_method' => 'stripe',
        ]);

        $response = $this->postJson(route('guest.bookings.stripe-verify', $booking), [
            'payment_intent' => 'pi_fake_123',
            'token' => 'invalid-token',
        ]);

        $response->assertForbidden();
    }
}


