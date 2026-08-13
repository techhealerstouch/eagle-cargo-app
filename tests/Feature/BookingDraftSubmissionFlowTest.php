<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Jobs\NotifyAdminOfNewBooking;
use App\Jobs\SendBookingConfirmationMail;
use App\Models\Area;
use App\Models\Booking;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Sender;
use App\Models\User;
use App\Notifications\BookingStatusChanged;
use App\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class BookingDraftSubmissionFlowTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Sender $sender;

    protected Area $area;

    protected BoxType $boxType;

    protected BoxPrice $boxPrice;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test user
        $this->user = User::factory()->create([
            'role' => Role::Sender,
            'email' => 'test@example.com',
        ]);

        // Fetch the automatically created sender (via UserObserver) and update its details
        $this->sender = $this->user->sender;
        $this->sender->update([
            'email' => 'test@example.com',
            'first_name' => 'John',
            'last_name' => 'Doe',
            'mobile' => '+61400000000',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
        ]);

        // Create area
        $this->area = Area::factory()->create([
            'name' => 'Metro Manila',
            'is_active' => true,
        ]);

        // Create box type
        $this->boxType = BoxType::factory()->create([
            'name' => 'Standard Box',
            'is_active' => true,
        ]);

        // Create box price
        $this->boxPrice = BoxPrice::factory()->create([
            'area_id' => $this->area->id,
            'box_type_id' => $this->boxType->id,
            'price' => 100.00,
        ]);
    }

#[Test]
    public function it_can_save_a_draft_booking()
    {
        $this->actingAs($this->user);

        $draftData = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'test@example.com',
            'mobile' => '+61400000000',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d\TH:i'),
            'payment_method' => 'stripe',
            'notes' => 'Test notes',
            'boxes' => [
                [
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Smith',
                    'recipient_email' => 'jane@example.com',
                    'recipient_address' => '456 Manila St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '+639123456789',
                    'recipient_landmarks' => 'Near the church',
                    'area_id' => $this->area->id,
                    'box_type_id' => $this->boxType->id,
                ],
            ],
        ];

        $response = $this->postJson('/bookings/draft', $draftData);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'success',
                'draft_id',
                'message',
            ]);

        // Verify draft was created
        $this->assertDatabaseHas('bookings', [
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Draft->value,
        ]);

        $draft = Booking::where('sender_id', $this->sender->id)
            ->where('status', BookingStatus::Draft)
            ->first();

        $this->assertNotNull($draft);
        $this->assertStringStartsWith('BK-', $draft->reference_number);
        $this->assertStringContainsString('<!--DRAFT_DATA-->', $draft->notes);
    }

#[Test]
    public function it_can_submit_a_draft_booking()
    {
        Queue::fake();
        Notification::fake();

        $this->actingAs($this->user);

        // First, create a draft
        $draft = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Draft,
            'notes' => '<!--DRAFT_DATA-->{"boxes":[]}',
        ]);

        $submissionData = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'test@example.com',
            'mobile' => '+61400000000',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d\TH:i'),
            'payment_method' => 'stripe',
            'notes' => 'Final notes',
            'boxes' => [
                [
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Smith',
                    'recipient_email' => 'jane@example.com',
                    'recipient_address' => '456 Manila St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '+639123456789',
                    'recipient_landmarks' => 'Near the church',
                    'area_id' => $this->area->id,
                    'box_type_id' => $this->boxType->id,
                ],
            ],
        ];

        $response = $this->post("/bookings/{$draft->id}/submit-draft", $submissionData);

        $response->assertRedirect();

        // Verify booking status changed to Pending
        $draft->refresh();
        $this->assertEquals(BookingStatus::Pending, $draft->status);
        $this->assertNotNull($draft->reference_number);
        $this->assertStringStartsWith('BK-', $draft->reference_number);

        // Verify boxes were created
        $this->assertCount(1, $draft->boxes);
        $box = $draft->boxes->first();
        $this->assertNotNull($box->tracking_number);
        $this->assertNotNull($box->recipient);

        // Verify notifications were queued
        Queue::assertPushed(SendBookingConfirmationMail::class);
        Queue::assertPushed(NotifyAdminOfNewBooking::class);
    }

