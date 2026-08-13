<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\BoxStatus;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Sender;
use App\Models\User;
use App\Notifications\BatchLifecycleNotification;
use App\Notifications\BatchStatusNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class BatchNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_batch_lifecycle_notification_is_sent_to_admins_when_batch_status_changes(): void
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => 'admin']);
        $batch = Batch::factory()->create(['status' => BatchStatus::Open]);

        $batch->update(['status' => BatchStatus::ReadyToClose]);

        Notification::assertSentTo($admin, BatchLifecycleNotification::class);
    }

    public function test_batch_lifecycle_notification_is_not_sent_for_non_notifiable_status(): void
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => 'admin']);
        $batch = Batch::factory()->create(['status' => BatchStatus::ReadyToClose]);

        $batch->update(['status' => BatchStatus::Loading]);

        Notification::assertNotSentTo($admin, BatchLifecycleNotification::class);
    }

    public function test_batch_status_notification_is_sent_to_senders_when_batch_departs(): void
    {
        Notification::fake();

        $user = User::factory()->create(['role' => 'sender']);
        $sender = Sender::factory()->create(['user_id' => $user->id]);
        $booking = Booking::factory()->create(['sender_id' => $sender->id]);
        $batch = Batch::factory()->create(['status' => BatchStatus::ReadyToClose]);
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'batch_id' => $batch->id,
            'status' => BoxStatus::ReceivedByWarehouse,
        ]);

        $batch->update(['status' => BatchStatus::Sailed]);

        Notification::assertSentTo($user, BatchStatusNotification::class);
    }

    public function test_batch_status_notification_is_sent_when_batch_arrives(): void
    {
        Notification::fake();

        $user = User::factory()->create(['role' => 'sender']);
        $sender = Sender::factory()->create(['user_id' => $user->id]);
        $booking = Booking::factory()->create(['sender_id' => $sender->id]);
        $batch = Batch::factory()->create(['status' => BatchStatus::Sailed]);
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'batch_id' => $batch->id,
            'status' => BoxStatus::InTransit,
        ]);

        $batch->update(['status' => BatchStatus::Arrived]);

        Notification::assertSentTo($user, BatchStatusNotification::class);
    }

    public function test_batch_status_notification_is_not_sent_for_ready_to_close_status(): void
    {
        Notification::fake();

        $user = User::factory()->create(['role' => 'sender']);
        $sender = Sender::factory()->create(['user_id' => $user->id]);
        $booking = Booking::factory()->create(['sender_id' => $sender->id]);
        $batch = Batch::factory()->create(['status' => BatchStatus::Loading]);
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'batch_id' => $batch->id,
            'status' => BoxStatus::ReceivedByWarehouse,
        ]);

        $batch->update(['status' => BatchStatus::ReadyToClose]);

        Notification::assertNotSentTo($user, BatchStatusNotification::class);
    }

    public function test_batch_lifecycle_notification_has_correct_data(): void
    {
        $batch = Batch::factory()->create([
            'batch_number' => 'BATCH-2025-001',
            'voyage_number' => 'VOY-123',
            'origin_port' => 'Los Angeles',
            'destination_port' => 'Manila',
        ]);

        $notification = new BatchLifecycleNotification($batch, BatchStatus::Sailed);
        $admin = User::factory()->create(['role' => 'admin']);

        $data = $notification->toArray($admin);

        $this->assertEquals('batch_lifecycle', $data['type']);
        $this->assertEquals($batch->id, $data['batch_id']);
        $this->assertEquals('BATCH-2025-001', $data['batch_number']);
        $this->assertEquals(BatchStatus::Sailed->value, $data['status']);
        $this->assertArrayHasKey('title', $data);
        $this->assertArrayHasKey('message', $data);
    }

    public function test_batch_status_notification_has_correct_data(): void
    {
        $batch = Batch::factory()->create([
            'batch_number' => 'BATCH-2025-002',
            'voyage_number' => 'VOY-456',
            'origin_port' => 'San Francisco',
            'destination_port' => 'Cebu',
        ]);

        $notification = new BatchStatusNotification($batch, BatchStatus::Arrived);
        $user = User::factory()->create();

        $data = $notification->toArray($user);

        $this->assertEquals('batch_status', $data['type']);
        $this->assertEquals($batch->id, $data['batch_id']);
        $this->assertEquals('BATCH-2025-002', $data['batch_number']);
        $this->assertEquals(BatchStatus::Arrived->value, $data['status']);
        $this->assertArrayHasKey('title', $data);
        $this->assertArrayHasKey('message', $data);
    }
}
