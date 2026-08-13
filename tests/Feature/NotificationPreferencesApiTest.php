<?php

namespace Tests\Feature;

use App\Enums\NotificationChannel;
use App\Enums\NotificationEvent;
use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationPreferencesApiTest extends TestCase
{
    use RefreshDatabase;

    protected function createUserWithToken(Role $role = Role::Sender): array
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => $role,
            'email_verified_at' => now(),
        ]);

        $token = $user->createToken('test-token')->plainTextToken;

        return compact('user', 'token');
    }

    // ---------------------------------------------------------------
    // 1. Get Notification Preferences
    // ---------------------------------------------------------------

    public function test_can_get_notification_preferences(): void
    {
        extract($this->createUserWithToken());

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/notifications/preferences');

        $response->assertStatus(200);
    }

    // ---------------------------------------------------------------
    // 2. Update Single Preference
    // ---------------------------------------------------------------

    public function test_can_update_single_preference(): void
    {
        extract($this->createUserWithToken());

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson('/api/notifications/preferences', [
                'channel' => NotificationChannel::Email->value,
                'event_type' => NotificationEvent::BoxShipped->value,
                'enabled' => true,
            ]);

        $response->assertStatus(200);
    }

    // ---------------------------------------------------------------
    // 3. Bulk Update Preferences
    // ---------------------------------------------------------------

    public function test_can_bulk_update_preferences(): void
    {
        extract($this->createUserWithToken());

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson('/api/notifications/preferences/bulk', [
                'preferences' => [
                    [
                        'channel' => NotificationChannel::Email->value,
                        'event_type' => NotificationEvent::BoxShipped->value,
                        'enabled' => true,
                    ],
                    [
                        'channel' => NotificationChannel::InApp->value,
                        'event_type' => NotificationEvent::BoxShipped->value,
                        'enabled' => true,
                    ],
                ],
            ]);

        $response->assertStatus(200);
    }

    // ---------------------------------------------------------------
    // 4. Unread Count
    // ---------------------------------------------------------------

    public function test_unread_count_returns_zero_for_new_user(): void
    {
        extract($this->createUserWithToken());

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/notifications/unread-count');

        $response->assertStatus(200);
        $response->assertJsonPath('data.count', 0);
    }

    // ---------------------------------------------------------------
    // 5. Mark as Read
    // ---------------------------------------------------------------

    public function test_can_mark_notification_as_read(): void
    {
        extract($this->createUserWithToken());

        // Create a database notification for the user
        $notification = $user->notifications()->create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'type' => 'App\Notifications\BookingStatusChanged',
            'data' => json_encode(['message' => 'Test notification']),
            'read_at' => null,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/notifications/' . $notification->id . '/read');

        $response->assertStatus(200);

        $this->assertNotNull($notification->fresh()->read_at);
    }

    // ---------------------------------------------------------------
    // 6. Mark All as Read
    // ---------------------------------------------------------------

    public function test_can_mark_all_notifications_as_read(): void
    {
        extract($this->createUserWithToken());

        // Create multiple unread notifications
        for ($i = 0; $i < 3; $i++) {
            $user->notifications()->create([
                'id' => (string) \Illuminate\Support\Str::uuid(),
                'type' => 'App\Notifications\BookingStatusChanged',
                'data' => json_encode(['message' => 'Test ' . $i]),
                'read_at' => null,
            ]);
        }

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/notifications/read-all');

        $response->assertStatus(200);

        // All should now be read
        $this->assertSame(0, $user->fresh()->unreadNotifications()->count());
    }

    // ---------------------------------------------------------------
    // 7. List Notifications
    // ---------------------------------------------------------------

    public function test_can_list_notifications(): void
    {
        extract($this->createUserWithToken());

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/notifications');

        $response->assertStatus(200);
    }

    // ---------------------------------------------------------------
    // 8. Authentication Required
    // ---------------------------------------------------------------

    public function test_notification_endpoints_require_auth(): void
    {
        $response = $this->getJson('/api/notifications');
        $response->assertStatus(401);

        $response = $this->getJson('/api/notifications/unread-count');
        $response->assertStatus(401);

        $response = $this->postJson('/api/notifications/read-all');
        $response->assertStatus(401);
    }
}
