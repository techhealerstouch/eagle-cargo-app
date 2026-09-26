<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Enums\RunsheetType;
use App\Jobs\SendBookingConfirmationMail;
use App\Models\Booking;
use App\Models\User;
use App\Repositories\Contracts\TrackingRepositoryInterface;
use App\Services\SettingsService;
use App\Services\TrackingAnalyticsService;
use App\Services\TrackingStepService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Inertia\Inertia;

class TrackingController extends Controller
{
    private TrackingRepositoryInterface $trackingRepo;

    private TrackingStepService $trackingStepService;

    private SettingsService $settingsService;

    private TrackingAnalyticsService $analyticsService;

    public function __construct(
        TrackingRepositoryInterface $trackingRepo,
        TrackingStepService $trackingStepService,
        SettingsService $settingsService,
        TrackingAnalyticsService $analyticsService,
    ) {
        $this->trackingRepo = $trackingRepo;
        $this->trackingStepService = $trackingStepService;
        $this->settingsService = $settingsService;
        $this->analyticsService = $analyticsService;
    }

    /**
     * Assert that the authenticated user owns the booking or is an admin,
     * or that a valid guest token is provided for guest bookings.
     */
    private function assertBookingOwnership(Booking $booking, ?string $token = null): void
    {
        $user = Auth::user();
        $isAdmin = $user && in_array($user->role, [Role::Admin, Role::SuperAdmin], true);
        $isOwner = $user && $user->sender && $booking->sender_id === $user->sender->id;

        if ($isAdmin || $isOwner) {
            return;
        }

        if ($token && ! empty($booking->guest_token) && hash_equals($booking->guest_token, $token)) {
            return;
        }

        abort(403, 'You do not have permission to modify this booking.');
    }

    public function index(Request $request)
    {
        $trackingData = null;

        $request->validate([
            'tracking_number' => 'nullable|string',
            'ref' => 'nullable|string',
        ]);

        $trackingNumber = $request->input('tracking_number') ?: $request->input('ref');

        if ($trackingNumber) {
            $trackingData = $this->trackingRepo->getTrackingData($trackingNumber);

            if ($trackingData) {
                $this->analyticsService->recordLookup($trackingNumber, $request, 'web');

                if (! empty($trackingData['booking_id'])) {
                    $trackingData['declaration_resends_remaining'] = $this->getRemainingDeclarationResends((int) $trackingData['booking_id']);
                }
            }
        }

        return inertia('marketing/track', [
            'trackingData' => $trackingData,
            'tracking_number' => $trackingNumber,
            'trackingSteps' => $this->trackingStepService->getSteps(),
        ]);
    }

    public function uploadDeclaration(Request $request)
    {
        $request->validate([
            'booking_id' => 'required|exists:bookings,id',
            'declaration_form' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120', // 5MB max
            'token' => 'nullable|string',
        ]);

        $booking = Booking::findOrFail($request->booking_id);
        $this->assertBookingOwnership($booking, $request->input('token'));

        if ($request->hasFile('declaration_form')) {
            $this->trackingRepo->uploadDeclaration(
                $booking->id,
                $request->file('declaration_form')
            );

            return back()->with('success', 'Declaration form uploaded successfully. Our team will verify it shortly.');
        }

        return back()->withErrors(['declaration_form' => 'Failed to upload file.']);
    }

    public function showDeclarationForm(Request $request, Booking $booking)
    {
        $token = $request->query('token');
        $this->assertBookingOwnership($booking, $token);

        $booking->load(['sender', 'boxes.recipient', 'boxes.boxType']);

        return inertia('marketing/declaration', [
            'booking' => $booking,
            'declarationSettings' => $this->settingsService->getDeclarationSettings(),
            'isGuest' => empty($booking->sender?->user_id),
            'guestToken' => $token,
        ]);
    }

