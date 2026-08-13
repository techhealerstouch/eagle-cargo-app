<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class CashPaymentConfirmationTest extends TestCase
{
    use RefreshDatabase;

    protected function createInvoiceForTest(float $amount = 100.00, InvoiceStatus $status = InvoiceStatus::Unpaid, ?BookingStatus $bookingStatus = null): Invoice
    {
        $bookingStatus = $bookingStatus ?? BookingStatus::Confirmed;

        $booking = Booking::factory()->create([
            'status' => $bookingStatus,
            'payment_status' => PaymentStatus::Pending,
        ]);

        return Invoice::factory()->create([
            'booking_id' => $booking->id,
            'amount' => $amount,
            'status' => $status,
        ]);
    }

    // ---------------------------------------------------------------
    // 1. Cash Payment Recording
    // ---------------------------------------------------------------

    public function test_cash_payment_creates_pending_confirmation_when_recorded_by_non_admin(): void
    {
        Notification::fake();

        // Create admin users first so the notification has recipients
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin, 'email_verified_at' => now()]);
        User::factory()->create(['role' => Role::SuperAdmin, 'email_verified_at' => now()]);

        $invoice = $this->createInvoiceForTest(100.00);

        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker]);

        $this->actingAs($picker);

        $payment = app(PaymentService::class)->recordPayment([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'cash',
            'idempotency_key' => 'cash-test-1',
        ]);

        $this->assertTrue((bool) $payment->is_cash_payment);
        $this->assertNull($payment->confirmed_at); // Not auto-confirmed
        $this->assertTrue($payment->isPendingConfirmation());

        // Verify notification was sent to the admin
        Notification::assertSentTo(
            $admin,
            \App\Notifications\CashPaymentPendingConfirmation::class
        );
    }

    public function test_cash_payment_is_auto_confirmed_when_recorded_by_admin(): void
    {
        $invoice = $this->createInvoiceForTest(100.00);

        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);

        $this->actingAs($admin);

        $payment = app(PaymentService::class)->recordPayment([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'cash',
            'idempotency_key' => 'cash-admin-test',
        ]);

        $this->assertNotNull($payment->confirmed_at);
        $this->assertEquals($admin->id, $payment->confirmed_by);
        $this->assertTrue($payment->isSettled());
    }

    public function test_super_admin_cash_payment_is_auto_confirmed(): void
    {
        $invoice = $this->createInvoiceForTest(100.00);

        /** @var User $superAdmin */
        $superAdmin = User::factory()->create(['role' => Role::SuperAdmin]);

        $this->actingAs($superAdmin);

        $payment = app(PaymentService::class)->recordPayment([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'cash',
        ]);

        $this->assertNotNull($payment->confirmed_at);
        $this->assertTrue($payment->isSettled());
    }

    // ---------------------------------------------------------------
    // 2. Admin Confirmation/Rejection
    // ---------------------------------------------------------------

    public function test_admin_can_confirm_pending_cash_payment(): void
    {
        $invoice = $this->createInvoiceForTest(100.00);

        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'cash',
            'paid_at' => now(),
            'is_cash_payment' => true,
        ]);

        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin, 'email_verified_at' => now()]);

        $response = $this->actingAs($admin)
            ->post(route('admin.payments.confirm', $payment));

        $response->assertSessionHasNoErrors();

        $payment->refresh();
        $this->assertNotNull($payment->confirmed_at);
        $this->assertEquals($admin->id, $payment->confirmed_by);
        $this->assertTrue($payment->isSettled());

        // Invoice should now be paid
        $this->assertEquals(InvoiceStatus::Paid, $invoice->fresh()->status);
    }

    public function test_admin_can_reject_pending_cash_payment(): void
    {
        $invoice = $this->createInvoiceForTest(100.00);

        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'cash',
            'paid_at' => now(),
            'is_cash_payment' => true,
        ]);

        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin, 'email_verified_at' => now()]);

        $response = $this->actingAs($admin)
            ->post(route('admin.payments.reject', $payment));

        $response->assertSessionHasNoErrors();

        // Payment should remain unconfirmed (rejected doesn't delete, it just stays pending)
        $payment->refresh();
        $this->assertNull($payment->confirmed_at);
    }

    // ---------------------------------------------------------------
    // 3. Non-Cash Payments Are Auto-Settled
    // ---------------------------------------------------------------

    public function test_stripe_payment_is_settled_without_admin_confirmation(): void
    {
        $invoice = $this->createInvoiceForTest(100.00);

        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'stripe',
            'paid_at' => now(),
            'stripe_payment_intent_id' => 'pi_test_123',
            'is_cash_payment' => false,
        ]);

        $this->assertTrue($payment->isSettled());
        $this->assertEquals(InvoiceStatus::Paid, $invoice->fresh()->status);
    }

    public function test_bank_transfer_payment_is_settled_without_admin_confirmation(): void
    {
        $invoice = $this->createInvoiceForTest(100.00);

        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'bank_transfer',
            'paid_at' => now(),
            'is_cash_payment' => false,
        ]);

        $this->assertTrue($payment->isSettled());
    }

    // ---------------------------------------------------------------
    // 4. Payment Amount Validation
    // ---------------------------------------------------------------

    public function test_cannot_record_payment_exceeding_outstanding_balance(): void
    {
        $invoice = $this->createInvoiceForTest(50.00);

        $this->expectException(ValidationException::class);

        app(PaymentService::class)->recordPayment([
            'invoice_id' => $invoice->id,
            'amount' => 100.00, // More than the 50.00 invoice
            'payment_method' => 'cash',
            'idempotency_key' => 'overpay-test',
        ]);
    }

    public function test_cannot_record_payment_for_fully_paid_invoice(): void
    {
        $invoice = $this->createInvoiceForTest(100.00, InvoiceStatus::Paid);

        $this->expectException(ValidationException::class);

        app(PaymentService::class)->recordPayment([
            'invoice_id' => $invoice->id,
            'amount' => 10.00,
            'payment_method' => 'cash',
            'idempotency_key' => 'paid-invoice-test',
        ]);
    }

    // ---------------------------------------------------------------
    // 5. Full Cash Payment Convenience Method
    // ---------------------------------------------------------------

    public function test_record_full_cash_payment_creates_payment_for_entire_invoice(): void
    {
        $invoice = $this->createInvoiceForTest(150.00);

        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker]);
        $this->actingAs($picker);

        $payment = app(PaymentService::class)->recordFullCashPayment(
            $invoice->booking,
            $picker->id
        );

        $this->assertEqualsWithDelta(150.00, (float) $payment->amount, 0.01);
        $this->assertTrue((bool) $payment->is_cash_payment);

        // Invoice is not yet paid because cash payment is unconfirmed
        $this->assertEquals(InvoiceStatus::Unpaid, $invoice->fresh()->status);

        // After admin confirms...
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin, 'email_verified_at' => now()]);
        $this->actingAs($admin);

        $this->post(route('admin.payments.confirm', $payment));

        $this->assertEquals(InvoiceStatus::Paid, $invoice->fresh()->status);
        $this->assertEquals(PaymentStatus::Paid, $invoice->booking->fresh()->payment_status);
    }
}
