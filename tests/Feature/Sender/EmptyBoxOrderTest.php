<?php

namespace Tests\Feature\Sender;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Sender;
use App\Models\User;
use App\Notifications\BookingStatusChanged;
use App\Repositories\Eloquent\TrackingRepository;
use App\Services\PaymentService;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
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

        $response->assertRedirect(route('sender.order-boxes', ['confirmed' => $booking->reference_number]));
        $response->assertSessionHas('success');

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

        // Assert session has guest_booking_id
        $response->assertSessionHas('guest_booking_id', $booking->id);

        // Assert redirected to signed guest payment URL
        $redirectUrl = $response->headers->get('Location');
        $this->assertNotNull($redirectUrl);
        $this->assertStringContainsString("/guest/booking/{$booking->id}/pay", $redirectUrl);
        $this->assertStringContainsString('signature=', $redirectUrl);

        // Verify guest can access payment console via redirected URL
        $paymentResponse = $this->get($redirectUrl);
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
}
