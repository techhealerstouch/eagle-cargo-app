<?php

namespace Tests\Feature\Sender;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Sender;
use App\Models\User;
use App\Notifications\PartialCancellationRequested;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PartialCancellationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

    public function test_sender_can_partially_cancel_booking_with_mixed_box_statuses()
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => Role::Admin]);
        $senderUser = User::factory()->create(['role' => Role::Sender]);
        $sender = $senderUser->sender;

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
        ]);

        // 3 boxes pending
        Box::factory()->count(3)->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Pending,
        ]);

        // 2 boxes picked up
        Box::factory()->count(2)->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Collected,
        ]);

        $response = $this->actingAs($senderUser)->delete(route('bookings.destroy', $booking));

        $response->assertRedirect(route('sender.bookings'));
        $response->assertSessionHas('warning');

        $booking->refresh();

        $this->assertTrue($booking->attention_required);
        $this->assertStringContainsString('Partial Cancellation Requested', $booking->admin_notes);
        
        $this->assertEquals(2, $booking->boxes()->where('status', BoxStatus::Collected)->count());
        $this->assertEquals(3, $booking->boxes()->where('status', BoxStatus::Cancelled)->count());
        $this->assertEquals(0, $booking->boxes()->where('status', BoxStatus::Pending)->count());

        Notification::assertSentTo(
            [$admin], PartialCancellationRequested::class
        );
    }
    
    public function test_sender_cannot_spam_partial_cancellation()
    {
        $senderUser = User::factory()->create(['role' => Role::Sender]);
        $sender = $senderUser->sender;

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
            'attention_required' => true,
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'status' => BoxStatus::Collected,
        ]);

        $response = $this->actingAs($senderUser)->delete(route('bookings.destroy', $booking));

        $response->assertRedirect(route('sender.bookings'));
        $response->assertSessionHas('error', 'Cancellation is already pending review.');
    }
}