    public function saveDeclarationData(Request $request)
    {
        $request->validate([
            'booking_id' => 'required|exists:bookings,id',
            'declaration_data' => 'required|array',
            'token' => 'nullable|string',
        ]);

        $booking = Booking::findOrFail($request->booking_id);
        $this->assertBookingOwnership($booking, $request->input('token'));

        $this->trackingRepo->saveDeclarationData(
            $booking->id,
            $request->declaration_data
        );

        $isGuest = empty($booking->sender?->user_id);
        if ($isGuest && $booking->guest_token) {
            return redirect()
                ->route('guest.booking.confirmed', ['token' => $booking->guest_token])
                ->with('success', 'Customs declaration submitted successfully.');
        }

        return redirect()->route('dashboard')->with('success', 'Customs declaration submitted successfully.');
    }

    private function isAssignedOperationalUser(Booking $booking): bool
    {
        $user = Auth::user();

        if (! $user) {
            return false;
        }

        return match ($user->role) {
            Role::Picker => $booking->runsheets()
                ->where('runsheets.type', RunsheetType::Pickup->value)
                ->where('runsheets.picker_id', $user->id)
                ->exists(),
            Role::Courier => $booking->runsheets()
                ->where('runsheets.type', RunsheetType::Delivery->value)
                ->where('runsheets.courier_id', $user->id)
                ->exists(),
            default => false,
        };
    }
    public function viewDeclaration(Request $request, Booking $booking)
    {
        $user = Auth::user();
        $token = $request->query('token');

        $isAdmin = $user && in_array($user->role, [Role::Admin, Role::SuperAdmin], true);
        $isOwnerSender = $user
            && $user->role === Role::Sender
            && $booking->sender_id === $user->sender?->id;
        $isOperational = $this->isAssignedOperationalUser($booking);
        $isValidGuest = $token && ! empty($booking->guest_token) && hash_equals($booking->guest_token, $token);

        if (! $isAdmin && ! $isOwnerSender && ! $isOperational && ! $isValidGuest) {
            abort(403);
        }

        return Inertia::render('admin/bookings/print-declaration', [
            'booking' => $booking->load(['sender', 'boxes.recipient', 'boxes.boxType', 'boxes.batch']),
            'declarationSettings' => $this->settingsService->getDeclarationSettings(),
        ]);
    }

    /**
     * Resolve the daily rate limit cache keys for a given booking and user.
     *
     * @return array<int, string>
     */
    private function getDeclarationDailyRateLimitKeys(Booking $booking, ?User $user = null): array
    {
        $user = $user ?? Auth::user();
        $userKey = $user
            ? 'user:' . $user->id
            : ($booking->sender?->email
                ? 'email:' . strtolower(trim($booking->sender->email))
                : 'booking:' . $booking->id);

        return [
            'declaration_resend_daily:' . $userKey,
            'declaration_resend_daily:booking:' . $booking->id,
        ];
    }

    /**
     * Get remaining declaration resends for today (0 to 3).
     */
    private function getRemainingDeclarationResends(int $bookingId): int
    {
        $booking = Booking::with('sender')->find($bookingId);
        if (! $booking) {
            return 3;
        }

        [$rateLimitUserKey, $rateLimitBookingKey] = $this->getDeclarationDailyRateLimitKeys($booking);

        $userRemaining = RateLimiter::remaining($rateLimitUserKey, 3);
        $bookingRemaining = RateLimiter::remaining($rateLimitBookingKey, 3);

        return max(0, min($userRemaining, $bookingRemaining));
    }

