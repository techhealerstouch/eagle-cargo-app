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
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class PickerTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_picker_can_record_cash_payment()
    {
        $tz = config('app.timezone', 'Australia/Sydney');
        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker]);

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::CashOnPickup,
            'preferred_date' => \Carbon\Carbon::today($tz)->format('Y-m-d'),
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'price_charged' => 50.00,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
            'scheduled_date' => \Carbon\Carbon::today($tz)->format('Y-m-d'),
        ]);

        $runsheet->bookings()->attach($booking->id);

        $response = $this->actingAs($picker)
            ->post(route('picker.runsheet.record-payment', $runsheet), [
                'booking_id' => $booking->id,
                'amount' => 50.00,
            ]);

        $response->assertSessionDoesntHaveErrors();
        $response->assertRedirect();

        // Payment record is created but pending admin confirmation (picker is not admin)
        $this->assertDatabaseHas('payments', [
            'amount' => 50.00,
            'payment_method' => 'cash',
            'collected_by' => $picker->id,
            'confirmed_at' => null,
        ]);

        // Booking payment status transitions to CashCollected when picker records payment
        $this->assertEquals(PaymentStatus::CashCollected, $booking->fresh()->payment_status);
        $this->assertNotNull($booking->fresh()->invoice);
        $this->assertEquals(InvoiceStatus::Unpaid, $booking->fresh()->invoice->status);
    }

    public function test_picker_cannot_record_cash_payment_if_booking_pickup_date_is_in_the_future()
    {
        $tz = config('app.timezone', 'Australia/Sydney');
        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker]);

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::CashOnPickup,
            'preferred_date' => \Carbon\Carbon::today($tz)->addDays(3)->format('Y-m-d'),
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

        $response->assertSessionHasErrors('booking_id');

        $this->assertDatabaseMissing('payments', [
            'amount' => 50.00,
            'collected_by' => $picker->id,
        ]);

        $this->assertEquals(PaymentStatus::CashOnPickup, $booking->fresh()->payment_status);
    }

    public function test_picker_cannot_record_cash_payment_if_runsheet_scheduled_date_is_in_the_future()
    {
        $tz = config('app.timezone', 'Australia/Sydney');
        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker]);

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::CashOnPickup,
            'preferred_date' => null,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'price_charged' => 75.00,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
            'scheduled_date' => \Carbon\Carbon::today($tz)->addDays(2)->format('Y-m-d'),
        ]);

        $runsheet->bookings()->attach($booking->id);

        $response = $this->actingAs($picker)
            ->post(route('picker.runsheet.record-payment', $runsheet), [
                'booking_id' => $booking->id,
                'amount' => 75.00,
            ]);

        $response->assertSessionHasErrors('booking_id');

        $this->assertDatabaseMissing('payments', [
            'amount' => 75.00,
            'collected_by' => $picker->id,
        ]);

        $this->assertEquals(PaymentStatus::CashOnPickup, $booking->fresh()->payment_status);
    }

    public function test_picker_cannot_open_payment_console_if_pickup_date_is_in_the_future()
    {
        $tz = config('app.timezone', 'Australia/Sydney');
        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker]);

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::CashOnPickup,
            'preferred_date' => \Carbon\Carbon::today($tz)->addDays(5)->format('Y-m-d'),
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'price_charged' => 60.00,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
        ]);

        $runsheet->bookings()->attach($booking->id);

        $response = $this->actingAs($picker)
            ->get(route('picker.runsheet.payment', ['runsheet' => $runsheet, 'booking' => $booking]));

        $response->assertRedirect(route('picker.runsheet', $runsheet));
        $response->assertSessionHas('error');
    }

    public function test_picker_can_record_cash_payment_when_scheduled_date_is_today_or_past()
    {
        $tz = config('app.timezone', 'Australia/Sydney');
        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker]);

        $booking = Booking::factory()->create([
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::CashOnPickup,
            'preferred_date' => \Carbon\Carbon::today($tz)->format('Y-m-d'),
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'price_charged' => 50.00,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
            'scheduled_date' => \Carbon\Carbon::today($tz)->format('Y-m-d'),
        ]);

        $runsheet->bookings()->attach($booking->id);

        $response = $this->actingAs($picker)
            ->post(route('picker.runsheet.record-payment', $runsheet), [
                'booking_id' => $booking->id,
                'amount' => 50.00,
            ]);

        $response->assertSessionDoesntHaveErrors();
        $response->assertRedirect();

        $this->assertDatabaseHas('payments', [
            'amount' => 50.00,
            'payment_method' => 'cash',
            'collected_by' => $picker->id,
        ]);

        $this->assertEquals(PaymentStatus::CashCollected, $booking->fresh()->payment_status);
    }

    public function test_picker_can_send_a_note_for_an_assigned_pickup(): void
    {
        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker]);
        $booking = Booking::factory()->create();
        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'status' => RunsheetStatus::InProgress,
            'type' => RunsheetType::Pickup,
        ]);
        $runsheet->bookings()->attach($booking->id);

        $response = $this->actingAs($picker)->post(route('picker.runsheet.notes.store', $runsheet), [
            'booking_id' => $booking->id,
            'note' => 'Customer requested a call before collection.',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('pickup_notes', [
            'runsheet_id' => $runsheet->id,
            'booking_id' => $booking->id,
            'picker_id' => $picker->id,
            'note' => 'Customer requested a call before collection.',
        ]);
    }

    public function test_picker_cannot_send_a_note_for_another_pickers_runsheet(): void
    {
        /** @var User $assignedPicker */
        $assignedPicker = User::factory()->create(['role' => Role::Picker]);
        /** @var User $otherPicker */
        $otherPicker = User::factory()->create(['role' => Role::Picker]);
        $booking = Booking::factory()->create();
        $runsheet = Runsheet::factory()->create([
            'picker_id' => $assignedPicker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
        ]);
        $runsheet->bookings()->attach($booking->id);

        $response = $this->actingAs($otherPicker)->post(route('picker.runsheet.notes.store', $runsheet), [
            'booking_id' => $booking->id,
            'note' => 'Attempted unauthorized note.',
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('pickup_notes', [
            'runsheet_id' => $runsheet->id,
            'picker_id' => $otherPicker->id,
        ]);
    }

    public function test_picker_cannot_send_a_note_for_a_booking_outside_the_runsheet(): void
    {
        /** @var User $picker */
        $picker = User::factory()->create(['role' => Role::Picker]);
        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
        ]);
        $unassignedBooking = Booking::factory()->create();

        $response = $this->actingAs($picker)->post(route('picker.runsheet.notes.store', $runsheet), [
            'booking_id' => $unassignedBooking->id,
            'note' => 'This booking is not on my run.',
        ]);

        $response->assertSessionHasErrors('booking_id');
        $this->assertDatabaseMissing('pickup_notes', [
            'runsheet_id' => $runsheet->id,
            'booking_id' => $unassignedBooking->id,
        ]);
    }
}
