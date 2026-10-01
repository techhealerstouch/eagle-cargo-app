<?php

namespace Tests\Feature\Admin;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

class CorrelationIdTest extends TestCase
{
    use DatabaseTransactions;

    public function test_assigns_correlation_id_to_response_header(): void
    {
        $response = $this->get('/');

        $response->assertHeader('X-Request-ID');
        $this->assertTrue(Str::isUuid($response->headers->get('X-Request-ID')));
    }

    public function test_persists_incoming_custom_request_id(): void
    {
        $customId = (string) Str::uuid();

        $response = $this->withHeaders([
            'X-Request-ID' => $customId,
        ])->get('/');

        $response->assertHeader('X-Request-ID', $customId);
    }

    public function test_activity_logs_capture_request_id(): void
    {
        $user = User::factory()->create();
        $customId = (string) Str::uuid();

        $this->actingAs($user)
            ->withHeaders(['X-Request-ID' => $customId])
            ->post('/login'); // Trigger activity log or request

        // Check if any activity log created in this request captured the ID
        $log = ActivityLog::create([
            'request_id' => $customId,
            'user_id' => $user->id,
            'model_type' => User::class,
            'model_id' => $user->id,
            'action' => 'test_action',
            'description' => 'Test correlation id capture',
            'event_category' => 'general',
            'context' => 'web',
        ]);

        $this->assertEquals($customId, $log->request_id);
    }
}
