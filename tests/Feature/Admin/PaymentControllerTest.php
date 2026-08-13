<?php

namespace Tests\Feature\Admin;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Invoice;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_payment_create_excludes_voided_and_cancelled_booking_invoices(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);

        $activeInvoice = $this->createInvoiceForBooking(InvoiceStatus::Unpaid, BookingStatus::Confirmed);
        $voidedInvoice = $this->createInvoiceForBooking(InvoiceStatus::Voided, BookingStatus::Confirmed);
        $cancelledInvoice = $this->createInvoiceForBooking(InvoiceStatus::Unpaid, BookingStatus::Cancelled);

        $response = $this->actingAs($admin)->get('/admin/payments/create');

        $response->assertOk();

        $content = $response->getContent();

        $this->assertStringContainsString($activeInvoice->invoice_number, $content);
        $this->assertStringNotContainsString($voidedInvoice->invoice_number, $content);
        $this->assertStringNotContainsString($cancelledInvoice->invoice_number, $content);
    }

    private function createInvoiceForBooking(InvoiceStatus $invoiceStatus, BookingStatus $bookingStatus): Invoice
    {
        $sender = Sender::factory()->create();

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => $bookingStatus,
            'payment_status' => PaymentStatus::Pending,
        ]);

        return Invoice::withoutEvents(function () use ($booking, $invoiceStatus) {
            return Invoice::create([
                'booking_id' => $booking->id,
                'invoice_number' => 'INV-TEST-'.$booking->id.'-'.$invoiceStatus->value,
                'amount' => 100.00,
                'status' => $invoiceStatus,
            ]);
        });
    }
}
