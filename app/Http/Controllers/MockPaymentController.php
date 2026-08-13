<?php

namespace App\Http\Controllers;

use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\PaymentService;

class MockPaymentController extends Controller
{
    public function __construct(
        private readonly PaymentService $paymentService
    ) {}

    /**
     * Simulate a successful payment for a booking.
     */
    public function simulate(Booking $booking)
    {
        // Only allow in local/staging environments
        if (! app()->environment('local', 'testing')) {
            return back()->with('error', 'Mock payments are only available in development.');
        }
        if ($booking->payment_status === PaymentStatus::Paid) {
            return redirect()->route('sender.bookings')->with('success', 'This booking has already been paid.');
        }

        try {
            $this->paymentService->recordPayment([
                'amount' => $booking->total_price ?? $booking->boxes->sum('price_charged'),
                'payment_method' => 'mock_card',
                'reference_number' => 'MOCK-'.strtoupper(bin2hex(random_bytes(4))),
                'paid_at' => now(),
                'stripe_status' => 'succeeded',
            ], $booking);

            return redirect()->route('sender.bookings')->with('success', 'MOCK PAYMENT SUCCESSFUL: Your booking is now paid.');
        } catch (\Exception $e) {
            return back()->with('error', 'Mock payment failed: '.$e->getMessage());
        }
    }
}
