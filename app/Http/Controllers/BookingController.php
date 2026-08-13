<?php

namespace App\Http\Controllers;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Http\Requests\SaveDraftBookingRequest;
use App\Http\Requests\StoreBookingRequest;
use App\Models\Booking;
use App\Models\Sender;
use App\Models\User;
use App\Notifications\PartialCancellationRequested;
use App\Repositories\Contracts\BookingRepositoryInterface;
use App\Rules\SecureFile;
use App\Services\PaymentService;
use App\Services\ReferenceDataService;
use App\Services\SettingsService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class BookingController extends Controller
{
    public function __construct(
        private BookingRepositoryInterface $bookings,
        private ReferenceDataService $referenceData,
    ) {}

    public function create(Request $request)
    {
        $user = Auth::user();
        $recipients = [];

        if ($user && $this->hasUnpaidCancellationFees($user->sender)) {
            return redirect()->route('sender.bookings')->with('error', 'You have an unpaid cancellation fee. Please settle your outstanding balance before making a new booking.');
        }

        if ($user && $user->sender) {
            $recipients = $user->sender->recipients()
                ->with('area')
                ->select('id', 'sender_id', 'area_id', 'name', 'first_name', 'last_name', 'email', 'phone_number', 'address', 'city', 'province', 'zip_code', 'landmarks', 'latitude', 'longitude')
                ->latest()
                ->get();
        }

        $cloneSource = null;
        if ($request->has('clone_id')) {
            $cloneSource = Booking::with('boxes.recipient')->find($request->clone_id);
            // Ensure security - only clone if it belongs to this user/sender
            if ($cloneSource && (! $user || ! $user->sender || $cloneSource->sender_id !== $user->sender->id)) {
                $cloneSource = null;
            }
        }

        // Find any existing draft for this sender
        $draftBooking = null;
        if ($user && $user->sender) {
            $draft = $user->sender->bookings()
                ->where('status', BookingStatus::Draft)
                ->latest()
                ->first();

            if ($draft) {
                // Parse the draft payload from notes
                $draftData = null;
                if ($draft->notes && str_starts_with($draft->notes, '<!--DRAFT_DATA-->')) {
                    $jsonStr = substr($draft->notes, strlen('<!--DRAFT_DATA-->'));
                    $draftData = json_decode($jsonStr, true);
                }

                $draftBooking = [
                    'id' => $draft->id,
                    'reference_number' => $draft->reference_number,
                    'created_at' => $draft->created_at,
                    'updated_at' => $draft->updated_at,
                    'draft_data' => $draftData,
                ];
            }
        }

        return Inertia::render('sender/Book', [
            'areas' => $this->referenceData->activeAreas(),
            'provinces' => $this->referenceData->activeProvinces(),
            'boxTypes' => $this->referenceData->activeBoxTypes(),
            'boxPrices' => $this->referenceData->boxPrices(),
            'pickupZones' => $this->referenceData->activePickupZones(),
            'savedRecipients' => $recipients,
            'cloneSource' => $cloneSource,
            'editingBooking' => null,
            'draftBooking' => $draftBooking,
            'sender' => $user ? $user->sender?->load('pickupZone') : null,
        ]);
    }

    public function store(StoreBookingRequest $request)
    {
        $user = Auth::user();
        $validated = $request->validated();

        $sender = $user->sender;

        if ($this->hasUnpaidCancellationFees($sender)) {
            return redirect()->route('sender.bookings')->with('error', 'You have an unpaid cancellation fee. Please settle your outstanding balance before making a new booking.');
        }

        if (! $sender) {
            $sender = Sender::create([
                'user_id' => $user->id,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => $validated['email'],
                'mobile' => $validated['mobile'],
                'address' => $validated['address'],
                'suburb' => $validated['suburb'] ?? null,
                'state' => $validated['state'] ?? null,
                'postcode' => $validated['postcode'] ?? null,
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
            ]);
        }

        $draft = $sender->bookings()
            ->where('status', BookingStatus::Draft)
            ->latest()
            ->first();

        $booking = $draft
            ? $this->bookings->submitDraft($draft, $validated)
            : $this->bookings->createBooking($validated, $sender);

        return $this->redirectAfterBookingSubmission($booking, $validated['payment_method']);
    }

    /**
     * Initialize a booking and return payment data for the inline checkout.
     */
    public function initialize(StoreBookingRequest $request, PaymentService $paymentService, SettingsService $settingsService)
    {
        $validated = $request->validated();
        $user = Auth::user();
        $sender = $user->sender;
        $booking = null;

        if ($this->hasUnpaidCancellationFees($sender)) {
            return response()->json(['error' => 'You have an unpaid cancellation fee. Please settle your outstanding balance before making a new booking.'], 403);
        }

        if (! $sender) {
            $sender = Sender::create([
                'user_id' => $user->id,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => $validated['email'],
                'mobile' => $validated['mobile'],
                'address' => $validated['address'],
                'suburb' => $validated['suburb'] ?? null,
                'state' => $validated['state'] ?? null,
                'postcode' => $validated['postcode'] ?? null,
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
            ]);
        }

        // Reuse a booking created by an earlier initialization attempt, including
        // attempts made before a browser refresh.
        $initializationKey = $validated['initialization_key'] ?? null;
        if ($initializationKey) {
            $booking = $sender->bookings()
                ->where('initialization_key', $initializationKey)
                ->whereIn('status', [BookingStatus::Pending, BookingStatus::Draft])
                ->first();
        }

        // Create/Update the booking
        $bookingId = $request->input('booking_id');
        if ($booking) {
            $booking = $this->bookings->updateBooking($booking, $validated);
        } elseif ($bookingId) {
            $booking = $sender->bookings()->findOrFail($bookingId);
            $booking = $this->bookings->updateBooking($booking, $validated);
        } else {
            // Check if there is an active draft that we should promote
            $draftId = $request->input('draft_id');
            $draft = null;
            if ($draftId) {
                $draft = Booking::where('id', $draftId)
                    ->where('sender_id', $sender->id)
                    ->where('status', BookingStatus::Draft)
                    ->first();
                Log::info('Draft query result', [
                    'found' => $draft ? true : false,
                    'status' => $draft ? $draft->status : null,
                ]);
            }

            if (! $draft) {
                $draft = $sender->bookings()
                    ->where('status', BookingStatus::Draft)
                    ->latest()
                    ->first();
            }

            if ($draft) {
                $booking = $this->bookings->submitDraft($draft, $validated);
            } else {
                $booking = $this->bookings->createBooking($validated, $sender);
            }
        }

        $invoiceSettings = $settingsService->getInvoiceSettings();
        $response = [
            'booking' => $booking->load('boxes.recipient', 'boxes.boxType', 'sender'),
            'bankDetails' => [
                'bank_name' => $invoiceSettings['bankName'] ?? '',
                'bsb' => $invoiceSettings['bankBsb'] ?? '',
                'account_number' => $invoiceSettings['bankAccount'] ?? '',
                'company_name' => $invoiceSettings['companyName'] ?? 'Love Balikbayan Cargo',
            ],
        ];

        // If Stripe is selected, prepare the intent
        if ($validated['payment_method'] === 'stripe') {
            try {
                $intent = $paymentService->createPaymentIntent($booking);
                $response['clientSecret'] = $intent->client_secret;
                $response['stripeKey'] = config('services.stripe.key');
            } catch (\Exception $e) {
                return response()->json([
                    'error' => 'Could not initialize Stripe: '.$e->getMessage(),
                    'booking_id' => $booking->id,
                ], 500);
            }
        }

        return response()->json($response);
    }

    public function downloadInvoice(Booking $booking, SettingsService $settingsService)
    {
        $user = Auth::user();
        if (! $user->sender || $booking->sender_id !== $user->sender->id) {
            abort(403);
        }

        $invoice = $booking->invoice;
        if (! $invoice) {
            abort(404, 'Invoice not found.');
        }

        $invoice->load(['booking.sender', 'booking.boxes.boxType']);
        $invoiceSettings = $settingsService->getInvoiceSettings();
        $senderSnapshot = $invoice->resolveSenderSnapshot();
        $bookingSnapshot = $invoice->resolveBookingSnapshot();
        $lineItemsSnapshot = $invoice->resolveLineItemsSnapshot();
        $adminTeamSnapshot = $invoice->resolveAdminTeamSnapshot();

        $pdf = Pdf::loadView('admin.invoices.pdf', compact('invoice', 'invoiceSettings', 'senderSnapshot', 'bookingSnapshot', 'lineItemsSnapshot', 'adminTeamSnapshot'))
            ->setPaper('a4', 'portrait');

        return $pdf->stream($invoice->invoice_number.'.pdf');
    }

    public function pay(Booking $booking, SettingsService $settingsService)
    {
        $user = Auth::user();
        if (! $user->sender || $booking->sender_id !== $user->sender->id) {
            abort(403);
        }

        if ($booking->payment_status === PaymentStatus::Paid) {
            return redirect()->route('sender.bookings')->with('success', 'This booking has already been paid.');
        }

        // Check if booking has valid total amount
        $booking->load('boxes');
        $totalAmount = $booking->boxes->sum('price_charged');
        if ($totalAmount <= 0) {
            return redirect()->route('sender.bookings')->with('error',
                'Cannot proceed to payment: booking total amount is $0. '.
                'Please contact support to check price configuration for your boxes.'
            );
        }

        $invoiceSettings = $settingsService->getInvoiceSettings();

        return Inertia::render('payment/PaymentConsole', [
            'booking' => $booking->load('boxes.recipient', 'boxes.boxType'),
            'stripeKey' => config('services.stripe.key'),
            'role' => 'sender',
            'endpoint' => null,
            'backUrl' => '/bookings',
            'bankDetails' => [
                'bank_name' => $invoiceSettings['bankName'],
                'bsb' => $invoiceSettings['bankBsb'],
                'account_number' => $invoiceSettings['bankAccount'],
                'company_name' => $invoiceSettings['companyName'],
            ],
        ]);
    }

    public function uploadProofOfPayment(Request $request, Booking $booking)
    {
        $user = Auth::user();

        if (! $user->sender || $booking->sender_id !== $user->sender->id) {
            abort(403);
        }

        // Guard: Prevent proof upload on already-paid bookings
        if ($booking->payment_status === PaymentStatus::Paid) {
            return redirect()->back()->with('info', 'This booking has already been paid. No proof of payment is needed.');
        }

        // Run file validation first to catch invalid file types early
        $request->validate([
            'proof_of_payment' => [
                'required',
                'file',
                'mimes:jpeg,png,jpg,pdf',
                'max:5120', // 5MB max
                new SecureFile,
            ],
        ]);

        if ($request->hasFile('proof_of_payment')) {
            if ($booking->proof_of_payment) {
                Log::info('Proof of payment file overwritten/updated. booking_id='.$booking->id.' old_file_path='.$booking->proof_of_payment.' user_id='.$user->getAuthIdentifier().' ip='.request()->ip());
                Storage::disk('public')->delete($booking->proof_of_payment);
            }

            $path = $request->file('proof_of_payment')->store('proofs_of_payment', 'public');
            $booking->update(['proof_of_payment' => $path]);

            Log::info('Proof of payment file uploaded successfully. booking_id='.$booking->id.' new_file_path='.$path.' user_id='.$user->getAuthIdentifier().' ip='.request()->ip());

            return redirect()->back()->with('success', 'Proof of payment uploaded successfully. Our team will review it shortly.');
        }

        return redirect()->back()->with('error', 'Failed to upload proof of payment.');
    }

    public function edit(Booking $booking)
    {
        // Check Ownership & Status — allow editing Pending and Draft bookings
        $user = Auth::user();
        if (! $user->sender || $booking->sender_id !== $user->sender->id
            || ! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Draft])) {
            return redirect()->route('sender.bookings')->with('error', 'Booking cannot be edited at this stage or you do not have permission.');
        }

        $recipients = $user->sender->recipients()
            ->has('boxes')
            ->with('area')
            ->select('id', 'sender_id', 'area_id', 'name', 'first_name', 'last_name', 'email', 'phone_number', 'address', 'city', 'province', 'zip_code', 'landmarks', 'latitude', 'longitude')
            ->latest()
            ->get();

        return Inertia::render('sender/Book', [
            'areas' => $this->referenceData->activeAreas(),
            'provinces' => $this->referenceData->activeProvinces(),
            'boxTypes' => $this->referenceData->activeBoxTypes(),
            'boxPrices' => $this->referenceData->boxPrices(),
            'pickupZones' => $this->referenceData->activePickupZones(),
            'savedRecipients' => $recipients,
            'editingBooking' => $booking->load(['sender', 'boxes.recipient']),
            'draftBooking' => null,
            'sender' => $user->sender?->load('pickupZone'),
        ]);
    }

    public function update(StoreBookingRequest $request, Booking $booking)
    {
        $user = Auth::user();
        if (! $user->sender || $booking->sender_id !== $user->sender->id
            || ! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Draft])) {
            abort(403, 'Unauthorized amendment attempt.');
        }

        $validated = $request->validated();

        // If the booking is still a Draft, submitting the edit form should promote it to
        // Pending — identical intent to bookings.submit-draft. Leaving it as Draft causes
        // it to be hidden from the admin index (which filters out drafts) and makes the
        // booking appear to "disappear" after the user edits and submits it.
        if ($booking->status === BookingStatus::Draft) {
            $booking = $this->bookings->submitDraft($booking, $validated);

            return $this->redirectAfterBookingSubmission($booking, $validated['payment_method']);
        }

        $this->bookings->updateBooking($booking, $validated);

        return redirect()->route('sender.bookings')->with('success', 'Booking updated successfully.');
    }

    public function destroy(Booking $booking)
    {
        $user = Auth::user();
        if (! $user->sender || $booking->sender_id !== $user->sender->id) {
            abort(403, 'Unauthorized cancellation attempt.');
        }

        if (in_array($booking->status, [BookingStatus::Delivered, BookingStatus::Cancelled])) {
            abort(403, 'Unauthorized cancellation attempt.');
        }

        $hasPickedUpBoxes = $booking->boxes()->where('status', '!=', BoxStatus::Pending->value)->exists();

        if ($hasPickedUpBoxes) {
            if ($booking->attention_required) {
                return redirect()->route('sender.bookings')->with('error', 'Cancellation is already pending review.');
            }

            $booking->boxes()->where('status', BoxStatus::Pending->value)->update(['status' => BoxStatus::Cancelled->value]);
            $booking->update([
                'attention_required' => true,
                'admin_notes' => trim($booking->admin_notes . "\n\nPartial Cancellation Requested by Sender."),
            ]);

            $admins = User::whereIn('role', [Role::Admin, Role::SuperAdmin])->get();
            Notification::send($admins, new PartialCancellationRequested($booking));

            return redirect()->route('sender.bookings')->with('warning', 'Partial cancellation requested. Our support team has been notified regarding the boxes already picked up.');
        }

        if (! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Draft])) {
            abort(403, 'Unauthorized cancellation attempt.');
        }

        if ($booking->status === BookingStatus::Draft) {
            // Drafts can be hard-deleted since they have no real data
            $booking->boxes()->delete();
            $booking->forceDelete();

            return redirect()->route('sender.bookings')->with('success', 'Draft deleted successfully.');
        }

        $this->bookings->cancelBooking($booking);

        return redirect()->route('sender.bookings')->with('success', 'Booking cancelled successfully.');
    }

    /**
     * Save or update a draft booking (AJAX-friendly).
     */
    public function saveDraft(SaveDraftBookingRequest $request)
    {
        $user = Auth::user();
        $validated = $request->validated();

        $sender = $user->sender;

        if ($this->hasUnpaidCancellationFees($sender)) {
            return response()->json([
                'success' => false,
                'draft_id' => null,
                'message' => 'You have an unpaid cancellation fee. Please settle your outstanding balance before making a new booking.',
            ]);
        }

        if (! $sender) {
            $sender = Sender::create([
                'user_id' => $user->id,
                'first_name' => $validated['first_name'] ?? $user->name,
                'last_name' => $validated['last_name'] ?? '',
                'email' => $validated['email'] ?? $user->email,
                'mobile' => $validated['mobile'] ?? '',
                'address' => $validated['address'] ?? '',
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
            ]);
        }

        // Find existing draft to update. If a stale autosave arrives after the
        // draft was submitted, ignore it instead of creating a new draft row.
        $existingDraft = null;
        if (! empty($validated['draft_id'])) {
            $existingBooking = $sender->bookings()
                ->where('id', $validated['draft_id'])
                ->first();

            if (! $existingBooking || $existingBooking->status !== BookingStatus::Draft) {
                return response()->json([
                    'success' => true,
                    'draft_id' => null,
                    'message' => 'Draft has already been submitted or removed.',
                ]);
            }

            $existingDraft = $existingBooking;
        }

        if (! $existingDraft) {
            $existingDraft = $sender->bookings()
                ->where('status', BookingStatus::Draft)
                ->latest()
                ->first();
        }

        $draft = $this->bookings->saveDraft($validated, $sender, $existingDraft);

        return response()->json([
            'success' => true,
            'draft_id' => $draft->id,
            'message' => 'Draft saved successfully.',
        ]);
    }

    /**
     * Submit (promote) a draft booking to pending — requires full validation.
     */
    public function submitDraft(StoreBookingRequest $request, Booking $booking)
    {
        $user = Auth::user();

        if (! $user->sender || $booking->sender_id !== $user->sender->id || $booking->status !== BookingStatus::Draft) {
            abort(403, 'Unauthorized submission attempt.');
        }

        $validated = $request->validated();
        $booking = $this->bookings->submitDraft($booking, $validated);

        return $this->redirectAfterBookingSubmission($booking, $validated['payment_method']);
    }

    /**
     * Download blank declaration form PDF.
     */
    public function downloadBlankDeclaration(Request $request, SettingsService $settingsService)
    {
        $boxCount = max(1, min(30, (int) $request->input('boxes', 1)));
        $declarationSettings = $settingsService->getDeclarationSettings();
        $pdf = Pdf::loadView('declaration-blank', compact('declarationSettings', 'boxCount'))->setPaper('a4', 'portrait');

        return $pdf->download('declaration-form-blank.pdf');
    }

    private function redirectAfterBookingSubmission(Booking $booking, string $paymentMethod)
    {
        if ($paymentMethod !== 'stripe') {
            $message = 'Booking confirmed! ';
            if ($paymentMethod === 'cash_on_pickup') {
                $message .= 'Payment will be collected on pickup.';
            } else {
                $message .= 'Please check your email for payment instructions.';
            }

            return redirect()->route('sender.bookings')->with('success', $message);
        }

        return redirect()->route('bookings.pay', $booking)->with('success', 'Pickup details saved! Please follow the instructions to complete your booking.');
    }

    private function hasUnpaidCancellationFees(?Sender $sender): bool
    {
        if (! $sender) return false;
        
        return $sender->bookings()->whereHas('invoice', function($q) {
            $q->where('status', \App\Enums\InvoiceStatus::Unpaid)
              ->where('is_cancellation_fee', true);
        })->exists();
    }
}
