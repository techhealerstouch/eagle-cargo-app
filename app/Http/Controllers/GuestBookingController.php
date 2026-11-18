<?php

namespace App\Http\Controllers;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Http\Requests\StoreGuestBookingRequest;
use App\Models\Booking;
use App\Models\GuestBookingAccessChallenge;
use App\Models\Promotion;
use App\Models\Sender;
use App\Notifications\BankTransferDetails;
use App\Repositories\Contracts\BookingRepositoryInterface;
use App\Rules\ValidPickupDate;
use App\Services\GuestBookingAccessService;
use App\Services\PaymentService;
use App\Services\ReferenceDataService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class GuestBookingController extends Controller
{
    public function __construct(
        private readonly BookingRepositoryInterface $bookings,
        private readonly ReferenceDataService $referenceData,
        private readonly GuestBookingAccessService $guestAccess,
    ) {}

    public function create(Request $request): Response
    {
        $activePromotions = Promotion::where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('valid_from')->orWhere('valid_from', '<=', now());
            })
            ->where(function ($query) {
                $query->whereNull('valid_to')->orWhere('valid_to', '>=', now());
            })
            ->where(function ($query) {
                $query->whereNull('max_uses')->orWhereRaw('uses_count < max_uses');
            })
            ->orderBy('created_at', 'desc')
            ->get([
                'id',
                'code',
                'name',
                'description',
                'type',
                'value',
                'min_spend',
                'max_discount',
                'min_box_count',
                'buy_quantity',
                'free_quantity',
                'valid_from',
                'valid_to',
                'first_time_sender_only',
                'applicable_pickup_zones',
                'applicable_box_types',
            ]);

        $emptyBoxSource = null;
        if ($request->has('from_empty_box')) {
            $sourceId = (int) $request->query('from_empty_box');
            $source = Booking::with('sender')->find($sourceId);

            $token = $request->query('token') ?? $request->header('X-Guest-Token');
            $isAuthorizedGuest = $source && (
                ($request->hasValidSignature() && (int) $request->query('from_empty_box') === (int) $source->id)
                || $this->guestAccess->isVerified($request, $source, GuestBookingAccessService::CONFIRMATION)
                || (int) $request->session()->get('guest_booking_id') === (int) $source->id
                || ($token && $source->guest_token && hash_equals((string) $source->guest_token, (string) $token))
            );

            if ($isAuthorizedGuest && $source->status !== BookingStatus::Cancelled && (int) $source->empty_box_count > 0) {
                $alreadyClaimed = Booking::where('source_empty_box_booking_id', $source->id)
                    ->where('status', '!=', BookingStatus::Cancelled)
                    ->exists();

                if (! $alreadyClaimed) {
                    $isPaidOrConfirmed = in_array($source->payment_status, [PaymentStatus::Paid, PaymentStatus::CashCollected], true)
                        || in_array($source->status, [BookingStatus::Confirmed, BookingStatus::Collected, BookingStatus::Delivered], true);

                    $emptyBoxSource = [
                        'id' => $source->id,
                        'reference_number' => $source->reference_number,
                        'empty_box_count' => (int) $source->empty_box_count,
                        'empty_box_fee' => (float) ($source->empty_box_fee ?: 10.00),
                        'empty_box_items' => $source->empty_box_items ?: [],
                        'sender' => $source->sender,
                        'is_credit_eligible' => $isPaidOrConfirmed,
                        'estimated_deposit_credit' => $isPaidOrConfirmed ? round((int) $source->empty_box_count * (float) ($source->empty_box_fee ?: 10.00), 2) : 0.00,
                    ];
                }
            }
        }

        return Inertia::render('guest/Book', [
            'areas' => $this->referenceData->activeAreas(),
            'provinces' => $this->referenceData->activeProvinces(),
            'boxTypes' => $this->referenceData->activeBoxTypes(),
            'boxPrices' => $this->referenceData->boxPrices(),
            'pickupZones' => $this->referenceData->activePickupZones(),
            'suburbs' => $this->referenceData->activeSuburbs(),
            'activePromotions' => $activePromotions,
            'emptyBoxSource' => $emptyBoxSource,
            'savedRecipients' => [],
            'sender' => null,
            'isGuest' => true,
            'initialQuery' => $request->only(['suburb', 'postcode', 'state', 'pickup_zone_id', 'box_type_id', 'area_id', 'province']),
        ]);
    }

    public function initialize(
        StoreGuestBookingRequest $request,
        PaymentService $paymentService,
    ) {
        if ($request->filled('website')) {
            return response()->json(['error' => 'Invalid submission'], 400);
        }

        $validated = $request->validated();

        $sender = Sender::where('email', $validated['email'])
            ->whereNull('user_id')
            ->first();

        $senderAttributes = [
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'mobile' => $validated['mobile'],
            'secondary_mobile' => $validated['secondary_mobile'] ?? null,
            'address' => $validated['address'],
            'suburb' => $validated['suburb'] ?? null,
            'state' => $validated['state'] ?? null,
            'postcode' => $validated['postcode'] ?? null,
            'latitude' => $validated['latitude'] ?? null,
            'longitude' => $validated['longitude'] ?? null,
            'pickup_zone_id' => $validated['pickup_zone_id'] ?? null,
        ];

        if ($sender) {
            $sender->update($senderAttributes);
        } else {
            $sender = Sender::create(array_merge($senderAttributes, [
                'email' => $validated['email'],
                'user_id' => null,
            ]));
        }

        $booking = null;
        $bookingId = $request->input('booking_id');
        $initializationKey = $request->input('initialization_key');

        if ($initializationKey) {
            $booking = Booking::where('sender_id', $sender->id)
                ->where('initialization_key', $initializationKey)
                ->where('is_guest', true)
                ->whereIn('status', [BookingStatus::Pending, BookingStatus::Draft])
                ->first();
        }

        if ($booking) {
            $booking = $this->bookings->updateBooking($booking, $validated);
        } elseif ($bookingId) {
            $booking = Booking::where('id', $bookingId)
                ->where('sender_id', $sender->id)
                ->where('is_guest', true)
                ->first();
            if ($booking) {
                $booking = $this->bookings->updateBooking($booking, $validated);
            }
        }

        if (! $booking) {
            $validated['is_guest'] = true;
            if (empty($validated['guest_token'])) {
                $validated['guest_token'] = (string) Str::uuid();
            }
            if ($initializationKey) {
                $validated['initialization_key'] = $initializationKey;
            }
            $booking = $this->bookings->createBooking($validated, $sender);
        }

        $this->guestAccess->markVerified($request, $booking, GuestBookingAccessService::PAYMENT, 120);
        $request->session()->put('guest_booking_id', $booking->id);

        $response = [
            'booking' => $booking->load('boxes.recipient', 'boxes.boxType', 'sender')->makeHidden('guest_token'),
            'stripeKey' => config('services.stripe.key'),
        ];

        if (! empty($validated['payment_method']) && $validated['payment_method'] === 'bank_transfer') {
            $sender->notify(new BankTransferDetails($booking));
        }

        try {
            $intent = $paymentService->createPaymentIntent($booking);
            $response['clientSecret'] = $intent->client_secret;
        } catch (\Exception $e) {
            Log::warning('Guest initialize: Stripe payment intent deferred: '.$e->getMessage());
        }

        return response()->json($response);
    }

    public function store(StoreGuestBookingRequest $request)
    {
        // Honeypot check for bots
        if ($request->filled('website')) {
            return redirect()->route('guest.book');
        }

        $validated = $request->validated();

        // Find or create an unlinked guest sender for this email
        $sender = Sender::where('email', $validated['email'])
            ->whereNull('user_id')
            ->first();

        $senderAttributes = [
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'mobile' => $validated['mobile'],
            'secondary_mobile' => $validated['secondary_mobile'] ?? null,
            'address' => $validated['address'],
            'suburb' => $validated['suburb'] ?? null,
            'state' => $validated['state'] ?? null,
            'postcode' => $validated['postcode'] ?? null,
            'latitude' => $validated['latitude'] ?? null,
            'longitude' => $validated['longitude'] ?? null,
            'pickup_zone_id' => $validated['pickup_zone_id'] ?? null,
        ];

        if ($sender) {
            $sender->update($senderAttributes);
        } else {
            $sender = Sender::create(array_merge($senderAttributes, [
                'email' => $validated['email'],
                'user_id' => null,
            ]));
        }

        $validated['is_guest'] = true;
        if (empty($validated['guest_token'])) {
            $validated['guest_token'] = (string) Str::uuid();
        }

        $booking = $this->bookings->createBooking($validated, $sender);

        if ($validated['payment_method'] === 'bank_transfer') {
            $sender->notify(new BankTransferDetails($booking));
        }

        return redirect($this->guestAccess->confirmationUrl($booking))
            ->with('success', 'Your booking request has been submitted successfully!');
    }

    public function confirmed(Request $request, Booking $booking): Response
    {
        $this->guestAccess->authorize($request, $booking, GuestBookingAccessService::CONFIRMATION);
        $this->guestAccess->markVerified($request, $booking, GuestBookingAccessService::CONFIRMATION, 120);
        $request->session()->put('guest_booking_id', $booking->id);

        $booking->load([
            'sender.pickupZone',
            'boxes.boxType',
            'boxes.recipient.area',
            'invoice.payments',
        ]);
        $booking->makeHidden('guest_token');

        return Inertia::render('guest/BookingConfirmed', [
            'booking' => $booking,
            'token' => null,
            'convertEmptyBoxUrl' => URL::temporarySignedRoute('guest.book', now()->addDays(30), ['from_empty_box' => $booking->id]),
            'declarationUrl' => $this->guestAccess->verificationUrl($booking, GuestBookingAccessService::DECLARATION),
            'paymentUrl' => $this->guestAccess->isVerified($request, $booking, GuestBookingAccessService::PAYMENT)
                ? $this->guestAccess->paymentUrl($booking)
                : $this->guestAccess->verificationUrl($booking, GuestBookingAccessService::PAYMENT),
        ]);
    }

    public function verifyAccess(Request $request, Booking $booking): Response
    {
        $purpose = (string) $request->query('purpose');
        $this->guestAccess->authorize($request, $booking, $purpose);

        $hasActiveChallenge = GuestBookingAccessChallenge::query()
            ->where('booking_id', $booking->id)
            ->where('purpose', $purpose)
            ->active()
            ->exists();

        if (! $hasActiveChallenge || $request->boolean('resend')) {
            $this->guestAccess->sendChallenge($booking, $purpose);
        }

        $cleanQuery = http_build_query($request->only(['expires', 'purpose', 'signature']));

        return Inertia::render('guest/VerifyAccess', [
            'bookingId' => $booking->id,
            'bookingReference' => $booking->reference_number,
            'purpose' => $purpose,
            'accessQuery' => $cleanQuery ? '?'.$cleanQuery : '',
            'email' => $booking->sender?->email,
        ]);
    }

    public function verifyAccessCode(Request $request, Booking $booking)
    {
        $purpose = (string) $request->query('purpose');
        $this->guestAccess->authorize($request, $booking, $purpose);
        $request->validate(['code' => ['required', 'digits:6']]);

        if (! $this->guestAccess->verifyChallenge($request, $booking, $purpose, (string) $request->input('code'))) {
            return back()->withErrors(['code' => 'That verification code is invalid or expired.']);
        }

        if ($purpose === GuestBookingAccessService::PAYMENT) {
            $this->guestAccess->markVerified($request, $booking, GuestBookingAccessService::CONFIRMATION, 60);
            $request->session()->put('guest_booking_id', $booking->id);
            $target = $this->guestAccess->paymentUrl($booking);
        } elseif ($purpose === GuestBookingAccessService::CONFIRMATION) {
            $request->session()->put('guest_booking_id', $booking->id);
            $target = $this->guestAccess->confirmationUrl($booking);
        } else {
            $target = $this->guestAccess->declarationUrl($booking);
        }

        return redirect($target);
    }

    public function schedulePackedPickup(Request $request, Booking $booking)
    {
        $this->guestAccess->authorizeSessionOrToken($request, $booking, GuestBookingAccessService::CONFIRMATION);

        if ($booking->status === BookingStatus::Cancelled) {
            return redirect()->back()->with('error', 'Cancelled bookings cannot be scheduled for pickup.');
        }

        $validated = $request->validate([
            'preferred_date' => [
                'required',
                'date',
                new ValidPickupDate(
                    $booking,
                    $booking->booking_type?->value === 'drop_off' || $booking->booking_type === 'drop_off'
                        ? null
                        : ($booking->pickup_zone_id ? (int) $booking->pickup_zone_id : null)
                ),
            ],
            'pickup_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $booking->update([
            'preferred_date' => $validated['preferred_date'],
            'is_ready_for_pickup' => true,
            'notes' => ! empty($validated['pickup_notes'])
                ? trim($booking->notes."\nPickup Note: ".$validated['pickup_notes'])
                : $booking->notes,
        ]);

        return redirect()->back()->with('success', 'Pickup date scheduled successfully! Our dispatch team has been notified.');
    }
}
