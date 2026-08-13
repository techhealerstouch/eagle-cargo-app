<?php

namespace App\Jobs;

use App\Mail\BookingReceivedAdmin;
use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class NotifyAdminOfNewBooking implements ShouldBeEncrypted, ShouldQueue
{
    use Dispatchable, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 30;

    public Booking $booking;

    /**
     * Create a new job instance.
     */
    public function __construct(Booking $booking)
    {
        $this->booking = $booking;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $booking = $this->booking->loadMissing(['sender']);

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
