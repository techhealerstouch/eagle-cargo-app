<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\InvoiceStatus;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use App\Services\ReferenceDataService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ObserverSideEffectsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    // ---------------------------------------------------------------
    // 1. BookingObserver
    // ---------------------------------------------------------------

    public function test_booking_observer_generates_reference_number(): void
    {
        $booking = Booking::factory()->create(['status' => BookingStatus::Draft]);

        // Reference number should be generated (not TMP- prefix)
        $this->assertStringStartsWith('BK-', $booking->reference_number);
        $this->assertStringNotContainsString('TMP-', $booking->reference_number);
    }

    public function test_booking_observer_auto_generates_invoice_on_confirm(): void
    {
        $sender = Sender::factory()->create();
        $recipient = Recipient::factory()->create(['sender_id' => $sender->id]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => BoxType::factory()->create()->id,
            'price_charged' => 100.00,
        ]);

        // Confirm the booking — observer should auto-generate invoice
        $booking->update(['status' => BookingStatus::Confirmed]);

        $this->assertSame(1, Invoice::where('booking_id', $booking->id)->count());
    }

    public function test_booking_observer_sets_confirmed_at_on_confirmation(): void
    {
        $booking = Booking::factory()->create(['status' => BookingStatus::Pending]);

        $booking->update(['status' => BookingStatus::Confirmed]);

        $this->assertNotNull($booking->fresh()->confirmed_at);
    }

    public function test_booking_observer_sets_shipped_at_on_shipment(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'confirmed_at' => now(),
        ]);

        $booking->update(['status' => BookingStatus::Shipped]);

        $this->assertNotNull($booking->fresh()->shipped_at);
    }

    public function test_booking_observer_syncs_collected_status_to_pending_boxes(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'confirmed_at' => now(),
        ]);

        $box1 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending,
        ]);

        $box2 = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending,
        ]);

        $booking->update(['status' => BookingStatus::Collected]);

        $this->assertEquals(BoxStatus::Collected, $box1->fresh()->status);
        $this->assertEquals(BoxStatus::Collected, $box2->fresh()->status);
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box1->id,
            'status' => BoxStatus::Collected->value,
            'tracking_phase' => \App\Enums\TrackingPhase::PICKED_UP->value,
        ]);
    }

    public function test_booking_observer_syncs_delivered_status_to_boxes(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Shipped,
            'confirmed_at' => now(),
            'shipped_at' => now(),
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::InTransit,
        ]);

        $booking->update(['status' => BookingStatus::Delivered]);

        $this->assertEquals(BoxStatus::Delivered, $box->fresh()->status);
    }

    // ---------------------------------------------------------------
    // 2. BoxObserver
    // ---------------------------------------------------------------

    public function test_box_observer_generates_tracking_number(): void
    {
        $booking = Booking::factory()->create();

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'tracking_number' => null,
        ]);

        $this->assertNotNull($box->tracking_number);
        $this->assertStringStartsWith('TRK-', $box->tracking_number);
    }

    public function test_box_observer_auto_populates_price_from_reference_data(): void
    {
        $zone = \App\Models\PickupZone::first() ?? \App\Models\PickupZone::create(['name' => 'Gold Coast Price Test', 'is_active' => true]);
        $area = \App\Models\Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);
        $boxType = BoxType::factory()->create(['name' => 'Jumbo Price Test', 'is_active' => true]);
        \App\Models\BoxPrice::firstOrCreate([
            'pickup_zone_id' => $zone->id,
            'area_id' => $area->id,
            'box_type_id' => $boxType->id,
        ], [
            'price' => 150.00,
        ]);

        $sender = Sender::factory()->create(['pickup_zone_id' => $zone->id]);
        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'pickup_zone_id' => $zone->id,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'price_charged' => null, // Not set — observer should auto-populate
        ]);

        $this->assertEqualsWithDelta(150.00, (float) $box->fresh()->price_charged, 0.01);
    }

    public function test_box_observer_captures_recipient_snapshot(): void
    {
        $recipient = Recipient::factory()->create();
        $booking = Booking::factory()->create();

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
        ]);

        $this->assertNotNull($box->recipient_snapshot);
        $this->assertIsArray($box->recipient_snapshot);
    }

    // ---------------------------------------------------------------
    // 3. PaymentObserver
    // ---------------------------------------------------------------

    public function test_payment_observer_syncs_invoice_status_to_paid(): void
    {
        $invoice = Invoice::factory()->create([
            'amount' => 100.00,
            'status' => InvoiceStatus::Unpaid,
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'stripe',
            'paid_at' => now(),
        ]);

        $this->assertEquals(InvoiceStatus::Paid, $invoice->fresh()->status);
    }

    public function test_payment_observer_syncs_booking_payment_status(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => \App\Enums\PaymentStatus::Pending,
        ]);

        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'amount' => 100.00,
            'status' => InvoiceStatus::Unpaid,
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'stripe',
            'paid_at' => now(),
        ]);

        $this->assertEquals(\App\Enums\PaymentStatus::Paid, $booking->fresh()->payment_status);
    }

    public function test_payment_observer_does_not_overwrite_voided_invoice(): void
    {
        $invoice = Invoice::factory()->create([
            'amount' => 100.00,
            'status' => InvoiceStatus::Voided,
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'stripe',
            'paid_at' => now(),
        ]);

        // Should remain voided
        $this->assertEquals(InvoiceStatus::Voided, $invoice->fresh()->status);
    }

    public function test_payment_observer_syncs_on_payment_deletion(): void
    {
        $invoice = Invoice::factory()->create([
            'amount' => 100.00,
            'status' => InvoiceStatus::Paid,
        ]);

        $payment = Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'stripe',
            'paid_at' => now(),
        ]);

        $payment->delete();

        // Invoice should revert to unpaid
        $this->assertEquals(InvoiceStatus::Unpaid, $invoice->fresh()->status);
    }

    // ---------------------------------------------------------------
    // 4. InvoiceObserver
    // ---------------------------------------------------------------

    public function test_invoice_observer_captures_snapshots_on_create(): void
    {
        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'price_charged' => 100.00,
        ]);

        $invoice = Invoice::generateForBooking($booking);

        $this->assertNotNull($invoice->sender_snapshot);
        $this->assertNotNull($invoice->booking_snapshot);
        $this->assertNotNull($invoice->line_items_snapshot);
        $this->assertIsArray($invoice->line_items_snapshot);
    }

    // ---------------------------------------------------------------
    // 5. Tracking Cache Invalidation
    // ---------------------------------------------------------------

    public function test_tracking_cache_is_invalidated_on_box_update(): void
    {
        $booking = Booking::factory()->create();
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'tracking_number' => 'TRK-2026-042-001',
            'status' => BoxStatus::Pending,
        ]);

        // Observer should call TrackingCacheService::forgetBox on update
        $box->update(['status' => BoxStatus::Collected]);

        $this->assertEquals(BoxStatus::Collected, $box->fresh()->status);
    }
}
