<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Box;
use App\Models\Sender;
use App\Models\TrackingLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrackingAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_tracking_increments_box_and_booking_counters_and_records_logs(): void
    {
        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'reference_number' => 'LB-2026-TEST01',
        ]);
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'tracking_number' => 'BOX-TEST-1001',
        ]);

        $this->assertEquals(0, $box->fresh()->tracking_views_count);
        $this->assertEquals(0, $booking->fresh()->tracking_views_count);

        // Perform public track request
        $response = $this->get('/track?tracking_number=BOX-TEST-1001');

        $response->assertStatus(200);

        // Verify counts incremented
        $this->assertEquals(1, $box->fresh()->tracking_views_count);
        $this->assertNotNull($box->fresh()->last_tracked_at);
        $this->assertEquals(1, $booking->fresh()->tracking_views_count);

        // Verify TrackingLog created
        $this->assertDatabaseHas('tracking_logs', [
            'trackable_type' => Box::class,
            'trackable_id' => $box->id,
            'search_query' => 'BOX-TEST-1001',
            'source' => 'web',
        ]);
    }

    public function test_api_tracking_increments_analytics_counters(): void
    {
        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'reference_number' => 'LB-2026-API01',
        ]);
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'tracking_number' => 'BOX-API-9999',
        ]);

        $response = $this->getJson('/api/track/BOX-API-9999');

        $response->assertStatus(200);
        $this->assertEquals(1, $box->fresh()->tracking_views_count);

        $this->assertDatabaseHas('tracking_logs', [
            'trackable_type' => Box::class,
            'trackable_id' => $box->id,
            'search_query' => 'BOX-API-9999',
            'source' => 'api',
        ]);
    }

    public function test_deduplication_prevents_double_counting_within_time_window(): void
    {
        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'reference_number' => 'LB-2026-DEDUP',
        ]);
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'tracking_number' => 'BOX-DEDUP-001',
        ]);

        // First track
        $this->get('/track?tracking_number=BOX-DEDUP-001');
        $this->assertEquals(1, $box->fresh()->tracking_views_count);

        // Immediate second track from same IP
        $this->get('/track?tracking_number=BOX-DEDUP-001');

        // Count should remain 1, but logs should record 2 entries
        $this->assertEquals(1, $box->fresh()->tracking_views_count);
        $this->assertEquals(2, TrackingLog::where('trackable_id', $box->id)->count());
    }

    public function test_admin_receives_analytics_data_while_guests_do_not(): void
    {
        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'reference_number' => 'LB-2026-ADMIN',
        ]);
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'tracking_number' => 'BOX-ADMIN-001',
        ]);

        // Guest request
        $guestResponse = $this->get('/track?tracking_number=BOX-ADMIN-001');
        $guestResponse->assertStatus(200);
        $guestResponse->assertInertia(fn ($page) => $page
            ->where('adminAnalytics', null)
        );

        // Admin request
        $admin = \App\Models\User::factory()->create([
            'role' => \App\Enums\Role::Admin,
        ]);

        $adminResponse = $this->actingAs($admin)->get('/track?tracking_number=BOX-ADMIN-001');
        $adminResponse->assertStatus(200);
        $adminResponse->assertInertia(fn ($page) => $page
            ->has('adminAnalytics.overall')
            ->where('adminAnalytics.query_analytics.query', 'BOX-ADMIN-001')
            ->where('adminAnalytics.query_analytics.tracking_views_count', 2)
        );
    }
}