#[Test]
    public function it_shows_submitted_booking_in_sender_dashboard()
    {
        $this->actingAs($this->user);

        // Create a submitted booking (Pending status)
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
        ]);

        $booking->boxes()->create([
            'recipient_id' => $this->sender->recipients()->create([
                'area_id' => $this->area->id,
                'name' => 'Jane Smith',
                'email' => 'jane@example.com',
                'phone_number' => '+639123456789',
                'address' => '456 Manila St',
                'city' => 'Manila',
                'province' => 'Metro Manila',
                'zip_code' => '1000',
            ])->id,
            'box_type_id' => $this->boxType->id,
            'price_charged' => 100.00,
        ]);

        $response = $this->get('/bookings');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('sender/Bookings')
            ->has('history.data', 1)
            ->where('history.data.0.id', $booking->id)
            ->where('history.data.0.status', BookingStatus::Pending->value)
        );
    }

    #[Test]
    public function sender_bookings_are_paginated()
    {
        Booking::factory()->count(12)->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
        ]);

        $this->actingAs($this->user)
            ->get('/bookings')
            ->assertInertia(fn ($page) => $page
                ->component('sender/Bookings')
                ->has('history.data', 10)
                ->where('history.total', 12)
                ->where('history.per_page', 10)
            );
    }

#[Test]
    public function it_shows_submitted_booking_in_admin_dashboard()
    {
        // Create admin user
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $this->actingAs($admin);

        // Create a submitted booking (Pending status)
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
        ]);

        $booking->boxes()->create([
            'recipient_id' => $this->sender->recipients()->create([
                'area_id' => $this->area->id,
                'name' => 'Jane Smith',
                'email' => 'jane@example.com',
                'phone_number' => '+639123456789',
                'address' => '456 Manila St',
                'city' => 'Manila',
                'province' => 'Metro Manila',
                'zip_code' => '1000',
            ])->id,
            'box_type_id' => $this->boxType->id,
            'price_charged' => 100.00,
        ]);

        $response = $this->get('/admin/bookings');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('admin/bookings/index')
            ->has('bookings.data', 1)
            ->where('bookings.data.0.id', $booking->id)
            ->where('bookings.data.0.status', BookingStatus::Pending->value)
        );
    }

#[Test]
    public function it_does_not_show_draft_bookings_in_admin_dashboard()
    {
        // Create admin user
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $this->actingAs($admin);

        // Create a draft booking
        Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Draft,
        ]);

        // Create a pending booking
        $pendingBooking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
        ]);

        $response = $this->get('/admin/bookings');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('admin/bookings/index')
            ->has('bookings.data', 1) // Only pending booking
            ->where('bookings.data.0.id', $pendingBooking->id)
        );
    }

#[Test]
    public function it_can_save_declaration_data_for_pending_booking()
    {
        $this->actingAs($this->user);

        // Create a pending booking
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'declaration_form_status' => 'missing',
        ]);

        $booking->boxes()->create([
            'recipient_id' => $this->sender->recipients()->create([
                'area_id' => $this->area->id,
                'name' => 'Jane Smith',
                'email' => 'jane@example.com',
                'phone_number' => '+639123456789',
                'address' => '456 Manila St',
                'city' => 'Manila',
                'province' => 'Metro Manila',
                'zip_code' => '1000',
            ])->id,
            'box_type_id' => $this->boxType->id,
            'price_charged' => 100.00,
        ]);

        $declarationData = [
            'booking_id' => $booking->id,
            'declaration_data' => [
                'items' => [
                    ['description' => 'Clothes', 'quantity' => 10, 'value' => 500],
                    ['description' => 'Food', 'quantity' => 5, 'value' => 200],
                ],
                'total_value' => 700,
            ],
        ];

        $response = $this->post('/track/declaration', $declarationData);

        $response->assertRedirect('/dashboard');
        $response->assertSessionHas('success');

        // Verify declaration was saved
        $booking->refresh();
        $this->assertEquals('submitted_online', $booking->declaration_form_status);
        $this->assertNotNull($booking->declaration_data);
        $this->assertIsArray($booking->declaration_data);
        $this->assertEquals(700, $booking->declaration_data['total_value']);
    }

#[Test]
    public function it_allows_admin_to_accept_booking_without_declaration()
    {
        // Create admin user
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $this->actingAs($admin);

        Notification::fake();

        // Create a pending booking without declaration
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'declaration_form_status' => 'missing',
        ]);

        $booking->boxes()->create([
            'recipient_id' => $this->sender->recipients()->create([
                'area_id' => $this->area->id,
                'name' => 'Jane Smith',
                'email' => 'jane@example.com',
                'phone_number' => '+639123456789',
                'address' => '456 Manila St',
                'city' => 'Manila',
                'province' => 'Metro Manila',
                'zip_code' => '1000',
            ])->id,
            'box_type_id' => $this->boxType->id,
            'price_charged' => 100.00,
        ]);

        $response = $this->post("/admin/bookings/{$booking->id}/accept", [
            'admin_notes' => 'Accepted without declaration',
        ]);

        $response->assertRedirect('/admin/bookings');
        $response->assertSessionHas('success');

        // Verify booking status changed to Confirmed
        $booking->refresh();
        $this->assertEquals(BookingStatus::Confirmed, $booking->status);
        $this->assertNotNull($booking->confirmed_at);

        // Verify invoice was generated
        $this->assertDatabaseHas('invoices', [
            'booking_id' => $booking->id,
        ]);

        // Verify notification was sent
        Notification::assertSentTo(
            $this->user,
            BookingStatusChanged::class
        );
    }

