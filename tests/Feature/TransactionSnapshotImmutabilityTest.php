<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Invoice;
use App\Models\Recipient;
use App\Models\Sender;
use App\Repositories\Eloquent\TrackingRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TransactionSnapshotImmutabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_sender_snapshot_remains_stable_after_sender_edit(): void
    {
        $sender = Sender::factory()->create([
            'first_name' => 'Original',
            'last_name' => 'Sender',
            'email' => 'original.sender@example.com',
            'mobile' => '+61411111111',
            'address' => '100 Old Street',
            'latitude' => -33.86880000,
            'longitude' => 151.20930000,
        ]);

        $area = Area::create([
            'name' => 'Snapshot Area',
            'is_active' => true,
        ]);

        $recipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'Recipient One',
            'address' => '200 Receiver Lane',
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'zip_code' => '1000',
            'latitude' => 14.59950000,
            'longitude' => 120.98420000,
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => 'confirmed',
            'payment_status' => 'pending',
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'price_charged' => 250.75,
            'status' => 'pending',
        ]);

        $invoice = Invoice::generateForBooking($booking->fresh());

        $sender->update([
            'first_name' => 'Edited',
            'last_name' => 'Profile',
            'address' => '900 New Street',
            'latitude' => -34.00000000,
            'longitude' => 150.00000000,
        ]);

        $invoice->load(['booking.sender', 'booking.boxes.boxType', 'booking.boxes.recipient']);
        $payload = $invoice->toHistoricalPayload();

        $this->assertSame('Edited', $sender->fresh()->first_name);
        $this->assertSame('Original', $payload['booking']['sender']['first_name']);
        $this->assertSame('Sender', $payload['booking']['sender']['last_name']);
        $this->assertSame('100 Old Street', $payload['booking']['sender']['address']);
        $this->assertEquals(-33.8688, $payload['booking']['sender']['latitude']);
        $this->assertEquals(151.2093, $payload['booking']['sender']['longitude']);
        $this->assertEquals(-33.8688, data_get($invoice->sender_snapshot, 'latitude'));
        $this->assertEquals(151.2093, data_get($invoice->sender_snapshot, 'longitude'));
    }

    public function test_tracking_destination_uses_box_snapshot_after_recipient_edit(): void
    {
        $sender = Sender::factory()->create();
        $area = Area::create([
            'name' => 'Tracking Area',
            'is_active' => true,
        ]);

        $recipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'Tracking Recipient',
            'address' => '123 Port Road',
            'city' => 'Cebu City',
            'province' => 'Cebu',
            'zip_code' => '6000',
            'latitude' => 10.31570000,
            'longitude' => 123.88540000,
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => 'confirmed',
            'payment_status' => 'pending',
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => 'pending',
        ])->fresh();

        $originalDestination = $box->destination;
        $this->assertSame('Cebu City, Cebu', $originalDestination);

        $recipient->update([
            'city' => 'Davao City',
            'province' => 'Davao del Sur',
            'latitude' => 7.07310000,
            'longitude' => 125.61100000,
        ]);

        $trackingData = app(TrackingRepository::class)->getTrackingData($box->tracking_number);

        $this->assertNotNull($trackingData);
        $this->assertSame('Cebu City, Cebu', $trackingData['destination']);
        $this->assertSame('Cebu City, Cebu', $booking->fresh()->destination);
    }

    public function test_booking_historical_payload_uses_sender_and_recipient_snapshots_after_edits(): void
    {
        $sender = Sender::factory()->create([
            'first_name' => 'Stable',
            'last_name' => 'Sender',
            'mobile' => '+61422222222',
            'address' => 'Old Sender Address',
            'latitude' => -33.86880000,
            'longitude' => 151.20930000,
        ]);

        $area = Area::create([
            'name' => 'History Area',
            'is_active' => true,
        ]);

        $recipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'Old Recipient',
            'address' => 'Old Recipient Address',
            'city' => 'Cebu City',
            'province' => 'Cebu',
            'zip_code' => '6000',
            'latitude' => 10.31570000,
            'longitude' => 123.88540000,
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => 'confirmed',
            'payment_status' => 'pending',
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => 'pending',
        ]);

        $sender->update([
            'first_name' => 'Edited',
            'address' => 'New Sender Address',
            'latitude' => -34.00000000,
            'longitude' => 150.00000000,
        ]);

        $recipient->update([
            'name' => 'New Recipient',
            'city' => 'Davao City',
            'province' => 'Davao del Sur',
            'latitude' => 7.07310000,
            'longitude' => 125.61100000,
        ]);

        $payload = $booking->fresh()->load(['sender', 'boxes.recipient', 'boxes.boxType'])->toHistoricalPayload();

        $this->assertSame('Edited', $sender->fresh()->first_name);
        $this->assertSame('Stable', data_get($payload, 'sender.first_name'));
        $this->assertSame('Old Sender Address', data_get($payload, 'sender.address'));
        $this->assertEquals(-33.8688, data_get($payload, 'sender.latitude'));
        $this->assertEquals(151.2093, data_get($payload, 'sender.longitude'));
        $this->assertSame('Old Recipient', data_get($payload, 'boxes.0.recipient.name'));
        $this->assertSame('Cebu City', data_get($payload, 'boxes.0.recipient.city'));
        $this->assertEquals(10.3157, data_get($payload, 'boxes.0.recipient.latitude'));
        $this->assertEquals(123.8854, data_get($payload, 'boxes.0.recipient.longitude'));
        $this->assertSame('Cebu City, Cebu', data_get($payload, 'boxes.0.destination'));
    }
}
