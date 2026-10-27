<?php

namespace Tests\Feature;

use App\Actions\Fortify\CreateNewUser;
use App\Enums\Role;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\GuestBookingAccessChallenge;
use App\Models\PickupZone;
use App\Models\Province;
use App\Models\Sender;
use App\Services\GuestBookingAccessService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class GuestBookingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        Notification::fake();
    }

    public function test_guest_can_view_booking_form(): void
    {
        $response = $this->get(route('guest.book'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('guest/Book'));
    }

    public function test_guest_booking_inherits_rate_calculator_query_params(): void
    {
        $queryParams = [
            'suburb' => 'Richmond',
            'postcode' => '3121',
            'state' => 'VIC',
            'pickup_zone_id' => '2',
            'box_type_id' => '3',
            'area_id' => '1',
            'province' => 'Metro Manila',
        ];

        $response = $this->get(route('guest.book', $queryParams));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('guest/Book')
            ->has('initialQuery')
            ->where('initialQuery.suburb', 'Richmond')
            ->where('initialQuery.postcode', '3121')
            ->where('initialQuery.state', 'VIC')
            ->where('initialQuery.pickup_zone_id', '2')
            ->where('initialQuery.box_type_id', '3')
            ->where('initialQuery.area_id', '1')
            ->where('initialQuery.province', 'Metro Manila')
        );
    }

    public function test_bot_honeypot_trap_silently_redirects(): void
    {
        $response = $this->post(route('guest.bookings.store'), [
            'website' => 'http://spam-bot-trap.com',
            'first_name' => 'Spam',
            'last_name' => 'Bot',
            'email' => 'bot@spam.com',
            'mobile' => '0412345678',
        ]);

        $response->assertRedirect(route('guest.book'));
        $this->assertDatabaseMissing('senders', ['email' => 'bot@spam.com']);
    }

    public function test_guest_booking_validation_errors(): void
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
            'boxes',
        ]);
    }

    public function test_guest_cannot_book_with_existing_registered_user_email(): void
    {
        $registeredUser = User::factory()->create([
            'email' => 'registered.user@example.com',
            'role' => Role::Sender,
        ]);

        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);
        $boxType = BoxType::firstOrCreate(['name' => 'Jumbo'], ['dimensions' => '24x24x24', 'is_active' => true]);
        $province = Province::firstOrCreate(['name' => 'Metro Manila'], ['area_id' => $area->id, 'is_active' => true]);
        $pickupZone = PickupZone::firstOrCreate([], ['name' => 'Zone 1', 'is_active' => true]);

        $payload = [
            'first_name' => 'Impostor',
            'last_name' => 'Guest',
            'email' => $registeredUser->email,
            'mobile' => '0412 345 678',
            'address' => '123 Fake Street',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $pickupZone->id,
            'preferred_date' => now()->addDays(3)->format('Y-m-d'),
            'booking_type' => 'home_pickup',
            'boxes' => [
                [
                    'recipient_first_name' => 'Juan',
                    'recipient_last_name' => 'Dela Cruz',
                    'recipient_phone' => '0917 123 4567',
                    'recipient_address' => '456 Rizal Ave',
                    'recipient_city' => 'Manila',
                    'recipient_province' => $province->name,
                    'area_id' => $area->id,
                    'box_type_id' => $boxType->id,
                ],
            ],
        ];

        $response = $this->post(route('guest.bookings.store'), $payload);

        $response->assertSessionHasErrors(['email']);
    }

    public function test_guest_can_successfully_create_booking(): void
    {
        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);
        $boxType = BoxType::firstOrCreate(['name' => 'Jumbo'], ['dimensions' => '24x24x24', 'is_active' => true]);
        $province = Province::firstOrCreate(['name' => 'Metro Manila'], ['area_id' => $area->id, 'is_active' => true]);
        $pickupZone = PickupZone::firstOrCreate([], ['name' => 'Zone 1', 'is_active' => true]);

        $payload = [
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'maria.santos@example.com',
            'mobile' => '0412 345 678',
            'address' => '123 George Street',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $pickupZone->id,
            'preferred_date' => now()->addDays(3)->format('Y-m-d'),
            'booking_type' => 'home_pickup',
            'payment_method' => 'cash_on_pickup',
            'notes' => 'Ring the intercom buzzer.',
            'boxes' => [
                [
                    'recipient_first_name' => 'Juan',
                    'recipient_last_name' => 'Dela Cruz',
                    'recipient_phone' => '0917 123 4567',
                    'recipient_address' => '456 Rizal Ave',
                    'recipient_city' => 'Manila',
                    'recipient_province' => $province->name,
                    'area_id' => $area->id,
                    'box_type_id' => $boxType->id,
                    'is_custom_size' => false,
                ],
            ],
        ];

        $response = $this->post(route('guest.bookings.store'), $payload);

        $sender = Sender::where('email', 'maria.santos@example.com')->first();
        $this->assertNotNull($sender);
        $this->assertNull($sender->user_id);

        $booking = Booking::where('sender_id', $sender->id)->first();
        $this->assertNotNull($booking);
        $this->assertTrue($booking->is_guest);
        $this->assertNotNull($booking->guest_token);
        $this->assertCount(1, $booking->boxes);

        $response->assertRedirect();
        $this->assertStringContainsString('/guest/booking/'.$booking->id.'/confirmed', $response->headers->get('Location'));
    }

    public function test_guest_confirmation_screen_requires_valid_signed_link(): void
    {
        $booking = Booking::factory()->create(['is_guest' => true]);

        $this->get(route('guest.booking.confirmed', ['booking' => $booking]))->assertForbidden();

        $access = app(GuestBookingAccessService::class);
        $response = $this->get($access->confirmationUrl($booking));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('guest/BookingConfirmed')
            ->where('booking.id', $booking->id)
            ->where('token', null)
            ->missing('booking.guest_token')
        );
    }

    public function test_guest_can_open_payment_page_after_email_verification(): void
    {
        $booking = Booking::factory()->pending()->create([
            'is_guest' => true,
        ]);
        Box::factory()->for($booking)->create(['price_charged' => 100]);

        $access = app(GuestBookingAccessService::class);
        $verificationUrl = $access->verificationUrl($booking, GuestBookingAccessService::PAYMENT);
        $this->get($verificationUrl)->assertOk();
        $this->setChallengeCode($booking, GuestBookingAccessService::PAYMENT);
        $query = parse_url($verificationUrl, PHP_URL_QUERY);
        $response = $this->post('/guest/booking/'.$booking->id.'/verify?'.$query, ['code' => '123456']);

        $response->assertRedirect();
        $response = $this->get($response->headers->get('Location'));
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('payment/PaymentConsole')
            ->where('role', 'guest')
            ->where('guestAccessQuery', fn ($query) => is_string($query))
            ->missing('booking.guest_token'));
    }

    public function test_guest_payment_page_requires_valid_token(): void
    {
        $booking = Booking::factory()->pending()->create(['is_guest' => true]);

        $this->get(route('guest.bookings.pay', ['booking' => $booking]))->assertForbidden();
    }

    public function test_user_registration_auto_links_guest_sender_and_bookings(): void
    {
        $guestEmail = 'ofw.shopper@example.com';

        // 1. Guest books prior to registration
        $guestSender = Sender::factory()->create([
            'email' => $guestEmail,
            'user_id' => null,
            'first_name' => 'Grace',
            'last_name' => 'Reyes',
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $guestSender->id,
            'is_guest' => true,
        ]);

        // 2. User registers using CreateNewUser action (Fortify registration)
        $action = new CreateNewUser();
        $user = $action->create([
            'name' => 'Grace Reyes',
            'email' => $guestEmail,
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'role' => Role::Sender->value,
            'address' => '789 Pitt St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'mobile' => '0412999888',
        ]);

        // 3. Verify sender record is now linked to user
        $guestSender->refresh();
        $this->assertEquals($user->id, $guestSender->user_id);

        // 4. Verify user sender relationship sees the past booking
        $this->assertCount(1, $user->sender->bookings);
        $this->assertEquals($booking->id, $user->sender->bookings->first()->id);
    }

    public function test_existing_user_login_auto_links_guest_bookings(): void
    {
        $email = 'existing.sender@example.com';

        // 1. Existing registered user with sender profile
        $user = User::factory()->create([
            'email' => $email,
            'role' => Role::Sender,
        ]);
        $existingSender = $user->sender;

        // 2. Booking created as a guest while logged out
        $guestSender = Sender::factory()->create([
            'user_id' => null,
            'email' => $email,
        ]);
        $booking = Booking::factory()->create([
            'sender_id' => $guestSender->id,
            'is_guest' => true,
        ]);

        // 3. User logs in
        event(new \Illuminate\Auth\Events\Login('web', $user, false));

        // 4. Verify guest booking is linked to user's sender profile
        $this->assertSoftDeleted('senders', ['id' => $guestSender->id]);
        $booking->refresh();
        $this->assertEquals($existingSender->id, $booking->sender_id);
        $this->assertTrue($user->fresh()->sender->bookings->contains('id', $booking->id));
    }

    public function test_customs_declaration_requires_email_verification(): void
    {
        $booking = Booking::factory()->create([
            'is_guest' => true,
        ]);

        $access = app(GuestBookingAccessService::class);
        $response = $this->get($access->verificationUrl($booking, GuestBookingAccessService::DECLARATION));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('guest/VerifyAccess'));
    }

    public function test_guest_can_submit_customs_declaration_after_email_verification(): void
    {
        $booking = Booking::factory()->create([
            'is_guest' => true,
        ]);

        $access = app(GuestBookingAccessService::class);
        $verificationUrl = $access->verificationUrl($booking, GuestBookingAccessService::DECLARATION);
        $this->get($verificationUrl)->assertOk();
        $this->setChallengeCode($booking, GuestBookingAccessService::DECLARATION);
        $query = parse_url($verificationUrl, PHP_URL_QUERY);
        $verifyResponse = $this->post('/guest/booking/'.$booking->id.'/verify?'.$query, ['code' => '123456']);
        $verifyResponse->assertRedirect();

        $declarationUrl = $verifyResponse->headers->get('Location');
        $declarationQuery = parse_url($declarationUrl, PHP_URL_QUERY);
        $declarationPayload = [
            'booking_id' => $booking->id,
            'declaration_data' => [
                'shipment' => [
                    'box_count' => '1',
                ],
                'sender' => [
                    'first_name' => 'Maria',
                    'last_name' => 'Santos',
                ],
                'boxes' => [
                    [
                        'box_index' => 0,
                        'items' => [
                            ['name' => 'Chocolates', 'description' => 'Chocolates & Sweets', 'qty' => 5, 'value' => 50],
                        ],
                    ],
                ],
                'certification' => [
                    'no_prohibited' => true,
                    'agree_terms' => true,
                    'signed_by' => 'Maria Santos',
                    'signature' => 'data:image/png;base64,sample',
                ],
            ],
        ];

        $response = $this->post(route('track.declaration.save').'?'.$declarationQuery, $declarationPayload);

        $response->assertRedirect();

        $booking->refresh();
        $this->assertNotNull($booking->declaration_data);
    }

    private function setChallengeCode(Booking $booking, string $purpose): void
    {
        GuestBookingAccessChallenge::query()
            ->where('booking_id', $booking->id)
            ->where('purpose', $purpose)
            ->latest('id')
            ->firstOrFail()
            ->update(['code_hash' => Hash::make('123456')]);
    }

    public function test_query_scopes_distinguish_guest_from_registered_bookings(): void
    {
        $registeredSender = Sender::factory()->create(['user_id' => User::factory()->create()->id]);
        $guestSender = Sender::factory()->create(['user_id' => null]);

        $registeredBooking = Booking::factory()->create([
            'sender_id' => $registeredSender->id,
            'is_guest' => false,
        ]);

        $guestBooking = Booking::factory()->create([
            'sender_id' => $guestSender->id,
            'is_guest' => true,
        ]);

        $guestBookings = Booking::guest()->pluck('id');
        $this->assertTrue($guestBookings->contains($guestBooking->id));
        $this->assertFalse($guestBookings->contains($registeredBooking->id));

        $registeredBookings = Booking::registered()->pluck('id');
        $this->assertTrue($registeredBookings->contains($registeredBooking->id));
        $this->assertFalse($registeredBookings->contains($guestBooking->id));
    }

    public function test_guest_can_initialize_booking_and_get_payment_data(): void
    {
        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);
        $boxType = BoxType::firstOrCreate(['name' => 'Jumbo'], ['dimensions' => '24x24x24', 'is_active' => true]);
        $pickupZone = PickupZone::firstOrCreate([], ['name' => 'Zone 1', 'is_active' => true]);
        BoxPrice::firstOrCreate(
            ['area_id' => $area->id, 'box_type_id' => $boxType->id],
            ['price' => 100.00, 'deposit' => 20.00, 'is_active' => true]
        );

        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john.doe@example.com',
            'mobile' => '0412345678',
            'address' => '123 Fake Street',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(5)->format('Y-m-d'),
            'pickup_zone_id' => $pickupZone->id,
            'boxes' => [
                [
                    'area_id' => $area->id,
                    'box_type_id' => $boxType->id,
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Doe',
                    'recipient_phone' => '09123456789',
                    'recipient_address' => '456 Sampaguita St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                ],
            ],
        ];

        $response = $this->postJson(route('guest.bookings.initialize'), $payload);

        $response->assertOk();
        $response->assertJsonStructure([
            'booking' => ['id', 'reference_number', 'sender', 'boxes'],
            'stripeKey',
        ]);

        $bookingId = $response->json('booking.id');
        $this->assertEquals($bookingId, session('guest_booking_id'));

        $booking = Booking::find($bookingId);
        $this->assertNotNull($booking);
        $this->assertTrue($booking->is_guest);
        $this->assertEquals('John', $booking->sender->first_name);
    }

    public function test_guest_can_upload_proof_of_payment_with_session(): void
    {
        Storage::fake('public');
        $booking = Booking::factory()->pending()->create(['is_guest' => true]);

        $file = UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf');

        $response = $this->withSession([
            'guest_booking_access.'.$booking->id.'.'.GuestBookingAccessService::PAYMENT => now()->addMinutes(120)->timestamp,
            'guest_booking_id' => $booking->id,
        ])->postJson("/guest/booking/{$booking->id}/upload-proof", [
            'proof_of_payment' => $file,
            'payment_reference' => 'PAY-REF-12345',
        ]);

        $response->assertOk();
        $booking->refresh();
        $this->assertNotNull($booking->proof_of_payment);
        $this->assertEquals('PAY-REF-12345', $booking->payment_reference);
    }
}

