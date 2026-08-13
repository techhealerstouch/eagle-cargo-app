<?php

namespace Tests\Feature\Warehouse;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\DataIntegrityWarning;
use App\Models\Invoice;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Tests\TestCase;

class DuplicateBatchScanTest extends TestCase
{
    use RefreshDatabase;

    protected User $warehouseUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
        $this->warehouseUser = User::factory()->create(['role' => Role::Warehouse]);
    }

    public function test_scanning_box_into_second_batch_triggers_duplicate_alert_and_logs_warning(): void
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

        Invoice::factory()->create([
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

        $batchA = Batch::factory()->create([
            'batch_number' => 'BATCH-A-001',
            'status' => BatchStatus::Open,
        ]);

        $batchB = Batch::factory()->create([
            'batch_number' => 'BATCH-B-002',
            'status' => BatchStatus::Open,
        ]);

        // 1. Initial successful scan into Batch A
        $response1 = $this->actingAs($this->warehouseUser)
            ->post(route('warehouse.load'), [
                'tracking_number' => $box->tracking_number,
                'batch_id' => $batchA->id,
            ]);

        $response1->assertSessionHas('success');
        $this->assertEquals($batchA->id, $box->fresh()->batch_id);

        // 2. Duplicate scan attempt into Batch B

        $response2 = $this->actingAs($this->warehouseUser)
            ->post(route('warehouse.load'), [
                'tracking_number' => $box->tracking_number,
                'batch_id' => $batchB->id,
            ]);

        $response2->assertSessionHasErrors('tracking_number');
        
        // Assert session error contains duplicate scan alert message
        $errors = session('errors')->get('tracking_number');
        $this->assertStringContainsString('DUPLICATE SCAN ALERT', $errors[0]);

        // Assert box remains in Batch A
        $this->assertEquals($batchA->id, $box->fresh()->batch_id);

        // Assert DataIntegrityWarning was logged
        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'duplicate_batch_scan',
            'record_type' => Box::class,
            'record_id' => $box->id,
            'severity' => 'error',
            'is_resolved' => false,
        ]);

        $warning = DataIntegrityWarning::where('type', 'duplicate_batch_scan')
            ->where('record_id', $box->id)
            ->first();

        $this->assertNotNull($warning);
        $this->assertStringContainsString('BATCH-A-001', $warning->message);
        $this->assertEquals($batchA->id, $warning->metadata['existing_batch_id']);
        $this->assertEquals($batchB->id, $warning->metadata['target_batch_id']);
    }
}
