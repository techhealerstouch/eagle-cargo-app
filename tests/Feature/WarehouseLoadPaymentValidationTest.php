<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\BoxStatus;
use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Models\Batch;
use App\Models\Box;
use App\Models\Booking;
use App\Models\Sender;
use App\Models\User;
use App\Models\Recipient;
use App\Models\Invoice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\Fluent\AssertableJson;
use Tests\TestCase;

class WarehouseLoadPaymentValidationTest extends TestCase
{
    use RefreshDatabase;

    protected User $warehouseUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->warehouseUser = User::factory()->create(['role' => Role::Warehouse->value]);
    }

    public function test_cannot_load_unpaid_box(): void
    {
        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Pending,
        ]);
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
        ]);
        $batch = Batch::factory()->create();

        $response = $this->actingAs($this->warehouseUser)
            ->post(route('warehouse.load'), [
                'tracking_number' => $box->tracking_number,
                'batch_id' => $batch->id,
            ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors(['tracking_number' => 'Payment not confirmed. Cannot load unpaid box to container.']);
        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $box->fresh()->status);
    }

    public function test_can_load_paid_box(): void
    {
        $sender = Sender::factory()->create();
        
        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'phone_number' => '09171234567',
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'declaration_form_status' => 'submitted',
            'declaration_form_path' => 'path/to/form.pdf',
        ]);

        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'status' => InvoiceStatus::Paid,
            'amount' => 100,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'recipient_id' => $recipient->id,
            'price_charged' => 100,
        ]);
        $batch = Batch::factory()->create();

        $response = $this->actingAs($this->warehouseUser)
            ->post(route('warehouse.load'), [
                'tracking_number' => $box->tracking_number,
                'batch_id' => $batch->id,
            ]);

        $response->assertSessionHas('success');
        $this->assertEquals(BoxStatus::LoadedToContainer, $box->fresh()->status);
        $this->assertEquals($batch->id, $box->fresh()->batch_id);
    }

    public function test_cannot_load_box_without_invoice(): void
    {
        $sender = Sender::factory()->create();
        
        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'phone_number' => '09171234567',
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Paid,
            'declaration_form_status' => 'submitted',
            'declaration_form_path' => 'path/to/form.pdf',
        ]);

        // No invoice created

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'recipient_id' => $recipient->id,
            'price_charged' => 100,
        ]);
        $batch = Batch::factory()->create();

        $response = $this->actingAs($this->warehouseUser)
            ->post(route('warehouse.load'), [
                'tracking_number' => $box->tracking_number,
                'batch_id' => $batch->id,
            ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors(['tracking_number' => 'No valid invoice found for this booking. Generate an invoice before loading to container.']);
        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $box->fresh()->status);
    }
}
