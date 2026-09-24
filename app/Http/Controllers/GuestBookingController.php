<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGuestBookingRequest;
use App\Models\Booking;
use App\Models\Sender;
use App\Repositories\Contracts\BookingRepositoryInterface;
use App\Services\ReferenceDataService;
use Illuminate\Http\Request;
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
     * Show booking confirmation for guest.
     */
    public function confirmed(Request $request)
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

        return Inertia::render('guest/BookingConfirmed', [
            'booking' => [
                'id' => $booking->id,
                'reference_number' => $booking->reference_number,
                'preferred_date' => $booking->preferred_date?->format('M d, Y'),
                'payment_method' => $booking->payment_method,
                'payment_status' => $booking->payment_status instanceof \BackedEnum ? $booking->payment_status->value : $booking->payment_status,
                'status' => $booking->status instanceof \BackedEnum ? $booking->status->value : $booking->status,
                'created_at' => $booking->created_at?->toISOString(),
                'boxes_count' => $booking->boxes->count(),
                'total_amount' => $booking->invoice?->amount !== null ? (float) $booking->invoice->amount : null,
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
                    'box_type' => $box->boxType?->name ?? 'Custom Box',
                    'recipient_name' => $box->recipient?->name ?? trim(($box->recipient?->first_name ?? '') . ' ' . ($box->recipient?->last_name ?? '')),
                    'destination' => $box->destination ?? trim(($box->recipient?->city ?? '') . ', ' . ($box->recipient?->province ?? '')),
                    'tracking_number' => $box->tracking_number,
                    'price_charged' => (float) $box->price_charged,
                ]),
            ],
        ]);
    }
}
