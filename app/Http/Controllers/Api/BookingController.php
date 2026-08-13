<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ScopesApiAccess;
use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * API Controller for Booking operations.
 *
 * Provides RESTful endpoints for mobile app integration.
 * All endpoints require authentication via Laravel Sanctum.
 *
 * @see Booking
 */
class BookingController extends Controller
{
    use ScopesApiAccess;

    /**
     * List all bookings for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $bookings = $this->scopeBookingsForUser(
            Booking::query()->with(['sender', 'boxes', 'invoice']),
            $request->user()
        )
            ->when($request->has('status'), fn ($query) => $query->where('status', $request->status))
            ->when($request->has('payment_status'), fn ($query) => $query->where('payment_status', $request->payment_status))
            ->orderByDesc('created_at')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => BookingResource::collection($bookings),
            'meta' => [
                'current_page' => $bookings->currentPage(),
                'last_page' => $bookings->lastPage(),
                'per_page' => $bookings->perPage(),
                'total' => $bookings->total(),
            ],
        ]);
    }

    /**
     * Get a single booking by ID or reference number.
     */
    public function show(Request $request, string $identifier): JsonResponse
    {
        $booking = $this->scopeBookingsForUser(
            Booking::query()->with(['sender', 'boxes.recipient', 'boxes.boxType', 'invoice', 'runsheets']),
            $request->user()
        )
            ->where(fn ($query) => $query
                ->where('id', $identifier)
                ->orWhere('reference_number', $identifier))
            ->first();

        if (! $booking) {
            return response()->json([
                'success' => false,
                'message' => 'Booking not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => new BookingResource($booking),
        ]);
    }

    /**
     * Update a booking (status, notes, etc.).
     */
    public function update(Request $request, string $identifier): JsonResponse
    {
        $booking = $this->scopeBookingsForUser(Booking::query(), $request->user())
            ->where(fn ($query) => $query
                ->where('id', $identifier)
                ->orWhere('reference_number', $identifier))
            ->first();

        if (! $booking) {
            return response()->json([
                'success' => false,
                'message' => 'Booking not found.',
            ], 404);
        }

        $validated = $request->validate([
            'notes' => 'nullable|string|max:1000',
            'admin_notes' => 'nullable|string|max:1000',
        ]);

        if (! $this->canUpdateBookingViaApi($request->user(), $booking, array_keys($validated))) {
            abort(403, 'Unauthorized action.');
        }

        $booking->update($validated);

        return response()->json([
            'success' => true,
            'data' => new BookingResource($booking->fresh()),
        ]);
    }
}
