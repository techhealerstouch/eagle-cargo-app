<?php

namespace App\Http\Controllers;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\PaymentIntent;
use Stripe\Stripe;
use Stripe\Webhook;

class StripePaymentController extends Controller
{
    private $paymentService;

    public function __construct(PaymentService $paymentService)
    {
        $this->paymentService = $paymentService;
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    /**
     * Create a Stripe PaymentIntent for a booking.
     */
    public function createIntent(Request $request, Booking $booking)
    {
        if ($this->hasStripeModeMismatch()) {
            Log::error('Stripe configuration mode mismatch detected while creating intent.', [
                'stripe_key_prefix' => substr((string) config('services.stripe.key'), 0, 8),
                'stripe_secret_prefix' => substr((string) config('services.stripe.secret'), 0, 8),
            ]);

            return response()->json([
                'error' => 'Payment gateway configuration mismatch. Please contact support.',
            ], 500);
        }

        // Authorization: Ensure the authenticated user owns the booking
        $user = $request->user();
        if (! $user->sender || $booking->sender_id != $user->sender->id) {
            abort(403, 'Unauthorized.');
        }

        // Guard: Do not allow payment for cancelled/voided bookings
        if (in_array($booking->status, [BookingStatus::Cancelled])) {
            abort(422, 'This booking has been cancelled and cannot be paid.');
        }

        if ($booking->payment_status === PaymentStatus::Paid) {
            return response()->json([
                'alreadyPaid' => true,
                'status' => 'succeeded',
            ]);
        }

        // Guard: Do not allow payment for voided invoices
        if ($booking->invoices()->where('status', InvoiceStatus::Voided->value)->exists()) {
            abort(422, 'The invoice for this booking has been voided.');
        }

        $forceNew = $request->boolean('force_new');

        try {
            $paymentIntent = $this->paymentService->createPaymentIntent($booking, $forceNew);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Could not initialize Stripe: '.$e->getMessage(),
            ], 500);
        }

        // Guard: Stripe may return a cached succeeded intent via idempotency
        if ($paymentIntent->status === 'succeeded') {
            return response()->json([
                'alreadyPaid' => true,
                'status' => 'succeeded',
            ]);
        }

        return response()->json([
            'clientSecret' => $paymentIntent->client_secret,
        ]);
    }

    /**
     * Verify a payment status after frontend confirmation.
     * Use this as a fast-track alternative to waiting for webhooks.
     */
    public function verifyPayment(Request $request, Booking $booking)
    {
        $user = $request->user();
        if (! $user->sender || $booking->sender_id != $user->sender->id) {
            abort(403, 'Unauthorized.');
        }

        $paymentIntentId = $request->input('payment_intent');

        if (! $paymentIntentId) {
            return response()->json(['error' => 'Missing payment_intent ID'], 400);
        }

        try {
            $paymentIntent = PaymentIntent::retrieve($paymentIntentId);

            if ($paymentIntent->status === 'succeeded') {
                $this->paymentService->handleSuccessfulPayment($paymentIntent);

                return response()->json([
                    'status' => 'paid',
                    'booking_id' => $booking->id,
                ]);
            }

            return response()->json([
                'status' => $paymentIntent->status,
                'booking_id' => $booking->id,
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Handle payment success callback/webhook.
     */
    public function webhook(Request $request)
    {
        $payload = $request->getContent();
        $sig_header = $request->header('Stripe-Signature');
        $endpoint_secret = config('services.stripe.webhook_secret');

        try {
            $event = Webhook::constructEvent(
                $payload, $sig_header, $endpoint_secret
            );
        } catch (\UnexpectedValueException $e) {
            return response()->json(['error' => 'Invalid payload'], 400);
        } catch (SignatureVerificationException $e) {
            return response()->json(['error' => 'Invalid signature'], 400);
        }

        if ($event->type === 'payment_intent.succeeded') {
            $paymentIntent = $event->data->object;
            $this->paymentService->handleSuccessfulPayment($paymentIntent);
        }

        return response()->json(['status' => 'success']);
    }

    private function hasStripeModeMismatch(): bool
    {
        $publishable = (string) config('services.stripe.key');
        $secret = (string) config('services.stripe.secret');

        $publishableMode = $this->stripeKeyMode($publishable);
        $secretMode = $this->stripeKeyMode($secret);

        if (! $publishableMode || ! $secretMode) {
            return false;
        }

        return $publishableMode !== $secretMode;
    }

    private function stripeKeyMode(string $key): ?string
    {
        if (str_contains($key, '_test_')) {
            return 'test';
        }

        if (str_contains($key, '_live_')) {
            return 'live';
        }

        return null;
    }
}
