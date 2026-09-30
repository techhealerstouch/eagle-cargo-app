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
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OfflinePaymentConfirmationTest extends TestCase
{
    use RefreshDatabase;

    protected User $senderUser;
    protected Sender $sender;
    protected User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->senderUser = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);
        $this->sender = $this->senderUser->sender ?? Sender::factory()->create(['user_id' => $this->senderUser->id]);

        $this->adminUser = User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);

        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

    public function test_uploading_proof_of_payment_initializes_unconfirmed_payment(): void
    {
        Storage::fake('public');

        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
            'payment_method' => 'bank_transfer',
        ]);

        $boxType = BoxType::factory()->create();
        Box::factory()->create([
            'booking_id' => $booking->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 150.00,
        ]);

        $file = UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf');

        $response = $this->actingAs($this->senderUser)
            ->post(route('bookings.upload-proof', $booking), [
                'proof_of_payment' => $file,
                'payment_reference' => 'REF-BANK-998877',
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        // 1. Verify booking has proof and reference
        $booking->refresh();
        $this->assertNotNull($booking->proof_of_payment);
        $this->assertEquals('REF-BANK-998877', $booking->payment_reference);
        $this->assertEquals(PaymentStatus::Pending, $booking->payment_status);

        // 2. Verify invoice was generated
        $invoice = $booking->invoice;
        $this->assertNotNull($invoice);
        $this->assertEquals(InvoiceStatus::Unpaid, $invoice->status);

        // 3. Verify Payment record was initialized
        $payment = Payment::where('invoice_id', $invoice->id)->first();
        $this->assertNotNull($payment);
        $this->assertEquals(150.00, (float) $payment->amount);
        $this->assertEquals('REF-BANK-998877', $payment->reference_number);
        $this->assertEquals('bank_transfer', $payment->payment_method);
        $this->assertNull($payment->confirmed_at);
        $this->assertTrue($payment->isPendingConfirmation());
        $this->assertFalse($payment->isSettled());
    }

    public function test_admin_can_confirm_offline_payment_and_settle_invoice_and_booking(): void
    {
        Storage::fake('public');

        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
            'payment_method' => 'bank_transfer',
        ]);

        $boxType = BoxType::factory()->create();
        Box::factory()->create([
            'booking_id' => $booking->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 200.00,
        ]);

        $invoice = Invoice::generateForBooking($booking);

        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 200.00,
            'payment_method' => 'bank_transfer',
            'reference_number' => 'REF-CONFIRM-123',
            'paid_at' => now(),
            'confirmed_at' => null,
            'is_cash_payment' => false,
        ]);

        $this->assertEquals(InvoiceStatus::Unpaid, $invoice->fresh()->status);
        $this->assertEquals(PaymentStatus::Pending, $booking->fresh()->payment_status);

        // Admin confirms payment
        $response = $this->actingAs($this->adminUser)
            ->post(route('admin.payments.confirm', $payment));

        $response->assertSessionHas('success');

        // Verify confirmed state
        $payment->refresh();
        $this->assertNotNull($payment->confirmed_at);
        $this->assertEquals($this->adminUser->id, $payment->confirmed_by);
        $this->assertTrue($payment->isSettled());
        $this->assertFalse($payment->isPendingConfirmation());

        // Invoice and booking must be marked as Paid
        $this->assertEquals(InvoiceStatus::Paid, $invoice->fresh()->status);
        $this->assertEquals(PaymentStatus::Paid, $booking->fresh()->payment_status);
    }

    public function test_admin_can_reject_offline_payment(): void
    {
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
            'payment_method' => 'bank_transfer',
        ]);

        $boxType = BoxType::factory()->create();
        Box::factory()->create([
            'booking_id' => $booking->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 100.00,
        ]);

        $invoice = Invoice::generateForBooking($booking);

        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'bank_transfer',
            'reference_number' => 'REF-FRAUD-000',
            'paid_at' => now(),
            'confirmed_at' => null,
            'is_cash_payment' => false,
        ]);

        // Admin rejects payment
        $response = $this->actingAs($this->adminUser)
            ->post(route('admin.payments.reject', $payment), [
                'reason' => 'Proof was illegible or transaction not found in bank account.',
            ]);

        $response->assertSessionHas('success');

        // Payment record is soft-deleted
        $this->assertSoftDeleted('payments', ['id' => $payment->id]);

        // Invoice and booking remain unpaid/pending
        $this->assertEquals(InvoiceStatus::Unpaid, $invoice->fresh()->status);
        $this->assertEquals(PaymentStatus::Pending, $booking->fresh()->payment_status);
    }

    public function test_invalid_zero_string_proof_of_payment_is_sanitized_to_null(): void
    {
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
        ]);

        $booking->setRawAttributes(array_merge($booking->getAttributes(), [
            'proof_of_payment' => '0',
        ]));

        $this->assertNull($booking->proof_of_payment);

        $booking->proof_of_payment = '0';
        $this->assertNull($booking->proof_of_payment);
    }
}
