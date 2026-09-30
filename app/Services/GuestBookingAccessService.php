<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\GuestBookingAccessChallenge;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use App\Notifications\GuestBookingAccessCode;

class GuestBookingAccessService
{
    public const CONFIRMATION = 'confirmation';

    public const DECLARATION = 'declaration';

    public const PAYMENT = 'payment';

    public function confirmationUrl(Booking $booking): string
    {
        return $this->temporaryUrl('guest.booking.confirmed', $booking, self::CONFIRMATION, 24 * 60);
    }

    public function declarationUrl(Booking $booking): string
    {
        return $this->temporaryUrl('track.declaration.form', $booking, self::DECLARATION, 24 * 60);
    }

    public function paymentUrl(Booking $booking): string
    {
        return $this->temporaryUrl('guest.bookings.pay', $booking, self::PAYMENT, 60);
    }

    public function verificationUrl(Booking $booking, string $purpose): string
    {
        return $this->temporaryUrl('guest.booking.verify', $booking, $purpose, 15);
    }

    public function sendChallenge(Booking $booking, string $purpose): void
    {
        $booking->loadMissing('sender');
        $email = $booking->sender?->email;

        if (! $email) {
            throw new AccessDeniedHttpException('Guest booking email is unavailable.');
        }

        GuestBookingAccessChallenge::query()
            ->where('booking_id', $booking->id)
            ->where('purpose', $purpose)
            ->whereNull('consumed_at')
            ->update(['revoked_at' => now()]);

        $code = (string) random_int(100000, 999999);
        $challenge = GuestBookingAccessChallenge::create([
            'booking_id' => $booking->id,
            'purpose' => $purpose,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(10),
        ]);

        Notification::route('mail', $email)->notify(new GuestBookingAccessCode($booking, $purpose, $code));
    }

    public function verifyChallenge(Request $request, Booking $booking, string $purpose, string $code): bool
    {
        $challenge = GuestBookingAccessChallenge::query()
            ->where('booking_id', $booking->id)
            ->where('purpose', $purpose)
            ->active()
            ->latest('id')
            ->first();

        if (! $challenge || $challenge->attempts >= 5) {
            return false;
        }

        if (! Hash::check($code, $challenge->code_hash)) {
            $challenge->increment('attempts');

            return false;
        }

        $challenge->update([
            'verified_at' => now(),
            'consumed_at' => now(),
        ]);

        $request->session()->put($this->sessionKey($booking, $purpose), now()->addMinutes(15)->timestamp);

        return true;
    }

    public function isVerified(Request $request, Booking $booking, string $purpose): bool
    {
        $expiresAt = $request->session()->get($this->sessionKey($booking, $purpose));

        return is_int($expiresAt) && $expiresAt > now()->timestamp;
    }

    public function markVerified(Request $request, Booking $booking, string $purpose, int $minutes = 60): void
    {
        $request->session()->put($this->sessionKey($booking, $purpose), now()->addMinutes($minutes)->timestamp);
    }

    public function authorizeSessionOrToken(Request $request, Booking $booking, string $purpose): void
    {
        if (! $booking->is_guest) {
            throw new AccessDeniedHttpException('Invalid guest access token.');
        }

        // 1. Allow if verified in session or created in current guest session
        if ($this->isVerified($request, $booking, $purpose) || (int) $request->session()->get('guest_booking_id') === (int) $booking->id) {
            return;
        }

        // 2. Allow if valid guest token matches
        $token = $request->header('X-Guest-Token') ?? $request->input('guest_token') ?? $request->query('token');
        if ($token && $booking->guest_token && hash_equals((string) $booking->guest_token, (string) $token)) {
            return;
        }

        // 3. Fallback to temporary signed URL check
        $this->authorize($request, $booking, $purpose);
    }

    public function authorize(Request $request, Booking $booking, string $purpose): void
    {
        if (! $booking->is_guest) {
            throw new AccessDeniedHttpException('Invalid guest access token.');
        }

        if (! $request->hasValidSignature() || $request->query('purpose') !== $purpose) {
            throw new AccessDeniedHttpException('This guest access link is invalid or expired.');
        }
    }

    public function temporaryUrl(string $route, Booking $booking, string $purpose, int $minutes): string
    {
        return URL::temporarySignedRoute(
            $route,
            Carbon::now()->addMinutes($minutes),
            [
                'booking' => $booking->getRouteKey(),
                'purpose' => $purpose,
            ],
        );
    }

    private function sessionKey(Booking $booking, string $purpose): string
    {
        return 'guest_booking_access.'.$booking->id.'.'.$purpose;
    }
}