#[Test]
    public function it_can_accept_booking_with_declaration_and_generates_invoice()
    {
        // Create admin user
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $this->actingAs($admin);

        Notification::fake();

        // Create a pending booking with declaration
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'declaration_form_status' => 'submitted_online',
            'declaration_data' => ['items' => []],
        ]);

        $booking->boxes()->create([
            'recipient_id' => $this->sender->recipients()->create([
                'area_id' => $this->area->id,
                'name' => 'Jane Smith',
                'email' => 'jane@example.com',
                'phone_number' => '+639123456789',
                'address' => '456 Manila St',
                'city' => 'Manila',
                'province' => 'Metro Manila',
                'zip_code' => '1000',
            ])->id,
            'box_type_id' => $this->boxType->id,
            'price_charged' => 100.00,
        ]);

        $response = $this->post("/admin/bookings/{$booking->id}/accept", [
            'admin_notes' => 'Approved',
        ]);

        $response->assertRedirect('/admin/bookings');
        $response->assertSessionHas('success');

        // Verify booking status changed to Confirmed
        $booking->refresh();
        $this->assertEquals(BookingStatus::Confirmed, $booking->status);
        $this->assertNotNull($booking->confirmed_at);

        // Verify invoice was generated
        $this->assertDatabaseHas('invoices', [
            'booking_id' => $booking->id,
        ]);

        $invoice = Invoice::where('booking_id', $booking->id)->first();
        $this->assertNotNull($invoice);
        $this->assertNotNull($invoice->invoice_number);

        // Verify notification was sent
        Notification::assertSentTo(
            $this->user,
            BookingStatusChanged::class
        );
    }

#[Test]
    public function it_shows_booking_requiring_declaration_in_dashboard()
    {
        $this->actingAs($this->user);

        // Create a pending booking without declaration
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Paid,
            'declaration_form_status' => 'missing',
            'declaration_data' => null,
            'declaration_form_path' => null,
        ]);

        $booking->boxes()->create([
            'recipient_id' => $this->sender->recipients()->create([
                'area_id' => $this->area->id,
                'name' => 'Jane Smith',
                'email' => 'jane@example.com',
                'phone_number' => '+639123456789',
                'address' => '456 Manila St',
                'city' => 'Manila',
                'province' => 'Metro Manila',
                'zip_code' => '1000',
            ])->id,
            'box_type_id' => $this->boxType->id,
            'price_charged' => 100.00,
        ]);

        $response = $this->get('/dashboard');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('sender/Dashboard')
            ->has('bookingsRequiringAction', 1)
            ->where('bookingsRequiringAction.0.id', $booking->id)
            ->where('bookingsRequiringAction.0.reason', 'Missing Declaration Form')
        );
    }

