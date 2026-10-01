<?php

namespace App\Http\Controllers;

use App\Enums\BookingStatus;
use App\Http\Requests\StoreGuestBookingRequest;
use App\Models\Booking;
use App\Models\Promotion;
use App\Models\Sender;
use App\Notifications\BankTransferDetails;
use App\Repositories\Contracts\BookingRepositoryInterface;
use App\Services\PaymentService;
use App\Services\ReferenceDataService;
use App\Services\GuestBookingAccessService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
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

        return Inertia::render('guest/Book', [
            'areas' => $this->referenceData->activeAreas(),
            'provinces' => $this->referenceData->activeProvinces(),
            'boxTypes' => $this->referenceData->activeBoxTypes(),
            'boxPrices' => $this->referenceData->boxPrices(),
            'pickupZones' => $this->referenceData->activePickupZones(),
            'suburbs' => $this->referenceData->activeSuburbs(),
            'activePromotions' => $activePromotions,
            'savedRecipients' => [],
            'sender' => null,
            'isGuest' => true,
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
            'declarationUrl' => $this->guestAccess->verificationUrl($booking, GuestBookingAccessService::DECLARATION),
            'paymentUrl' => $this->guestAccess->verificationUrl($booking, GuestBookingAccessService::PAYMENT),
        ]);
    }

    public function verifyAccess(Request $request, Booking $booking): Response
    {
        $purpose = (string) $request->query('purpose');
        $this->guestAccess->authorize($request, $booking, $purpose);

        $this->guestAccess->sendChallenge($booking, $purpose);

        return Inertia::render('guest/VerifyAccess', [
            'bookingId' => $booking->id,
            'bookingReference' => $booking->reference_number,
            'purpose' => $purpose,
            'accessQuery' => '?'.$request->getQueryString(),
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

        $target = $purpose === GuestBookingAccessService::PAYMENT
            ? $this->guestAccess->paymentUrl($booking)
            : $this->guestAccess->declarationUrl($booking);

        return redirect($target);
    }
}
