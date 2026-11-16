<?php

namespace App\Services;

use App\Enums\OperationalMessageCategory;
use App\Enums\OperationalThreadPriority;
use App\Enums\OperationalThreadStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\OperationalMessage;
use App\Models\OperationalThread;
use App\Models\Runsheet;
use App\Models\User;
use App\Notifications\OperationalMessageReceivedNotification;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class OperationalCommunicationService
{
    /**
     * Create a new operational communication thread with an initial message.
     *
     * @param  array{
     *     subject: string,
     *     message: string,
     *     category?: string,
     *     priority?: string,
     *     picker_id?: int,
     *     runsheet_id?: int|null,
     *     booking_id?: int|null,
     *     attachment_path?: string|null,
     * }  $data
     */
    public function createThread(User $creator, array $data): OperationalThread
    {
        return DB::transaction(function () use ($creator, $data): OperationalThread {
            $isPickerCreator = $this->isPicker($creator);

            if ($isPickerCreator) {
                $pickerId = $creator->id;
            } else {
                $pickerId = (int) ($data['picker_id'] ?? 0);
                $picker = User::query()->whereKey($pickerId)->first();

                if (! $picker || ! $this->isPicker($picker)) {
                    throw ValidationException::withMessages([
                        'picker_id' => 'Please select a valid picker for this communication thread.',
                    ]);
                }
            }

            $runsheetId = ! empty($data['runsheet_id']) ? (int) $data['runsheet_id'] : null;
            $bookingId = ! empty($data['booking_id']) ? (int) $data['booking_id'] : null;

            if ($runsheetId !== null) {
                $runsheet = Runsheet::query()->find($runsheetId);
                if (! $runsheet) {
                    throw ValidationException::withMessages([
                        'runsheet_id' => 'The selected runsheet does not exist.',
                    ]);
                }

                if ($isPickerCreator && (int) $runsheet->picker_id !== (int) $creator->id) {
                    throw ValidationException::withMessages([
                        'runsheet_id' => 'You can only link your own assigned runsheets.',
                    ]);
                }
            }

            if ($bookingId !== null) {
                $booking = Booking::query()->find($bookingId);
                if (! $booking) {
                    throw ValidationException::withMessages([
                        'booking_id' => 'The selected booking was not found.',
                    ]);
                }

                if ($runsheetId !== null) {
                    $attached = DB::table('booking_runsheet')
                        ->where('runsheet_id', $runsheetId)
                        ->where('booking_id', $bookingId)
                        ->exists();

                    if (! $attached) {
                        throw ValidationException::withMessages([
                            'booking_id' => 'The selected booking is not assigned to this runsheet.',
                        ]);
                    }
                }
            }

            $category = OperationalMessageCategory::tryFrom($data['category'] ?? '')
                ?? OperationalMessageCategory::General;

            $priority = OperationalThreadPriority::tryFrom($data['priority'] ?? '')
                ?? OperationalThreadPriority::Normal;

            $thread = OperationalThread::query()->create([
                'subject' => trim((string) $data['subject']),
                'category' => $category,
                'priority' => $priority,
                'status' => OperationalThreadStatus::Open,
                'picker_id' => $pickerId,
                'creator_id' => $creator->id,
                'runsheet_id' => $runsheetId,
                'booking_id' => $bookingId,
                'last_message_at' => now(),
            ]);

            $message = OperationalMessage::query()->create([
                'thread_id' => $thread->id,
                'sender_id' => $creator->id,
                'message' => trim((string) $data['message']),
                'attachment_path' => $data['attachment_path'] ?? null,
            ]);

            $this->notifyRecipients($thread, $message, $creator);

            return $thread->load(['picker', 'creator', 'runsheet', 'booking', 'messages.sender']);
        });
    }

    /**
     * Send a reply message to an existing operational thread.
     */
    public function reply(OperationalThread $thread, User $sender, string $messageText, ?string $attachmentPath = null): OperationalMessage
    {
        return DB::transaction(function () use ($thread, $sender, $messageText, $attachmentPath): OperationalMessage {
            /** @var OperationalThread $lockedThread */
            $lockedThread = OperationalThread::query()->lockForUpdate()->findOrFail($thread->id);

            $this->authorizeParticipant($lockedThread, $sender);

            $message = OperationalMessage::query()->create([
                'thread_id' => $lockedThread->id,
                'sender_id' => $sender->id,
                'message' => trim($messageText),
                'attachment_path' => $attachmentPath,
            ]);

            $newStatus = $lockedThread->status === OperationalThreadStatus::Resolved
                ? OperationalThreadStatus::InProgress
                : $lockedThread->status;

            $lockedThread->update([
                'last_message_at' => now(),
                'status' => $newStatus,
            ]);

            $this->notifyRecipients($lockedThread, $message, $sender);

            return $message->load('sender');
        });
    }

    /**
     * Mark all incoming unread messages as read for the current viewer.
     */
    public function markAsRead(OperationalThread $thread, User $reader): int
    {
        $updated = OperationalMessage::query()
            ->where('thread_id', $thread->id)
            ->where('sender_id', '!=', $reader->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        if ($updated > 0) {
            Cache::forget("user.{$reader->id}.sidebar_counts");
        }

        return $updated;
    }

    /**
     * Resolve an operational thread.
     */
    public function resolveThread(OperationalThread $thread, User $resolver, ?string $resolutionNote = null): OperationalThread
    {
        return DB::transaction(function () use ($thread, $resolver, $resolutionNote): OperationalThread {
            /** @var OperationalThread $lockedThread */
            $lockedThread = OperationalThread::query()->lockForUpdate()->findOrFail($thread->id);

            $this->authorizeParticipant($lockedThread, $resolver);

            $lockedThread->update([
                'status' => OperationalThreadStatus::Resolved,
                'resolved_at' => now(),
                'resolved_by' => $resolver->id,
                'resolution_note' => $resolutionNote ? trim($resolutionNote) : $lockedThread->resolution_note,
            ]);

            $this->forgetSidebarCountsForThread($lockedThread);

            return $lockedThread->load(['resolvedBy', 'picker', 'creator']);
        });
    }

    /**
     * Reopen a resolved operational thread.
     */
    public function reopenThread(OperationalThread $thread, User $user): OperationalThread
    {
        return DB::transaction(function () use ($thread, $user): OperationalThread {
            /** @var OperationalThread $lockedThread */
            $lockedThread = OperationalThread::query()->lockForUpdate()->findOrFail($thread->id);

            $this->authorizeParticipant($lockedThread, $user);

            $lockedThread->update([
                'status' => OperationalThreadStatus::InProgress,
                'resolved_at' => null,
                'resolved_by' => null,
            ]);

            $this->forgetSidebarCountsForThread($lockedThread);

            return $lockedThread;
        });
    }

    public function authorizeParticipant(OperationalThread $thread, User $user): void
    {
        if ($this->isAdmin($user)) {
            return;
        }

        if ($this->isPicker($user) && (int) $thread->picker_id === (int) $user->id) {
            return;
        }

        throw ValidationException::withMessages([
            'thread' => 'You are not authorized to view or reply to this communication thread.',
        ]);
    }

    public function isPicker(User $user): bool
    {
        $role = $user->role instanceof Role ? $user->role->value : (string) $user->role;

        return $role === Role::Picker->value;
    }

    public function isAdmin(User $user): bool
    {
        $role = $user->role instanceof Role ? $user->role->value : (string) $user->role;

        return in_array($role, [
            Role::SuperAdmin->value,
            Role::Admin->value,
            Role::Developer->value,
        ], true);
    }

    protected function notifyRecipients(OperationalThread $thread, OperationalMessage $message, User $sender): void
    {
        if ($this->isPicker($sender)) {
            $admins = $this->activeAdminUsers();

            if ($admins->isNotEmpty()) {
                foreach ($admins as $admin) {
                    Cache::forget("user.{$admin->id}.sidebar_counts");
                }
                Notification::send($admins, new OperationalMessageReceivedNotification($thread, $message, 'admin'));
            }
        } else {
            $picker = $thread->picker ?? User::query()->find($thread->picker_id);
            if ($picker && ! $picker->trashed()) {
                Cache::forget("user.{$picker->id}.sidebar_counts");
                $picker->notify(new OperationalMessageReceivedNotification($thread, $message, 'picker'));
            }
        }
    }

    protected function forgetSidebarCountsForThread(OperationalThread $thread): void
    {
        if ($thread->picker_id) {
            Cache::forget("user.{$thread->picker_id}.sidebar_counts");
        }

        foreach ($this->activeAdminUsers(['id']) as $admin) {
            Cache::forget("user.{$admin->id}.sidebar_counts");
        }
    }

    /**
     * @param  array<int, string>  $columns
     */
    protected function activeAdminUsers(array $columns = ['*'])
    {
        return User::query()
            ->whereIn('role', [Role::Admin->value, Role::SuperAdmin->value, Role::Developer->value])
            ->whereNull('deleted_at')
            ->get($columns);
    }
}
