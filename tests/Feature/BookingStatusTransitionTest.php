<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Models\Booking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class BookingStatusTransitionTest extends TestCase
{
    use RefreshDatabase;

#[Test]
    public function it_enforces_status_transition_on_eloquent_save()
    {
        $booking = Booking::factory()->create(['status' => BookingStatus::Draft]);

        // Attempt invalid transition: Draft -> Collected (skipped Pending/Confirmed)
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Unauthorized transition');

        $booking->status = BookingStatus::Collected;
        $booking->save();
    }

    #[Test]
    public function it_enforces_status_transition_on_update_quietly()
    {
        $booking = Booking::factory()->create(['status' => BookingStatus::Draft]);

        // updateQuietly bypasses observers but should NOT bypass model mutator
        $this->expectException(\RuntimeException::class);

        $booking->updateQuietly(['status' => BookingStatus::Shipped]);
    }

    #[Test]
    public function it_validates_status_value_in_setter()
    {
        $booking = Booking::factory()->create(['status' => BookingStatus::Draft]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid status');

        $booking->status = 'invalid_status_string';
    }

    #[Test]
    public function it_allows_valid_transitions()
    {
        $booking = Booking::factory()->create(['status' => BookingStatus::Draft]);

        // Draft -> Pending is valid
        $booking->status = BookingStatus::Pending;
        $booking->save();

        $this->assertEquals(BookingStatus::Pending, $booking->fresh()->status);
    }
}
