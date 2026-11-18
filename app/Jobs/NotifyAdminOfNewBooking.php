<?php

namespace App\Jobs;

use App\Enums\Role;
use App\Http\Controllers\SenderDashboardController;
use App\Mail\BookingReceivedAdmin;
use App\Models\Booking;
use App\Models\User;
use App\Notifications\NewOnlineBookingReceived;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class NotifyAdminOfNewBooking implements ShouldBeEncrypted, ShouldQueue
{
    use Dispatchable, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 30;

    public Booking $booking;

    public bool $sendInApp;

    /**
     * Create a new job instance.
     */
    public function __construct(Booking $booking, bool $sendInApp = true)
    {
        $this->booking = $booking;
        $this->sendInApp = $sendInApp;
    }

    /**
     * Dispatch in-app notification immediately after transaction commit,
     * then queue the SMTP email delivery without blocking request execution.
     */
    public static function dispatchForBooking(Booking $booking): mixed
    {
        if (DB::transactionLevel() > 0) {
            DB::afterCommit(function () use ($booking) {
                static::sendInAppNotifications($booking);
            });
        } else {
            static::sendInAppNotifications($booking);
        }

        return static::dispatch($booking, false)->afterCommit();
    }

    /**
     * Send in-app database & broadcast notifications to Admin / SuperAdmin users
     * with deduplication and cache invalidation.
     */
    public static function sendInAppNotifications(Booking $booking): void
    {
        try {
            $booking->loadMissing(['sender.user']);

            $admins = User::whereIn('role', [Role::SuperAdmin, Role::Admin])->get();
            if ($admins->isEmpty()) {
                return;
            }

            foreach ($admins as $admin) {
                try {
                    $alreadyNotified = $admin->notifications()
                        ->where('type', NewOnlineBookingReceived::class)
                        ->where('created_at', '>=', now()->subHours(24))
                        ->get(['id', 'data'])
                        ->contains(fn ($n) => (int) ($n->data['booking_id'] ?? 0) === (int) $booking->id);

                    if (! $alreadyNotified) {
                        $admin->notifyNow(new NewOnlineBookingReceived($booking));
                    }

                    Cache::forget("user.{$admin->id}.sidebar_counts");
                    Cache::forget("user.{$admin->id}.unread_notifications");
                } catch (Throwable $e) {
                    Log::error('Failed to notify admin in-app of new booking.', [
                        'admin_id' => $admin->id,
                        'booking_id' => $booking->id,
                        'exception' => $e->getMessage(),
                    ]);
                }
            }

            Cache::forget(SenderDashboardController::DASHBOARD_CACHE_KEY);
        } catch (Throwable $e) {
            Log::error('Unexpected error while sending admin in-app notifications.', [
                'booking_id' => $booking->id,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $booking = $this->booking->loadMissing(['sender.user']);

        if ($this->sendInApp) {
            static::sendInAppNotifications($booking);
        }

        $adminEmail = config('mail.admin_address', config('mail.from.address'));

        if (! $adminEmail) {
            Log::warning('Unable to notify admin of new booking: admin email is not configured.', [
                'booking_id' => $booking->id,
            ]);

            return;
        }

        Mail::to($adminEmail)
            ->sendNow(new BookingReceivedAdmin($booking));
    }

    /**
     * Back off exponentially when transport/provider errors happen.
     */
    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function failed(Throwable $exception): void
    {
        Log::error('Failed to notify admin of new booking.', [
            'booking_id' => $this->booking->id,
            'exception' => $exception->getMessage(),
        ]);
    }
}
