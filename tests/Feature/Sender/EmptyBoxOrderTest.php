<?php

namespace Tests\Feature\Sender;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Jobs\SendBookingConfirmationMail;
use App\Models\Area;
use App\Models\Booking;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\DataIntegrityWarning;
use App\Models\GuestBookingAccessChallenge;
use App\Models\Invoice;
use App\Models\PickupZone;
use App\Models\Sender;
use App\Models\User;
use App\Notifications\BookingStatusChanged;
use App\Repositories\Eloquent\TrackingRepository;
use App\Services\DataIntegrityService;
use App\Services\PaymentService;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class EmptyBoxOrderTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_guest_can_access_order_boxes_page(): void
    {
        $response = $this->get(route('sender.order-boxes'));
        $response->assertOk();

        // Also test guest redirect alias
        $redirectResponse = $this->get('/guest/order-boxes');
        $redirectResponse->assertRedirect('/order-boxes');
    }

    public function test_authenticated_sender_can_access_order_boxes_page(): void
    {
        $user = User::factory()->create(['role' => Role::Sender]);

        $response = $this->actingAs($user)->get(route('sender.order-boxes'));

        $response->assertOk();
    }

    public function test_guest_order_requires_name_and_email(): void
    {
        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );

        $response = $this->post(route('sender.order-boxes.store'), [
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'contact_number' => '0405998800',
            'delivery_date' => now()->addDays(2)->toDateString(),
            'payment_method' => 'cash_on_pickup',
            'items' => [
                [
                    'box_type_id' => $boxType->id,
                    'quantity' => 1,
                ],
            ],
        ]);

        $response->assertSessionHasErrors(['first_name', 'last_name', 'email']);
    }

    public function test_validation_fails_when_total_boxes_ordered_is_zero(): void
    {
        $user = User::factory()->create(['role' => Role::Sender]);
        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );

        $response = $this->actingAs($user)->post(route('sender.order-boxes.store'), [
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'contact_number' => '0405998800',
            'delivery_date' => now()->addDays(2)->toDateString(),
            'payment_method' => 'cash_on_pickup',
            'items' => [
                [
                    'box_type_id' => $boxType->id,
                    'quantity' => 0,
                ],
            ],
        ]);

        $response->assertSessionHasErrors('items');
    }

    public function test_guest_can_successfully_order_empty_boxes_and_is_redirected_with_confirmation(): void
    {
        Notification::fake();

        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );

        $deliveryDate = now()->addDays(3)->toDateString();

        $response = $this->post(route('sender.order-boxes.store'), [
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'maria.santos.guest@example.com',
            'address' => '12 Sunshine Blvd',
            'suburb' => 'Blacktown',
            'state' => 'NSW',
            'postcode' => '2148',
            'contact_number' => '0412345678',
            'delivery_date' => $deliveryDate,
            'payment_method' => 'cash_on_pickup',
            'delivery_notes' => 'Please leave behind gate if unattended.',
            'items' => [
                [
                    'box_type_id' => $boxType->id,
                    'quantity' => 3,
                ],
            ],
        ]);

        // Find guest sender
        $sender = Sender::where('email', 'maria.santos.guest@example.com')
            ->whereNull('user_id')
            ->first();
        $this->assertNotNull($sender);
        $this->assertEquals('Maria', $sender->first_name);
        $this->assertEquals('Santos', $sender->last_name);

        // Find booking
        $booking = Booking::where('sender_id', $sender->id)
            ->where('empty_box_count', 3)
            ->latest('id')
            ->first();
        $this->assertNotNull($booking);
        $this->assertTrue((bool) $booking->is_guest);
        $this->assertNotNull($booking->guest_token);
        $this->assertEquals(BookingStatus::Pending, $booking->status);
        $this->assertEquals(PaymentStatus::CashOnPickup, $booking->payment_status);
        $this->assertEquals(3, $booking->empty_box_count);
        $this->assertEquals(10.00, (float) $booking->empty_box_fee);

        $response->assertRedirect();
        $redirectUrl = $response->headers->get('Location');
        $this->assertNotNull($redirectUrl);
        $this->assertStringContainsString("/guest/booking/{$booking->id}/verify", $redirectUrl);
        $this->assertStringContainsString('purpose=confirmation', $redirectUrl);

        // Step 1: Visiting verify URL sends OTP challenge and loads VerifyAccess
        $this->get($redirectUrl)
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('guest/VerifyAccess')->where('purpose', 'confirmation'));

        $challenge = GuestBookingAccessChallenge::where('booking_id', $booking->id)
            ->where('purpose', 'confirmation')
            ->latest('id')
            ->first();
        $this->assertNotNull($challenge);

        // Set known OTP and submit verification code
        $challenge->update(['code_hash' => Hash::make('123456')]);
        $verifyQuery = parse_url($redirectUrl, PHP_URL_QUERY);
        $verifyResponse = $this->post("/guest/booking/{$booking->id}/verify?{$verifyQuery}", [
            'code' => '123456',
        ]);

        $verifyResponse->assertRedirect();
        $confirmedUrl = $verifyResponse->headers->get('Location');
        $this->assertNotNull($confirmedUrl);
        $this->assertStringContainsString("/guest/booking/{$booking->id}/confirmed", $confirmedUrl);

        $this->get($confirmedUrl)
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('guest/BookingConfirmed')->where('booking.id', $booking->id));

        // Verify invoice was generated for 3 * $10 = $30
        $invoice = Invoice::where('booking_id', $booking->id)->first();
        $this->assertNotNull($invoice);
        $this->assertEquals(30.00, (float) $invoice->amount);

        // Verify notification dispatched to guest sender
        Notification::assertSentTo($sender, BookingStatusChanged::class);
    }

    public function test_sender_can_successfully_order_empty_boxes_and_invoice_is_generated(): void
    {
        Notification::fake();

        $user = User::factory()->create(['role' => Role::Sender]);
        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );

        $deliveryDate = now()->addDays(3)->toDateString();

        $response = $this->actingAs($user)->post(route('sender.order-boxes.store'), [
            'address' => '456 Kangaloon Rd',
            'suburb' => 'Bowral',
            'state' => 'NSW',
            'postcode' => '2576',
            'contact_number' => '0405998800',
            'delivery_date' => $deliveryDate,
            'payment_method' => 'cash_on_pickup',
            'delivery_notes' => 'Please leave near the porch if not home.',
            'items' => [
                [
                    'box_type_id' => $boxType->id,
                    'quantity' => 2,
                ],
            ],
        ]);

        $response->assertRedirect(route('sender.bookings'));
        $response->assertSessionHas('success');

        $user->refresh();
        $sender = $user->sender;
        $this->assertNotNull($sender);

        // Verify booking created
        $booking = Booking::where('sender_id', $sender->id)
            ->where('empty_box_count', 2)
            ->latest('id')
            ->first();

        $this->assertNotNull($booking);
        $this->assertEquals(BookingStatus::Pending, $booking->status);
        $this->assertEquals(PaymentStatus::CashOnPickup, $booking->payment_status);
        $this->assertEquals('cash_on_pickup', $booking->payment_method);
        $this->assertEquals(2, $booking->empty_box_count);
        $this->assertEquals(10.00, (float) $booking->empty_box_fee);
        $this->assertStringContainsString('2x Standard Balikbayan Box', $booking->notes);
        $this->assertStringContainsString('Please leave near the porch', $booking->notes);

        // Verify invoice was generated
        $invoice = Invoice::where('booking_id', $booking->id)->first();
        $this->assertNotNull($invoice);
        $this->assertEquals(20.00, (float) $invoice->amount);

        // Verify notification dispatched to user
        Notification::assertSentTo($user, BookingStatusChanged::class);
    }

    public function test_empty_box_order_is_trackable_via_reference_number(): void
    {
        $sender = Sender::factory()->create([
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'suburb' => 'Parramatta',
            'state' => 'NSW',
            'postcode' => '2150',
        ]);

        $booking = Booking::create([
            'sender_id' => $sender->id,
            'booking_type' => 'home_pickup',
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
            'payment_method' => 'cash_on_pickup',
            'preferred_date' => now()->addDays(4)->toDateString(),
            'empty_box_count' => 4,
            'empty_box_fee' => 10.00,
            'notes' => 'Empty Box Delivery Order',
            'is_guest' => true,
        ]);

        $trackingRepo = app(TrackingRepository::class);
        $data = $trackingRepo->getTrackingData($booking->reference_number);

        $this->assertNotNull($data);
        $this->assertTrue($data['is_empty_box_order']);
        $this->assertEquals(4, $data['empty_box_count']);
        $this->assertEquals('not_required', $data['declaration_form_status']);
        $this->assertEquals($booking->reference_number, $data['tracking_number']);
    }

    public function test_empty_box_orders_appear_in_sender_dashboard_without_declaration_warning(): void
    {
        $user = User::factory()->create(['role' => Role::Sender]);
        $sender = $user->sender ?? Sender::where('user_id', $user->id)->first();

        $booking = Booking::create([
            'sender_id' => $sender->id,
            'booking_type' => 'home_pickup',
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::CashOnPickup,
            'payment_method' => 'cash_on_pickup',
            'preferred_date' => now()->addDays(2)->toDateString(),
            'empty_box_count' => 2,
            'empty_box_fee' => 10.00,
            'notes' => 'Empty box order',
        ]);

        $response = $this->actingAs($user)->get(route('dashboard'));
        $response->assertOk();

        // Verify inertia props
        $page = $response->viewData('page');
        $this->assertNotNull($page);

        // Standalone empty box orders must not be flagged as missing declaration
        $actions = collect($page['props']['bookingsRequiringAction'] ?? []);
        $missingDeclActions = $actions->where('id', $booking->id)->where('type', 'declaration');
        $this->assertCount(0, $missingDeclActions);

        // Booking must appear in history
        $history = collect($page['props']['history'] ?? []);
        $this->assertTrue($history->contains('id', $booking->id));
    }

    public function test_guest_empty_box_order_with_stripe_redirects_to_guest_payment_portal(): void
    {
        Notification::fake();

        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );

        $deliveryDate = now()->addDays(3)->toDateString();

        $response = $this->post(route('sender.order-boxes.store'), [
            'first_name' => 'Stripe',
            'last_name' => 'Guest',
            'email' => 'stripe.guest@example.com',
            'address' => '789 Ocean Way',
            'suburb' => 'Manly',
            'state' => 'NSW',
            'postcode' => '2095',
            'contact_number' => '0405112233',
            'delivery_date' => $deliveryDate,
            'payment_method' => 'stripe',
            'items' => [
                [
                    'box_type_id' => $boxType->id,
                    'quantity' => 2,
                ],
            ],
        ]);

        $booking = Booking::where('empty_box_count', 2)->latest('id')->first();
        $this->assertNotNull($booking);
        $this->assertEquals(PaymentStatus::Pending, $booking->payment_status);
        $this->assertEquals('stripe', $booking->payment_method);

        // Assert redirected to signed guest OTP verification URL with purpose=payment
        $redirectUrl = $response->headers->get('Location');
        $this->assertNotNull($redirectUrl);
        $this->assertStringContainsString("/guest/booking/{$booking->id}/verify", $redirectUrl);
        $this->assertStringContainsString('purpose=payment', $redirectUrl);
        $this->assertStringContainsString('signature=', $redirectUrl);

        // Visiting verify URL triggers OTP challenge and shows VerifyAccess
        $this->get($redirectUrl)
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('guest/VerifyAccess')->where('purpose', 'payment'));

        // Verify resend=1 stays signature-valid and returns clean accessQuery
        $this->get($redirectUrl.'&resend=1')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('guest/VerifyAccess')
                ->where('accessQuery', fn ($q) => is_string($q) && ! str_contains($q, 'resend='))
            );

        $challenge = GuestBookingAccessChallenge::where('booking_id', $booking->id)
            ->where('purpose', 'payment')
            ->active()
            ->latest('id')
            ->first();
        $this->assertNotNull($challenge);

        // Verify 6-digit OTP code redirects to payment portal
        $challenge->update(['code_hash' => Hash::make('123456')]);
        $verifyQuery = parse_url($redirectUrl, PHP_URL_QUERY);
        $verifyResponse = $this->post("/guest/booking/{$booking->id}/verify?{$verifyQuery}", [
            'code' => '123456',
        ]);

        $verifyResponse->assertSessionHas('guest_booking_id', $booking->id);
        $paymentUrl = $verifyResponse->headers->get('Location');
        $this->assertNotNull($paymentUrl);
        $this->assertStringContainsString("/guest/booking/{$booking->id}/pay", $paymentUrl);

        // Verify guest can access payment console via verified URL
        $paymentResponse = $this->get($paymentUrl);
        $paymentResponse->assertOk();
        $page = $paymentResponse->viewData('page');
        $this->assertEquals('payment/PaymentConsole', $page['component']);
        $this->assertEquals(20.00, (float) $page['props']['invoice']['amount']);
    }

    public function test_authenticated_sender_empty_box_order_with_stripe_redirects_to_bookings_pay(): void
    {
        $user = User::factory()->create(['role' => Role::Sender]);
        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );

        $deliveryDate = now()->addDays(3)->toDateString();

        $response = $this->actingAs($user)->post(route('sender.order-boxes.store'), [
            'address' => '100 George St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'contact_number' => '0405887766',
            'delivery_date' => $deliveryDate,
            'payment_method' => 'stripe',
            'items' => [
                [
                    'box_type_id' => $boxType->id,
                    'quantity' => 3,
                ],
            ],
        ]);

        $booking = Booking::where('empty_box_count', 3)->latest('id')->first();
        $this->assertNotNull($booking);
        $this->assertEquals(PaymentStatus::Pending, $booking->payment_status);
        $this->assertEquals('stripe', $booking->payment_method);

        // Assert redirected to route('bookings.pay', $booking->id)
        $response->assertRedirect(route('bookings.pay', $booking->id));

        // Verify authenticated user can access payment console
        $paymentResponse = $this->actingAs($user)->get(route('bookings.pay', $booking->id));
        $paymentResponse->assertOk();
        $page = $paymentResponse->viewData('page');
        $this->assertEquals('payment/PaymentConsole', $page['component']);
        $this->assertEquals(30.00, (float) $page['props']['invoice']['amount']);
    }

    public function test_empty_box_order_full_payment_settlement_lifecycle(): void
    {
        $user = User::factory()->create(['role' => Role::Sender]);
        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );

        $this->actingAs($user)->post(route('sender.order-boxes.store'), [
            'address' => '200 Pitt St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'contact_number' => '0405112233',
            'delivery_date' => now()->addDays(3)->toDateString(),
            'payment_method' => 'stripe',
            'items' => [
                ['box_type_id' => $boxType->id, 'quantity' => 2],
            ],
        ]);

        $booking = Booking::where('empty_box_count', 2)->latest('id')->firstOrFail();
        $invoice = $booking->invoice;
        $this->assertNotNull($invoice);
        $this->assertEquals(20.00, (float) $invoice->amount);
        $this->assertEquals(PaymentStatus::Pending, $booking->payment_status);

        // Simulate successful Stripe card settlement via PaymentService
        app(PaymentService::class)->recordPayment([
            'amount' => 20.00,
            'payment_method' => 'stripe_card',
            'stripe_payment_intent_id' => 'pi_test_empty_box_'.uniqid(),
            'stripe_status' => 'succeeded',
            'paid_at' => now(),
            'idempotency_key' => 'stripe_test_'.uniqid(),
        ], $booking, $invoice);

        $this->assertEquals(InvoiceStatus::Paid, $invoice->fresh()->status);
        $this->assertEquals(PaymentStatus::Paid, $booking->fresh()->payment_status);

        // Visiting pay route now safely redirects with already paid success message
        $response = $this->actingAs($user)->get(route('bookings.pay', $booking->id));
        $response->assertRedirect(route('sender.bookings'));
        $response->assertSessionHas('success', 'This booking has already been paid.');
    }

    public function test_guest_cannot_order_empty_boxes_with_existing_registered_user_email(): void
    {
        User::factory()->create([
            'email' => 'registered.sender@example.com',
            'role' => Role::Sender,
        ]);

        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );

        $response = $this->post(route('sender.order-boxes.store'), [
            'first_name' => 'Impostor',
            'last_name' => 'Guest',
            'email' => 'registered.sender@example.com',
            'address' => '123 Fake St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'contact_number' => '0412345678',
            'delivery_date' => now()->addDays(2)->toDateString(),
            'payment_method' => 'stripe',
            'items' => [
                [
                    'box_type_id' => $boxType->id,
                    'quantity' => 1,
                ],
            ],
        ]);

        $response->assertSessionHasErrors(['email']);
    }

    public function test_empty_box_order_stores_structured_items_breakdown(): void
    {
        $user = User::factory()->create(['role' => Role::Sender]);
        $boxType = BoxType::firstOrCreate(
            ['name' => 'Jumbo Balikbayan Box'],
            ['dimensions' => '73x43x43', 'is_active' => true]
        );

        $this->actingAs($user)->post(route('sender.order-boxes.store'), [
            'address' => '100 George St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'contact_number' => '0405112233',
            'delivery_date' => now()->addDays(3)->toDateString(),
            'payment_method' => 'cash_on_pickup',
            'items' => [
                ['box_type_id' => $boxType->id, 'quantity' => 2],
            ],
        ]);

        $booking = Booking::where('sender_id', $user->sender?->id)->latest('id')->firstOrFail();
        $this->assertIsArray($booking->empty_box_items);
        $this->assertCount(1, $booking->empty_box_items);
        $this->assertEquals($boxType->id, $booking->empty_box_items[0]['box_type_id']);
        $this->assertEquals(2, $booking->empty_box_items[0]['quantity']);
        $this->assertEquals('Jumbo Balikbayan Box', $booking->empty_box_items[0]['name']);
        $this->assertEquals('73x43x43', $booking->empty_box_items[0]['dimensions']);
    }

    public function test_sender_can_convert_paid_empty_box_order_into_cargo_booking_with_deposit_credit(): void
    {
        $user = User::factory()->create(['role' => Role::Sender]);
        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );
        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['code' => 'MNL', 'is_active' => true]);
        $zone = PickupZone::firstOrCreate(['name' => 'Sydney Metro'], ['code' => 'SYD_METRO', 'is_active' => true]);
        BoxPrice::firstOrCreate(
            ['pickup_zone_id' => $zone->id, 'area_id' => $area->id, 'box_type_id' => $boxType->id],
            ['price' => 120.00]
        );

        // 1. Create empty box order (2 boxes = $20)
        $this->actingAs($user)->post(route('sender.order-boxes.store'), [
            'address' => '250 Queen St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'contact_number' => '0405112233',
            'delivery_date' => now()->addDays(3)->toDateString(),
            'payment_method' => 'cash_on_pickup',
            'items' => [
                ['box_type_id' => $boxType->id, 'quantity' => 2],
            ],
        ]);

        $emptyOrder = Booking::where('empty_box_count', 2)->latest('id')->firstOrFail();
        // Mark as paid/collected
        $emptyOrder->update([
            'status' => BookingStatus::Collected,
            'payment_status' => PaymentStatus::Paid,
        ]);

        // 2. Sender creates cargo booking referencing the empty box order
        $response = $this->actingAs($user)->post(route('bookings.store'), [
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'email' => $user->email,
            'mobile' => '0405112233',
            'address' => '250 Queen St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $zone->id,
            'payment_method' => 'stripe',
            'booking_type' => 'home_pickup',
            'preferred_date' => now()->addDays(5)->toDateTimeString(),
            'source_empty_box_booking_id' => $emptyOrder->id,
            'boxes' => [
                [
                    'box_type_id' => $boxType->id,
                    'area_id' => $area->id,
                    'recipient_first_name' => 'Rosa',
                    'recipient_last_name' => 'Dela Cruz',
                    'recipient_phone' => '09171234567',
                    'recipient_address' => '123 Rizal St',
                    'recipient_province' => 'Metro Manila',
                    'recipient_city' => 'Manila',
                    'recipient_zip_code' => '1000',
                    'price_charged' => 120.00,
                ],
                [
                    'box_type_id' => $boxType->id,
                    'area_id' => $area->id,
                    'recipient_first_name' => 'Rosa',
                    'recipient_last_name' => 'Dela Cruz',
                    'recipient_phone' => '09171234567',
                    'recipient_address' => '123 Rizal St',
                    'recipient_province' => 'Metro Manila',
                    'recipient_city' => 'Manila',
                    'recipient_zip_code' => '1000',
                    'price_charged' => 120.00,
                ],
            ],
        ]);

        $cargoBooking = Booking::where('source_empty_box_booking_id', $emptyOrder->id)->latest('id')->firstOrFail();
        $this->assertEquals(20.00, (float) $cargoBooking->empty_box_deposit_credit);
        $this->assertEquals($emptyOrder->id, $cargoBooking->source_empty_box_booking_id);

        // Verify that the empty order shows convertedCargoBooking
        $this->assertEquals($cargoBooking->id, $emptyOrder->fresh()->convertedCargoBooking?->id);

        // Verify invoice deducted the $20 credit (2 boxes * 120 - 20 = 220)
        if ($cargoBooking->invoice) {
            $this->assertEquals(220.00, (float) $cargoBooking->invoice->amount);
        }
    }

    public function test_sender_can_book_pack_first_mode_without_pickup_date_and_schedule_later(): void
    {
        $user = User::factory()->create(['role' => Role::Sender]);
        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );
        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['code' => 'MNL', 'is_active' => true]);
        $zone = PickupZone::firstOrCreate(['name' => 'Sydney Metro'], ['code' => 'SYD_METRO', 'is_active' => true]);
        BoxPrice::firstOrCreate(
            ['pickup_zone_id' => $zone->id, 'area_id' => $area->id, 'box_type_id' => $boxType->id],
            ['price' => 120.00]
        );

        // 1. Create booking in pack-first mode (is_ready_for_pickup = false, preferred_date = null)
        $response = $this->actingAs($user)->post(route('bookings.store'), [
            'first_name' => 'Pedro',
            'last_name' => 'Penduko',
            'email' => $user->email,
            'mobile' => '0405112233',
            'address' => '88 King St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $zone->id,
            'payment_method' => 'stripe',
            'booking_type' => 'home_pickup',
            'is_ready_for_pickup' => false,
            'preferred_date' => null,
            'boxes' => [
                [
                    'box_type_id' => $boxType->id,
                    'area_id' => $area->id,
                    'recipient_first_name' => 'Maria',
                    'recipient_last_name' => 'Penduko',
                    'recipient_phone' => '09171234567',
                    'recipient_address' => '456 Mabini St',
                    'recipient_province' => 'Metro Manila',
                    'recipient_city' => 'Manila',
                    'recipient_zip_code' => '1000',
                    'price_charged' => 120.00,
                ],
            ],
        ]);

        $booking = Booking::where('sender_id', $user->sender?->id)->latest('id')->firstOrFail();
        $this->assertFalse((bool) $booking->is_ready_for_pickup);
        $this->assertNull($booking->preferred_date);

        // 2. Schedule pickup once packed
        $pickupDate = now()->addDays(6)->toDateString();
        $scheduleResponse = $this->actingAs($user)->post(route('bookings.schedule-pickup', $booking->id), [
            'preferred_date' => $pickupDate,
            'pickup_notes' => 'Boxes packed and sealed on ground floor.',
        ]);

        $scheduleResponse->assertRedirect();
        $scheduleResponse->assertSessionHas('success');

        $booking->refresh();
        $this->assertTrue((bool) $booking->is_ready_for_pickup);
        $this->assertNotNull($booking->preferred_date);
        $this->assertStringContainsString('Boxes packed and sealed', (string) $booking->notes);
    }

    public function test_data_integrity_detects_and_resolves_unreturned_empty_boxes(): void
    {
        $user = User::factory()->create(['role' => Role::Sender]);
        $sender = Sender::firstOrCreate(
            ['email' => $user->email],
            [
                'first_name' => 'Test',
                'last_name' => 'Sender',
                'mobile' => '0405112233',
                'address' => '100 Test Way',
                'suburb' => 'Sydney',
                'state' => 'NSW',
                'postcode' => '2000',
                'user_id' => $user->id,
            ]
        );

        $emptyOrder = Booking::create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-TEST-UNRETURNED',
            'status' => BookingStatus::Delivered,
            'payment_status' => PaymentStatus::Paid,
            'payment_method' => 'stripe',
            'empty_box_count' => 3,
            'empty_box_fee' => 10.00,
            'booking_type' => 'home_pickup',
            'is_ready_for_pickup' => true,
            'created_at' => now()->subDays(65),
            'updated_at' => now()->subDays(65),
        ]);

        DB::table('bookings')->where('id', $emptyOrder->id)->update([
            'created_at' => now()->subDays(65),
            'updated_at' => now()->subDays(65),
        ]);

        // Run data integrity audit
        $auditResults = app(DataIntegrityService::class)->performAudit();
        $this->assertGreaterThanOrEqual(1, $auditResults['unreturned_empty_box']);

        $warning = DataIntegrityWarning::where('type', 'unreturned_empty_box')
            ->where('record_id', $emptyOrder->id)
            ->where('is_resolved', false)
            ->first();
        $this->assertNotNull($warning);

        // Now convert it to a cargo booking
        Booking::create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-TEST-CONVERTED',
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
            'payment_method' => 'stripe',
            'source_empty_box_booking_id' => $emptyOrder->id,
            'empty_box_deposit_credit' => 30.00,
            'booking_type' => 'home_pickup',
            'is_ready_for_pickup' => true,
        ]);

        // Run audit again - warning should resolve
        app(DataIntegrityService::class)->cleanupResolvedWarnings();

        $warning->refresh();
        $this->assertTrue((bool) $warning->is_resolved);
    }

    public function test_empty_box_deposit_credit_guards_ownership_eligibility_and_double_redemption(): void
    {
        $owner = User::factory()->create(['role' => Role::Sender]);
        $attacker = User::factory()->create(['role' => Role::Sender]);
        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );
        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['code' => 'MNL', 'is_active' => true]);
        $zone = PickupZone::firstOrCreate(['name' => 'Sydney Metro'], ['code' => 'SYD_METRO', 'is_active' => true]);
        BoxPrice::firstOrCreate(
            ['pickup_zone_id' => $zone->id, 'area_id' => $area->id, 'box_type_id' => $boxType->id],
            ['price' => 120.00]
        );

        // 1. Owner creates an empty box order, still pending and unpaid
        $this->actingAs($owner)->post(route('sender.order-boxes.store'), [
            'address' => '10 Owner St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'contact_number' => '0405112233',
            'delivery_date' => now()->addDays(3)->toDateString(),
            'payment_method' => 'stripe',
            'items' => [
                ['box_type_id' => $boxType->id, 'quantity' => 2],
            ],
        ]);

        $unpaidOrder = Booking::where('empty_box_count', 2)->latest('id')->firstOrFail();

        // 2. Attacker tries to claim owner's empty box order -> blocked
        $this->actingAs($attacker)->post(route('bookings.store'), [
            'first_name' => 'Attacker',
            'last_name' => 'User',
            'email' => $attacker->email,
            'mobile' => '0405999888',
            'address' => '99 Attacker Ave',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $zone->id,
            'payment_method' => 'stripe',
            'booking_type' => 'home_pickup',
            'preferred_date' => now()->addDays(5)->toDateTimeString(),
            'source_empty_box_booking_id' => $unpaidOrder->id,
            'boxes' => [[
                'box_type_id' => $boxType->id,
                'area_id' => $area->id,
                'recipient_first_name' => 'Test',
                'recipient_last_name' => 'Rec',
                'recipient_phone' => '09171234567',
                'recipient_address' => '1 Rizal St',
                'recipient_province' => 'Metro Manila',
                'recipient_city' => 'Manila',
                'recipient_zip_code' => '1000',
            ]],
        ]);

        $attackerBooking = Booking::where('sender_id', $attacker->sender?->id)->latest('id')->firstOrFail();
        $this->assertNull($attackerBooking->source_empty_box_booking_id);
        $this->assertEquals(0.00, (float) $attackerBooking->empty_box_deposit_credit);

        // 3. Owner converts unpaid empty box order -> links source ID, but deposit credit is $0.00
        $this->actingAs($owner)->post(route('bookings.store'), [
            'first_name' => 'Owner',
            'last_name' => 'User',
            'email' => $owner->email,
            'mobile' => '0405112233',
            'address' => '10 Owner St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $zone->id,
            'payment_method' => 'stripe',
            'booking_type' => 'home_pickup',
            'preferred_date' => now()->addDays(5)->toDateTimeString(),
            'source_empty_box_booking_id' => $unpaidOrder->id,
            'boxes' => [[
                'box_type_id' => $boxType->id,
                'area_id' => $area->id,
                'recipient_first_name' => 'Test',
                'recipient_last_name' => 'Rec',
                'recipient_phone' => '09171234567',
                'recipient_address' => '1 Rizal St',
                'recipient_province' => 'Metro Manila',
                'recipient_city' => 'Manila',
                'recipient_zip_code' => '1000',
            ]],
        ]);

        $ownerFirstConversion = Booking::where('sender_id', $owner->sender?->id)
            ->where('source_empty_box_booking_id', $unpaidOrder->id)
            ->latest('id')
            ->firstOrFail();
        $this->assertEquals(0.00, (float) $ownerFirstConversion->empty_box_deposit_credit);

        // 4. Attempting double redemption on the already converted empty box order fails
        $this->actingAs($owner)->post(route('bookings.store'), [
            'first_name' => 'Owner',
            'last_name' => 'User',
            'email' => $owner->email,
            'mobile' => '0405112233',
            'address' => '10 Owner St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $zone->id,
            'payment_method' => 'stripe',
            'booking_type' => 'home_pickup',
            'preferred_date' => now()->addDays(6)->toDateTimeString(),
            'source_empty_box_booking_id' => $unpaidOrder->id,
            'boxes' => [[
                'box_type_id' => $boxType->id,
                'area_id' => $area->id,
                'recipient_first_name' => 'Test',
                'recipient_last_name' => 'Rec',
                'recipient_phone' => '09171234567',
                'recipient_address' => '1 Rizal St',
                'recipient_province' => 'Metro Manila',
                'recipient_city' => 'Manila',
                'recipient_zip_code' => '1000',
            ]],
        ]);

        $ownerSecondBooking = Booking::where('sender_id', $owner->sender?->id)->latest('id')->firstOrFail();
        $this->assertNotEquals($ownerFirstConversion->id, $ownerSecondBooking->id);
        $this->assertNull($ownerSecondBooking->source_empty_box_booking_id);
        $this->assertEquals(0.00, (float) $ownerSecondBooking->empty_box_deposit_credit);
    }

    public function test_guest_book_from_empty_box_requires_authorization_to_prevent_pii_leak(): void
    {
        $sender = Sender::create([
            'first_name' => 'Private',
            'last_name' => 'Guest',
            'email' => 'private.guest@example.com',
            'mobile' => '0411222333',
            'address' => '42 Secret Rd',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
        ]);

        $guestEmptyOrder = Booking::create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-GUEST-PRIVATE',
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'payment_method' => 'stripe',
            'empty_box_count' => 2,
            'empty_box_fee' => 10.00,
            'booking_type' => 'home_pickup',
            'is_guest' => true,
            'guest_token' => 'secret-guest-token-123',
        ]);

        // Unauthenticated visitor without signed URL or session must NOT see emptyBoxSource PII
        $unauthResponse = $this->get(route('guest.book', ['from_empty_box' => $guestEmptyOrder->id]));
        $unauthResponse->assertOk();
        $unauthResponse->assertInertia(fn ($page) => $page->where('emptyBoxSource', null));

        // Signed URL DOes expose emptyBoxSource safely
        $signedUrl = URL::temporarySignedRoute('guest.book', now()->addDays(7), [
            'from_empty_box' => $guestEmptyOrder->id,
        ]);
        $signedResponse = $this->get($signedUrl);
        $signedResponse->assertOk();
        $signedResponse->assertInertia(fn ($page) => $page
            ->where('emptyBoxSource.id', $guestEmptyOrder->id)
            ->where('emptyBoxSource.sender.email', 'private.guest@example.com')
        );
    }

    public function test_guest_empty_box_order_dispatches_confirmation_mail(): void
    {
        Queue::fake();

        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );

        $response = $this->post(route('sender.order-boxes.store'), [
            'first_name' => 'Ana',
            'last_name' => 'Reyes',
            'email' => 'ana.reyes@example.com',
            'address' => '45 Queen St',
            'suburb' => 'Auburn',
            'state' => 'NSW',
            'postcode' => '2144',
            'contact_number' => '0412345678',
            'delivery_date' => now()->addDays(2)->toDateString(),
            'payment_method' => 'cash_on_pickup',
            'items' => [
                [
                    'box_type_id' => $boxType->id,
                    'quantity' => 2,
                ],
            ],
        ]);

        $response->assertRedirect();

        Queue::assertPushed(SendBookingConfirmationMail::class, function ($job) {
            return $job->booking->sender->email === 'ana.reyes@example.com'
                && (int) $job->booking->empty_box_count === 2;
        });
    }
}
