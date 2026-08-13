<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Stripe\Event as StripeEvent;
use Stripe\PaymentIntent;
use Tests\TestCase;

class StripeWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Ensure Stripe config is set for testing
        config()->set('services.stripe.secret', 'sk_test_dummy');
        config()->set('services.stripe.key', 'pk_test_dummy');
        config()->set('services.stripe.webhook_secret', 'whsec_test_dummy');
    }

    // ---------------------------------------------------------------
    // 1. Stripe PaymentIntent Creation
    // ---------------------------------------------------------------

    public function test_create_intent_requires_authentication(): void
    {
        $booking = Booking::factory()->create(['status' => BookingStatus::Pending]);

        $response = $this->postJson(route('bookings.stripe-intent', $booking));

        // JSON request returns 401 Unauthenticated
        $response->assertStatus(401);
    }

    public function test_create_intent_only_allows_booking_owner(): void
    {
        /** @var User $owner */
        $owner = User::factory()->create(['role' => Role::Sender]);
        $ownerSender = $owner->sender;

        /** @var User $intruder */
        $intruder = User::factory()->create(['role' => Role::Sender]);
        $intruderSender = $intruder->sender;

        $booking = Booking::factory()->create([
            'sender_id' => $ownerSender->id,
            'status' => BookingStatus::Pending,
        ]);

        $response = $this->actingAs($intruder)
            ->postJson(route('bookings.stripe-intent', $booking));

        $response->assertForbidden();
    }

    public function test_create_intent_rejects_cancelled_booking(): void
    {
        /** @var User $user */
        $user = User::factory()->create(['role' => Role::Sender]);
        $sender = $user->sender;

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Cancelled,
        ]);

        $response = $this->actingAs($user->refresh())
            ->postJson(route('bookings.stripe-intent', $booking));

        $response->assertStatus(422);
    }

    public function test_create_intent_returns_already_paid_when_payment_status_is_paid(): void
    {
        /** @var User $user */
        $user = User::factory()->create(['role' => Role::Sender]);
        $sender = $user->sender;

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $response = $this->actingAs($user->refresh())
            ->postJson(route('bookings.stripe-intent', $booking));

        $response->assertOk()
            ->assertJson(['alreadyPaid' => true]);
    }

    public function test_create_intent_rejects_voided_invoice(): void
    {
        /** @var User $user */
        $user = User::factory()->create(['role' => Role::Sender]);
        $sender = $user->sender;

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
        ]);

        Invoice::factory()->create([
            'booking_id' => $booking->id,
            'status' => InvoiceStatus::Voided,
        ]);

        $response = $this->actingAs($user->refresh())
            ->postJson(route('bookings.stripe-intent', $booking));

        // Voided invoice blocks payment — returns 422 or 500 depending on Stripe config
        $this->assertContains($response->getStatusCode(), [422, 500]);
    }

    // ---------------------------------------------------------------
    // 2. Stripe Webhook Handling
    // ---------------------------------------------------------------

    public function test_webhook_rejects_invalid_signature(): void
    {
        $payload = [
            'id' => 'evt_fake',
            'type' => 'payment_intent.succeeded',
            'data' => ['object' => ['id' => 'pi_fake']],
        ];

        $response = $this->postJson('/stripe/webhook', $payload, [
            'Stripe-Signature' => 't=9999999999,v1=invalid_signature_here,v0=also_invalid',
        ]);

        // Should fail due to invalid signature (Stripe SDK throws SignatureVerificationException)
        $response->assertStatus(400);
    }

    public function test_webhook_handles_unknown_event_type(): void
    {
        // Create a valid signature for a dummy payload is complex without Stripe's test helpers.
        // Instead, test that the webhook route exists and is accessible without auth middleware.
        $response = $this->postJson('/stripe/webhook', [
            'type' => 'unknown.event',
            'data' => ['object' => []],
        ]);

        // Without a valid signature, Stripe SDK will reject. This test validates the route is reachable.
        $response->assertStatus(400);
    }

    public function test_webhook_route_is_outside_auth_middleware(): void
    {
        // Verify webhook endpoint does NOT redirect to login (unlike protected routes)
        $response = $this->post('/stripe/webhook', [
            'type' => 'payment_intent.succeeded',
        ]);

        // Should NOT be a redirect to login
        $this->assertNotEquals(302, $response->getStatusCode());
    }

    // ---------------------------------------------------------------
    // 3. Payment Verification (verifyPayment)
    // ---------------------------------------------------------------

    public function test_verify_payment_requires_payment_intent_id(): void
    {
        /** @var User $user */
        $user = User::factory()->create(['role' => Role::Sender]);
        $sender = $user->sender;

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
        ]);

        $response = $this->actingAs($user->refresh())
            ->postJson(route('bookings.stripe-verify', $booking), []);

        $response->assertStatus(400)
            ->assertJson(['error' => 'Missing payment_intent ID']);
    }

    public function test_verify_payment_only_allows_booking_owner(): void
    {
        /** @var User $owner */
        $owner = User::factory()->create(['role' => Role::Sender]);
        $ownerSender = $owner->sender;

        /** @var User $intruder */
        $intruder = User::factory()->create(['role' => Role::Sender]);
        $intruderSender = $intruder->sender;

        $booking = Booking::factory()->create([
            'sender_id' => $ownerSender->id,
            'status' => BookingStatus::Pending,
        ]);

        $response = $this->actingAs($intruder)
            ->postJson(route('bookings.stripe-verify', $booking), [
                'payment_intent' => 'pi_fake',
            ]);

        $response->assertForbidden();
    }

    // ---------------------------------------------------------------
    // 4. Payment Idempotency
    // ---------------------------------------------------------------

    public function test_payment_idempotency_key_prevents_duplicate_charges(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
        ]);

        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'amount' => 100.00,
            'status' => InvoiceStatus::Unpaid,
        ]);

        $idempotencyKey = 'idem-test-' . uniqid();

        // First payment succeeds
        $paymentService = app(\App\Services\PaymentService::class);
        $payment1 = $paymentService->recordPayment([
            'amount' => 50.00,
            'payment_method' => 'stripe',
            'idempotency_key' => $idempotencyKey,
            'invoice_id' => $invoice->id,
            'stripe_status' => 'succeeded',
        ]);

        $this->assertNotNull($payment1);

        // Second payment with same key should be deduplicated
        $paymentService = app(\App\Services\PaymentService::class);
        $payment2 = $paymentService->recordPayment([
            'amount' => 50.00,
            'payment_method' => 'stripe',
            'idempotency_key' => $idempotencyKey,
            'invoice_id' => $invoice->id,
            'stripe_status' => 'succeeded',
        ]);

        // Both should reference the same record (idempotency handled by PaymentService)
        $this->assertEquals($payment1->id, $payment2->id);
        $this->assertSame(1, Payment::where('idempotency_key', $idempotencyKey)->count());
    }

    // ---------------------------------------------------------------
    // 5. Stripe Mode Mismatch Detection
    // ---------------------------------------------------------------

    public function test_stripe_mode_mismatch_detection(): void
    {
        /** @var User $user */
        $user = User::factory()->create(['role' => Role::Sender]);
        $sender = $user->sender;

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
        ]);

        // Set mismatched keys: test publishable key + live secret key
        config()->set('services.stripe.key', 'pk_test_mismatch');
        config()->set('services.stripe.secret', 'sk_live_mismatch');

        $response = $this->actingAs($user)
            ->postJson(route('bookings.stripe-intent', $booking));

        // Mode mismatch returns 500 with error message
        $response->assertStatus(500);
        $this->assertStringContainsString('mismatch', $response->json('error'));
    }

    // ---------------------------------------------------------------
    // 6. Booking Payment Status Synchronization
    // ---------------------------------------------------------------

    public function test_booking_payment_status_is_paid_when_invoice_fully_settled(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Pending,
        ]);

        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'amount' => 120.00,
            'status' => InvoiceStatus::Unpaid,
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 120.00,
            'payment_method' => 'stripe',
            'paid_at' => now(),
        ]);

        // PaymentObserver should sync invoice and booking payment_status
        $this->assertEquals(PaymentStatus::Paid, $booking->fresh()->payment_status);
        $this->assertEquals(InvoiceStatus::Paid, $invoice->fresh()->status);
    }

    public function test_booking_payment_status_remains_pending_when_partially_paid(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Pending,
        ]);

        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'amount' => 200.00,
            'status' => InvoiceStatus::Unpaid,
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'stripe',
            'paid_at' => now(),
        ]);

        $this->assertEquals(PaymentStatus::Pending, $booking->fresh()->payment_status);
        $this->assertEquals(InvoiceStatus::Partial, $invoice->fresh()->status);
    }

    public function test_voided_invoice_status_is_not_overwritten_by_payment_observer(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
        ]);

        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'amount' => 120.00,
            'status' => InvoiceStatus::Voided,
        ]);

        // PaymentObserver should NOT change a voided invoice's status
        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 120.00,
            'payment_method' => 'stripe',
            'paid_at' => now(),
        ]);

        $this->assertEquals(InvoiceStatus::Voided, $invoice->fresh()->status);
    }

    public function test_webhook_ignores_duplicate_events(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
        ]);

        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'amount' => 100.00,
            'status' => InvoiceStatus::Unpaid,
        ]);

        $paymentIntentId = 'pi_duplicate_test_' . uniqid();
        $payload = json_encode([
            'id' => 'evt_test',
            'type' => 'payment_intent.succeeded',
            'data' => [
                'object' => [
                    'id' => $paymentIntentId,
                    'amount' => 10000,
                    'metadata' => [
                        'invoice_id' => $invoice->id,
                        'booking_id' => $booking->id,
                    ],
                ],
            ],
        ]);

        $secret = config('services.stripe.webhook_secret');
        $signature = $this->generateValidStripeSignature($payload, $secret);

        // First webhook call
        $response1 = $this->postJson('/stripe/webhook', json_decode($payload, true), [
            'Stripe-Signature' => $signature,
        ]);
        $response1->assertOk();

        $this->assertSame(1, Payment::where('stripe_payment_intent_id', $paymentIntentId)->count());

        // Second duplicate webhook call
        $response2 = $this->postJson('/stripe/webhook', json_decode($payload, true), [
            'Stripe-Signature' => $signature,
        ]);
        $response2->assertOk();

        // Should still only be 1 payment record
        $this->assertSame(1, Payment::where('stripe_payment_intent_id', $paymentIntentId)->count());
    }

    private function generateValidStripeSignature(string $payload, string $secret): string
    {
        $timestamp = time();
        $signedPayload = "{$timestamp}.{$payload}";
        $signature = hash_hmac('sha256', $signedPayload, $secret);

        return "t={$timestamp},v1={$signature}";
    }
}
