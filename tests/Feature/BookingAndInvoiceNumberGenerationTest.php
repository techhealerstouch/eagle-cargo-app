<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Recipient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingAndInvoiceNumberGenerationTest extends TestCase
{
    use RefreshDatabase;

    public function test_booking_reference_number_is_based_on_persisted_id(): void
    {
        $booking = Booking::factory()->create();

        $expected = 'BK-'.$booking->created_at->format('Y').'-'.str_pad((string) ($booking->id % 1000), 3, '0', STR_PAD_LEFT);

        $this->assertSame($expected, $booking->fresh()->reference_number);
    }

    public function test_invoice_number_is_based_on_persisted_id_and_is_idempotent_per_booking(): void
    {
        $booking = Booking::factory()->create([
            'status' => \App\Enums\BookingStatus::Pending,
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'price_charged' => 275.50,
        ]);

        $invoice = Invoice::generateForBooking($booking->fresh());

        $expectedNumber = 'INV-'.$invoice->created_at->format('Y').'-'.str_pad((string) $invoice->id, 5, '0', STR_PAD_LEFT);

        $this->assertSame($expectedNumber, $invoice->invoice_number);
        $this->assertSame('275.50', number_format((float) $invoice->amount, 2, '.', ''));

        $secondCallInvoice = Invoice::generateForBooking($booking->fresh());

        $this->assertTrue($invoice->is($secondCallInvoice));
    }

    public function test_box_tracking_number_uses_batch_and_last_three_digits_of_booking_reference(): void
    {
        $booking = Booking::factory()->create();
        $referenceSuffix = substr((string) $booking->reference_number, -3);
        $year = $booking->created_at->format('Y');
        $recipient = Recipient::factory()->create();
        $boxType = BoxType::factory()->create();

        $firstBox = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
        ]);

        $secondBox = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
        ]);

        $this->assertSame("TRK-{$year}-001-{$referenceSuffix}", $firstBox->tracking_number);
        $this->assertSame("TRK-{$year}-002-{$referenceSuffix}", $secondBox->tracking_number);
    }
}
