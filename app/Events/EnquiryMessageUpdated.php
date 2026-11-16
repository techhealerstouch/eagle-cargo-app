<?php

namespace App\Events;

use App\Enums\Role;
use App\Models\Enquiry;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;

class EnquiryMessageUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $enquiryId;

    public ?int $senderUserId;

    public function __construct(Enquiry $enquiry, ?int $senderUserId = null)
    {
        $this->enquiryId = (int) $enquiry->id;
        $this->senderUserId = $senderUserId ?? User::query()
            ->where('email', $enquiry->email)
            ->value('id');

        $admins = User::query()
            ->whereIn('role', [Role::Admin->value, Role::SuperAdmin->value, Role::Developer->value])
            ->whereNull('deleted_at')
            ->pluck('id');

        foreach ($admins as $adminId) {
            Cache::forget("user.{$adminId}.sidebar_counts");
        }
    }

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('admin.enquiries'),
        ];

        if ($this->senderUserId) {
            $channels[] = new PrivateChannel("sender.enquiries.{$this->senderUserId}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'EnquiryMessageUpdated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'enquiry_id' => $this->enquiryId,
        ];
    }
}
