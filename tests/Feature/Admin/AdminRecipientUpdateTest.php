<?php

namespace Tests\Feature\Admin;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class AdminRecipientUpdateTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_admin_can_update_recipient_with_null_or_empty_zip_code(): void
    {
        $this->withoutExceptionHandling();

        $admin = User::factory()->create(['role' => Role::Admin]);
        $sender = Sender::factory()->create();
        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);

        $recipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'Jane Doe',
            'address' => '456 Sampaguita St',
            'city' => 'Manila',
            'province' => 'METRO MANILA',
            'zip_code' => '1000',
            'phone_number' => '09123456789',
        ]);

        $response = $this->actingAs($admin)->put(route('admin.recipients.update', $recipient), [
            'name' => 'Jane Dave Bravo',
            'address' => '456 Sampaguita St',
            'city' => 'Manila',
            'province' => 'METRO MANILA',
            'zip_code' => '',
            'phone_number' => '09123456789',
            'area_id' => $area->id,
        ]);

        $response->assertRedirect();
        $recipient->refresh();

        $this->assertSame('Jane Dave Bravo', $recipient->name);
        $this->assertNull($recipient->zip_code);
    }

    public function test_admin_recipient_update_syncs_active_booking_and_box_snapshots(): void
    {
        $this->withoutExceptionHandling();

        $admin = User::factory()->create(['role' => Role::Admin]);
        $sender = Sender::factory()->create();
        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);

        $recipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'Jane Doe',
            'address' => '456 Sampaguita St',
            'city' => 'Manila',
            'province' => 'METRO MANILA',
            'zip_code' => '1000',
            'phone_number' => '09123456789',
        ]);

        $pendingBooking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
        ]);

        $pendingBox = Box::factory()->create([
            'booking_id' => $pendingBooking->id,
            'recipient_id' => $recipient->id,
            'status' => BoxStatus::Pending,
            'destination' => 'Manila, METRO MANILA',
            'recipient_snapshot' => [
                'id' => $recipient->id,
                'name' => 'Jane Doe',
                'phone_number' => '09123456789',
                'address' => '456 Sampaguita St',
                'city' => 'Manila',
                'province' => 'METRO MANILA',
            ],
        ]);

        $pendingBooking->updateQuietly([
            'primary_recipient_snapshot' => $pendingBox->recipient_snapshot,
        ]);

        // Historical shipped booking
        $shippedBooking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Shipped,
        ]);

        $shippedBox = Box::factory()->create([
            'booking_id' => $shippedBooking->id,
            'recipient_id' => $recipient->id,
            'status' => BoxStatus::InTransit,
            'destination' => 'Manila, METRO MANILA',
            'recipient_snapshot' => [
                'id' => $recipient->id,
                'name' => 'Jane Doe',
                'phone_number' => '09123456789',
                'address' => '456 Sampaguita St',
                'city' => 'Manila',
                'province' => 'METRO MANILA',
            ],
        ]);

        $shippedBooking->updateQuietly([
            'primary_recipient_snapshot' => $shippedBox->recipient_snapshot,
        ]);

        // Admin updates recipient profile
        $response = $this->actingAs($admin)->put(route('admin.recipients.update', $recipient), [
            'name' => 'Jane Dave Bravo',
            'address' => '456 Sampaguita St',
            'city' => 'Manila',
            'province' => 'METRO MANILA',
            'zip_code' => '1000',
            'phone_number' => '09123456789',
            'area_id' => $area->id,
        ]);

        $response->assertRedirect();

        // 1. Pending booking payload should have updated recipient name
        $pendingPayload = $pendingBooking->fresh()->toHistoricalPayload();
        $this->assertSame('Jane Dave Bravo', data_get($pendingPayload, 'boxes.0.recipient.name'));
        $this->assertSame('Jane Dave Bravo', data_get($pendingPayload, 'primary_recipient_snapshot.name'));

        // 2. Shipped historical booking should preserve original snapshot
        $shippedPayload = $shippedBooking->fresh()->toHistoricalPayload();
        $this->assertSame('Jane Doe', data_get($shippedPayload, 'boxes.0.recipient.name'));
        $this->assertSame('Jane Doe', data_get($shippedPayload, 'primary_recipient_snapshot.name'));
    }
}
