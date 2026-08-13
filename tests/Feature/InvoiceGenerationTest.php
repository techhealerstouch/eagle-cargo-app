<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use App\Services\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class InvoiceGenerationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed default invoice settings for VAT calculations
        $this->seedInvoiceSettings();
    }

    protected function seedInvoiceSettings(): void
    {
        // Seed individual invoice settings that SettingsService::getInvoiceSettings() reads
        \App\Models\Setting::updateOrCreate(
            ['key' => 'invoice_tax_rate'],
            [
                'value' => '0.12',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Tax Rate',
            ]
        );
    }

    protected function createBookingWithBoxes(int $boxCount = 2, float $pricePerBox = 100.00): Booking
    {
        \Illuminate\Support\Facades\Cache::flush();
        $area = Area::factory()->create(['name' => fake()->unique()->city(), 'is_active' => true]);
        $boxType = BoxType::factory()->create(['name' => 'Jumbo', 'is_active' => true]);
        BoxPrice::create(['area_id' => $area->id, 'box_type_id' => $boxType->id, 'price' => $pricePerBox]);

        $sender = Sender::factory()->create();
        // Create booking as Pending first so BookingObserver doesn't auto-generate
        // an invoice before boxes are attached
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => \App\Enums\PaymentStatus::Pending,
        ]);

        for ($i = 0; $i < $boxCount; $i++) {
            $recipient = Recipient::factory()->create([
                'sender_id' => $sender->id,
                'area_id' => $area->id,
            ]);

            Box::factory()->create([
                'booking_id' => $booking->id,
                'recipient_id' => $recipient->id,
                'box_type_id' => $boxType->id,
                'price_charged' => $pricePerBox,
                'status' => \App\Enums\BoxStatus::Pending,
            ]);
        }

        // Now transition to Confirmed — this triggers BookingObserver which
        // auto-generates the invoice with boxes present
        $booking->update(['status' => BookingStatus::Confirmed]);

        return $booking->fresh();
    }

    // ---------------------------------------------------------------
    // 1. Invoice Generation
    // ---------------------------------------------------------------

    public function test_generate_invoice_creates_invoice_for_confirmed_booking(): void
    {
        $booking = $this->createBookingWithBoxes(2, 100.00);

        $invoice = Invoice::generateForBooking($booking);

        $this->assertNotNull($invoice);
        $this->assertNotNull($invoice->invoice_number);
        $this->assertEquals($booking->id, $invoice->booking_id);
        $this->assertEquals(InvoiceStatus::Unpaid, $invoice->status);
    }

    public function test_invoice_amount_matches_total_box_prices(): void
    {
        $booking = $this->createBookingWithBoxes(3, 150.00);

        $invoice = Invoice::generateForBooking($booking);

        // 3 boxes × 150.00 = 450.00 total (exclusive of VAT)
        $this->assertEqualsWithDelta(450.00, (float) $invoice->amount, 0.01);
    }

    public function test_generate_invoice_is_idempotent(): void
    {
        $booking = $this->createBookingWithBoxes(1, 100.00);

        $invoice1 = Invoice::generateForBooking($booking);
        $invoice2 = Invoice::generateForBooking($booking);

        // Should return the same invoice, not create a duplicate
        $this->assertEquals($invoice1->id, $invoice2->id);
        $this->assertSame(1, Invoice::where('booking_id', $booking->id)->count());
    }

    public function test_generate_invoice_uses_row_level_locking(): void
    {
        $booking = $this->createBookingWithBoxes(1, 100.00);

        // Simulate concurrent invoice generation under a transaction
        $invoices = DB::transaction(function () use ($booking) {
            return [
                Invoice::generateForBooking($booking),
                Invoice::generateForBooking($booking),
            ];
        });

        // Both calls within the same transaction should return the same invoice
        $this->assertEquals($invoices[0]->id, $invoices[1]->id);
    }

    // ---------------------------------------------------------------
    // 2. VAT Calculations
    // ---------------------------------------------------------------

    public function test_vat_is_calculated_correctly_exclusive(): void
    {
        // Set VAT to 12%
        \App\Models\Setting::updateOrCreate(
            ['key' => 'invoice_tax_rate'],
            ['value' => '0.12', 'type' => 'string', 'group' => 'invoice', 'display_name' => 'Tax Rate']
        );
        \Illuminate\Support\Facades\Cache::flush();

        $booking = $this->createBookingWithBoxes(2, 100.00);
        $invoice = Invoice::generateForBooking($booking);

        // 2 boxes × 100 = 200.00 total
        // calculateVatBreakdown(200, 0.12) → vatable = 200 / 1.12 = 178.57, vat = 21.43
        $this->assertEqualsWithDelta(200.00, (float) $invoice->amount, 0.01);
        $this->assertEqualsWithDelta(178.57, (float) $invoice->vatable_revenue, 0.01);
        $this->assertEqualsWithDelta(21.43, (float) $invoice->vat_amount, 0.01);
    }

    public function test_vat_is_calculated_correctly_inclusive(): void
    {
        // Set VAT to 12%
        \App\Models\Setting::updateOrCreate(
            ['key' => 'invoice_tax_rate'],
            ['value' => '0.12', 'type' => 'string', 'group' => 'invoice', 'display_name' => 'Tax Rate']
        );
        \Illuminate\Support\Facades\Cache::flush();

        $booking = $this->createBookingWithBoxes(1, 112.00);
        $invoice = Invoice::generateForBooking($booking);

        // calculateVatBreakdown(112, 0.12) → vatable = 112 / 1.12 = 100.00, vat = 12.00
        $this->assertEqualsWithDelta(112.00, (float) $invoice->amount, 0.01);
        $this->assertEqualsWithDelta(100.00, (float) $invoice->vatable_revenue, 0.01);
        $this->assertEqualsWithDelta(12.00, (float) $invoice->vat_amount, 0.01);
    }

    public function test_vat_is_zero_when_tax_rate_is_zero(): void
    {
        \App\Models\Setting::updateOrCreate(
            ['key' => 'invoice_tax_rate'],
            ['value' => '0', 'type' => 'string', 'group' => 'invoice', 'display_name' => 'Tax Rate']
        );
        \Illuminate\Support\Facades\Cache::flush();

        $booking = $this->createBookingWithBoxes(2, 150.00);
        $invoice = Invoice::generateForBooking($booking);

        // calculateVatBreakdown(300, 0) → taxRate <= 0, so vat_exempt_revenue = 300
        $this->assertEqualsWithDelta(300.00, (float) $invoice->amount, 0.01);
        $this->assertEqualsWithDelta(0.00, (float) $invoice->vatable_revenue, 0.01);
        $this->assertEqualsWithDelta(0.00, (float) $invoice->vat_amount, 0.01);
        $this->assertEqualsWithDelta(300.00, (float) $invoice->vat_exempt_revenue, 0.01);
    }

    public function test_invoice_vat_flag_is_stored(): void
    {
        \App\Models\Setting::updateOrCreate(
            ['key' => 'invoice_tax_rate'],
            ['value' => '0.12', 'type' => 'string', 'group' => 'invoice', 'display_name' => 'Tax Rate']
        );
        \Illuminate\Support\Facades\Cache::flush();

        $booking = $this->createBookingWithBoxes(1, 112.00);
        $invoice = Invoice::generateForBooking($booking);

        $this->assertTrue((bool) $invoice->is_vat_inclusive);
    }

    // ---------------------------------------------------------------
    // 3. Invoice Number Generation
    // ---------------------------------------------------------------

    public function test_invoice_number_is_generated_automatically(): void
    {
        $booking = $this->createBookingWithBoxes(1, 100.00);
        $invoice = Invoice::generateForBooking($booking);

        $this->assertNotNull($invoice->invoice_number);
        $this->assertStringContainsString('INV-', $invoice->invoice_number);
    }

    public function test_invoice_numbers_are_unique(): void
    {
        $booking1 = $this->createBookingWithBoxes(1, 100.00);
        $booking2 = $this->createBookingWithBoxes(1, 80.00);

        $invoice1 = Invoice::generateForBooking($booking1);
        $invoice2 = Invoice::generateForBooking($booking2);

        $this->assertNotEquals($invoice1->invoice_number, $invoice2->invoice_number);
    }

    // ---------------------------------------------------------------
    // 4. Invoice Status Transitions
    // ---------------------------------------------------------------

    public function test_invoice_transitions_from_unpaid_to_paid_when_fully_settled(): void
    {
        $booking = $this->createBookingWithBoxes(1, 100.00);
        $invoice = Invoice::generateForBooking($booking);

        $this->assertEquals(InvoiceStatus::Unpaid, $invoice->status);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'bank_transfer',
            'paid_at' => now(),
        ]);

        $this->assertEquals(InvoiceStatus::Paid, $invoice->fresh()->status);
    }

    public function test_invoice_transitions_to_partial_when_partially_settled(): void
    {
        $booking = $this->createBookingWithBoxes(1, 200.00);
        $invoice = Invoice::generateForBooking($booking);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'bank_transfer',
            'paid_at' => now(),
        ]);

        $this->assertEquals(InvoiceStatus::Partial, $invoice->fresh()->status);
    }

    public function test_invoice_transitions_back_to_unpaid_when_payment_is_deleted(): void
    {
        $booking = $this->createBookingWithBoxes(1, 100.00);
        $invoice = Invoice::generateForBooking($booking);

        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'bank_transfer',
            'paid_at' => now(),
        ]);

        $this->assertEquals(InvoiceStatus::Paid, $invoice->fresh()->status);

        $payment->delete();

        $this->assertEquals(InvoiceStatus::Unpaid, $invoice->fresh()->status);
    }

    public function test_invoice_with_overpayment_is_paid(): void
    {
        $booking = $this->createBookingWithBoxes(1, 100.00);
        $invoice = Invoice::generateForBooking($booking);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 150.00,
            'payment_method' => 'bank_transfer',
            'paid_at' => now(),
        ]);

        $this->assertEquals(InvoiceStatus::Paid, $invoice->fresh()->status);
    }

    // ---------------------------------------------------------------
    // 5. Invoice PDF Generation
    // ---------------------------------------------------------------

    public function test_invoice_pdf_endpoint_returns_pdf(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);

        $booking = $this->createBookingWithBoxes(1, 100.00);
        $invoice = Invoice::generateForBooking($booking);

        $response = $this->actingAs($admin)
            ->get(route('admin.invoices.pdf', $invoice));

        $response->assertStatus(200);
        $this->assertStringContainsString('application/pdf', $response->headers->get('Content-Type'));
    }

    public function test_bulk_mark_paid_updates_multiple_invoices(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);

        $booking1 = $this->createBookingWithBoxes(1, 100.00);
        $booking2 = $this->createBookingWithBoxes(1, 80.00);

        $invoice1 = Invoice::generateForBooking($booking1);
        $invoice2 = Invoice::generateForBooking($booking2);

        $response = $this->actingAs($admin)
            ->post(route('admin.invoices.bulk-mark-paid'), [
                'ids' => [$invoice1->id, $invoice2->id],
            ]);

        $response->assertSessionHasNoErrors();

        $this->assertEquals(InvoiceStatus::Paid, $invoice1->fresh()->status);
        $this->assertEquals(InvoiceStatus::Paid, $invoice2->fresh()->status);
    }

    // ---------------------------------------------------------------
    // 6. Auto-Invoice on Booking Confirmation
    // ---------------------------------------------------------------

    public function test_invoice_is_auto_generated_when_booking_is_confirmed(): void
    {
        $area = Area::factory()->create(['name' => 'Metro Manila', 'is_active' => true]);
        $boxType = BoxType::factory()->create(['name' => 'Jumbo', 'is_active' => true]);
        BoxPrice::create(['area_id' => $area->id, 'box_type_id' => $boxType->id, 'price' => 120.00]);

        $sender = Sender::factory()->create();
        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 120.00,
            'status' => \App\Enums\BoxStatus::Pending,
        ]);

        // Confirm the booking — this should auto-generate invoice via BookingObserver
        $booking->update(['status' => BookingStatus::Confirmed]);

        $this->assertSame(1, Invoice::where('booking_id', $booking->id)->count());
        $invoice = Invoice::where('booking_id', $booking->id)->first();
        $this->assertEquals(InvoiceStatus::Unpaid, $invoice->status);
    }

    // ---------------------------------------------------------------
    // 7. Invoice Snapshot Immutability
    // ---------------------------------------------------------------

    public function test_invoice_captures_snapshots_at_creation(): void
    {
        $booking = $this->createBookingWithBoxes(1, 100.00);
        $invoice = Invoice::generateForBooking($booking);

        $this->assertNotNull($invoice->sender_snapshot);
        $this->assertNotNull($invoice->booking_snapshot);
        $this->assertNotNull($invoice->line_items_snapshot);
        $this->assertNotNull($invoice->snapshot_taken_at);

        // Verify snapshot contains expected data
        $this->assertIsArray($invoice->sender_snapshot);
        $this->assertIsArray($invoice->line_items_snapshot);
    }
}
