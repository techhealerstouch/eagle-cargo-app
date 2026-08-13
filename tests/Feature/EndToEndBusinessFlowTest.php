<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Area;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use App\Services\BatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class EndToEndBusinessFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_complete_pickup_to_delivery_business_flow()
    {
        Notification::fake();

        // ---------------------------------------------------------
        // 0. Setup Foundation Data
        // ---------------------------------------------------------
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker]);
        /** @var User $courier */
        $courier = User::factory()->create(['role' => Role::Courier]);
        /** @var User $senderUser */
        $senderUser = User::factory()->create(['role' => Role::Sender]);

        $area = Area::factory()->create(['name' => 'Metro Manila', 'is_active' => true]);
        $boxType = BoxType::factory()->create(['name' => 'Jumbo', 'is_active' => true]);
        $boxPrice = BoxPrice::create(['area_id' => $area->id, 'box_type_id' => $boxType->id, 'price' => 120.00]);

        // ---------------------------------------------------------
        // 1. Sender Phase (Registration & Booking)
        // ---------------------------------------------------------
        $this->actingAs($senderUser);

        $sender = Sender::factory()->create([
            'user_id' => $senderUser->id,
            'address' => '123 Wallaby Way',
            'suburb' => 'Sydney',
        ]);

        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'city' => 'Manila',
            'province' => 'Metro Manila',
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'status' => BoxStatus::Pending,
            'price_charged' => 120.00,
        ]);

        $this->assertEquals(BookingStatus::Pending, $booking->status);
        $this->assertEquals(PaymentStatus::Pending, $booking->payment_status);

        // ---------------------------------------------------------
        // 2. Admin Phase (Confirmation & Invoicing)
        // ---------------------------------------------------------
        $this->actingAs($admin);

        $booking->update([
            'status' => BookingStatus::Confirmed,
            'confirmed_at' => now(),
        ]);
        $this->assertEquals(BookingStatus::Confirmed, $booking->fresh()->status);

        $invoice = Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-2026-99999',
            'amount' => 120.00,
            'status' => InvoiceStatus::Unpaid,
        ]);

        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 120.00,
            'status' => PaymentStatus::Paid,
            'payment_method' => 'bank_transfer',
        ]);

        $invoice->update(['status' => InvoiceStatus::Paid]);
        $booking->update(['payment_status' => PaymentStatus::Paid]);

        $this->assertEquals(PaymentStatus::Paid, $booking->fresh()->payment_status);

        // ---------------------------------------------------------
        // 3. Admin / Picker Phase (Pickup Runsheet)
        // ---------------------------------------------------------
        $pickupRunsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Assigned,
            'courier_id' => $picker->id,
        ]);

        $pickupRunsheet->bookings()->attach($booking->id);

        $this->actingAs($picker);
        $pickupRunsheet->update(['status' => RunsheetStatus::InProgress]);

        $box->update([
            'status' => BoxStatus::Collected,
        ]);

        $pickupRunsheet->update(['status' => RunsheetStatus::Completed]);

        $this->assertEquals(BoxStatus::Collected, $box->fresh()->status);
        $booking->update(['status' => BookingStatus::Collected]);
        $this->assertEquals(BookingStatus::Collected, $booking->fresh()->status);

        // ---------------------------------------------------------
        // 4. Warehouse & Consolidation (Batch & Container)
        // ---------------------------------------------------------
        $this->actingAs($admin);

        $box->update([
            'status' => BoxStatus::ReceivedByWarehouse,
            'weight' => 25.5,
        ]);

        $batchService = app(BatchService::class);
        $batch = clone $batchService->create([
            'branch_name' => 'Sydney Hub',
            'vessel_name' => 'Ever Given',
            'capacity_boxes' => 1,
            'status' => BatchStatus::Open,
        ]);

        $box->update([
            'batch_id' => $batch->id,
        ]);

        $batchService->refreshAndEvaluateById($batch->id);

        $this->assertEquals(1, $batch->fresh()->current_box_count);
        $this->assertEquals(BatchStatus::ReadyToClose, $batch->fresh()->status);

        $batch = $batchService->confirmManifest($batch->fresh());

        $this->assertEquals(BatchStatus::Sailed, $batch->fresh()->status);

        // ---------------------------------------------------------
        // 5. Shipping (International Transit)
        // ---------------------------------------------------------
        $box->update([
            'status' => BoxStatus::InTransit,
        ]);
        $booking->update(['status' => BookingStatus::Shipped]);

        $batch->update(['status' => BatchStatus::Arrived]);

        $box->update([
            'status' => BoxStatus::Arrived,
        ]);

        // ---------------------------------------------------------
        // 6. Last-Mile Delivery
        // ---------------------------------------------------------
        $deliveryRunsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Delivery,
            'status' => RunsheetStatus::Draft,
            'area_description' => $area->name,
        ]);

        $deliveryRunsheet->update([
            'status' => RunsheetStatus::Assigned,
            'courier_id' => $courier->id,
        ]);
        $deliveryRunsheet->bookings()->attach($booking->id);

        $this->actingAs($courier);
        $deliveryRunsheet->update(['status' => RunsheetStatus::InProgress]);

        $box->update([
            'status' => BoxStatus::Delivered,
        ]);

        $booking->update(['status' => BookingStatus::Delivered]);
        $deliveryRunsheet->update(['status' => RunsheetStatus::Completed]);

        // ---------------------------------------------------------
        // 7. Final Assertions
        // ---------------------------------------------------------
        $this->assertEquals(BookingStatus::Delivered, $booking->fresh()->status);
        $this->assertEquals(BoxStatus::Delivered, $box->fresh()->status);
        $this->assertEquals(RunsheetStatus::Completed, $deliveryRunsheet->fresh()->status);
    }
}
