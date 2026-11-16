<?php

namespace Tests\Feature;

use App\Enums\OperationalMessageCategory;
use App\Enums\OperationalThreadPriority;
use App\Enums\OperationalThreadStatus;
use App\Enums\Role;
use App\Models\OperationalMessage;
use App\Models\OperationalThread;
use App\Models\User;
use App\Notifications\OperationalMessageReceivedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class OperationalCommunicationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

    public function test_admin_can_view_communications_hub_and_metrics(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $picker = User::factory()->create(['role' => Role::Picker->value]);

        $thread = OperationalThread::create([
            'subject' => 'Urgent delay on route',
            'category' => OperationalMessageCategory::ScheduleChange->value,
            'priority' => OperationalThreadPriority::Urgent->value,
            'status' => OperationalThreadStatus::Open->value,
            'picker_id' => $picker->id,
            'creator_id' => $picker->id,
            'last_message_at' => now(),
        ]);

        OperationalMessage::create([
            'thread_id' => $thread->id,
            'sender_id' => $picker->id,
            'message' => 'Traffic blockage on highway, delayed by 30 mins.',
        ]);

        $response = $this->actingAs($admin)->get(route('admin.communications.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('admin/communications/index')
            ->has('threads.data', 1)
            ->where('metrics.total_urgent', 1)
            ->where('metrics.total_open', 1)
        );
    }

    public function test_admin_can_create_operational_thread_to_picker(): void
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $picker = User::factory()->create(['role' => Role::Picker->value]);

        $response = $this->actingAs($admin)->post(route('admin.communications.store'), [
            'picker_id' => $picker->id,
            'subject' => 'Extra pickup stop assigned',
            'category' => OperationalMessageCategory::PickupSchedule->value,
            'priority' => OperationalThreadPriority::Normal->value,
            'message' => 'Please collect an additional box at Stop 5 if van capacity allows.',
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('operational_threads', [
            'picker_id' => $picker->id,
            'creator_id' => $admin->id,
            'subject' => 'Extra pickup stop assigned',
            'category' => OperationalMessageCategory::PickupSchedule->value,
            'status' => OperationalThreadStatus::Open->value,
        ]);

        $this->assertDatabaseHas('operational_messages', [
            'sender_id' => $admin->id,
            'message' => 'Please collect an additional box at Stop 5 if van capacity allows.',
        ]);

        Notification::assertSentTo($picker, OperationalMessageReceivedNotification::class);
    }

    public function test_picker_can_view_own_messages_only(): void
    {
        $pickerA = User::factory()->create(['role' => Role::Picker->value]);
        $pickerB = User::factory()->create(['role' => Role::Picker->value]);

        $threadA = OperationalThread::create([
            'subject' => 'Picker A thread',
            'category' => OperationalMessageCategory::General->value,
            'priority' => OperationalThreadPriority::Normal->value,
            'status' => OperationalThreadStatus::Open->value,
            'picker_id' => $pickerA->id,
            'creator_id' => $pickerA->id,
            'last_message_at' => now(),
        ]);

        OperationalMessage::create([
            'thread_id' => $threadA->id,
            'sender_id' => $pickerA->id,
            'message' => 'Hello from picker A',
        ]);

        $threadB = OperationalThread::create([
            'subject' => 'Picker B thread',
            'category' => OperationalMessageCategory::CustomerConcern->value,
            'priority' => OperationalThreadPriority::Urgent->value,
            'status' => OperationalThreadStatus::Open->value,
            'picker_id' => $pickerB->id,
            'creator_id' => $pickerB->id,
            'last_message_at' => now(),
        ]);

        OperationalMessage::create([
            'thread_id' => $threadB->id,
            'sender_id' => $pickerB->id,
            'message' => 'Hello from picker B',
        ]);

        $response = $this->actingAs($pickerA)->get(route('picker.messages.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('picker/messages/index')
            ->has('threads.data', 1)
            ->where('threads.data.0.id', $threadA->id)
        );
    }

    public function test_picker_can_create_operational_thread_to_dispatch(): void
    {
        Notification::fake();

        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $admin = User::factory()->create(['role' => Role::Admin->value]);

        $response = $this->actingAs($picker)->post(route('picker.messages.store'), [
            'subject' => 'Customer requested later pickup time',
            'category' => OperationalMessageCategory::CustomerConcern->value,
            'priority' => OperationalThreadPriority::Normal->value,
            'message' => 'Sender requested to push pickup from 1 PM to 3 PM.',
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('operational_threads', [
            'picker_id' => $picker->id,
            'creator_id' => $picker->id,
            'subject' => 'Customer requested later pickup time',
            'category' => OperationalMessageCategory::CustomerConcern->value,
        ]);

        $this->assertDatabaseHas('operational_messages', [
            'sender_id' => $picker->id,
            'message' => 'Sender requested to push pickup from 1 PM to 3 PM.',
        ]);

        Notification::assertSentTo($admin, OperationalMessageReceivedNotification::class);
    }

    public function test_picker_cannot_reply_to_another_pickers_thread(): void
    {
        $pickerA = User::factory()->create(['role' => Role::Picker->value]);
        $pickerB = User::factory()->create(['role' => Role::Picker->value]);

        $threadA = OperationalThread::create([
            'subject' => 'Thread for picker A',
            'category' => OperationalMessageCategory::General->value,
            'priority' => OperationalThreadPriority::Normal->value,
            'status' => OperationalThreadStatus::Open->value,
            'picker_id' => $pickerA->id,
            'creator_id' => $pickerA->id,
            'last_message_at' => now(),
        ]);

        $response = $this->actingAs($pickerB)->post(route('picker.messages.reply', $threadA), [
            'message' => 'Attempting to inject reply into another driver thread',
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('operational_messages', [
            'sender_id' => $pickerB->id,
            'thread_id' => $threadA->id,
        ]);
    }

    public function test_admin_and_picker_can_exchange_replies_and_track_read_receipts(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $picker = User::factory()->create(['role' => Role::Picker->value]);

        $thread = OperationalThread::create([
            'subject' => 'Pickup questions',
            'category' => OperationalMessageCategory::PickupSchedule->value,
            'priority' => OperationalThreadPriority::Normal->value,
            'status' => OperationalThreadStatus::Open->value,
            'picker_id' => $picker->id,
            'creator_id' => $picker->id,
            'last_message_at' => now(),
        ]);

        $initialMessage = OperationalMessage::create([
            'thread_id' => $thread->id,
            'sender_id' => $picker->id,
            'message' => 'Are packing tapes available at depot?',
        ]);

        $this->assertNull($initialMessage->read_at);

        // Admin views thread -> marks picker's message as read
        $this->actingAs($admin)->get(route('admin.communications.index', ['thread_id' => $thread->id]));

        $this->assertNotNull($initialMessage->fresh()->read_at);

        // Admin replies
        $this->actingAs($admin)->post(route('admin.communications.reply', $thread), [
            'message' => 'Yes, extra tape rolls are at Bay 2.',
        ]);

        $adminReply = OperationalMessage::where('sender_id', $admin->id)->first();
        $this->assertNotNull($adminReply);
        $this->assertNull($adminReply->read_at);

        // Picker views thread -> marks admin's reply as read
        $this->actingAs($picker)->get(route('picker.messages.index', ['thread_id' => $thread->id]));
        $this->assertNotNull($adminReply->fresh()->read_at);
    }

    public function test_thread_can_be_resolved_and_reopened(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $picker = User::factory()->create(['role' => Role::Picker->value]);

        $thread = OperationalThread::create([
            'subject' => 'Schedule adjustment',
            'category' => OperationalMessageCategory::ScheduleChange->value,
            'priority' => OperationalThreadPriority::Normal->value,
            'status' => OperationalThreadStatus::Open->value,
            'picker_id' => $picker->id,
            'creator_id' => $picker->id,
            'last_message_at' => now(),
        ]);

        // Resolve thread
        $this->actingAs($admin)->post(route('admin.communications.resolve', $thread), [
            'resolution_note' => 'Schedule was adjusted and confirmed by phone.',
        ]);

        $thread->refresh();
        $this->assertEquals(OperationalThreadStatus::Resolved, $thread->status);
        $this->assertEquals('Schedule was adjusted and confirmed by phone.', $thread->resolution_note);
        $this->assertEquals($admin->id, $thread->resolved_by);

        // Reply to resolved thread auto-reopens it to InProgress
        $this->actingAs($picker)->post(route('picker.messages.reply', $thread), [
            'message' => 'Reopening: customer needs one more change.',
        ]);

        $thread->refresh();
        $this->assertEquals(OperationalThreadStatus::InProgress, $thread->status);
    }
}
