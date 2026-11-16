<?php

namespace Tests\Feature\Sender;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Sender;
use App\Models\User;
use App\Notifications\BookingStatusChanged;
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
        $response->assertInertia(fn ($page) => $page
            ->component('sender/OrderBoxes')
            ->where('isGuest', true)
        );
    }

    public function test_guest_validation_requires_contact_identity_fields(): void
    {
        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );

        $response = $this->post(route('sender.order-boxes.store'), [
            'address' => '123 Guest St',
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

    public function test_guest_can_submit_empty_box_order_without_logging_in(): void
    {
        Notification::fake();

        $boxType = BoxType::firstOrCreate(
            ['name' => 'Standard Balikbayan Box'],
            ['dimensions' => '50x50x50', 'is_active' => true]
        );

        $email = 'guest-box-'.uniqid('', true).'@example.com';

        $response = $this->post(route('sender.order-boxes.store'), [
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => $email,
            'address' => '789 Harbor Ave',
            'suburb' => 'Arundel',
            'state' => 'QLD',
            'postcode' => '4214',
            'contact_number' => '0405998800',
            'delivery_date' => now()->addDays(3)->toDateString(),
            'payment_method' => 'bank_transfer',
            'items' => [
                [
                    'box_type_id' => $boxType->id,
                    'quantity' => 3,
                ],
            ],
        ]);

        $sender = Sender::where('email', $email)->whereNull('user_id')->first();
        $this->assertNotNull($sender);

        $booking = Booking::where('sender_id', $sender->id)
            ->where('empty_box_count', 3)
            ->latest('id')
            ->first();

        $this->assertNotNull($booking);
        $this->assertTrue((bool) $booking->is_guest);
        $this->assertNotEmpty($booking->guest_token);

        $response->assertRedirect(route('sender.order-boxes', ['confirmed' => $booking->reference_number]));
        $response->assertSessionHas('success');

        $invoice = Invoice::where('booking_id', $booking->id)->first();
        $this->assertNotNull($invoice);
        $this->assertEquals(30.00, (float) $invoice->amount);

        Notification::assertSentTo($sender, BookingStatusChanged::class);
    }

    public function test_authenticated_sender_can_access_order_boxes_page(): void
    {
        $user = User::factory()->create(['role' => Role::Sender]);

        $response = $this->actingAs($user)->get(route('sender.order-boxes'));

        $response->assertOk();
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
}
