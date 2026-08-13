<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Sender;
use App\Notifications\BookingStatusChanged;
use App\Notifications\BoxStatusChanged;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class BookingPickupNotificationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test 1: When a box status changes to Collected,
     * the sender receives a BoxStatusChanged notification via mail (and brevo if credentials exist).
     */
    public function test_box_pickup_notifies_sender_via_email(): void
    {
        Notification::fake();

        $sender = Sender::factory()->create([
            'email' => 'sender@example.com',
            'mobile' => '+61400000000',
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status'    => BookingStatus::Confirmed,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status'     => BoxStatus::Pending,
        ]);

        // Transition box to Collected (simulates pickup)
        $box->status = BoxStatus::Collected;
        $box->save();

        // Assert BoxStatusChanged was sent to the sender
        Notification::assertSentTo(
            $sender,
            BoxStatusChanged::class
        );
    }

    /**
     * Test 2: When ALL boxes in a booking are collected,
     * the booking rolls up to "Collected" status.
     */
    public function test_booking_status_rolls_up_to_collected_when_all_boxes_collected(): void
    {
        Notification::fake(); // Prevent real SMS/email dispatch

        $sender = Sender::factory()->create();

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status'    => BookingStatus::Confirmed,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status'     => BoxStatus::Pending,
        ]);

        // Trigger pickup
        $box->status = BoxStatus::Collected;
        $box->save();

        // Refresh from DB and verify rollup
        $this->assertEquals(BookingStatus::Collected, $booking->fresh()->status);
    }

    /**
     * Test 3: When a booking rolls up to Collected,
     * BookingStatusChanged notification is sent to the sender via mail AND sms (brevo).
     */
    public function test_booking_collected_sends_notification_to_sender_with_correct_channels(): void
    {
        Notification::fake();

        $sender = Sender::factory()->create([
            'email'  => 'sender@example.com',
            'mobile' => '+61400000000',
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status'    => BookingStatus::Confirmed,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status'     => BoxStatus::Pending,
        ]);

        // Trigger pickup — this causes booking rollup → BookingStatusChanged fires
        $box->status = BoxStatus::Collected;
        $box->save();

        // Assert BookingStatusChanged is sent to the sender
        Notification::assertSentTo(
            $sender,
            BookingStatusChanged::class,
            function (BookingStatusChanged $notification, array $channels) {
                // 'collected' is a critical stage — both mail AND brevo should be dispatched
                $this->assertContains('mail', $channels, 'Email channel should be included for collected status');
                $this->assertContains('brevo', $channels, 'SMS (brevo) channel should be included for collected status');

                return true;
            }
        );
    }

    /**
     * Test 4: Only the SENDER is notified, not the recipient,
     * when a box is picked up.
     */
    public function test_only_sender_is_notified_on_pickup_not_recipient(): void
    {
        Notification::fake();

        $sender = Sender::factory()->create();

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status'    => BookingStatus::Confirmed,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'status'     => BoxStatus::Pending,
        ]);

        // Trigger pickup
        $box->status = BoxStatus::Collected;
        $box->save();

        // Sender gets notified
        Notification::assertSentTo($sender, BoxStatusChanged::class);

        // Recipient (box->recipient) is NOT a notifiable in this flow
        // (Recipient model doesn't use Notifiable trait)
        // We just confirm the recipient model itself was never targeted
        $recipient = $box->recipient;
        Notification::assertNotSentTo($recipient, BoxStatusChanged::class);
    }
}
