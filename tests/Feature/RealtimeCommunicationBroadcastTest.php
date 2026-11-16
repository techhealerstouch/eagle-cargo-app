<?php

namespace Tests\Feature;

use App\Enums\OperationalMessageCategory;
use App\Enums\OperationalThreadPriority;
use App\Enums\OperationalThreadStatus;
use App\Enums\Role;
use App\Events\EnquiryMessageUpdated;
use App\Models\Enquiry;
use App\Models\OperationalMessage;
use App\Models\OperationalThread;
use App\Models\Sender;
use App\Models\User;
use App\Notifications\OperationalMessageReceivedNotification;
use App\Services\OperationalCommunicationService;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RealtimeCommunicationBroadcastTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_enquiry_message_updated_event_dispatches_on_sender_and_admin_actions(): void
    {
        Event::fake([EnquiryMessageUpdated::class]);

        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $senderUser = User::factory()->create(['role' => Role::Sender->value]);
        Sender::factory()->create([
            'user_id' => $senderUser->id,
            'email' => $senderUser->email,
        ]);

        // 1. Sender submits message in Support Chat
        $senderResponse = $this->actingAs($senderUser)->post(route('sender.enquiries.store'), [
            'message' => 'Hello, when will my box arrive?',
        ]);
        $senderResponse->assertRedirect(route('sender.enquiries'));

        $enquiry = Enquiry::where('email', $senderUser->email)->latest('id')->firstOrFail();

        Event::assertDispatched(EnquiryMessageUpdated::class, function (EnquiryMessageUpdated $event) use ($enquiry, $senderUser) {
            $channels = array_map(fn ($ch) => $ch->name, $event->broadcastOn());

            return $event->enquiryId === $enquiry->id
                && in_array('private-admin.enquiries', $channels, true)
                && in_array("private-sender.enquiries.{$senderUser->id}", $channels, true);
        });

        // 2. Admin replies to the enquiry
        $adminResponse = $this->actingAs($admin)->patch(route('admin.enquiries.update', $enquiry), [
            'admin_notes' => 'Your box is scheduled for delivery tomorrow.',
        ]);
        $adminResponse->assertRedirect();

        Event::assertDispatchedTimes(EnquiryMessageUpdated::class, 2);
    }

    public function test_enquiry_message_updated_clears_admin_sidebar_counts_cache(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $senderUser = User::factory()->create(['role' => Role::Sender->value]);

        Cache::put("user.{$admin->id}.sidebar_counts", ['enquiries' => 0], now()->addMinutes(5));

        $enquiry = Enquiry::create([
            'name' => 'Test Sender',
            'email' => $senderUser->email,
            'message' => 'Checking sidebar count cache invalidation.',
            'is_read' => false,
        ]);

        new EnquiryMessageUpdated($enquiry, $senderUser->id);

        $this->assertFalse(Cache::has("user.{$admin->id}.sidebar_counts"));
    }

    public function test_operational_message_notification_broadcasts_and_clears_sidebar_counts_cache(): void
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $picker = User::factory()->create(['role' => Role::Picker->value]);

        Cache::put("user.{$admin->id}.sidebar_counts", ['communications' => 0], now()->addMinutes(5));
        Cache::put("user.{$picker->id}.sidebar_counts", ['messages' => 0], now()->addMinutes(5));

        $service = app(OperationalCommunicationService::class);

        $thread = $service->createThread($admin, [
            'picker_id' => $picker->id,
            'subject' => 'Live dispatch update',
            'category' => OperationalMessageCategory::General->value,
            'priority' => OperationalThreadPriority::Normal->value,
            'message' => 'Stop 3 confirmed for 2 PM.',
        ]);

        // Picker's sidebar cache should be cleared when admin creates thread
        $this->assertFalse(Cache::has("user.{$picker->id}.sidebar_counts"));

        Notification::assertSentTo($picker, OperationalMessageReceivedNotification::class, function (OperationalMessageReceivedNotification $notification) use ($picker) {
            return in_array('database', $notification->via($picker), true)
                && in_array('broadcast', $notification->via($picker), true);
        });

        // Picker opens thread -> markAsRead clears picker's sidebar cache
        Cache::put("user.{$picker->id}.sidebar_counts", ['messages' => 1], now()->addMinutes(5));
        $service->markAsRead($thread, $picker);
        $this->assertFalse(Cache::has("user.{$picker->id}.sidebar_counts"));

        // Picker replies -> admin's sidebar cache is cleared and notification sent
        $service->reply($thread, $picker, 'Copy that, en route.');
        $this->assertFalse(Cache::has("user.{$admin->id}.sidebar_counts"));
        Notification::assertSentTo($admin, OperationalMessageReceivedNotification::class);
    }

    public function test_broadcast_channel_authorization_for_enquiries(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'test-key',
            'broadcasting.connections.reverb.secret' => 'test-secret',
            'broadcasting.connections.reverb.app_id' => '12345',
        ]);
        Broadcast::forgetDrivers();
        require base_path('routes/channels.php');

        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $senderA = User::factory()->create(['role' => Role::Sender->value]);
        $senderB = User::factory()->create(['role' => Role::Sender->value]);

        // Admin authorized for admin.enquiries; sender denied
        $this->actingAs($admin)
            ->post('/broadcasting/auth', [
                'channel_name' => 'private-admin.enquiries',
                'socket_id' => '1234.5678',
            ])
            ->assertOk();

        $this->actingAs($senderA)
            ->post('/broadcasting/auth', [
                'channel_name' => 'private-admin.enquiries',
                'socket_id' => '1234.5678',
            ])
            ->assertForbidden();

        // Sender A authorized for own channel; Sender B denied
        $this->actingAs($senderA)
            ->post('/broadcasting/auth', [
                'channel_name' => "private-sender.enquiries.{$senderA->id}",
                'socket_id' => '1234.5678',
            ])
            ->assertOk();

        $this->actingAs($senderB)
            ->post('/broadcasting/auth', [
                'channel_name' => "private-sender.enquiries.{$senderA->id}",
                'socket_id' => '1234.5678',
            ])
            ->assertForbidden();
    }

    public function test_operational_communication_indexes_zero_out_unread_count_for_selected_thread(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $picker = User::factory()->create(['role' => Role::Picker->value]);

        $thread = OperationalThread::create([
            'subject' => 'Unread sync verification thread',
            'category' => OperationalMessageCategory::General->value,
            'priority' => OperationalThreadPriority::Normal->value,
            'status' => OperationalThreadStatus::Open->value,
            'picker_id' => $picker->id,
            'creator_id' => $picker->id,
            'last_message_at' => now(),
        ]);

        OperationalMessage::create([
            'thread_id' => $thread->id,
            'sender_id' => $picker->id,
            'message' => 'Unread message from picker to admin',
        ]);

        $adminResponse = $this->actingAs($admin)->get(route('admin.communications.index', ['thread_id' => $thread->id]));
        $adminResponse->assertOk();
        $adminResponse->assertInertia(fn ($page) => $page
            ->where('selectedThread.id', $thread->id)
            ->where('selectedThread.unread_count', 0)
            ->where('threads.data', function ($rows) use ($thread) {
                $match = collect($rows)->firstWhere('id', $thread->id);

                return $match !== null && (int) ($match['unread_count'] ?? -1) === 0;
            })
        );

        OperationalMessage::create([
            'thread_id' => $thread->id,
            'sender_id' => $admin->id,
            'message' => 'Unread reply from admin to picker',
        ]);

        $pickerResponse = $this->actingAs($picker)->get(route('picker.messages.index', ['thread_id' => $thread->id]));
        $pickerResponse->assertOk();
        $pickerResponse->assertInertia(fn ($page) => $page
            ->where('selectedThread.id', $thread->id)
            ->where('selectedThread.unread_count', 0)
            ->where('threads.data', function ($rows) use ($thread) {
                $match = collect($rows)->firstWhere('id', $thread->id);

                return $match !== null && (int) ($match['unread_count'] ?? -1) === 0;
            })
        );
    }

    public function test_admin_enquiries_index_zeroes_out_unread_count_for_selected_thread(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $email = 'unread-sync-'.uniqid('', true).'@example.com';

        Enquiry::create([
            'name' => 'Unread Sync Customer',
            'email' => $email,
            'message' => 'Initial unread message from customer',
            'is_read' => false,
        ]);

        $response = $this->actingAs($admin)->get(route('admin.enquiries.index', ['email' => $email]));
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->where('selectedThread.email', $email)
            ->where('selectedThread.is_read', true)
            ->where('selectedThread.unread_count', 0)
            ->where('enquiries.data', function ($rows) use ($email) {
                $match = collect($rows)->firstWhere('email', $email);

                return $match !== null
                    && ($match['is_read'] ?? false) === true
                    && (int) ($match['unread_count'] ?? -1) === 0;
            })
        );
    }

    public function test_operational_message_broadcast_payload_preserves_type_and_timestamp(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $picker = User::factory()->create(['role' => Role::Picker->value]);

        $thread = OperationalThread::create([
            'subject' => 'Broadcast payload verification',
            'category' => OperationalMessageCategory::General->value,
            'priority' => OperationalThreadPriority::Normal->value,
            'status' => OperationalThreadStatus::Open->value,
            'picker_id' => $picker->id,
            'creator_id' => $admin->id,
            'last_message_at' => now(),
        ]);

        $message = OperationalMessage::create([
            'thread_id' => $thread->id,
            'sender_id' => $admin->id,
            'message' => 'Please confirm stop arrival.',
        ])->load('sender');

        $notification = new OperationalMessageReceivedNotification($thread, $message, 'picker');
        $broadcastMessage = $notification->toBroadcast($picker);

        $this->assertSame('operational_message', $notification->broadcastType());
        $this->assertSame('operational_message', $broadcastMessage->data['type'] ?? null);
        $this->assertSame('operational_message', $broadcastMessage->data['data']['type'] ?? null);
        $this->assertNotEmpty($broadcastMessage->data['created_at'] ?? null);
        $this->assertArrayHasKey('read_at', $broadcastMessage->data);
        $this->assertNull($broadcastMessage->data['read_at']);
    }

    public function test_toggle_thread_unread_and_resolve_thread_preserve_state_and_clear_cache(): void
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $email = 'toggle-unread-'.uniqid('', true).'@example.com';

        $enquiry = Enquiry::create([
            'name' => 'Toggle Customer',
            'email' => $email,
            'message' => 'Please mark me unread.',
            'is_read' => true,
            'read_at' => now(),
        ]);

        $toggleResponse = $this->actingAs($admin)
            ->from(route('admin.enquiries.index', ['email' => $email]))
            ->patch(route('admin.enquiries.update', $enquiry), [
                'toggle_thread' => true,
            ]);

        $toggleResponse->assertRedirect(route('admin.enquiries.index', ['email' => $email]));

        // Redirect after "Mark Unread" must preserve unread state
        $afterRedirect = $this->actingAs($admin)->get(route('admin.enquiries.index', ['email' => $email]));
        $afterRedirect->assertOk();
        $afterRedirect->assertInertia(fn ($page) => $page
            ->where('selectedThread.email', $email)
            ->where('selectedThread.is_read', false)
            ->where('selectedThread.unread_count', 1)
        );

        // Background polling with preserve_unread=1 must also keep unread state
        $afterPoll = $this->actingAs($admin)->get(route('admin.enquiries.index', [
            'email' => $email,
            'preserve_unread' => 1,
        ]));
        $afterPoll->assertOk();
        $afterPoll->assertInertia(fn ($page) => $page
            ->where('selectedThread.is_read', false)
            ->where('selectedThread.unread_count', 1)
        );

        // Resolving and reopening an operational thread must clear admin and picker sidebar caches
        $service = app(OperationalCommunicationService::class);
        $thread = $service->createThread($admin, [
            'picker_id' => $picker->id,
            'subject' => 'Cache invalidation on resolve/reopen',
            'category' => OperationalMessageCategory::General->value,
            'priority' => OperationalThreadPriority::Normal->value,
            'message' => 'Initial dispatch note.',
        ]);

        Cache::put("user.{$admin->id}.sidebar_counts", ['communications' => 1], now()->addMinutes(5));
        Cache::put("user.{$picker->id}.sidebar_counts", ['messages' => 1], now()->addMinutes(5));

        $service->resolveThread($thread, $admin, 'Resolved');
        $this->assertFalse(Cache::has("user.{$admin->id}.sidebar_counts"));
        $this->assertFalse(Cache::has("user.{$picker->id}.sidebar_counts"));

        Cache::put("user.{$admin->id}.sidebar_counts", ['communications' => 0], now()->addMinutes(5));
        Cache::put("user.{$picker->id}.sidebar_counts", ['messages' => 0], now()->addMinutes(5));

        $service->reopenThread($thread, $admin);
        $this->assertFalse(Cache::has("user.{$admin->id}.sidebar_counts"));
        $this->assertFalse(Cache::has("user.{$picker->id}.sidebar_counts"));
    }
}
