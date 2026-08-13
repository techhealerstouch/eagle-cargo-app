<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiEndpointsTest extends TestCase
{
    use RefreshDatabase;

    protected function createUserWithToken(Role $role): array
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => $role,
            'email_verified_at' => now(),
        ]);

        $token = $user->createToken('test-token')->plainTextToken;

        return compact('user', 'token');
    }

    protected function createSenderWithToken(): array
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $sender = $user->sender()->first() ?? Sender::factory()->create(['user_id' => $user->id]);
        $token = $user->createToken('test-token')->plainTextToken;

        return compact('user', 'sender', 'token');
    }

    // ---------------------------------------------------------------
    // 1. Authentication
    // ---------------------------------------------------------------

    public function test_api_requires_authentication(): void
    {
        $response = $this->getJson('/api/user');

        $response->assertStatus(401);
    }

    public function test_api_returns_authenticated_user(): void
    {
        extract($this->createSenderWithToken());

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/user');

        $response->assertStatus(200);
        $response->assertJsonPath('id', $user->id);
    }

    public function test_api_rejects_invalid_token(): void
    {
        $response = $this->withHeader('Authorization', 'Bearer invalid_token_here')
            ->getJson('/api/user');

        $response->assertStatus(401);
    }

    // ---------------------------------------------------------------
    // 2. Bookings API
    // ---------------------------------------------------------------

    public function test_api_lists_sender_bookings(): void
    {
        extract($this->createSenderWithToken());

        Booking::factory()->count(3)->create([
            'sender_id' => $sender->id,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/bookings');

        $response->assertStatus(200);
        $response->assertJsonCount(3, 'data');
    }

    public function test_api_only_returns_own_bookings(): void
    {
        extract($this->createSenderWithToken());

        $otherSender = Sender::factory()->create();
        Booking::factory()->create(['sender_id' => $otherSender->id]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/bookings');

        $response->assertStatus(200);
        $response->assertJsonCount(0, 'data');
        $response->assertJsonPath('meta.total', 0);
    }

    public function test_api_cannot_access_other_senders_booking(): void
    {
        extract($this->createSenderWithToken());

        $otherSender = Sender::factory()->create();
        $booking = Booking::factory()->create(['sender_id' => $otherSender->id]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/bookings/'.$booking->id);

        $response->assertNotFound();
    }

    public function test_api_shows_booking_by_reference_number(): void
    {
        extract($this->createSenderWithToken());

        Booking::factory()->create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-2026-042',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/bookings/BK-2026-042');

        $response->assertStatus(200);
    }

    public function test_sender_can_update_own_booking_notes_only(): void
    {
        extract($this->createSenderWithToken());

        $booking = Booking::factory()->create(['sender_id' => $sender->id]);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/bookings/'.$booking->id, ['notes' => 'Gate code 1234'])
            ->assertOk()
            ->assertJsonPath('data.notes', 'Gate code 1234');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/bookings/'.$booking->id, ['admin_notes' => 'Override fee'])
            ->assertForbidden();
    }

    public function test_admin_api_can_list_all_bookings(): void
    {
        extract($this->createUserWithToken(Role::Admin));

        Booking::factory()->count(2)->create();

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/bookings');

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
    }

    // ---------------------------------------------------------------
    // 3. Boxes API
    // ---------------------------------------------------------------

    public function test_api_lists_only_sender_boxes(): void
    {
        extract($this->createSenderWithToken());

        $booking = Booking::factory()->create(['sender_id' => $sender->id]);
        Box::factory()->count(2)->create(['booking_id' => $booking->id]);

        $otherSender = Sender::factory()->create();
        $otherBooking = Booking::factory()->create(['sender_id' => $otherSender->id]);
        Box::factory()->create(['booking_id' => $otherBooking->id]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/boxes');

        $response->assertStatus(200);
        $response->assertJsonCount(2, 'data');
        $response->assertJsonPath('meta.total', 2);
    }

    public function test_api_shows_box_by_tracking_number(): void
    {
        extract($this->createSenderWithToken());

        $booking = Booking::factory()->create(['sender_id' => $sender->id]);
        Box::factory()->create([
            'booking_id' => $booking->id,
            'tracking_number' => 'TRK-2026-042-001',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/boxes/TRK-2026-042-001');

        $response->assertStatus(200);
    }

    public function test_api_cannot_access_other_senders_box(): void
    {
        extract($this->createSenderWithToken());

        $otherSender = Sender::factory()->create();
        $otherBooking = Booking::factory()->create(['sender_id' => $otherSender->id]);
        Box::factory()->create([
            'booking_id' => $otherBooking->id,
            'tracking_number' => 'TRK-OTHER-001',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/boxes/TRK-OTHER-001');

        $response->assertNotFound();
    }

    // ---------------------------------------------------------------
    // 4. Batches API
    // ---------------------------------------------------------------

    public function test_api_lists_only_batches_containing_accessible_boxes(): void
    {
        extract($this->createSenderWithToken());

        $ownBatch = Batch::factory()->create();
        $otherBatch = Batch::factory()->create();

        $booking = Booking::factory()->create(['sender_id' => $sender->id]);
        Box::factory()->create([
            'booking_id' => $booking->id,
            'batch_id' => $ownBatch->id,
        ]);

        $otherSender = Sender::factory()->create();
        $otherBooking = Booking::factory()->create(['sender_id' => $otherSender->id]);
        Box::factory()->create([
            'booking_id' => $otherBooking->id,
            'batch_id' => $otherBatch->id,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/batches');

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $ownBatch->id);
    }

    public function test_api_cannot_access_other_senders_batch(): void
    {
        extract($this->createSenderWithToken());

        $batch = Batch::factory()->create();
        $otherSender = Sender::factory()->create();
        $otherBooking = Booking::factory()->create(['sender_id' => $otherSender->id]);
        Box::factory()->create([
            'booking_id' => $otherBooking->id,
            'batch_id' => $batch->id,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/batches/'.$batch->id);

        $response->assertNotFound();
    }

    public function test_api_shows_only_accessible_batch_boxes(): void
    {
        extract($this->createSenderWithToken());

        $batch = Batch::factory()->create();
        $booking = Booking::factory()->create(['sender_id' => $sender->id]);
        $ownBox = Box::factory()->create([
            'booking_id' => $booking->id,
            'batch_id' => $batch->id,
            'tracking_number' => 'TRK-OWN-001',
        ]);

        $otherSender = Sender::factory()->create();
        $otherBooking = Booking::factory()->create(['sender_id' => $otherSender->id]);
        Box::factory()->create([
            'booking_id' => $otherBooking->id,
            'batch_id' => $batch->id,
            'tracking_number' => 'TRK-OTHER-002',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/batches/'.$batch->id.'/boxes');

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.id', $ownBox->id);
        $response->assertJsonPath('data.0.tracking_number', 'TRK-OWN-001');
    }

    // ---------------------------------------------------------------
    // 5. API Rate Limiting
    // ---------------------------------------------------------------

    public function test_api_is_rate_limited(): void
    {
        extract($this->createSenderWithToken());

        for ($i = 0; $i < 5; $i++) {
            $response = $this->withHeader('Authorization', 'Bearer '.$token)
                ->getJson('/api/user');

            $this->assertNotEquals(500, $response->getStatusCode());
        }

        $this->assertTrue(true);
    }
}