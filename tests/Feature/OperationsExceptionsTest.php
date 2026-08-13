<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Enums\TrackingPhase;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\DataIntegrityWarning;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Runsheet;
use App\Models\User;
use App\Services\DataIntegrityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperationsExceptionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_audit_creates_operations_exception_warnings(): void
    {
        $service = app(DataIntegrityService::class);

        $staleBox = $this->boxWithStatus(BoxStatus::InTransit);
        $this->scan($staleBox, TrackingPhase::IN_TRANSIT_SEA, now()->subHours(80));

        $arrivedNotSortedBox = $this->boxWithStatus(BoxStatus::Arrived);
        $this->scan($arrivedNotSortedBox, TrackingPhase::ARRIVED_MANILA_PORT, now()->subHours(49));

        $delayedReceiptBox = $this->boxWithStatus(BoxStatus::Collected);
        $this->scan($delayedReceiptBox, TrackingPhase::PICKED_UP, now()->subHours(25));

        $overdueLoadingBox = $this->boxWithStatus(BoxStatus::ReceivedByWarehouse);
        $this->scan($overdueLoadingBox, TrackingPhase::RECEIVED_BY_WAREHOUSE, now()->subHours(25));

        $missedEtaBatch = Batch::factory()->create([
            'status' => BatchStatus::Sailed,
            'eta_at' => now()->subHours(25),
        ]);
        $missedEtaBox = $this->boxWithStatus(BoxStatus::InTransit, ['batch_id' => $missedEtaBatch->id]);

        $heldBox = $this->boxWithStatus(BoxStatus::Held);
        $damagedBox = $this->boxWithStatus(BoxStatus::Damaged);

        $unpaidBooking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Pending,
        ]);
        $unpaidBox = Box::factory()->create([
            'booking_id' => $unpaidBooking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'batch_id' => null,
        ]);

        $deliveryOverdueBox = $this->boxWithStatus(BoxStatus::InTransit);
        $this->scan($deliveryOverdueBox, TrackingPhase::OUT_FOR_DELIVERY, now()->subHours(13));

        $results = $service->performAudit();

        $this->assertSame(2, $results['stale_scan']);
        $this->assertSame(1, $results['delayed_receipt']);
        $this->assertSame(1, $results['overdue_loading']);
        $this->assertSame(1, $results['missed_eta']);
        $this->assertSame(1, $results['held_box']);
        $this->assertSame(1, $results['damaged_box']);
        $this->assertSame(1, $results['unpaid_loading_block']);
        $this->assertSame(1, $results['delivery_overdue']);

        foreach ([
            'stale_scan' => $staleBox,
            'delayed_receipt' => $delayedReceiptBox,
            'overdue_loading' => $overdueLoadingBox,
            'missed_eta' => $missedEtaBox,
            'held_box' => $heldBox,
            'damaged_box' => $damagedBox,
            'unpaid_loading_block' => $unpaidBox,
            'delivery_overdue' => $deliveryOverdueBox,
        ] as $type => $box) {
            $this->assertDatabaseHas('data_integrity_warnings', [
                'type' => $type,
                'record_type' => Box::class,
                'record_id' => $box->id,
                'is_resolved' => false,
            ]);

            $warning = DataIntegrityWarning::where('type', $type)->where('record_id', $box->id)->firstOrFail();
            $this->assertNotNull($warning->metadata['recommended_action'] ?? null);
            $this->assertNotNull($warning->metadata['severity_reason'] ?? null);
            $this->assertNotNull($warning->metadata['target_url'] ?? null);
            $this->assertNotNull($warning->metadata['resolve_url'] ?? null);
        }

        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'stale_scan',
            'record_type' => Box::class,
            'record_id' => $arrivedNotSortedBox->id,
            'is_resolved' => false,
        ]);

        $warning = DataIntegrityWarning::where('type', 'delayed_receipt')->firstOrFail();
        $this->assertSame($delayedReceiptBox->tracking_number, $warning->metadata['tracking_number']);
        $this->assertSame($delayedReceiptBox->booking->reference_number, $warning->metadata['booking_reference']);
    }

    public function test_cleanup_resolves_operations_warnings_that_no_longer_apply(): void
    {
        $service = app(DataIntegrityService::class);
        $box = $this->boxWithStatus(BoxStatus::Held);

        $service->performAudit();
        $warning = DataIntegrityWarning::where('type', 'held_box')->firstOrFail();

        $box->update(['status' => BoxStatus::ReceivedByWarehouse]);
        $service->cleanupResolvedWarnings();

        $this->assertTrue($warning->fresh()->is_resolved);
        $this->assertNotNull($warning->fresh()->resolved_at);
    }

    public function test_admin_can_filter_operations_exceptions(): void
    {
        $admin = User::factory()->create(['role' => Role::SuperAdmin]);
        $box = $this->boxWithStatus(BoxStatus::Damaged);
        $heldBox = $this->boxWithStatus(BoxStatus::Held);

        $response = $this->actingAs($admin)->get(route('admin.data-integrity.index', [
            'type' => 'damaged_box',
            'severity' => 'high',
            'q' => 'Damaged',
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('admin/DataIntegrity/Index')
            ->where('filters.type', 'damaged_box')
            ->where('filters.severity', 'high')
            ->where('filters.q', 'Damaged')
            ->has('warnings.data', 1)
            ->where('warnings.data.0.type', 'damaged_box'));
    }

    public function test_audit_command_reports_operations_exception_counts(): void
    {
        $box = $this->boxWithStatus(BoxStatus::Collected);
        $this->scan($box, TrackingPhase::PICKED_UP, now()->subHours(25));

        $this->artisan('app:audit-data-integrity')
            ->expectsOutputToContain('Delayed Warehouse Receipts')
            ->expectsOutputToContain('Delivery Overdue')
            ->assertExitCode(0);
    }

    public function test_overdue_loading_warning_uses_configured_threshold(): void
    {
        config(['logistics.sla_hours.overdue_loading' => 12]);

        $box = $this->boxWithStatus(BoxStatus::ReceivedByWarehouse);
        $this->scan($box, TrackingPhase::RECEIVED_BY_WAREHOUSE, now()->subHours(13));

        $results = app(DataIntegrityService::class)->performAudit();

        $this->assertSame(1, $results['overdue_loading']);
        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'overdue_loading',
            'record_type' => Box::class,
            'record_id' => $box->id,
            'is_resolved' => false,
        ]);
    }

    public function test_audit_creates_expanded_business_exception_warnings(): void
    {
        config(['logistics.sla_hours.missed_pickup' => 24]);

        $service = app(DataIntegrityService::class);

        $pickupBooking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Pending,
        ]);
        $pendingPickupBox = Box::factory()->create([
            'booking_id' => $pickupBooking->id,
            'status' => BoxStatus::Pending,
        ]);
        $collectedPickupBox = Box::factory()->create([
            'booking_id' => $pickupBooking->id,
            'status' => BoxStatus::Collected,
        ]);
        $pickupRunsheet = Runsheet::factory()->create([
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Assigned,
            'scheduled_date' => now()->subHours(25),
        ]);
        $pickupRunsheet->bookings()->attach($pickupBooking->id);

        $warehouseBooking = Booking::factory()->create([
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
        ]);
        $warehouseBox = Box::factory()->create([
            'booking_id' => $warehouseBooking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'warehouse_location' => null,
        ]);

        $overrunBatch = Batch::factory()->create([
            'capacity_boxes' => 1,
            'current_box_count' => 2,
        ]);

        $blockedBatch = Batch::factory()->create([
            'status' => BatchStatus::ReadyToClose,
            'capacity_boxes' => 1,
        ]);
        $blockedBooking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Pending,
        ]);
        $blockedBox = Box::factory()->create([
            'booking_id' => $blockedBooking->id,
            'batch_id' => $blockedBatch->id,
            'status' => BoxStatus::ReceivedByWarehouse,
        ]);

        $deliveryBooking = Booking::factory()->create([
            'status' => BookingStatus::Shipped,
            'payment_status' => PaymentStatus::Paid,
        ]);
        $deliveredBox = Box::factory()->create([
            'booking_id' => $deliveryBooking->id,
            'status' => BoxStatus::Delivered,
            'delivery_proof_path' => null,
            'signature_path' => null,
        ]);
        $undeliveredBox = Box::factory()->create([
            'booking_id' => $deliveryBooking->id,
            'status' => BoxStatus::OutForDelivery,
        ]);

        $paidBooking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);
        $unbackedInvoice = Invoice::create([
            'booking_id' => $paidBooking->id,
            'invoice_number' => 'INV-TEST-UNBACKED',
            'amount' => 100,
            'status' => 'paid',
        ]);

        $mismatchBooking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);
        $mismatchInvoice = Invoice::create([
            'booking_id' => $mismatchBooking->id,
            'invoice_number' => 'INV-TEST-MISMATCH',
            'amount' => 100,
            'status' => 'paid',
        ]);
        Payment::create([
            'invoice_id' => $mismatchInvoice->id,
            'amount' => 75,
            'payment_method' => 'cash',
            'paid_at' => now(),
        ]);

        $results = $service->performAudit();

        $this->assertSame(1, $results['missed_pickup']);
        $this->assertSame(1, $results['partial_pickup']);
        $this->assertSame(2, $results['missing_warehouse_location']);
        $this->assertSame(1, $results['batch_capacity_overrun']);
        $this->assertSame(1, $results['batch_status_blocked']);
        $this->assertSame(1, $results['partial_delivery']);
        $this->assertSame(1, $results['delivery_proof_missing']);
        $this->assertSame(1, $results['paid_no_payment_record']);
        $this->assertSame(1, $results['payment_balance_mismatch']);

        foreach ([
            ['missed_pickup', Runsheet::class, $pickupRunsheet->id],
            ['partial_pickup', Booking::class, $pickupBooking->id],
            ['missing_warehouse_location', Box::class, $warehouseBox->id],
            ['batch_capacity_overrun', Batch::class, $overrunBatch->id],
            ['batch_status_blocked', Batch::class, $blockedBatch->id],
            ['partial_delivery', Booking::class, $deliveryBooking->id],
            ['delivery_proof_missing', Box::class, $deliveredBox->id],
            ['paid_no_payment_record', Booking::class, $paidBooking->id],
            ['payment_balance_mismatch', Invoice::class, $mismatchInvoice->id],
        ] as [$type, $recordType, $recordId]) {
            $this->assertDatabaseHas('data_integrity_warnings', [
                'type' => $type,
                'record_type' => $recordType,
                'record_id' => $recordId,
                'is_resolved' => false,
            ]);

            $warning = DataIntegrityWarning::where('type', $type)->where('record_id', $recordId)->firstOrFail();
            $this->assertNotNull($warning->metadata['recommended_action'] ?? null);
            $this->assertNotNull($warning->metadata['severity_reason'] ?? null);
            $this->assertNotNull($warning->metadata['target_url'] ?? null);
            $this->assertNotNull($warning->metadata['resolve_url'] ?? null);
        }

        $warning = DataIntegrityWarning::where('type', 'missed_pickup')->firstOrFail();
        $this->assertSame($pendingPickupBox->tracking_number, $warning->metadata['pending_boxes'][0]);
        $this->assertArrayHasKey('target_url', $warning->metadata);
        $this->assertArrayHasKey('recommended_action', $warning->metadata);

        $this->assertNotNull($collectedPickupBox->id);
        $this->assertNotNull($blockedBox->id);
        $this->assertNotNull($undeliveredBox->id);
        $this->assertNotNull($unbackedInvoice->id);
    }

    public function test_cash_collected_bookings_are_not_flagged_as_unpaid(): void
    {
        $service = app(DataIntegrityService::class);

        // Bug #2: CashCollected box should NOT trigger unpaid_loading_block
        $cashCollectedBooking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::CashCollected,
        ]);
        $cashCollectedBox = Box::factory()->create([
            'booking_id' => $cashCollectedBooking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'batch_id' => null,
        ]);

        // Contrast: Pending booking SHOULD trigger unpaid_loading_block
        $pendingBooking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Pending,
        ]);
        $pendingBox = Box::factory()->create([
            'booking_id' => $pendingBooking->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'batch_id' => null,
        ]);

        $results = $service->performAudit();

        $this->assertSame(1, $results['unpaid_loading_block']);
        $this->assertDatabaseMissing('data_integrity_warnings', [
            'type' => 'unpaid_loading_block',
            'record_id' => $cashCollectedBox->id,
        ]);
        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'unpaid_loading_block',
            'record_id' => $pendingBox->id,
            'is_resolved' => false,
        ]);
    }

    public function test_cash_collected_bookings_do_not_block_batch_status(): void
    {
        $service = app(DataIntegrityService::class);

        // Bug #3: CashCollected box in a batch should NOT trigger batch_status_blocked
        $cashCollectedBooking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::CashCollected,
        ]);
        $batch = Batch::factory()->create([
            'status' => BatchStatus::ReadyToClose,
            'capacity_boxes' => 10,
        ]);
        Box::factory()->create([
            'booking_id' => $cashCollectedBooking->id,
            'batch_id' => $batch->id,
            'status' => BoxStatus::LoadedToContainer,
        ]);

        $results = $service->performAudit();

        $this->assertSame(0, $results['batch_status_blocked']);
        $this->assertDatabaseMissing('data_integrity_warnings', [
            'type' => 'batch_status_blocked',
            'record_id' => $batch->id,
        ]);
    }

    public function test_paid_no_payment_record_detects_only_unsettled_payments(): void
    {
        $service = app(DataIntegrityService::class);

        // Bug #5: A paid booking with only a failed Stripe attempt should still be flagged
        $paidBooking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);
        $invoice = Invoice::create([
            'booking_id' => $paidBooking->id,
            'invoice_number' => 'INV-TEST-FAILED-STRIPE',
            'amount' => 100,
            'status' => 'paid',
        ]);
        // Failed Stripe attempt — NOT settled
        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100,
            'payment_method' => 'stripe_card',
            'stripe_status' => 'requires_payment_method',
            'is_cash_payment' => false,
            'paid_at' => null,
        ]);

        // Re-set to Paid after Payment::create because PaymentObserver resets it.
        // This simulates the real-world data inconsistency we're trying to catch.
        \Illuminate\Support\Facades\DB::table('bookings')
            ->where('id', $paidBooking->id)
            ->update(['payment_status' => PaymentStatus::Paid->value]);

        $results = $service->performAudit();

        $this->assertSame(1, $results['paid_no_payment_record']);
        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'paid_no_payment_record',
            'record_id' => $paidBooking->id,
            'is_resolved' => false,
        ]);

        // Cleanup should NOT resolve it (failed Stripe attempt is not settled)
        $service->cleanupResolvedWarnings();
        $warning = DataIntegrityWarning::where('type', 'paid_no_payment_record')
            ->where('record_id', $paidBooking->id)
            ->firstOrFail();
        $this->assertFalse($warning->is_resolved);
    }

    private function boxWithStatus(BoxStatus $status, array $overrides = []): Box
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);

        return Box::factory()->create(array_merge([
            'booking_id' => $booking->id,
            'status' => $status,
        ], $overrides));
    }

    private function scan(Box $box, TrackingPhase $phase, \DateTimeInterface $createdAt): void
    {
        BoxUpdate::unguarded(fn () => BoxUpdate::create([
            'box_id' => $box->id,
            'status' => $box->status->value,
            'tracking_phase' => $phase->value,
            'description' => $phase->label(),
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]));
    }
}
