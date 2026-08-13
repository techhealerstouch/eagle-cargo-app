<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\DataIntegrityWarning;
use App\Models\Invoice;
use App\Models\Recipient;
use App\Models\Sender;
use App\Services\DataIntegrityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DataIntegritySystemTest extends TestCase
{
    use RefreshDatabase;

    // ---------------------------------------------------------------
    // 1. Missing Declarations
    // ---------------------------------------------------------------

    public function test_detects_missing_declaration_for_confirmed_booking(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'declaration_form_status' => 'missing',
        ]);

        $service = app(DataIntegrityService::class);
        $count = $service->checkMissingDeclarations();

        $this->assertSame(1, $count);
        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'missing_declaration',
            'record_type' => Booking::class,
            'record_id' => $booking->id,
            'is_resolved' => false,
            'severity' => 'high',
        ]);
    }

    public function test_detects_missing_declaration_for_collected_booking(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Collected,
            'declaration_form_status' => 'missing',
        ]);

        $service = app(DataIntegrityService::class);
        $count = $service->checkMissingDeclarations();

        $this->assertSame(1, $count);
    }

    public function test_does_not_flag_booking_with_declaration(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'declaration_form_status' => 'submitted',
        ]);

        $service = app(DataIntegrityService::class);
        $count = $service->checkMissingDeclarations();

        $this->assertSame(0, $count);
    }

    // ---------------------------------------------------------------
    // 2. Orphan Boxes
    // ---------------------------------------------------------------

    public function test_detects_orphan_boxes_not_in_batch(): void
    {
        $box = Box::factory()->create([
            'status' => BoxStatus::ReceivedByWarehouse,
            'batch_id' => null,
            'created_at' => now()->subHours(48),
            'updated_at' => now()->subHours(48),
        ]);

        $service = app(DataIntegrityService::class);
        $count = $service->checkOrphanBoxes();

        $this->assertSame(1, $count);
        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'orphan_box',
            'record_type' => Box::class,
            'record_id' => $box->id,
            'is_resolved' => false,
        ]);
    }

    public function test_does_not_flag_recent_orphan_boxes(): void
    {
        Box::factory()->create([
            'status' => BoxStatus::ReceivedByWarehouse,
            'batch_id' => null,
            'created_at' => now()->subHours(2), // Less than 24h
            'updated_at' => now()->subHours(2),
        ]);

        $service = app(DataIntegrityService::class);
        $count = $service->checkOrphanBoxes();

        $this->assertSame(0, $count);
    }

    // ---------------------------------------------------------------
    // 3. Box Count Mismatches
    // ---------------------------------------------------------------

    public function test_detects_bookings_without_boxes(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
        ]);
        // No boxes created

        $service = app(DataIntegrityService::class);
        $count = $service->checkBoxCountMismatches();

        $this->assertSame(1, $count);
        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'box_count_mismatch',
            'record_type' => Booking::class,
            'record_id' => $booking->id,
            'severity' => 'high',
        ]);
    }

    public function test_ignores_draft_bookings_without_boxes(): void
    {
        Booking::factory()->create([
            'status' => BookingStatus::Draft,
        ]);
        // Drafts without boxes are normal

        $service = app(DataIntegrityService::class);
        $count = $service->checkBoxCountMismatches();

        $this->assertSame(0, $count);
    }

    public function test_ignores_cancelled_bookings_without_boxes(): void
    {
        Booking::factory()->create([
            'status' => BookingStatus::Cancelled,
        ]);

        $service = app(DataIntegrityService::class);
        $count = $service->checkBoxCountMismatches();

        $this->assertSame(0, $count);
    }

    // ---------------------------------------------------------------
    // 4. Stale Scans
    // ---------------------------------------------------------------

    public function test_detects_boxes_with_stale_scans(): void
    {
        $box = Box::factory()->create([
            'status' => BoxStatus::InTransit,
            'updated_at' => now()->subHours(80), // More than 72h
        ]);

        $service = app(DataIntegrityService::class);
        $results = $service->performAudit();

        $this->assertArrayHasKey('stale_scan', $results);
    }

    // ---------------------------------------------------------------
    // 5. Warning Resolution
    // ---------------------------------------------------------------

    public function test_warning_can_be_resolved(): void
    {
        $warning = DataIntegrityWarning::create([
            'type' => 'missing_declaration',
            'record_type' => Booking::class,
            'record_id' => 1,
            'is_resolved' => false,
            'severity' => 'high',
            'message' => 'Test warning',
        ]);

        $warning->update(['is_resolved' => true]);

        $this->assertTrue((bool) $warning->fresh()->is_resolved);
    }

    public function test_warning_is_upserted_not_duplicated(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'declaration_form_status' => 'missing',
        ]);

        $service = app(DataIntegrityService::class);

        // Run check twice
        $service->checkMissingDeclarations();
        $service->checkMissingDeclarations();

        // Should only create one warning for the same booking
        $this->assertSame(
            1,
            DataIntegrityWarning::where('record_type', Booking::class)
                ->where('record_id', $booking->id)
                ->where('type', 'missing_declaration')
                ->where('is_resolved', false)
                ->count()
        );
    }

    // ---------------------------------------------------------------
    // 6. Full Audit
    // ---------------------------------------------------------------

    public function test_perform_audit_runs_all_checks(): void
    {
        $service = app(DataIntegrityService::class);
        $results = $service->performAudit();

        // Verify all expected checks ran
        $expectedChecks = [
            'missing_declarations',
            'orphan_boxes',
            'box_count_mismatches',
            'stale_scan',
            'missed_pickup',
            'partial_pickup',
            'delayed_receipt',
            'missing_warehouse_location',
            'overdue_loading',
            'batch_capacity_overrun',
            'batch_status_blocked',
            'missed_eta',
            'held_box',
            'damaged_box',
            'unpaid_loading_block',
            'delivery_overdue',
            'partial_delivery',
            'delivery_proof_missing',
            'paid_no_payment_record',
            'payment_balance_mismatch',
            'delivered_no_invoice',
        ];

        foreach ($expectedChecks as $check) {
            $this->assertArrayHasKey($check, $results, "Missing check: {$check}");
        }
    }

    // ---------------------------------------------------------------
    // 7. Real-Time Anomaly Detection & Events
    // ---------------------------------------------------------------

    public function test_dispatches_audit_job_and_creates_warnings_in_realtime(): void
    {
        \Illuminate\Support\Facades\Queue::fake();

        Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'declaration_form_status' => 'missing',
        ]);

        \Illuminate\Support\Facades\Queue::assertPushed(\App\Jobs\AuditDataIntegrityJob::class);
    }

    public function test_executes_audit_job_synchronously_to_produce_warnings(): void
    {
        $booking = Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'declaration_form_status' => 'missing',
        ]);

        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'missing_declaration',
            'record_type' => Booking::class,
            'record_id' => $booking->id,
            'is_resolved' => false,
            'severity' => 'high',
        ]);
    }

    public function test_broadcasts_system_health_updated_event(): void
    {
        \Illuminate\Support\Facades\Event::fake([\App\Events\SystemHealthUpdated::class]);

        DataIntegrityWarning::create([
            'type' => 'missing_declaration',
            'record_type' => Booking::class,
            'record_id' => 1,
            'is_resolved' => false,
            'severity' => 'high',
            'message' => 'Test warning',
        ]);

        \Illuminate\Support\Facades\Event::assertDispatched(\App\Events\SystemHealthUpdated::class);
    }
}
