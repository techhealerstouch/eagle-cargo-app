<?php

namespace App\Http\Controllers;

use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Http\Requests\Picker\RecordPaymentRequest;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Invoice;
use App\Models\Runsheet;
use App\Repositories\Contracts\BoxRepositoryInterface;
use App\Repositories\Contracts\TrackingRepositoryInterface;
use App\Services\CommissionService;
use App\Services\PaymentService;
use App\Services\RunsheetService;
use App\Services\SettingsService;
use App\Services\TrackingStepService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PickerController extends Controller
{
    public function __construct(
        private readonly BoxRepositoryInterface $boxRepo,
        private readonly RunsheetService $runsheetService,
        private readonly TrackingStepService $trackingStepService,
        private readonly PaymentService $paymentService,
    ) {}

    public function dashboard()
    {
        $user = Auth::user();

        $runsheets = Runsheet::with(['bookings.sender', 'bookings.invoice', 'bookings.boxes'])
            ->where('picker_id', (int) $user->id)
            ->where('type', RunsheetType::Pickup->value)
            ->whereIn('status', [RunsheetStatus::Assigned, RunsheetStatus::InProgress])
            ->orderBy('status', 'asc')
            ->orderBy('scheduled_date', 'asc')
            ->get();

        $statusCounts = Box::query()
            ->whereHas('booking.runsheets', function ($query) use ($user) {
                $query->where('runsheets.picker_id', (int) $user->id)
                    ->where('runsheets.type', RunsheetType::Pickup->value)
                    ->whereIn('runsheets.status', [RunsheetStatus::Assigned->value, RunsheetStatus::InProgress->value]);
            })
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $stats = [
            'totalBoxes' => array_sum($statusCounts),
            'collected' => $statusCounts[BoxStatus::Collected->value] ?? 0,
            'pending' => $statusCounts[BoxStatus::Pending->value] ?? 0,
            'delivered' => $statusCounts[BoxStatus::Delivered->value] ?? 0,
            'activeRunsheets' => $runsheets->count(),
            'cashDue' => $runsheets->flatMap->bookings
                ->where('payment_status', PaymentStatus::CashOnPickup)
                ->flatMap->boxes
                ->sum(fn (Box $box) => (float) $box->price_charged),
        ];

        return Inertia::render('picker/Dashboard', [
            'runsheets' => $runsheets,
            'stats' => $stats,
        ]);
    }

    public function runsheetIndex()
    {
        $user = Auth::user();

        $runsheets = Runsheet::with(['bookings.boxes', 'bookings.sender'])
            ->where('picker_id', (int) $user->id)
            ->where('type', RunsheetType::Pickup->value)
            ->orderBy('scheduled_date', 'desc')
            ->get();

        return Inertia::render('picker/Runsheets', [
            'runsheets' => $runsheets,
        ]);
    }

    public function runsheetShow(Runsheet $runsheet)
    {
        if (! $this->isAssignedToRunsheet($runsheet)) {
            abort(403);
        }

        $runsheet->load(['bookings.sender', 'bookings.boxes', 'bookings.invoice']);

        return Inertia::render('picker/RunsheetDetail', [
            'runsheet' => $runsheet,
        ]);
    }

    public function scanPage()
    {
        return Inertia::render('picker/ScanBox');
    }

    public function showBox(Box $box, SettingsService $settingsService)
    {
        $canView = $this->canAccessBox($box, true);
        if (! $canView) {
            abort(403);
        }

        $canUpdate = $this->canAccessBox($box, false);
        $box = $this->boxRepo->loadBoxDetails($box);

        $activeRunsheetId = null;
        if ($box->booking) {
            $runsheet = $this->activePickupRunsheetForBooking($box->booking);

            if ($runsheet) {
                $activeRunsheetId = $runsheet->id;
            }
        }

        // Fetch allowed tracking steps for picker
        $pickerSteps = $this->getTransitionablePickerSteps($box);

        $box->booking->load(['sender', 'boxes.boxType', 'invoice']);
        $invoiceSettings = $settingsService->getInvoiceSettings();

        // Standard snapshots for frontend consistency
        $invoice = $box->booking->invoice;
        $senderSnapshot = $invoice ? $invoice->resolveSenderSnapshot() : null;
        $bookingSnapshot = $invoice ? $invoice->resolveBookingSnapshot() : null;
        $lineItemsSnapshot = $invoice ? $invoice->resolveLineItemsSnapshot() : null;
        $adminTeamSnapshot = $invoice ? $invoice->resolveAdminTeamSnapshot() : null;

        $availableSerialNumbers = \App\Models\SerialNumber::whereHas('box', function ($q) {
            $q->where('status', BoxStatus::Pending->value)
              ->whereHas('booking.runsheets', function ($q2) {
                  $q2->where('type', RunsheetType::Pickup->value)
                     ->where('picker_id', Auth::id())
                     ->whereIn('status', [RunsheetStatus::Assigned->value, RunsheetStatus::InProgress->value]);
              });
        })->orderBy('serial_number')->pluck('serial_number')->toArray();

        if ($box->serial_number && !in_array($box->serial_number, $availableSerialNumbers)) {
            $availableSerialNumbers[] = $box->serial_number;
            sort($availableSerialNumbers);
        }

        return Inertia::render('picker/BoxDetail', [
            'box' => $box,
            'canUpdate' => $canUpdate,
            'activeRunsheetId' => $activeRunsheetId,
            'trackingSteps' => $pickerSteps,
            'invoiceSettings' => $invoiceSettings,
            'senderSnapshot' => $senderSnapshot,
            'bookingSnapshot' => $bookingSnapshot,
            'lineItemsSnapshot' => $lineItemsSnapshot,
            'adminTeamSnapshot' => $adminTeamSnapshot,
            'availableSerialNumbers' => $availableSerialNumbers,
        ]);
    }

    public function scanBox(Request $request)
    {
        $request->validate([
            'tracking_number' => 'required|string',
        ]);

        $box = $this->boxRepo->findByIdentifier($request->tracking_number);

        if (! $box) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Box not found with that serial or tracking number.',
                    'errors' => [
                        'tracking_number' => ['Box not found with that serial or tracking number.'],
                    ],
                ], 422);
            }

            return back()->withErrors(['tracking_number' => 'Box not found with that serial or tracking number.']);
        }

        if (! $this->canAccessBox($box, false)) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'This box does not belong to your active pickup runsheet.',
                    'errors' => [
                        'tracking_number' => ['This box does not belong to your active pickup runsheet.'],
                    ],
                ], 403);
            }

            return back()->withErrors(['tracking_number' => 'This box does not belong to your active pickup runsheet.']);
        }

        $box->loadMissing(['booking.sender', 'booking.boxes', 'booking.invoice']);

        $booking = $box->booking;
        if ($request->expectsJson()) {
            return $this->scanBoxJsonResponse($box);
        }

        return redirect()->route('picker.box.show', ['box' => $box->tracking_number]);
    }

    public function startRunsheet(Runsheet $runsheet)
    {
        if (! $this->isAssignedToRunsheet($runsheet)) {
            abort(403);
        }

        try {
            $this->runsheetService->transition($runsheet, RunsheetStatus::InProgress);
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', 'Pickup runsheet started.');
    }

    public function completeRunsheet(Runsheet $runsheet)
    {
        if (! $this->isAssignedToRunsheet($runsheet)) {
            abort(403);
        }

        try {
            $this->runsheetService->transition($runsheet, RunsheetStatus::Completed);
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', 'Pickup runsheet completed.');
    }

    public function paymentConsole(Runsheet $runsheet, Booking $booking)
    {
        if (! $this->isAssignedToRunsheet($runsheet)) {
            abort(403);
        }

        // Verify booking belongs to this runsheet
        if (! $runsheet->bookings()->where('bookings.id', $booking->id)->exists()) {
            abort(404, 'Booking not found on this runsheet.');
        }

        $booking = $booking->load('boxes.recipient', 'boxes.boxType');
        $invoice = $booking->invoice ?? Invoice::generateForBooking($booking);

        return Inertia::render('payment/PaymentConsole', [
            'booking' => $booking,
            'invoice' => $invoice->load('payments', 'booking.sender', 'booking.boxes.recipient', 'booking.boxes.boxType'),
            'role' => 'picker',
            'endpoint' => route('picker.runsheet.record-payment', ['runsheet' => $runsheet->id]),
            'backUrl' => route('picker.runsheet', ['runsheet' => $runsheet->id]),
        ]);
    }

    public function recordPayment(RecordPaymentRequest $request, Runsheet $runsheet)
    {
        $validated = $request->validated();
        $booking = $runsheet->bookings()->findOrFail($validated['booking_id']);

        try {
            $idempotencyKey = $validated['idempotency_key'] ?? ('picker_'.$runsheet->id.'_'.Str::uuid());

            $this->paymentService->recordPayment([
                'amount' => $validated['amount'],
                'payment_method' => $validated['payment_method'] ?? 'cash',
                'reference_number' => $validated['reference_number'] ?? null,
                'paid_at' => $validated['paid_at'] ?? now(),
                'collected_by' => Auth::id(),
                'idempotency_key' => $idempotencyKey,
                'invoice_id' => $validated['invoice_id'] ?? null,
            ], $booking);

            $booking->refresh();
            $isFullyPaid = $booking->payment_status === PaymentStatus::Paid;
            $message = $isFullyPaid
                ? 'Cash collected. Booking is now fully paid.'
                : 'Cash collected. Redirecting to runsheet.';

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $message,
                    'booking_id' => $booking->id,
                    'payment_status' => $booking->payment_status->value,
                ]);
            }

            return redirect()->route('picker.runsheet', ['runsheet' => $runsheet->id])
                ->with('success', $message);
        } catch (ValidationException $exception) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Recording payment failed.',
                    'errors' => $exception->errors(),
                ], 422);
            }

            return redirect()->back()->withErrors($exception->errors())->withInput();
        } catch (\Exception $e) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Recording payment failed: '.$e->getMessage(),
                ], 422);
            }

            return redirect()->back()->with('error', 'Recording payment failed: '.$e->getMessage());
        }
    }

    public function collectBoxes(Request $request, Runsheet $runsheet)
    {
        if (! $this->isAssignedToRunsheet($runsheet) || ! in_array($runsheet->status, [RunsheetStatus::Assigned, RunsheetStatus::InProgress], true)) {
            abort(403);
        }

        $validated = $request->validate([
            'boxes' => ['required', 'array', 'min:1'],
            'boxes.*.id' => ['required', 'integer', 'distinct', 'exists:boxes,id'],
            'pickup_proof' => ['required', 'file', 'mimes:jpeg,jpg,png', 'max:5120'],
        ]);

        $boxData = collect($validated['boxes'])->keyBy('id');
        $boxIds = $boxData->keys()->toArray();
        $pickupProof = $request->file('pickup_proof');

        $collectedCount = DB::transaction(function () use ($runsheet, $boxIds, $boxData, $pickupProof) {
            $lockedRunsheet = Runsheet::query()->whereKey($runsheet->id)->lockForUpdate()->firstOrFail();
            if (! $this->isAssignedToRunsheet($lockedRunsheet) || ! in_array($lockedRunsheet->status, [RunsheetStatus::Assigned, RunsheetStatus::InProgress], true)) {
                abort(403);
            }

            $boxes = Box::query()
                ->whereIn('id', $boxIds)
                ->lockForUpdate()
                ->get();

            if ($boxes->count() !== count($boxIds)) {
                throw ValidationException::withMessages(['boxes' => 'One or more selected boxes could not be found.']);
            }

            $bookings = Booking::query()
                ->whereIn('id', $boxes->pluck('booking_id')->filter()->unique())
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $runsheetBookingIds = $lockedRunsheet->bookings()
                ->whereIn('bookings.id', $boxes->pluck('booking_id')->filter()->unique())
                ->pluck('bookings.id')
                ->map(fn ($id) => (int) $id)
                ->all();

            if (count($runsheetBookingIds) !== $boxes->pluck('booking_id')->filter()->unique()->count()) {
                abort(403);
            }

            foreach ($boxes as $box) {
                $booking = $bookings->get($box->booking_id);
                if (! $booking) {
                    abort(403);
                }
                if ($box->status !== BoxStatus::Pending) {
                    throw ValidationException::withMessages(['boxes' => "Box {$box->tracking_number} is not pending pickup."]);
                }
                if (! in_array($booking->payment_status, [PaymentStatus::Paid, PaymentStatus::CashCollected])) {
                    throw ValidationException::withMessages(['boxes' => "Box {$box->tracking_number} cannot be collected until payment is complete."]);
                }
            }

            foreach ($boxes as $box) {
                $this->boxRepo->updateStatus(
                    $box,
                    BoxStatus::Collected->value,
                    'Batch collected from picker runsheet.',
                    Auth::id(),
                    pickupProof: $pickupProof,
                );
            }

            return $boxes->count();
        });

        return redirect()->back()->with('success', "{$collectedCount} boxes collected successfully.");
    }

    public function updateBoxStatus(Request $request, Box $box)
    {
        if (! $this->canAccessBox($box, false)) {
            abort(403);
        }

        // Block tracking updates for unpaid bookings (allow paid and cash_collected)
        $booking = $box->booking;
        if ($booking && ! in_array($booking->payment_status, [PaymentStatus::Paid, PaymentStatus::CashCollected])) {
            $message = $booking->payment_status === PaymentStatus::CashOnPickup
                ? 'Cash must be collected before updating tracking. Please record the cash payment first.'
                : 'Payment must be collected before updating tracking. Please record the payment first.';

            return redirect()->back()->with('error', $message);
        }

        // Fetch only picker steps that are valid from the box's current status.
        $pickerSteps = $this->getTransitionablePickerSteps($box);
        if (count($pickerSteps) === 0) {
            return redirect()->back()->with('error', 'No valid pickup tracking actions are available for this box status.');
        }

        $allowedStepKeys = array_column($pickerSteps, 'key');

        // Map BoxStatus values to tracking_step_key values for backward compatibility
        $statusToStepKeyMap = [
            BoxStatus::Collected->value => 'picked_up',
        ];

        $trackingStepKey = $request->input('tracking_step_key');
        if (! $trackingStepKey && $request->filled('status')) {
            $trackingStepKey = $statusToStepKeyMap[$request->input('status')] ?? null;
        }

        $stepConfig = $trackingStepKey ? collect($pickerSteps)->firstWhere('key', $trackingStepKey) : null;
        $systemStatus = $stepConfig['system_status'] ?? null;

        $validated = $request->validate([
            'tracking_step_key' => ['nullable', 'string', function ($attribute, $value, $fail) use ($allowedStepKeys) {
                if ($value && ! in_array($value, $allowedStepKeys, true)) {
                    $fail('Pickers cannot update tracking to this status.');
                }
            }],
            'status' => ['nullable', 'string', function ($attribute, $value, $fail) use ($statusToStepKeyMap, $allowedStepKeys) {
                // Accept legacy 'status' field and map to tracking_step_key
                if ($value) {
                    $mappedKey = $statusToStepKeyMap[$value] ?? null;
                    if ($mappedKey && in_array($mappedKey, $allowedStepKeys, true)) {
                        return; // Valid mapping
                    }
                    $fail('Pickers cannot update tracking to this status.');
                }
            }],
            'courier_notes' => 'nullable|string',
            'pickup_proof' => ['nullable', 'file', 'mimes:jpeg,jpg,png,pdf', 'max:5120'],
            'serial_number' => [
                $systemStatus === BoxStatus::Collected->value ? 'required' : 'nullable',
                'string',
                'max:30',
                function ($attribute, $value, $fail) use ($box) {
                    if (! $value) {
                        return;
                    }

                    $existingBox = Box::withTrashed()
                        ->where('serial_number', $value)
                        ->where('id', '!=', $box->id)
                        ->first();

                    if ($existingBox) {
                        $fail("The serial number {$value} is already assigned to another box ({$existingBox->tracking_number}).");
                    }
                }
            ],
        ]);

        if ($systemStatus === BoxStatus::Collected->value) {
            if (! $request->hasFile('pickup_proof') && ! $box->pickup_proof_path) {
                throw ValidationException::withMessages([
                    'pickup_proof' => 'A pickup proof photo is required to mark this box as Collected.',
                ]);
            }
        }

        if (! $trackingStepKey) {
            return redirect()->back()->with('error', 'A valid tracking step is required.');
        }

        $trackingLabel = $stepConfig['label'] ?? 'Status updated';

        $currentStatus = $box->status instanceof BoxStatus
            ? $box->status
            : BoxStatus::tryFrom((string) $box->status);
        $targetStatus = BoxStatus::tryFrom($systemStatus);

        if (! $targetStatus) {
            return redirect()->back()->with('error', 'Selected tracking step has an invalid system status mapping.');
        }



        // Logic Protection: Prevent "Collected" if negative observations are present
        if ($targetStatus === BoxStatus::Collected) {
            $negativeKeywords = ['not ready', 'not home', 'incorrect address', 'cancelled'];
            $notesLower = strtolower($validated['courier_notes'] ?? '');
            foreach ($negativeKeywords as $keyword) {
                if (str_contains($notesLower, $keyword)) {
                    return redirect()->back()->with('error', "Cannot mark as Collected while noting '{$keyword}'. Please update status to Pending or Cancelled instead.");
                }
            }
        }

        // Duplication Protection: Skip if status is the same and notes haven't changed meaningfully
        // This prevents double-logging (e.g., auto-collected then manual note added with same status)
        if ($currentStatus === $targetStatus) {
            $lastUpdate = $box->updates()->orderBy('created_at', 'desc')->first();
            $newDescription = $validated['courier_notes']
                ? "{$trackingLabel} - {$validated['courier_notes']}"
                : "{$trackingLabel}";

            if ($lastUpdate && $lastUpdate->description === $newDescription) {
                return redirect()->back()->with('success', 'No changes detected.');
            }
        }

        if ($currentStatus && $currentStatus !== $targetStatus && ! $currentStatus->canTransitionTo($targetStatus)) {
            return redirect()->back()->with('error', "Cannot move box from {$currentStatus->value} to {$targetStatus->value}.");
        }

        $courierNotes = $validated['courier_notes'] ?? null;
        $notes = $courierNotes
            ? "{$trackingLabel} - {$courierNotes}"
            : "{$trackingLabel}";

        try {
            $this->boxRepo->updateStatus(
                box: $box,
                status: $systemStatus,
                notes: $notes,
                courierId: Auth::id(),
                trackingStepKey: $trackingStepKey,
                pickupProof: $request->file('pickup_proof'),
                serialNumber: $systemStatus === BoxStatus::Collected->value ? $validated['serial_number'] : null,
            );
        } catch (\InvalidArgumentException|\RuntimeException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        // Commission Logic
        if ($systemStatus === BoxStatus::Collected->value) {
            app(CommissionService::class)->createCommission($box, Auth::user());
        } elseif (in_array($systemStatus, [BoxStatus::Cancelled->value, BoxStatus::Held->value, BoxStatus::Damaged->value])) {
            app(CommissionService::class)->cancelCommission($box, Auth::user());
        }

        // Auto-sync runsheet status based on updated box states

        $successMessage = 'Box status updated successfully.';
        if ($systemStatus === BoxStatus::Collected->value) {
            $successMessage = "Box {$box->tracking_number} collected from sender successfully.";
        }

        return redirect()->back()->with('success', $successMessage);
    }

    public function uploadDeclaration(Request $request, Box $box)
    {
        if (! $this->canAccessBox($box, false)) {
            abort(403);
        }

        $request->validate([
            'declaration_form' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ]);

        $booking = $box->booking;
        if (! $booking) {
            return back()->with('error', 'Booking not found.');
        }

        app(TrackingRepositoryInterface::class)->uploadDeclaration(
            $booking->id,
            $request->file('declaration_form'),
            'physical_copy_received'
        );

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Physical declaration uploaded successfully.',
                'booking_id' => $booking->id,
                'declaration_form_status' => 'physical_copy_received',
            ]);
        }

        return back()->with('success', 'Physical declaration uploaded successfully.');
    }

    private function scanBoxJsonResponse(Box $box)
    {
        $booking = $box->booking;

        if (! $booking) {
            return response()->json([
                'action' => 'needs_review',
                'message' => 'Booking not found for this box. Open details to review.',
                'box' => $this->scanBoxPayload($box),
            ]);
        }

        if (! in_array($booking->payment_status, [PaymentStatus::Paid, PaymentStatus::CashCollected])) {
            $paymentLabel = $booking->payment_status === PaymentStatus::CashOnPickup
                ? 'Cash payment is due before pickup.'
                : 'Payment must be recorded before pickup.';

            return response()->json([
                'action' => 'payment_required',
                'message' => $paymentLabel,
                'box' => $this->scanBoxPayload($box),
            ]);
        }

        if ($box->status === BoxStatus::Pending) {
            return response()->json([
                'action' => 'needs_review',
                'message' => 'Box scanned. Please upload pickup proof to complete collection.',
                'box' => $this->scanBoxPayload($box),
            ]);
        }

        $status = $box->status instanceof BoxStatus ? $box->status->label() : Str::headline((string) $box->status);

        return response()->json([
            'action' => 'already_scanned',
            'message' => "Box {$box->tracking_number} is already {$status}.",
            'box' => $this->scanBoxPayload($box),
        ]);
    }

    private function scanBoxPayload(Box $box): array
    {
        $box->loadMissing(['booking.sender', 'booking.boxes', 'booking.invoice']);
        $booking = $box->booking;
        $activeRunsheet = $booking ? $this->activePickupRunsheetForBooking($booking) : null;
        $invoice = $booking?->invoice;
        $totalAmount = $invoice
            ? (float) $invoice->amount
            : (float) ($booking?->boxes?->sum('price_charged') ?? 0);

        return [
            'id' => $box->id,
            'trackingNumber' => $box->tracking_number,
            'serialNumber' => $box->serial_number,
            'status' => $box->status instanceof BoxStatus ? $box->status->value : (string) $box->status,
            'detailUrl' => route('picker.box.show', ['box' => $box->tracking_number]),
            'booking' => $booking ? [
                'id' => $booking->id,
                'referenceNumber' => $booking->reference_number,
                'paymentStatus' => $booking->payment_status instanceof PaymentStatus ? $booking->payment_status->value : (string) $booking->payment_status,
                'declarationFormStatus' => (string) $booking->declaration_form_status,
                'senderName' => trim(($booking->sender?->first_name ?? '').' '.($booking->sender?->last_name ?? '')) ?: 'Sender',
                'boxesCount' => $booking->boxes?->count() ?? 0,
                'totalAmount' => round($totalAmount, 2),
                'paymentConsoleUrl' => $activeRunsheet ? route('picker.runsheet.payment', [
                    'runsheet' => $activeRunsheet->id,
                    'booking' => $booking->id,
                ]) : null,
                'paymentPostUrl' => $activeRunsheet ? route('picker.runsheet.record-payment', [
                    'runsheet' => $activeRunsheet->id,
                ]) : null,
                'uploadDeclarationUrl' => route('picker.box.upload-declaration', ['box' => $box->id]),
            ] : null,
        ];
    }

    private function activePickupRunsheetForBooking(Booking $booking): ?Runsheet
    {
        return $booking->runsheets()
            ->where('picker_id', Auth::id())
            ->where('type', RunsheetType::Pickup->value)
            ->whereIn('status', [RunsheetStatus::Assigned->value, RunsheetStatus::InProgress->value])
            ->first();
    }

    private function canAccessBox(Box $box, bool $allowCompletedRunsheets): bool
    {
        $userId = Auth::id();
        if (! $userId) {
            return false;
        }

        return $box->booking()
            ->whereHas('runsheets', function ($query) use ($userId, $allowCompletedRunsheets) {
                $query->where('runsheets.picker_id', $userId)
                    ->where('runsheets.type', RunsheetType::Pickup->value);

                if (! $allowCompletedRunsheets) {
                    $query->whereIn('runsheets.status', RunsheetStatus::activeValues());
                }
            })
            ->exists();
    }

    public function isAssignedToRunsheet(Runsheet $runsheet): bool
    {
        $userId = Auth::id();
        if (! $userId) {
            return false;
        }

        $runsheetType = $runsheet->type instanceof RunsheetType
            ? $runsheet->type
            : RunsheetType::from((string) $runsheet->type);

        if ($runsheetType !== RunsheetType::Pickup) {
            return false;
        }

        return (int) ($runsheet->picker_id ?? 0) === (int) $userId;
    }

    /**
     * Return picker-configured tracking steps that are valid transitions from the box's current status.
     */
    private function getTransitionablePickerSteps(Box $box): array
    {
        $allSteps = $this->trackingStepService->getSteps();
        $pickerSteps = array_values(array_filter($allSteps, function ($step) {
            return in_array('picker', $step['allowed_roles'] ?? [], true);
        }));

        $currentStatus = $box->status instanceof BoxStatus
            ? $box->status
            : BoxStatus::tryFrom((string) $box->status);

        if (! $currentStatus) {
            return $pickerSteps;
        }

        return array_values(array_filter($pickerSteps, function ($step) use ($currentStatus) {
            $targetStatus = BoxStatus::tryFrom((string) ($step['system_status'] ?? ''));

            if (! $targetStatus) {
                return false;
            }

            return $currentStatus->canTransitionTo($targetStatus);
        }));
    }
}
