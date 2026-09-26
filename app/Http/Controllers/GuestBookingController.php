<?php

namespace App\Http\Controllers;

use App\Enums\BookingStatus;
use App\Http\Requests\StoreGuestBookingRequest;
use App\Models\Booking;
use App\Models\Sender;
use App\Repositories\Contracts\BookingRepositoryInterface;
use App\Rules\SecureFile;
use App\Services\PaymentService;
use App\Services\ReferenceDataService;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class GuestBookingController extends Controller
{
    public function __construct(
        protected BookingRepositoryInterface $bookingRepository,
        protected ReferenceDataService $referenceData
    ) {}

    /**
     * Show the public guest booking page.
     */
    public function create()
    {
        return Inertia::render('guest/Book', [
            'areas' => $this->referenceData->activeAreas(),
            'provinces' => $this->referenceData->activeProvinces(),
            'boxTypes' => $this->referenceData->activeBoxTypes(),
            'boxPrices' => $this->referenceData->boxPrices(),
            'pickupZones' => $this->referenceData->activePickupZones(),
            'suburbs' => $this->referenceData->activeSuburbs(),
        ]);
    }

    /**
     * Store a guest booking without user authentication.
     */
    public function store(StoreGuestBookingRequest $request)
    {
        if ($request->filled('website')) {
            return redirect()->route('guest.book');
        }

        $validated = $request->validated();

        // Find existing guest sender (where user_id is null) or create a new one
        $sender = Sender::where('email', $validated['email'])
            ->whereNull('user_id')
            ->first();

        if (! $sender) {
            $sender = Sender::create([
                'user_id' => null,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => $validated['email'],
                'mobile' => $validated['mobile'],
                'secondary_mobile' => $validated['secondary_mobile'] ?? null,
                'address' => $validated['address'],
                'suburb' => $validated['suburb'] ?? null,
                'state' => $validated['state'] ?? null,
                'postcode' => $validated['postcode'] ?? null,
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
                'pickup_zone_id' => $validated['pickup_zone_id'] ?? null,
            ]);
        } else {
            $sender->update([
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'mobile' => $validated['mobile'],
                'secondary_mobile' => $validated['secondary_mobile'] ?? $sender->secondary_mobile,
                'address' => $validated['address'],
                'suburb' => $validated['suburb'] ?? $sender->suburb,
                'state' => $validated['state'] ?? $sender->state,
                'postcode' => $validated['postcode'] ?? $sender->postcode,
                'latitude' => $validated['latitude'] ?? $sender->latitude,
                'longitude' => $validated['longitude'] ?? $sender->longitude,
                'pickup_zone_id' => $validated['pickup_zone_id'] ?? $sender->pickup_zone_id,
            ]);
        }

        $validated['user_id'] = null;
        $validated['is_guest'] = true;

        $booking = $this->bookingRepository->createBooking($validated, $sender);

        $guestToken = (string) Str::uuid();
        $booking->update([
            'guest_token' => $guestToken,
            'is_guest' => true,
        ]);

        return redirect()
            ->route('guest.booking.confirmed', ['token' => $guestToken])
            ->with('success', 'Your booking request has been submitted successfully!');
    }

    /**
     * Initialize a guest booking and return live payment console data (Step 4).
     */
    public function initialize(StoreGuestBookingRequest $request, PaymentService $paymentService, SettingsService $settingsService)
    {
        if ($request->filled('website')) {
            return response()->json(['error' => 'Invalid request.'], 422);
        }

        $validated = $request->validated();

        // Find existing guest sender (where user_id is null) or create a new one
        $sender = Sender::where('email', $validated['email'])
            ->whereNull('user_id')
            ->first();

        if (! $sender) {
            $sender = Sender::create([
                'user_id' => null,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => $validated['email'],
                'mobile' => $validated['mobile'],
                'secondary_mobile' => $validated['secondary_mobile'] ?? null,
                'address' => $validated['address'],
                'suburb' => $validated['suburb'] ?? null,
                'state' => $validated['state'] ?? null,
                'postcode' => $validated['postcode'] ?? null,
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
                'pickup_zone_id' => $validated['pickup_zone_id'] ?? null,
            ]);
        } else {
            $sender->update([
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'mobile' => $validated['mobile'],
                'secondary_mobile' => $validated['secondary_mobile'] ?? $sender->secondary_mobile,
                'address' => $validated['address'],
                'suburb' => $validated['suburb'] ?? $sender->suburb,
                'state' => $validated['state'] ?? $sender->state,
                'postcode' => $validated['postcode'] ?? $sender->postcode,
                'latitude' => $validated['latitude'] ?? $sender->latitude,
                'longitude' => $validated['longitude'] ?? $sender->longitude,
                'pickup_zone_id' => $validated['pickup_zone_id'] ?? $sender->pickup_zone_id,
            ]);
        }

        $validated['user_id'] = null;
        $validated['is_guest'] = true;

        $booking = null;
        $initializationKey = $validated['initialization_key'] ?? null;
        $bookingId = $request->input('booking_id');

        if ($initializationKey) {
            $booking = Booking::where('initialization_key', $initializationKey)
                ->where('is_guest', true)
                ->whereIn('status', [BookingStatus::Pending, BookingStatus::Draft])
                ->first();
        }

        if (! $booking && $bookingId) {
            $booking = Booking::where('id', $bookingId)
                ->where('is_guest', true)
                ->first();
        }

        if ($booking) {
            $booking = $this->bookingRepository->updateBooking($booking, $validated);
        } else {
            $booking = $this->bookingRepository->createBooking($validated, $sender);
        }

        $guestToken = $booking->guest_token ?: (string) Str::uuid();
        $booking->update([
            'guest_token' => $guestToken,
            'is_guest' => true,
            'initialization_key' => $initializationKey ?? $booking->initialization_key,
        ]);

        $invoiceSettings = $settingsService->getInvoiceSettings();
        $response = [
            'booking' => $booking->fresh()->load(['boxes.recipient', 'boxes.boxType', 'sender', 'invoice']),
            'guest_token' => $guestToken,
            'bankDetails' => [
                'bank_name' => $invoiceSettings['bankName'] ?? 'Commonwealth Bank',
                'bsb' => $invoiceSettings['bankBsb'] ?? '064-449',
                'account_number' => $invoiceSettings['bankAccount'] ?? '1097 5991',
                'company_name' => $invoiceSettings['companyName'] ?? config('app.name'),
            ],
        ];

        // If Stripe is selected, prepare the intent
        if (($validated['payment_method'] ?? '') === 'stripe') {
            try {
                $intent = $paymentService->createPaymentIntent($booking);
                $response['clientSecret'] = $intent->client_secret;
                $response['stripeKey'] = config('services.stripe.key');
            } catch (\Exception $e) {
                return response()->json([
                    'error' => 'Could not initialize Stripe: ' . $e->getMessage(),
                    'booking_id' => $booking->id,
                ], 500);
            }
        }

        return response()->json($response);
    }

    /**
     * Show booking confirmation for guest.
     */
    public function confirmed(Request $request, SettingsService $settingsService, PaymentService $paymentService)
    {
        $token = $request->query('token');

        if (! $token) {
            return redirect()->route('guest.book');
        }

        $booking = Booking::with(['sender', 'boxes.boxType', 'boxes.recipient', 'invoice'])
            ->where('guest_token', $token)
            ->first();

        if (! $booking) {
            abort(404, 'Booking not found or link has expired.');
        }

        $invoiceSettings = $settingsService->getInvoiceSettings();
        $totalAmount = $booking->invoice?->amount !== null 
            ? (float) $booking->invoice->amount 
            : ($booking->boxes->isNotEmpty() ? (float) $booking->boxes->sum('price_charged') : null);

        $clientSecret = null;
        $stripeKey = config('services.stripe.key');
        $isPaid = ($booking->payment_status instanceof \BackedEnum ? $booking->payment_status->value : $booking->payment_status) === 'paid';

        if (! $isPaid && $totalAmount > 0) {
            try {
                $intent = $paymentService->createPaymentIntent($booking);
                $clientSecret = $intent->client_secret;
            } catch (\Exception $e) {
                Log::warning('Could not create Stripe intent for guest confirmation page: ' . $e->getMessage());
            }
        }

        return Inertia::render('guest/BookingConfirmed', [
            'booking' => [
                'id' => $booking->id,
                'reference_number' => $booking->reference_number,
                'guest_token' => $booking->guest_token,
                'declaration_form_status' => $booking->declaration_form_status,
                'declaration_form_path' => $booking->declaration_form_path,
                'needs_declaration' => $booking->needsDeclaration(),
                'has_proof_of_payment' => ! empty($booking->proof_of_payment),
                'payment_reference' => $booking->payment_reference,
                'proof_of_payment' => $booking->proof_of_payment,
                'preferred_date' => $booking->preferred_date?->format('M d, Y'),
                'payment_method' => $booking->payment_method,
                'payment_status' => $booking->payment_status instanceof \BackedEnum ? $booking->payment_status->value : $booking->payment_status,
                'status' => $booking->status instanceof \BackedEnum ? $booking->status->value : $booking->status,
                'created_at' => $booking->created_at?->toISOString(),
                'boxes_count' => $booking->boxes->count(),
                'total_amount' => $totalAmount,
                'sender' => [
                    'first_name' => $booking->sender?->first_name,
                    'last_name' => $booking->sender?->last_name,
                    'name' => trim(($booking->sender?->first_name ?? '') . ' ' . ($booking->sender?->last_name ?? '')),
                    'email' => $booking->sender?->email,
                    'mobile' => $booking->sender?->mobile,
                    'address' => $booking->sender?->address,
                    'suburb' => $booking->sender?->suburb,
                    'state' => $booking->sender?->state,
                    'postcode' => $booking->sender?->postcode,
                ],
                'boxes' => $booking->boxes->map(fn ($box) => [
                    'box_type' => [
                        'name' => $box->boxType?->name ?? 'Custom Box',
                    ],
                    'recipient' => [
                        'first_name' => $box->recipient?->first_name ?? '',
                        'last_name' => $box->recipient?->last_name ?? '',
                        'city' => $box->recipient?->city ?? '',
                        'province' => $box->recipient?->province ?? '',
                    ],
                    'recipient_name' => $box->recipient?->name ?? trim(($box->recipient?->first_name ?? '') . ' ' . ($box->recipient?->last_name ?? '')),
                    'destination' => $box->destination ?? trim(($box->recipient?->city ?? '') . ', ' . ($box->recipient?->province ?? '')),
                    'tracking_number' => $box->tracking_number,
                    'price_charged' => (string) $box->price_charged,
                ]),
            ],
            'bankDetails' => [
                'bankName' => $invoiceSettings['bankName'] ?? 'Commonwealth Bank',
                'bank_name' => $invoiceSettings['bankName'] ?? 'Commonwealth Bank',
                'accountName' => $invoiceSettings['companyName'] ?? config('app.name'),
                'company_name' => $invoiceSettings['companyName'] ?? config('app.name'),
                'bankBsb' => $invoiceSettings['bankBsb'] ?? '064-449',
                'bsb' => $invoiceSettings['bankBsb'] ?? '064-449',
                'bankAccount' => $invoiceSettings['bankAccount'] ?? '1097 5991',
                'account_number' => $invoiceSettings['bankAccount'] ?? '1097 5991',
            ],
            'stripeKey' => $stripeKey,
            'clientSecret' => $clientSecret,
        ]);
    }

    /**
     * Upload proof of payment for a guest booking.
     */
    public function uploadProofOfPayment(Request $request)
    {
        $request->validate([
            'booking_id' => 'required|exists:bookings,id',
            'token' => 'required|string',
            'proof_of_payment' => [
                'required',
                'file',
                'mimes:jpeg,png,jpg,pdf',
                'max:5120', // 5MB max
                new SecureFile,
            ],
        ]);

        $booking = Booking::findOrFail($request->booking_id);

        if (empty($booking->guest_token) || ! hash_equals($booking->guest_token, $request->input('token'))) {
            abort(403, 'Unauthorized access or invalid guest token.');
        }

        if ($request->hasFile('proof_of_payment')) {
            if ($booking->proof_of_payment) {
                Storage::disk('public')->delete($booking->proof_of_payment);
            }

            $path = $request->file('proof_of_payment')->store('proofs_of_payment', 'public');
            $booking->update(['proof_of_payment' => $path]);

            return redirect()
                ->route('guest.booking.confirmed', ['token' => $booking->guest_token])
                ->with('success', 'Proof of payment uploaded successfully. Our team will verify it shortly.');
        }

        return redirect()->back()->with('error', 'Failed to upload proof of payment.');
    }
}