    /**
     * Resend the booking confirmation / declaration email to the sender on file.
     * Enforces a maximum of 3 chances per user / booking per day.
     */
    public function resendDeclarationEmail(Request $request)
    {
        $validated = $request->validate([
            'booking_id' => 'required|integer|exists:bookings,id',
            'tracking_number' => 'nullable|string',
        ]);

        $booking = Booking::with(['sender', 'boxes'])->findOrFail($validated['booking_id']);

        // Verify relationship if tracking_number / reference provided
        if (! empty($validated['tracking_number'])) {
            $inputRef = trim(strtolower($validated['tracking_number']));
            $bookingRef = trim(strtolower($booking->reference_number ?? ''));
            $hasMatchingBox = $booking->boxes->contains(function ($box) use ($inputRef) {
                return trim(strtolower($box->tracking_number ?? '')) === $inputRef;
            });

            if ($bookingRef !== $inputRef && ! $hasMatchingBox) {
                return response()->json([
                    'message' => 'The provided tracking details do not match this booking.',
                ], 403);
            }
        }

        // Check if declaration is actually required
        if (! $booking->needsDeclaration()) {
            return response()->json([
                'message' => 'A customs declaration has already been received or is not required for this booking.',
            ], 422);
        }

        // Check if sender has an email
        if (! $booking->sender || ! $booking->sender->email) {
            return response()->json([
                'message' => 'No sender email address is on file for this booking. Please contact customer support.',
            ], 422);
        }

        [$rateLimitUserKey, $rateLimitBookingKey] = $this->getDeclarationDailyRateLimitKeys($booking, $request->user());

        // Daily limit check: max 3 chances per user / booking per day
        if (RateLimiter::tooManyAttempts($rateLimitUserKey, 3) || RateLimiter::tooManyAttempts($rateLimitBookingKey, 3)) {
            $secondsUntilAvailable = max(
                RateLimiter::availableIn($rateLimitUserKey),
                RateLimiter::availableIn($rateLimitBookingKey)
            );
            $hours = (int) ceil($secondsUntilAvailable / 3600);
            $timeText = $hours > 1 ? "in {$hours} hours" : ($secondsUntilAvailable > 60 ? "in 1 hour" : "shortly");

            return response()->json([
                'message' => "You have reached the maximum of 3 email resends allowed per day. Please check your spam/junk folder or try again {$timeText}.",
                'resends_remaining' => 0,
                'retry_after' => $secondsUntilAvailable,
            ], 429);
        }

        // Short cooldown check (60s cooldown per booking to prevent rapid double-clicks)
        $cacheKey = 'resend_declaration_cooldown_' . $booking->id;
        if (Cache::has($cacheKey)) {
            $cooldownUntil = Cache::get($cacheKey);
            $secondsRemaining = max(1, $cooldownUntil - now()->timestamp);

            return response()->json([
                'message' => "Please wait {$secondsRemaining} seconds before requesting another email.",
                'retry_after' => $secondsRemaining,
                'resends_remaining' => max(0, min(
                    RateLimiter::remaining($rateLimitUserKey, 3),
                    RateLimiter::remaining($rateLimitBookingKey, 3)
                )),
            ], 429);
        }

        // Ensure guest token exists if needed
        if (empty($booking->guest_token)) {
            $booking->update(['guest_token' => (string) Str::uuid()]);
        }

        // Record attempt against 24-hour rate limiters (86400 seconds)
        RateLimiter::hit($rateLimitUserKey, 86400);
        RateLimiter::hit($rateLimitBookingKey, 86400);

        Cache::put($cacheKey, now()->timestamp + 60, 60);

        // Dispatch booking confirmation email (contains the tokenized declaration link)
        SendBookingConfirmationMail::dispatch($booking);

        $remaining = max(0, min(
            RateLimiter::remaining($rateLimitUserKey, 3),
            RateLimiter::remaining($rateLimitBookingKey, 3)
        ));

        $maskedEmail = $this->trackingRepo->maskEmail($booking->sender->email);

        $chancesText = $remaining > 0
            ? "({$remaining} " . ($remaining === 1 ? 'chance' : 'chances') . ' remaining today)'
            : '(Daily limit of 3 reached for today)';

        $successMsg = "Customs declaration link has been resent to {$maskedEmail}. {$chancesText} Please check your inbox and spam folder.";

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => $successMsg,
                'masked_email' => $maskedEmail,
                'resends_remaining' => $remaining,
            ]);
        }

        return back()->with('success', $successMsg);
    }
}
