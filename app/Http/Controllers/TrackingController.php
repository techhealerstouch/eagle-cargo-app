<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Enums\RunsheetType;
use App\Models\Booking;
use App\Repositories\Contracts\TrackingRepositoryInterface;
use App\Services\SettingsService;
use App\Services\TrackingAnalyticsService;
use App\Services\TrackingStepService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
     * Assert that the authenticated user owns the booking or is an admin.
     */
    private function assertBookingOwnership(Booking $booking): void
    {
        $user = Auth::user();
        $isAdmin = $user && in_array($user->role, [Role::Admin, Role::SuperAdmin], true);
        $isOwner = $user && $user->sender && $booking->sender_id === $user->sender->id;

        if (! $isAdmin && ! $isOwner) {
            abort(403, 'You do not have permission to modify this booking.');
        }
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
        ]);

        $booking = Booking::findOrFail($request->booking_id);
        $this->assertBookingOwnership($booking);

        if ($request->hasFile('declaration_form')) {
            $this->trackingRepo->uploadDeclaration(
                $booking->id,
                $request->file('declaration_form')
            );

            return back()->with('success', 'Declaration form uploaded successfully. Our team will verify it shortly.');
        }

        return back()->withErrors(['declaration_form' => 'Failed to upload file.']);
    }

    public function showDeclarationForm(Booking $booking)
    {
        $this->assertBookingOwnership($booking);

        $booking->load(['sender', 'boxes.recipient', 'boxes.boxType']);

        return inertia('marketing/declaration', [
            'booking' => $booking,
            'declarationSettings' => $this->settingsService->getDeclarationSettings(),
        ]);
    }

    public function saveDeclarationData(Request $request)
    {
        $request->validate([
            'booking_id' => 'required|exists:bookings,id',
            'declaration_data' => 'required|array',
        ]);

        $booking = Booking::findOrFail($request->booking_id);
        $this->assertBookingOwnership($booking);

        $this->trackingRepo->saveDeclarationData(
            $booking->id,
            $request->declaration_data
        );

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
    public function viewDeclaration(Booking $booking)
    {
        $user = Auth::user();

        $isAdmin = $user && in_array($user->role, [Role::Admin, Role::SuperAdmin], true);
        $isOwnerSender = $user
            && $user->role === Role::Sender
            && $booking->sender_id === $user->sender?->id;
        $isOperational = $this->isAssignedOperationalUser($booking);

        if (! $isAdmin && ! $isOwnerSender && ! $isOperational) {
            abort(403);
        }

        return Inertia::render('admin/bookings/print-declaration', [
            'booking' => $booking->load(['sender', 'boxes.recipient', 'boxes.boxType', 'boxes.batch']),
            'declarationSettings' => $this->settingsService->getDeclarationSettings(),
        ]);
    }
}
