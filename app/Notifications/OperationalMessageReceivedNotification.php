<?php

namespace App\Notifications;

use App\Models\OperationalMessage;
use App\Models\OperationalThread;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

class OperationalMessageReceivedNotification extends Notification implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public OperationalThread $thread,
        public OperationalMessage $message,
        public string $targetRole = 'admin'
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $senderName = $this->message->sender?->name ?? 'Dispatch';
        $isPickerTarget = $this->targetRole === 'picker';

        $title = $isPickerTarget
            ? "Dispatch: {$this->thread->subject}"
            : "Picker ({$senderName}): {$this->thread->subject}";

        $url = $isPickerTarget
            ? "/picker/messages?thread_id={$this->thread->id}"
            : "/admin/communications?thread_id={$this->thread->id}";

        return [
            'type' => 'operational_message',
            'thread_id' => $this->thread->id,
            'title' => $title,
            'message' => Str::limit($this->message->message, 140),
            'url' => $url,
            'category' => $this->thread->category?->value ?? 'general',
            'priority' => $this->thread->priority?->value ?? 'normal',
        ];
    }

    public function broadcastType(): string
    {
        return 'operational_message';
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        $payload = $this->toArray($notifiable);

        return new BroadcastMessage([
            ...$payload,
            'data' => $payload,
            'read_at' => null,
            'created_at' => now()->toIso8601String(),
        ]);
    }
}
