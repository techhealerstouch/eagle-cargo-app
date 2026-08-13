<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Sender;
use App\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PaymentServiceGuardrailsTest extends TestCase
{
    use RefreshDatabase;

    public function test_record_payment_rejects_amount_above_outstanding_balance(): void
    {
        $invoice = $this->createInvoice(100.00, InvoiceStatus::Unpaid);
        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 60.00,
            'payment_method' => 'cash',
            'paid_at' => now(),
        ]);

        try {
            app(PaymentService::class)->recordPayment([
                'invoice_id' => $invoice->id,
                'amount' => 50.00,
                'payment_method' => 'cash',
                'idempotency_key' => 'guardrail-overpay',
            ]);
            $this->fail('Expected ValidationException was not thrown.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('amount', $exception->errors());
        }

        $this->assertSame(1, Payment::query()->where('invoice_id', $invoice->id)->count());
    }

    public function test_record_payment_rejects_voided_invoice(): void
    {
        $invoice = $this->createInvoice(80.00, InvoiceStatus::Voided);

        try {
            app(PaymentService::class)->recordPayment([
                'invoice_id' => $invoice->id,
                'amount' => 20.00,
                'payment_method' => 'cash',
                'idempotency_key' => 'guardrail-voided',
            ]);
            $this->fail('Expected ValidationException was not thrown.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('invoice_id', $exception->errors());
        }

        $this->assertSame(0, Payment::query()->where('invoice_id', $invoice->id)->count());
    }

    public function test_record_payment_rejects_cancelled_booking(): void
    {
        $invoice = $this->createInvoice(80.00, InvoiceStatus::Unpaid, BookingStatus::Cancelled);

        try {
            app(PaymentService::class)->recordPayment([
                'invoice_id' => $invoice->id,
                'amount' => 20.00,
                'payment_method' => 'cash',
                'idempotency_key' => 'guardrail-cancelled-booking',
            ]);
            $this->fail('Expected ValidationException was not thrown.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('booking_id', $exception->errors());
        }

        $this->assertSame(0, Payment::query()->where('invoice_id', $invoice->id)->count());
    }

    public function test_record_payment_rejects_paid_invoice(): void
    {
        $invoice = $this->createInvoice(40.00, InvoiceStatus::Paid);

        try {
            app(PaymentService::class)->recordPayment([
                'invoice_id' => $invoice->id,
                'amount' => 10.00,
                'payment_method' => 'cash',
                'idempotency_key' => 'guardrail-paid',
            ]);
            $this->fail('Expected ValidationException was not thrown.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('invoice_id', $exception->errors());
        }
    }

    public function test_record_payment_deduplicates_same_idempotency_key(): void
    {
        $invoice = $this->createInvoice(120.00, InvoiceStatus::Unpaid);
        $service = app(PaymentService::class);

        $first = $service->recordPayment([
            'invoice_id' => $invoice->id,
            'amount' => 25.00,
            'payment_method' => 'cash',
            'idempotency_key' => 'guardrail-duplicate-key',
        ]);

        $second = $service->recordPayment([
            'invoice_id' => $invoice->id,
            'amount' => 25.00,
            'payment_method' => 'cash',
            'idempotency_key' => 'guardrail-duplicate-key',
        ]);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, Payment::query()->where('invoice_id', $invoice->id)->count());
    }

    private function createInvoice(
        float $amount,
        InvoiceStatus $status,
        BookingStatus $bookingStatus = BookingStatus::Pending
    ): Invoice
    {
        $sender = Sender::factory()->create();

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => $bookingStatus,
            'payment_status' => PaymentStatus::Pending,
        ]);

        return Invoice::withoutEvents(function () use ($booking, $amount, $status) {
            return Invoice::create([
                'booking_id' => $booking->id,
                'invoice_number' => 'INV-GUARD-'.$booking->id,
                'amount' => $amount,
                'status' => $status,
            ]);
        });
    }
}
