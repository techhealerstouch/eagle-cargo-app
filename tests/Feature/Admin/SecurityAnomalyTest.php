<?php

namespace Tests\Feature\Admin;

use App\Models\ActivityLog;
use App\Models\User;
use App\Notifications\SecurityAnomalyAlert;
use App\Services\SecurityAnomalyService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class SecurityAnomalyTest extends TestCase
{
    use DatabaseTransactions;

    public function test_triggers_alert_when_failed_logins_exceed_threshold(): void
    {
        Notification::fake();
        config(['audit.alert_email' => 'alerts@example.com']);

        $admin = User::factory()->create(['role' => 'admin']);
        $service = app(SecurityAnomalyService::class);
        $email = 'victim@example.com';
        $ip = '192.168.1.100';

        // Simulate 5 failed login activity logs
        for ($i = 0; $i < 5; $i++) {
            ActivityLog::create([
                'user_id' => null,
                'model_type' => User::class,
                'model_id' => 0,
                'action' => 'failed_login',
                'description' => "Failed login attempt for email: {$email}.",
                'event_category' => 'security',
                'context' => 'web',
                'ip_address' => $ip,
            ]);
        }

        $service->checkFailedLoginThreshold($email, $ip);

        Notification::assertSentOnDemand(
            SecurityAnomalyAlert::class,
            function ($notification) use ($email) {
                return $notification->anomalyType === 'brute_force_login'
                    && str_contains($notification->description, $email);
            }
        );
    }

    public function test_triggers_alert_on_privilege_escalation(): void
    {
        Notification::fake();
        config(['audit.alert_email' => 'alerts@example.com']);

        $superAdmin = User::factory()->create(['role' => 'admin']);
        $targetUser = User::factory()->create(['role' => 'sender']);

        $service = app(SecurityAnomalyService::class);
        $service->checkPrivilegeEscalation(
            targetUser: $targetUser,
            newRole: 'super-admin',
            actor: $superAdmin
        );

        Notification::assertSentOnDemand(
            SecurityAnomalyAlert::class,
            function ($notification) use ($targetUser) {
                return $notification->anomalyType === 'privilege_escalation'
                    && str_contains($notification->description, $targetUser->name);
            }
        );
    }
}
