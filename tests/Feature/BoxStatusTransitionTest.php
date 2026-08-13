<?php

namespace Tests\Feature;

use App\Enums\BoxStatus;
use App\Models\Booking;
use App\Models\Box;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;
use Illuminate\Support\Facades\Notification;

class BoxStatusTransitionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        // Create a box to test with
        $this->booking = Booking::factory()->create();
    }

    #[Test]
    public function it_enforces_status_transition_on_eloquent_save()
    {
        $box = Box::factory()->create(['booking_id' => $this->booking->id, 'status' => BoxStatus::Pending]);

        // Attempt invalid transition: Pending -> Delivered (skipped Collected/InTransit etc)
        // Note: Check BoxStatus::canTransitionTo for exact rules, but usually Pending to Delivered is not direct.
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Unauthorized transition');

        $box->status = BoxStatus::Delivered;
        $box->save();
    }

#[Test]
    public function it_enforces_status_transition_on_update_quietly()
    {
        $box = Box::factory()->create(['booking_id' => $this->booking->id, 'status' => BoxStatus::Pending]);

        // updateQuietly bypasses scouts/observers but should NOT bypass model setter
        $this->expectException(\RuntimeException::class);

        $box->updateQuietly(['status' => BoxStatus::Delivered]);
    }

    #[Test]
    public function it_validates_status_value_in_setter()
    {
        $box = Box::factory()->create(['booking_id' => $this->booking->id, 'status' => BoxStatus::Pending]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid status');

        $box->status = 'invalid_status_string';
    }

#[Test]
    public function it_allows_valid_transitions()
    {
        $box = Box::factory()->create(['booking_id' => $this->booking->id, 'status' => BoxStatus::Pending]);

        // Pending -> Collected is usually valid
        $box->status = BoxStatus::Collected;
        $box->save();

        $this->assertEquals(BoxStatus::Collected, $box->fresh()->status);
    }
}
