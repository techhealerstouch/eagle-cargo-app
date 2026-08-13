<?php

namespace Tests\Feature\Sender;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\Area;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Recipient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Tests\TestCase;

class MidTransitAddressChangeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    // -----------------------------------------------------------------------
    // Option A: area_id change is BLOCKED when any box is mid-transit.
    // Changing area changes the BoxPrice matrix, so price integrity demands
    // we reject this at the controller level.
    // -----------------------------------------------------------------------

    public function test_sender_cannot_change_delivery_area_while_box_is_mid_transit(): void
    {
        $area1 = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);
        $area2 = Area::firstOrCreate(['name' => 'Cebu'], ['is_active' => true]);

        $senderUser = User::factory()->create(['role' => Role::Sender]);
        $sender     = $senderUser->sender;

        $recipient = Recipient::factory()->create([
            'sender_id'    => $sender->id,
            'address'      => '123 Old Street',
            'city'         => 'Makati City',
            'province'     => 'Metro Manila',
            'area_id'      => $area1->id,
            'phone_number' => '09171112222',
        ]);

        $booking = Booking::factory()->create([
            'sender_id'          => $sender->id,
            'status'             => BookingStatus::Shipped,
            'attention_required' => false,
        ]);

        $batch = Batch::factory()->create([
            'batch_number' => 'BATCH-SAILED-001',
            'status'       => BatchStatus::Sailed,
        ]);

        Box::factory()->create([
            'booking_id'   => $booking->id,
            'recipient_id' => $recipient->id,
            'batch_id'     => $batch->id,
            'status'       => BoxStatus::InTransit,
            'destination'  => 'Makati City, Metro Manila',
        ]);

        // Attempt to change area mid-transit
        $response = $this->actingAs($senderUser)
            ->put(route('sender.recipients.update', $recipient), [
                'name'         => $recipient->name,
                'email'        => $recipient->email,
                'phone_number' => '09171112222',
                'address'      => '456 New Ocean View Blvd',
                'city'         => 'Cebu City',
                'province'     => 'Cebu',
                'zip_code'     => '6000',
                'landmarks'    => 'Near Port Gateway',
                'area_id'      => $area2->id,  // <-- different area!
            ]);

        // Should be rejected with a validation error on area_id
        $response->assertSessionHasErrors(['area_id']);

        // Recipient must not have been updated
        $recipient->refresh();
        $this->assertEquals($area1->id, $recipient->area_id);
        $this->assertEquals('123 Old Street', $recipient->address);
    }

    // -----------------------------------------------------------------------
    // Text-only address changes (same area_id) are still ALLOWED mid-transit.
    // The RecipientObserver fires, updates box.destination, flags the booking,
    // and writes an ActivityLog entry.
    // -----------------------------------------------------------------------

    public function test_sender_can_update_address_text_mid_transit_when_area_is_unchanged(): void
    {
        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);

        $senderUser = User::factory()->create(['role' => Role::Sender]);
        $sender     = $senderUser->sender;

        $recipient = Recipient::factory()->create([
            'sender_id'    => $sender->id,
            'address'      => '123 Old Street',
            'city'         => 'Makati City',
            'province'     => 'Metro Manila',
            'area_id'      => $area->id,
            'phone_number' => '09171112222',
        ]);

        $booking = Booking::factory()->create([
            'sender_id'          => $sender->id,
            'status'             => BookingStatus::Shipped,
            'attention_required' => false,
        ]);

        $batch = Batch::factory()->create([
            'batch_number' => 'BATCH-SAILED-002',
            'status'       => BatchStatus::Sailed,
        ]);

        $box = Box::factory()->create([
            'booking_id'   => $booking->id,
            'recipient_id' => $recipient->id,
            'batch_id'     => $batch->id,
            'status'       => BoxStatus::InTransit,
            'destination'  => 'Makati City, Metro Manila',
        ]);

        // Update street address and city only — same area_id
        $response = $this->actingAs($senderUser)
            ->put(route('sender.recipients.update', $recipient), [
                'name'         => $recipient->name,
                'email'        => $recipient->email,
                'phone_number' => '09171112222',
                'address'      => '789 Corrected Blvd, Barangay San Jose',
                'city'         => 'Quezon City',
                'province'     => 'Metro Manila',
                'zip_code'     => '1100',
                'landmarks'    => 'Near QC Circle',
                'area_id'      => $area->id,  // <-- SAME area
            ]);

        $response->assertRedirect(route('sender.recipients.index'));

        // Recipient updated
        $recipient->refresh();
        $this->assertEquals('789 Corrected Blvd, Barangay San Jose', $recipient->address);
        $this->assertEquals('Quezon City', $recipient->city);

        // Box destination updated by RecipientObserver
        $box->refresh();
        $this->assertEquals('Quezon City, Metro Manila', $box->destination);

        // Booking flagged for re-routing
        $booking->refresh();
        $this->assertTrue($booking->attention_required);
        $this->assertStringContainsString('Mid-transit recipient address updated', $booking->admin_notes);

        // ActivityLog audit entry created
        $this->assertDatabaseHas('activity_logs', [
            'model_type' => Box::class,
            'model_id'   => $box->id,
            'action'     => 'mid_transit_address_change',
        ]);

        $activity = ActivityLog::where('model_type', Box::class)
            ->where('model_id', $box->id)
            ->where('action', 'mid_transit_address_change')
            ->first();

        $this->assertNotNull($activity);
        $this->assertEquals('Makati City', $activity->changes['old_city']);
        $this->assertEquals('Quezon City', $activity->changes['new_city']);
    }
}