#[Test]
    public function complete_flow_from_draft_to_confirmed()
    {
        Queue::fake();
        Notification::fake();

        $this->actingAs($this->user);

        // Step 1: Save draft
        $draftData = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'test@example.com',
            'mobile' => '+61400000000',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d\TH:i'),
            'payment_method' => 'stripe',
            'notes' => 'Test notes',
            'boxes' => [
                [
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Smith',
                    'recipient_email' => 'jane@example.com',
                    'recipient_address' => '456 Manila St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '+639123456789',
                    'recipient_landmarks' => 'Near the church',
                    'area_id' => $this->area->id,
                    'box_type_id' => $this->boxType->id,
                ],
            ],
        ];

        $draftResponse = $this->postJson('/bookings/draft', $draftData);
        $draftResponse->assertStatus(200);
        $draftId = $draftResponse->json('draft_id');

        // Step 2: Submit draft
        $submitResponse = $this->post("/bookings/{$draftId}/submit-draft", $draftData);
        $submitResponse->assertRedirect();

        $booking = Booking::find($draftId);
        $this->assertEquals(BookingStatus::Pending, $booking->status);
        $this->assertCount(1, $booking->boxes);

        // Step 3: Submit declaration
        $declarationData = [
            'booking_id' => $booking->id,
            'declaration_data' => [
                'items' => [
                    ['description' => 'Clothes', 'quantity' => 10, 'value' => 500],
                ],
                'total_value' => 500,
            ],
        ];

        $declarationResponse = $this->post('/track/declaration', $declarationData);
        $declarationResponse->assertRedirect('/dashboard');

        $booking->refresh();
        $this->assertEquals('submitted_online', $booking->declaration_form_status);

        // Step 4: Verify booking is visible in sender dashboard
        $senderDashboard = $this->get('/bookings');
        $senderDashboard->assertStatus(200);
        $senderDashboard->assertInertia(fn ($page) => $page
            ->has('history.data', 1)
            ->where('history.data.0.id', $booking->id)
        );

        // Step 5: Admin accepts booking
        $admin = User::factory()->create(['role' => Role::Admin]);
        $this->actingAs($admin);

        $acceptResponse = $this->post("/admin/bookings/{$booking->id}/accept");
        $acceptResponse->assertRedirect('/admin/bookings');

        $booking->refresh();
        $this->assertEquals(BookingStatus::Confirmed, $booking->status);
        $this->assertNotNull($booking->confirmed_at);

        // Step 6: Verify invoice was generated
        $invoice = Invoice::where('booking_id', $booking->id)->first();
        $this->assertNotNull($invoice);
        $this->assertNotNull($invoice->invoice_number);

        // Step 7: Verify booking is visible in admin dashboard
        $adminDashboard = $this->get('/admin/bookings');
        $adminDashboard->assertStatus(200);
        $adminDashboard->assertInertia(fn ($page) => $page
            ->has('bookings.data', 1)
            ->where('bookings.data.0.id', $booking->id)
            ->where('bookings.data.0.status', BookingStatus::Confirmed->value)
        );
    }

#[Test]
    public function it_promotes_draft_booking_on_payment_initialization()
    {
        $this->actingAs($this->user);

        // Create a draft
        $draft = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Draft,
            'notes' => '<!--DRAFT_DATA-->{"boxes":[]}',
        ]);

        $initializationData = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'test@example.com',
            'mobile' => '+61400000000',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d\TH:i'),
            'payment_method' => 'stripe',
            'notes' => 'Test notes',
            'draft_id' => $draft->id,
            'boxes' => [
                [
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Smith',
                    'recipient_email' => 'jane@example.com',
                    'recipient_address' => '456 Manila St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '+639123456789',
                    'recipient_landmarks' => 'Near the church',
                    'area_id' => $this->area->id,
                    'box_type_id' => $this->boxType->id,
                ],
            ],
        ];

        $response = $this->postJson('/bookings/initialize', $initializationData);

        $response->assertStatus(200);

        // Verify draft was promoted and updated instead of creating a new booking
        $draft->refresh();
        $this->assertEquals(BookingStatus::Pending, $draft->status);
        $this->assertCount(1, $draft->boxes);
        $this->assertEquals(1, Booking::where('sender_id', $this->sender->id)->count());
    }

    #[Test]
    public function retrying_after_stripe_initialization_failure_reuses_the_created_booking()
    {
        $this->actingAs($this->user);

        $paymentService = $this->mock(PaymentService::class);
        $paymentService->shouldReceive('createPaymentIntent')
            ->twice()
            ->andThrow(new \RuntimeException('Stripe is unavailable'));

        $initializationData = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'test@example.com',
            'mobile' => '+61400000000',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d\TH:i'),
            'payment_method' => 'stripe',
            'boxes' => [
                [
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Smith',
                    'recipient_email' => 'jane@example.com',
                    'recipient_address' => '456 Manila St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '+639123456789',
                    'area_id' => $this->area->id,
                    'box_type_id' => $this->boxType->id,
                ],
            ],
        ];

        $firstResponse = $this->postJson('/bookings/initialize', $initializationData);

        $firstResponse->assertStatus(500)
            ->assertJsonPath('error', 'Could not initialize Stripe: Stripe is unavailable')
            ->assertJsonStructure(['booking_id']);

        $bookingId = $firstResponse->json('booking_id');

        $secondResponse = $this->postJson('/bookings/initialize', [
            ...$initializationData,
            'booking_id' => $bookingId,
        ]);

        $secondResponse->assertStatus(500)
            ->assertJsonPath('booking_id', $bookingId);

        $this->assertSame(1, Booking::where('sender_id', $this->sender->id)->count());
    }
}
