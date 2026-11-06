<?php

namespace Tests\Feature\Admin;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PickupZone;
use App\Models\Sender;
use App\Models\User;
use App\Services\PaymentService;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class BookingInvoicePaymentSyncTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;

    private Sender $sender;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ValidateCsrfToken::class);

        $this->admin = User::factory()->create(['role' => Role::Admin]);
        $this->sender = Sender::factory()->create();
    }

    public function test_editing_partially_paid_booking_to_paid_auto_settles_balance_and_updates_invoice_to_paid(): void
    {
        $pickupZone = PickupZone::factory()->create();

        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'pickup_zone_id' => $pickupZone->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::PartiallyPaid,
            'payment_method' => 'bank_transfer',
            'declaration_form_status' => 'submitted_online',
        ]);

        $invoice = Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-TEST-'.Str::upper(Str::random(8)),
            'amount' => 130.00,
            'status' => InvoiceStatus::Partial,
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 50.00,
            'payment_method' => 'bank_transfer',
            'reference_number' => 'PARTIAL-REF-1',
            'paid_at' => now(),
            'confirmed_at' => now(),
            'confirmed_by' => $this->admin->id,
            'is_cash_payment' => false,
        ]);

        $response = $this->actingAs($this->admin)->put("/admin/bookings/{$booking->id}", [
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Confirmed->value,
            'pickup_zone_id' => $pickupZone->id,
            'booking_type' => 'drop_off',
            'recipient_name' => 'Maria Santos',
            'payment_status' => PaymentStatus::Paid->value,
            'payment_method' => 'cash_on_pickup',
            'declaration_form_status' => 'submitted_online',
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $booking->refresh();
        $invoice->refresh();

        $this->assertEquals(PaymentStatus::Paid, $booking->payment_status);
        $this->assertEquals(InvoiceStatus::Paid, $invoice->status);

        $settledTotal = app(PaymentService::class)->settledPaymentsTotal($invoice);
        $this->assertEquals(130.00, $settledTotal);

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $invoice->id,
            'amount' => 80.00,
            'payment_method' => 'cash_on_pickup',
            'is_cash_payment' => true,
        ]);
    }

    public function test_editing_invoice_to_paid_with_cash_on_pickup_does_not_require_proof_of_payment(): void
    {
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Pending,
        ]);

        $invoice = Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-TEST-'.Str::upper(Str::random(8)),
            'amount' => 130.00,
            'status' => InvoiceStatus::Unpaid,
        ]);

        $response = $this->actingAs($this->admin)->put("/admin/invoices/{$invoice->id}", [
            'amount' => 130.00,
            'status' => InvoiceStatus::Paid->value,
            'payment_method' => 'cash_on_pickup',
            'reference_number' => '',
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $invoice->refresh();
        $booking->refresh();

        $this->assertEquals(InvoiceStatus::Paid, $invoice->status);
        $this->assertEquals(PaymentStatus::Paid, $booking->payment_status);

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $invoice->id,
            'amount' => 130.00,
            'payment_method' => 'cash_on_pickup',
            'is_cash_payment' => true,
        ]);
    }

    public function test_editing_invoice_with_partial_payments_to_paid_auto_settles_balance(): void
    {
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::PartiallyPaid,
        ]);

        $invoice = Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-TEST-'.Str::upper(Str::random(8)),
            'amount' => 130.00,
            'status' => InvoiceStatus::Partial,
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 50.00,
            'payment_method' => 'bank_transfer',
            'reference_number' => 'PARTIAL-1',
            'paid_at' => now(),
            'confirmed_at' => now(),
            'confirmed_by' => $this->admin->id,
            'is_cash_payment' => false,
        ]);

        $response = $this->actingAs($this->admin)->put("/admin/invoices/{$invoice->id}", [
            'amount' => 130.00,
            'status' => InvoiceStatus::Paid->value,
            'payment_method' => 'cash',
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $invoice->refresh();
        $booking->refresh();

        $this->assertEquals(InvoiceStatus::Paid, $invoice->status);
        $this->assertEquals(PaymentStatus::Paid, $booking->payment_status);

        $settledTotal = app(PaymentService::class)->settledPaymentsTotal($invoice);
        $this->assertEquals(130.00, $settledTotal);

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $invoice->id,
            'amount' => 80.00,
            'payment_method' => 'cash',
            'is_cash_payment' => true,
        ]);
    }

    public function test_modifying_invoice_amount_fails_when_payments_already_exist(): void
    {
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::PartiallyPaid,
        ]);

        $invoice = Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-TEST-'.Str::upper(Str::random(8)),
            'amount' => 130.00,
            'status' => InvoiceStatus::Partial,
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 50.00,
            'payment_method' => 'bank_transfer',
            'reference_number' => 'PARTIAL-1',
            'paid_at' => now(),
            'confirmed_at' => now(),
            'confirmed_by' => $this->admin->id,
            'is_cash_payment' => false,
        ]);

        $response = $this->actingAs($this->admin)->put("/admin/invoices/{$invoice->id}", [
            'amount' => 100.00,
            'status' => InvoiceStatus::Partial->value,
            'payment_method' => 'bank_transfer',
        ]);

        $response->assertSessionHas('error', 'The invoice amount cannot be modified because payments have already been recorded.');

        $invoice->refresh();
        $this->assertEquals(130.00, (float) $invoice->amount);
    }

    public function test_bulk_updating_partially_paid_bookings_to_paid_auto_settles_invoice(): void
    {
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::PartiallyPaid,
            'payment_method' => 'cash',
        ]);

        $invoice = Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-TEST-'.Str::upper(Str::random(8)),
            'amount' => 150.00,
            'status' => InvoiceStatus::Partial,
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 60.00,
            'payment_method' => 'cash',
            'reference_number' => 'CASH-DEP-1',
            'paid_at' => now(),
            'confirmed_at' => now(),
            'confirmed_by' => $this->admin->id,
            'is_cash_payment' => true,
        ]);

        $response = $this->actingAs($this->admin)->post('/admin/bookings/bulk-update-payment-status', [
            'ids' => [$booking->id],
            'payment_status' => PaymentStatus::Paid->value,
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $booking->refresh();
        $invoice->refresh();

        $this->assertEquals(PaymentStatus::Paid, $booking->payment_status);
        $this->assertEquals(InvoiceStatus::Paid, $invoice->status);

        $settledTotal = app(PaymentService::class)->settledPaymentsTotal($invoice);
        $this->assertEquals(150.00, $settledTotal);

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $invoice->id,
            'amount' => 90.00,
            'is_cash_payment' => true,
        ]);
    }
}
