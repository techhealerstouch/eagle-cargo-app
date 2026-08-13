<?php

namespace Tests\Feature;

use App\Enums\NotificationChannel;
use App\Enums\NotificationEvent;
use App\Models\User;
use App\Repositories\Contracts\NotificationPreferenceRepositoryInterface;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationPreferenceTest extends TestCase
{
    use RefreshDatabase;

    private NotificationPreferenceRepositoryInterface $repository;

    private NotificationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = app(NotificationPreferenceRepositoryInterface::class);
        $this->service = app(NotificationService::class);
    }

    public function test_default_preference_is_enabled_when_not_set(): void
    {
        $user = User::factory()->create();

        $isEnabled = $this->repository->isEnabled(
            $user,
            NotificationChannel::Email,
            NotificationEvent::BoxShipped
        );

        $this->assertTrue($isEnabled);
    }

    public function test_can_disable_notification_channel_for_event(): void
    {
        $user = User::factory()->create();

        $this->repository->setPreference(
            $user,
            NotificationChannel::Sms,
            NotificationEvent::BoxShipped,
            false
        );

        $isEnabled = $this->repository->isEnabled(
            $user,
            NotificationChannel::Sms,
            NotificationEvent::BoxShipped
        );

        $this->assertFalse($isEnabled);
    }

    public function test_can_enable_previously_disabled_channel(): void
    {
        $user = User::factory()->create();

        // Disable first
        $this->repository->setPreference(
            $user,
            NotificationChannel::Email,
            NotificationEvent::PaymentReceived,
            false
        );

        // Re-enable
        $this->repository->setPreference(
            $user,
            NotificationChannel::Email,
            NotificationEvent::PaymentReceived,
            true
        );

        $isEnabled = $this->repository->isEnabled(
            $user,
            NotificationChannel::Email,
            NotificationEvent::PaymentReceived
        );

        $this->assertTrue($isEnabled);
    }

    public function test_get_enabled_channels_returns_all_when_no_preferences_set(): void
    {
        $user = User::factory()->create();

        $channels = $this->repository->getEnabledChannelsForEvent(
            $user,
            NotificationEvent::BoxDelivered
        );

        $this->assertEquals(NotificationChannel::values(), $channels);
    }

    public function test_get_enabled_channels_respects_preferences(): void
    {
        $user = User::factory()->create();

        // Enable only email and in-app
        $this->repository->setPreference($user, NotificationChannel::Email, NotificationEvent::BoxDelivered, true);
        $this->repository->setPreference($user, NotificationChannel::InApp, NotificationEvent::BoxDelivered, true);
        $this->repository->setPreference($user, NotificationChannel::Sms, NotificationEvent::BoxDelivered, false);
        $this->repository->setPreference($user, NotificationChannel::Push, NotificationEvent::BoxDelivered, false);

        $channels = $this->repository->getEnabledChannelsForEvent(
            $user,
            NotificationEvent::BoxDelivered
        );

        $this->assertContains('email', $channels);
        $this->assertContains('in_app', $channels);
        $this->assertNotContains('sms', $channels);
        $this->assertNotContains('push', $channels);
    }

    public function test_bulk_set_preferences(): void
    {
        $user = User::factory()->create();

        $this->repository->bulkSetForUser($user, [
            ['channel' => 'email', 'event_type' => 'box_shipped', 'enabled' => true],
            ['channel' => 'sms', 'event_type' => 'box_shipped', 'enabled' => false],
            ['channel' => 'email', 'event_type' => 'payment_received', 'enabled' => false],
        ]);

        $this->assertTrue($this->repository->isEnabled($user, NotificationChannel::Email, NotificationEvent::BoxShipped));
        $this->assertFalse($this->repository->isEnabled($user, NotificationChannel::Sms, NotificationEvent::BoxShipped));
        $this->assertFalse($this->repository->isEnabled($user, NotificationChannel::Email, NotificationEvent::PaymentReceived));
    }

    public function test_preferences_are_user_specific(): void
    {
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();

        $this->repository->setPreference($user1, NotificationChannel::Email, NotificationEvent::BoxShipped, false);
        $this->repository->setPreference($user2, NotificationChannel::Email, NotificationEvent::BoxShipped, true);

        $this->assertFalse($this->repository->isEnabled($user1, NotificationChannel::Email, NotificationEvent::BoxShipped));
        $this->assertTrue($this->repository->isEnabled($user2, NotificationChannel::Email, NotificationEvent::BoxShipped));
    }

    public function test_notification_service_returns_unread_count(): void
    {
        $user = User::factory()->create();

        $count = $this->service->getUnreadCount($user);

        $this->assertEquals(0, $count);
    }
}
