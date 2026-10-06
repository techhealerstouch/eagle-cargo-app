<?php

namespace Tests\Feature\Admin;

use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminBookingUpdateRecipientTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_booking_update_syncs_recipient_and_destination_snapshots(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $sender = Sender::factory()->create([
            'first_name' => 'Weston',
            'last_name' => 'Sheila',
            'email' => 'weston.sheila@example.com',
        ]);

        $area = Area::factory()->create(['name' => 'Gold Coast']);

        $recipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'CHRISTOPHER CAPILI CRUZ',
            'address' => 'Block 9 Lot 9 Oakridge Filinvest',
            'city' => 'Dasmarinas',
            'province' => 'Cavite',
            'zip_code' => '4114',
            'phone_number' => '+639652370275',
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => 'confirmed',
            'payment_status' => 'paid',
            'payment_method' => 'bank_transfer',
            'payment_reference' => 'REF-12345',
            'declaration_form_status' => 'submitted_online',
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => BoxStatus::Pending,
            'destination' => 'Dasmarinas, Cavite',
        ]);

        // Baseline verification: historical payload has original snapshot
        $payloadBefore = $booking->fresh()->toHistoricalPayload();
        $this->assertSame('CHRISTOPHER CAPILI CRUZ', data_get($payloadBefore, 'boxes.0.recipient.name'));
        $this->assertSame('Dasmarinas, Cavite', data_get($payloadBefore, 'boxes.0.destination'));

        // Admin updates recipient name to "Froilan Flores", destination to "Cabuyao, LAGUNA", phone and address
        $updatePayload = [
            'sender_id' => $sender->id,
            'status' => 'confirmed',
            'booking_type' => 'home_pickup',
            'recipient_name' => 'Froilan Flores',
            'recipient_phone' => '09171234567',
            'recipient_secondary_phone' => '09181234567',
            'recipient_address' => 'Unit 12B Amber Tower',
            'destination' => 'Cabuyao, LAGUNA',
            'payment_status' => 'paid',
            'payment_method' => 'bank_transfer',
            'payment_reference' => 'REF-12345',
            'declaration_form_status' => 'submitted_online',
        ];

        $this->withoutExceptionHandling();

        $response = $this->withoutMiddleware(ValidateCsrfToken::class)
            ->actingAs($admin)
            ->put("/admin/bookings/{$booking->id}", $updatePayload);

        $response->assertRedirect('/admin/bookings');

        // Check recipient model was updated
        $this->assertSame('Froilan Flores', $recipient->fresh()->name);
        $this->assertSame('09171234567', $recipient->fresh()->phone_number);
        $this->assertSame('09181234567', $recipient->fresh()->secondary_phone_number);
        $this->assertSame('Unit 12B Amber Tower', $recipient->fresh()->address);
        $this->assertSame('Cabuyao', $recipient->fresh()->city);
        $this->assertSame('LAGUNA', $recipient->fresh()->province);

        // Check box destination and recipient snapshot were updated
        $refreshedBox = $box->fresh();
        $this->assertSame('Cabuyao, LAGUNA', $refreshedBox->destination);
        $this->assertSame('Froilan Flores', data_get($refreshedBox->recipient_snapshot, 'name'));
        $this->assertSame('09171234567', data_get($refreshedBox->recipient_snapshot, 'phone_number'));
        $this->assertSame('09181234567', data_get($refreshedBox->recipient_snapshot, 'secondary_phone_number'));
        $this->assertSame('Unit 12B Amber Tower', data_get($refreshedBox->recipient_snapshot, 'address'));
        $this->assertSame('Cabuyao', data_get($refreshedBox->recipient_snapshot, 'city'));
        $this->assertSame('LAGUNA', data_get($refreshedBox->recipient_snapshot, 'province'));

        // Check booking primary recipient snapshot was updated
        $refreshedBooking = $booking->fresh();
        $this->assertSame('Froilan Flores', data_get($refreshedBooking->primary_recipient_snapshot, 'name'));
        $this->assertSame('09171234567', data_get($refreshedBooking->primary_recipient_snapshot, 'phone_number'));
        $this->assertSame('09181234567', data_get($refreshedBooking->primary_recipient_snapshot, 'secondary_phone_number'));
        $this->assertSame('Unit 12B Amber Tower', data_get($refreshedBooking->primary_recipient_snapshot, 'address'));

        // Verify toHistoricalPayload() now reflects the updated recipient and destination
        $payloadAfter = $refreshedBooking->toHistoricalPayload();
        $this->assertSame('Froilan Flores', data_get($payloadAfter, 'recipient_name'));
        $this->assertSame('Froilan Flores', data_get($payloadAfter, 'boxes.0.recipient.name'));
        $this->assertSame('09171234567', data_get($payloadAfter, 'boxes.0.recipient.phone_number'));
        $this->assertSame('Unit 12B Amber Tower', data_get($payloadAfter, 'boxes.0.recipient.address'));
        $this->assertSame('Cabuyao, LAGUNA', data_get($payloadAfter, 'destination'));
        $this->assertSame('Cabuyao, LAGUNA', data_get($payloadAfter, 'boxes.0.destination'));

        // Verify edit route provides the updated recipient fields
        $editResponse = $this->actingAs($admin)->get("/admin/bookings/{$booking->id}/edit");
        $editResponse->assertOk();
        $editResponse->assertInertia(fn ($page) => $page
            ->component('admin/bookings/edit')
            ->where('booking.recipient_name', 'Froilan Flores')
            ->where('booking.recipient_phone', '09171234567')
            ->where('booking.recipient_secondary_phone', '09181234567')
            ->where('booking.recipient_address', 'Unit 12B Amber Tower')
        );
    }
}
