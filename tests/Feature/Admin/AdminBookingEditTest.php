<?php

namespace Tests\Feature\Admin;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminBookingEditTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Sender $sender;
    private Booking $booking;
    private Recipient $recipient;
    private Box $box;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => Role::Admin]);
        $this->sender = Sender::factory()->create();
        $area = Area::factory()->create();
        $boxType = BoxType::factory()->create();

        $this->booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
            'declaration_form_status' => 'missing',
        ]);

        $this->recipient = Recipient::factory()->create([
            'sender_id' => $this->sender->id,
            'name' => 'Original Recipient',
        ]);

        $this->box = Box::factory()->create([
            'booking_id' => $this->booking->id,
            'recipient_id' => $this->recipient->id,
            'area_id' => $area->id,
            'box_type_id' => $boxType->id,
        ]);
    }

    public function test_updating_to_paid_with_bank_transfer_requires_reference_and_proof(): void
    {
        $payload = [
            'sender_id' => $this->sender->id,
            'status' => 'confirmed',
            'recipient_name' => 'John Doe',
            'payment_status' => 'paid',
            'payment_method' => 'bank_transfer',
            'payment_reference' => '',
            'declaration_form_status' => 'missing',
        ];

        $response = $this->actingAs($this->admin)->put("/admin/bookings/{$this->booking->id}", $payload);

        $response->assertSessionHasErrors(['payment_reference', 'proof_of_payment']);
    }

    public function test_updating_to_paid_with_cash_does_not_require_reference_or_proof(): void
    {
        $payload = [
            'sender_id' => $this->sender->id,
            'status' => 'confirmed',
            'recipient_name' => 'John Doe',
            'payment_status' => 'paid',
            'payment_method' => 'cash',
            'payment_reference' => '',
            'declaration_form_status' => 'missing',
        ];

        $response = $this->actingAs($this->admin)->put("/admin/bookings/{$this->booking->id}", $payload);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect('/admin/bookings');

        $this->booking->refresh();
        $this->assertEquals(PaymentStatus::Paid, $this->booking->payment_status);
        $this->assertEquals('cash', $this->booking->payment_method);
    }

    public function test_marking_booking_as_paid_creates_invoice_and_payment_record(): void
    {
        Storage::fake('public');

        $proofFile = UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf');

        $payload = [
            'sender_id' => $this->sender->id,
            'status' => 'confirmed',
            'recipient_name' => 'John Doe',
            'payment_status' => 'paid',
            'payment_method' => 'bank_transfer',
            'payment_reference' => 'TXN-BANK-9988',
            'proof_of_payment' => $proofFile,
            'declaration_form_status' => 'submitted_online',
        ];

        $response = $this->actingAs($this->admin)->put("/admin/bookings/{$this->booking->id}", $payload);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect('/admin/bookings');

        $this->booking->refresh();
        $this->assertNotNull($this->booking->proof_of_payment);
        Storage::disk('public')->assertExists($this->booking->proof_of_payment);

        // Verify invoice was created
        $invoice = Invoice::where('booking_id', $this->booking->id)->first();
        $this->assertNotNull($invoice);

        // Verify payment record was created
        $payment = Payment::where('invoice_id', $invoice->id)->first();
        $this->assertNotNull($payment);
        $this->assertEquals('bank_transfer', $payment->payment_method);
        $this->assertEquals('TXN-BANK-9988', $payment->reference_number);
        $this->assertEquals($this->admin->id, $payment->collected_by);
        $this->assertEquals($this->admin->id, $payment->confirmed_by);
    }

    public function test_declaration_form_upload_stores_file_and_updates_status(): void
    {
        Storage::fake('public');

        $declarationFile = UploadedFile::fake()->create('declaration.pdf', 200, 'application/pdf');

        $payload = [
            'sender_id' => $this->sender->id,
            'status' => 'confirmed',
            'recipient_name' => 'John Doe',
            'payment_status' => 'pending',
            'declaration_form_status' => 'physical_copy_received',
            'declaration_form' => $declarationFile,
        ];

        $response = $this->actingAs($this->admin)->put("/admin/bookings/{$this->booking->id}", $payload);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect('/admin/bookings');

        $this->booking->refresh();
        $this->assertEquals('physical_copy_received', $this->booking->declaration_form_status);
        $this->assertNotNull($this->booking->declaration_form_path);
        Storage::disk('public')->assertExists($this->booking->declaration_form_path);
    }
}
