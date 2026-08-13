<?php

namespace Tests\Feature\Picker;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class PickerScanWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_json_scan_collects_paid_pending_box_without_redirecting(): void
    {
        Notification::fake();

        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createPickerBox($picker, [
            'payment_status' => PaymentStatus::Paid->value,
            'declaration_form_status' => 'submitted_online',
        ]);

        $this->actingAs($picker)
            ->postJson(route('picker.scan'), [
                'tracking_number' => $box->tracking_number,
            ])
            ->assertOk()
            ->assertJsonPath('action', 'needs_review')
            ->assertJsonPath('box.trackingNumber', $box->tracking_number);

        $this->assertDatabaseHas('boxes', [
            'id' => $box->id,
            'status' => BoxStatus::Pending->value,
        ]);
    }

    public function test_json_scan_accepts_box_serial_number(): void
    {
        Notification::fake();

        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createPickerBox($picker, [
            'payment_status' => PaymentStatus::Paid->value,
            'declaration_form_status' => 'submitted_online',
        ]);
        $box->update(['serial_number' => '654321']);
        $box->refresh();

        $this->actingAs($picker)
            ->postJson(route('picker.scan'), [
                'tracking_number' => $box->serial_number,
            ])
            ->assertOk()
            ->assertJsonPath('action', 'needs_review')
            ->assertJsonPath('box.trackingNumber', $box->tracking_number)
            ->assertJsonPath('box.serialNumber', $box->serial_number);

        $this->assertDatabaseHas('boxes', [
            'id' => $box->id,
            'status' => BoxStatus::Pending->value,
        ]);
    }

    public function test_json_scan_returns_needs_review_action_without_collecting_for_missing_declaration(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createPickerBox($picker, [
            'payment_status' => PaymentStatus::Paid->value,
            'declaration_form_status' => 'missing',
        ]);

        $this->actingAs($picker)
            ->postJson(route('picker.scan'), [
                'tracking_number' => $box->tracking_number,
            ])
            ->assertOk()
            ->assertJsonPath('action', 'needs_review');

        $this->assertDatabaseHas('boxes', [
            'id' => $box->id,
            'status' => BoxStatus::Pending->value,
        ]);
    }

    public function test_json_scan_returns_payment_required_action_for_cash_pickup(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createPickerBox($picker, [
            'payment_status' => PaymentStatus::CashOnPickup->value,
            'declaration_form_status' => 'submitted_online',
        ], price: 75.50);

        $this->actingAs($picker)
            ->postJson(route('picker.scan'), [
                'tracking_number' => $box->tracking_number,
            ])
            ->assertOk()
            ->assertJsonPath('action', 'payment_required')
            ->assertJsonPath('box.booking.paymentStatus', PaymentStatus::CashOnPickup->value)
            ->assertJsonPath('box.booking.totalAmount', 75.50);

        $this->assertDatabaseHas('boxes', [
            'id' => $box->id,
            'status' => BoxStatus::Pending->value,
        ]);
    }

    public function test_json_scan_allows_collection_without_declared_weight(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createPickerBox($picker, [
            'payment_status' => PaymentStatus::Paid->value,
            'declaration_form_status' => 'submitted_online',
        ]);
        $box->update(['weight' => null]);

        $this->actingAs($picker)
            ->postJson(route('picker.scan'), [
                'tracking_number' => $box->tracking_number,
            ])
            ->assertOk()
            ->assertJsonPath('action', 'needs_review');

        $this->assertEquals(BoxStatus::Pending, $box->fresh()->status);
    }

    public function test_web_scan_allows_collection_without_declared_weight(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createPickerBox($picker, [
            'payment_status' => PaymentStatus::Paid->value,
            'declaration_form_status' => 'submitted_online',
        ]);
        $box->update(['weight' => null]);

        $this->actingAs($picker)
            ->post(route('picker.scan'), [
                'tracking_number' => $box->tracking_number,
            ])
            ->assertRedirect(route('picker.box.show', $box->tracking_number));

        $this->assertEquals(BoxStatus::Pending, $box->fresh()->status);
    }

    public function test_picker_can_batch_collect_eligible_boxes(): void
    {
        Storage::fake('public');
        Notification::fake();

        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $firstBox = $this->createPickerBox($picker, [
            'payment_status' => PaymentStatus::Paid->value,
            'declaration_form_status' => 'submitted_online',
        ]);
        $runsheet = $firstBox->booking->runsheets()->firstOrFail();
        $secondBox = Box::factory()->create([
            'booking_id' => $firstBox->booking_id,
            'recipient_id' => $firstBox->recipient_id,
            'status' => BoxStatus::Pending->value,
            'weight' => 8.5,
        ]);

        $this->actingAs($picker)
            ->post(route('picker.runsheet.collect-boxes', $runsheet), [
                'boxes' => [
                    ['id' => $firstBox->id, 'serial_number' => '111111'],
                    ['id' => $secondBox->id, 'serial_number' => '222222'],
                ],
                'pickup_proof' => UploadedFile::fake()->image('batch-pickup.jpg'),
            ])
            ->assertSessionHas('success');

        $this->assertEquals(BoxStatus::Collected, $firstBox->fresh()->status);
        $this->assertEquals(BoxStatus::Collected, $secondBox->fresh()->status);
        $this->assertEquals('111111', $firstBox->fresh()->serial_number);
        $this->assertEquals('222222', $secondBox->fresh()->serial_number);
        $this->assertNotNull($firstBox->fresh()->pickup_proof_path);
        $this->assertNotNull($secondBox->fresh()->pickup_proof_path);
    }

    public function test_batch_collection_does_not_partially_collect_when_one_box_is_ineligible(): void
    {
        Storage::fake('public');
        Notification::fake();

        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $firstBox = $this->createPickerBox($picker, [
            'payment_status' => PaymentStatus::Paid->value,
            'declaration_form_status' => 'submitted_online',
        ]);
        $runsheet = $firstBox->booking->runsheets()->firstOrFail();
        $secondBox = Box::factory()->create([
            'booking_id' => $firstBox->booking_id,
            'recipient_id' => $firstBox->recipient_id,
            'status' => BoxStatus::Collected->value,
            'weight' => 8.5,
        ]);

        $this->actingAs($picker)
            ->post(route('picker.runsheet.collect-boxes', $runsheet), [
                'boxes' => [
                    ['id' => $firstBox->id, 'serial_number' => '333333'],
                    ['id' => $secondBox->id, 'serial_number' => '444444'],
                ],
                'pickup_proof' => UploadedFile::fake()->image('batch-pickup.jpg'),
            ])
            ->assertSessionHasErrors('boxes');

        $this->assertEquals(BoxStatus::Pending, $firstBox->fresh()->status);
        $this->assertNull($firstBox->fresh()->pickup_proof_path);
    }

    public function test_picker_can_upload_declaration_with_json_response(): void
    {
        Storage::fake('local');

        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createPickerBox($picker, [
            'payment_status' => PaymentStatus::Paid->value,
            'declaration_form_status' => 'missing',
        ]);

        $this->actingAs($picker)
            ->postJson(route('picker.box.upload-declaration', $box), [
                'declaration_form' => UploadedFile::fake()->image('declaration.jpg'),
            ])
            ->assertOk()
            ->assertJsonPath('declaration_form_status', 'physical_copy_received');

        $this->assertEquals('physical_copy_received', $box->booking->fresh()->declaration_form_status);
    }

    public function test_picker_can_record_cash_payment_with_json_response(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createPickerBox($picker, [
            'payment_status' => PaymentStatus::CashOnPickup->value,
            'declaration_form_status' => 'submitted_online',
        ], price: 50.00);
        $runsheet = $box->booking->runsheets()->firstOrFail();

        $this->actingAs($picker)
            ->postJson(route('picker.runsheet.record-payment', $runsheet), [
                'booking_id' => $box->booking_id,
                'amount' => 50.00,
                'payment_method' => 'cash',
                'idempotency_key' => 'test_picker_scan_cash_'.Str::uuid(),
            ])
            ->assertOk()
            ->assertJsonPath('payment_status', PaymentStatus::CashCollected->value);

        // Booking payment status transitions to CashCollected when picker records payment
        $this->assertEquals(PaymentStatus::CashCollected, $box->booking->fresh()->payment_status);
    }

    private function createPickerBox(User $picker, array $bookingOverrides = [], float $price = 25.00): Box
    {
        $sender = Sender::factory()->create();

        $area = Area::factory()->create([
            'name' => 'Picker Scan Area '.Str::uuid(),
        ]);

        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
        ]);

        $booking = Booking::factory()->create(array_merge([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Paid->value,
            'declaration_form_status' => 'submitted_online',
        ], $bookingOverrides));

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => BoxStatus::Pending->value,
            'price_charged' => $price,
            'weight' => 12.5,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'courier_id' => null,
            'type' => RunsheetType::Pickup->value,
            'status' => RunsheetStatus::Assigned->value,
        ]);

        $runsheet->bookings()->attach($booking->id);

        return $box;
    }
}
