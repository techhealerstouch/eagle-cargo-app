<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationBellApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_notification_bell_api_is_available_to_all_user_roles(): void
    {
        foreach (['super_admin', 'admin', 'sender', 'recipient', 'courier', 'picker', 'warehouse'] as $role) {
            $user = User::factory()->create(['role' => $role]);
            $notificationId = (string) Str::uuid();

            DB::table('notifications')->insert([
                'id' => $notificationId,
                'type' => 'Tests\\Feature\\BellNotification',
                'notifiable_type' => User::class,
                'notifiable_id' => $user->id,
                'data' => json_encode([
                    'type' => 'booking',
                    'title' => 'Bell test',
                    'message' => "Notification for {$role}",
                    'url' => '/dashboard',
                ]),
                'read_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->actingAs($user)
                ->getJson('/api/notifications/unread-count')
                ->assertOk()
                ->assertJsonPath('success', true)
                ->assertJsonPath('data.count', 1);

            $this->actingAs($user)
                ->getJson('/api/notifications')
                ->assertOk()
                ->assertJsonPath('success', true)
                ->assertJsonPath('data.unread_count', 1)
                ->assertJsonPath('data.notifications.0.id', $notificationId)
                ->assertJsonPath('data.notifications.0.data.title', 'Bell test');

            $this->actingAs($user)
                ->postJson("/api/notifications/{$notificationId}/read")
                ->assertOk()
                ->assertJsonPath('success', true);

            $this->actingAs($user)
                ->getJson('/api/notifications/unread-count')
                ->assertOk()
                ->assertJsonPath('data.count', 0);
        }
    }
}
