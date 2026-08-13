<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Runsheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PickerTest extends TestCase
{
    use RefreshDatabase;

    public function test_picker_can_record_cash_payment()
    {
        $picker = User::factory()->create(['role' => Role::Picker]);

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::CashOnPickup,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'price_charged' => 50.00,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
        ]);

        $runsheet->bookings()->attach($booking->id);

        $response = $this->actingAs($picker)
            ->post(route('picker.runsheet.record-payment', $runsheet), [
                'booking_id' => $booking->id,
                'amount' => 50.00,
            ]);

        $response->assertRedirect();

        // Payment record is created but pending admin confirmation (picker is not admin)
        $this->assertDatabaseHas('payments', [
            'amount' => 50.00,
            'payment_method' => 'cash',
            'confirmed_at' => null,
        ]);

        // Booking payment status transitions to CashCollected when picker records payment
        $this->assertEquals(PaymentStatus::CashCollected, $booking->fresh()->payment_status);
        $this->assertNotNull($booking->fresh()->invoice);
        $this->assertEquals(InvoiceStatus::Unpaid, $booking->fresh()->invoice->status);
    }
}
