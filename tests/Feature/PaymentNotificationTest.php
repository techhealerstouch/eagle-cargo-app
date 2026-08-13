<?php

namespace Tests\Feature;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Sender;
use App\Notifications\BookingPaymentReceived;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PaymentNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_sender_is_notified_when_booking_is_marked_paid(): void
    {
        Notification::fake();

        [$sender, $booking, $invoice] = $this->createPendingBookingWithInvoice(120.00);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 120.00,
            'payment_method' => 'bank_transfer',
            'reference_number' => 'PAY-001',
            'paid_at' => now(),
        ]);

        $this->assertEquals(PaymentStatus::Paid, $booking->fresh()->payment_status);

        Notification::assertSentTo(
            $sender,
            BookingPaymentReceived::class,
            function (BookingPaymentReceived $notification) use ($sender, $booking, $invoice): bool {
                $message = $notification->toMail($sender);

                $this->assertContains(
                    __('messages.notifications.booking_payment.line_copy_required'),
                    $message->introLines
                );

                $payload = $notification->toArray($sender);

                return $payload['booking_id'] === $booking->id
                    && $payload['invoice_id'] === $invoice->id;
            }
        );
    }

    public function test_sender_is_not_notified_for_unsettled_payment(): void
    {
        Notification::fake();

        [$sender, $booking, $invoice] = $this->createPendingBookingWithInvoice(120.00);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 120.00,
            'payment_method' => 'stripe_card',
            'reference_number' => 'pi_test_pending',
        ]);

        $this->assertEquals(PaymentStatus::Pending, $booking->fresh()->payment_status);
        $this->assertEquals(InvoiceStatus::Unpaid, $invoice->fresh()->status);
        Notification::assertNotSentTo($sender, BookingPaymentReceived::class);
    }

    public function test_sender_is_notified_when_booking_is_marked_paid_manually(): void
    {
        Notification::fake();

        [$sender, $booking] = $this->createPendingBookingWithInvoice(120.00);

        $booking->update(['payment_status' => PaymentStatus::Paid]);

        Notification::assertSentTo($sender, BookingPaymentReceived::class);
    }

    /**
     * @return array{Sender, Booking, Invoice}
     */
    private function createPendingBookingWithInvoice(float $amount): array
    {
        $sender = Sender::factory()->create();

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => 'pending',
            'payment_status' => 'pending',
        ]);

        $invoice = Invoice::withoutEvents(function () use ($booking, $amount) {
            return Invoice::create([
                'booking_id' => $booking->id,
                'invoice_number' => 'INV-TEST-'.$booking->id,
                'amount' => $amount,
                'status' => InvoiceStatus::Unpaid,
            ]);
        });

        return [$sender, $booking, $invoice];
    }
}
