<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Invoice;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperationalDocumentAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_unassigned_picker_cannot_view_booking_declaration(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker]);
        ['booking' => $booking] = $this->createBookingWithInvoice();

        $this->actingAs($picker)
            ->get(route('track.declaration.view', $booking))
            ->assertForbidden();
    }

    public function test_assigned_picker_can_view_booking_declaration(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker]);
        ['booking' => $booking] = $this->createBookingWithInvoice();
        $this->assignPickupRunsheet($booking, $picker);

        $this->actingAs($picker)
            ->get(route('track.declaration.view', $booking))
            ->assertOk();
    }

    public function test_unassigned_courier_cannot_view_booking_declaration(): void
    {
        $courier = User::factory()->create(['role' => Role::Courier]);
        ['booking' => $booking] = $this->createBookingWithInvoice();

        $this->actingAs($courier)
            ->get(route('track.declaration.view', $booking))
            ->assertForbidden();
    }

    public function test_assigned_courier_can_view_booking_declaration(): void
    {
        $courier = User::factory()->create(['role' => Role::Courier]);
        ['booking' => $booking] = $this->createBookingWithInvoice();
        $this->assignDeliveryRunsheet($booking, $courier);

        $this->actingAs($courier)
            ->get(route('track.declaration.view', $booking))
            ->assertOk();
    }

    public function test_unassigned_picker_cannot_view_invoice_html_or_pdf(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker]);
        ['invoice' => $invoice] = $this->createBookingWithInvoice();

        $this->actingAs($picker)
            ->get(route('admin.invoices.show', $invoice))
            ->assertForbidden();

        $this->actingAs($picker)
            ->get(route('admin.invoices.pdf', $invoice))
            ->assertForbidden();
    }

    public function test_assigned_picker_can_view_invoice_html_and_pdf(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker]);
        ['booking' => $booking, 'invoice' => $invoice] = $this->createBookingWithInvoice();
        $this->assignPickupRunsheet($booking, $picker);

        $this->actingAs($picker)
            ->get(route('admin.invoices.show', $invoice))
            ->assertOk();

        $this->actingAs($picker)
            ->get(route('admin.invoices.pdf', $invoice))
            ->assertOk();
    }

    private function createBookingWithInvoice(): array
    {
        $senderUser = User::factory()->create(['role' => Role::Sender]);
        $sender = $senderUser->sender()->first() ?? Sender::factory()->create(['user_id' => $senderUser->id]);
        $recipient = Recipient::factory()->create(['sender_id' => $sender->id]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'declaration_form_status' => 'submitted_online',
            'declaration_data' => ['items' => []],
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => BoxStatus::Pending,
            'price_charged' => 100,
        ]);

        $invoice = Invoice::factory()->create(['booking_id' => $booking->id]);

        return compact('booking', 'invoice');
    }

    private function assignPickupRunsheet(Booking $booking, User $picker): Runsheet
    {
        $runsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Assigned,
            'picker_id' => $picker->id,
            'courier_id' => null,
        ]);

        $runsheet->bookings()->attach($booking->id);

        return $runsheet;
    }

    private function assignDeliveryRunsheet(Booking $booking, User $courier): Runsheet
    {
        $runsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::Assigned,
            'courier_id' => $courier->id,
        ]);

        $runsheet->bookings()->attach($booking->id);

        return $runsheet;
    }
}