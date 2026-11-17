<?php

namespace App\Jobs;

use App\Mail\BookingConfirmation;
use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SendBookingConfirmationMail implements ShouldBeEncrypted, ShouldQueue
{
    use Dispatchable, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 30;

    public Booking $booking;

    /**
     * Dispatch the confirmation mail job using either post-response execution or database queue.
     */
    public static function dispatchForBooking(Booking $booking): mixed
    {
        if (config('mail.booking_confirmation_after_response', false)) {
            return static::dispatchAfterResponse($booking);
        }

        return static::dispatch($booking)->afterCommit();
    }

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
        $booking = $this->booking->loadMissing('sender');

        if (! $booking->sender || ! $booking->sender->email) {
            Log::warning('Unable to send booking confirmation email: sender email is missing.', [
                'booking_id' => $booking->id,
                'sender_id' => $booking->sender?->id,
            ]);

            return;
        }

        Mail::to($booking->sender->email)
            ->sendNow(new BookingConfirmation($booking));
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
        Log::error('Failed to send booking confirmation email.', [
            'booking_id' => $this->booking->id,
            'sender_id' => $this->booking->sender_id,
            'exception' => $exception->getMessage(),
        ]);
    }
}
