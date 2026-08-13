<?php

namespace App\Http\Controllers\Admin;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Enums\SerialNumberStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreAdminBookingRequest;
use App\Http\Requests\Admin\UpdateAdminBookingRequest;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\SerialNumber;
use App\Models\User;
use App\Repositories\Contracts\BookingRepositoryInterface;
use App\Services\RunsheetService;
use App\Services\SettingsService;
use App\Services\ReferenceDataService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use App\Notifications\AccountCreatedByAdmin;

class BookingController extends Controller
{
    protected $bookings;

    private SettingsService $settingsService;

    public function __construct(
        BookingRepositoryInterface $bookings,
        SettingsService $settingsService,
    ) {
        $this->bookings = $bookings;
        $this->settingsService = $settingsService;
    }

    public function index(Request $request)
    {
        $query = Booking::with(['sender', 'runsheets.courier', 'runsheets.picker', 'boxes.recipient', 'boxes.updates.milestone'])
            ->where('status', '!=', BookingStatus::Draft->value);

        if ($request->boolean('trashed') && auth()->user()?->role === Role::SuperAdmin) {
            $query = Booking::onlyTrashed()->with(['sender', 'runsheets.courier', 'runsheets.picker', 'boxes.recipient', 'boxes.updates.milestone']);
        }

        $query = $this->applyFilters($query, $request);

        $bookings = $query->paginate(10)->withQueryString();

        // Check for duplicates in the current set of bookings
        $bookings->getCollection()->transform(function ($booking) {
            $booking->makeVisible('admin_notes');
            $booking->is_potential_duplicate = $booking->isPotentialDuplicate();

            $activeStatusValues = RunsheetStatus::activeValues();

            $paymentStatus = $booking->payment_status instanceof PaymentStatus
                ? $booking->payment_status
                : PaymentStatus::from((string) $booking->payment_status);

            $bookingStatus = $booking->status instanceof BookingStatus
                ? $booking->status
                : BookingStatus::from((string) $booking->status);

            $hasCompletedPickupRunsheet = $booking->runsheets->contains(function ($runsheet) {
                $type = $runsheet->type instanceof RunsheetType
                    ? $runsheet->type->value
                    : (string) $runsheet->type;

                $status = $runsheet->status instanceof RunsheetStatus
                    ? $runsheet->status->value
                    : (string) $runsheet->status;

                return $type === RunsheetType::Pickup->value
                    && $status === RunsheetStatus::Completed->value;
            });

            $hasActivePickupRunsheet = $booking->runsheets->contains(function ($runsheet) use ($activeStatusValues) {
                $type = $runsheet->type instanceof RunsheetType
                    ? $runsheet->type->value
                    : (string) $runsheet->type;

                $status = $runsheet->status instanceof RunsheetStatus
                    ? $runsheet->status->value
                    : (string) $runsheet->status;

                return $type === RunsheetType::Pickup->value
                    && in_array($status, $activeStatusValues, true);
            });

            $hasActiveDeliveryRunsheet = $booking->runsheets->contains(function ($runsheet) use ($activeStatusValues) {
                $type = $runsheet->type instanceof RunsheetType
                    ? $runsheet->type->value
                    : (string) $runsheet->type;

                $status = $runsheet->status instanceof RunsheetStatus
                    ? $runsheet->status->value
                    : (string) $runsheet->status;

                return $type === RunsheetType::Delivery->value
                    && in_array($status, $activeStatusValues, true);
            });

            $warehouseHandoffCompleted = $booking->hasWarehouseHandoffCompleted();
            $canAssignPicker = in_array($paymentStatus, [PaymentStatus::Paid, PaymentStatus::Pending, PaymentStatus::CashOnPickup], true)
                && $bookingStatus === BookingStatus::Confirmed
                && ! $hasActivePickupRunsheet;

            $canAssignCourier = $paymentStatus === PaymentStatus::Paid
                && $hasCompletedPickupRunsheet
                && $warehouseHandoffCompleted
                && ! $hasActiveDeliveryRunsheet;

            $booking->has_completed_pickup_runsheet = $hasCompletedPickupRunsheet;
            $booking->has_active_pickup_runsheet = $hasActivePickupRunsheet;
            $booking->has_active_delivery_runsheet = $hasActiveDeliveryRunsheet;
            $booking->warehouse_handoff_completed = $warehouseHandoffCompleted;
            $booking->can_assign_picker = $canAssignPicker;
            $booking->can_assign_courier = $canAssignCourier;
            $booking->box_count = $booking->boxes->count();

            if ($canAssignPicker) {
                $booking->picker_assignment_block_reason = null;
            } elseif (! in_array($paymentStatus, [PaymentStatus::Paid, PaymentStatus::Pending, PaymentStatus::CashOnPickup], true)) {
                $booking->picker_assignment_block_reason = 'Payment status must be Paid, Pending, or Payment on Pickup.';
            } elseif ($bookingStatus !== BookingStatus::Confirmed) {
                $booking->picker_assignment_block_reason = 'Booking must be Confirmed.';
            } elseif ($hasActivePickupRunsheet) {
                $booking->picker_assignment_block_reason = 'Booking already has an active pickup runsheet.';
            }

            if ($canAssignCourier) {
                $booking->courier_assignment_block_reason = null;
            } elseif ($paymentStatus !== PaymentStatus::Paid) {
                $booking->courier_assignment_block_reason = 'Payment status must be Paid.';
            } elseif (! $hasCompletedPickupRunsheet) {
                $booking->courier_assignment_block_reason = 'Pickup runsheet must be Completed.';
            } elseif (! $warehouseHandoffCompleted) {
                $booking->courier_assignment_block_reason = 'Warehouse handoff must be completed.';
            } elseif ($hasActiveDeliveryRunsheet) {
                $booking->courier_assignment_block_reason = 'Booking already has an active delivery runsheet.';
            }

            // Backward-compatible field retained for existing UI consumers.
            $booking->assignment_block_reason = $booking->courier_assignment_block_reason;

            return $booking;
        });

        $pickers = User::where('role', Role::Picker)
            ->with('picker:id,user_id,mobile')
            ->withCount(['pickerRunsheets as active_runsheet_count' => function ($q) {
                $q->whereIn('status', RunsheetStatus::activeValues());
            }])
            ->orderBy('name')
            ->get();
        $couriers = User::where('role', Role::Courier)
            ->with(['courier:id,user_id,mobile,area_id', 'courier.area'])
            ->withCount(['courierRunsheets as active_runsheet_count' => function ($q) {
                $q->whereIn('status', RunsheetStatus::activeValues());
            }])
            ->orderBy('name')
            ->get();

        $activeRunsheets = Runsheet::with(['courier', 'picker'])
            ->whereIn('status', [
                RunsheetStatus::Draft,
                RunsheetStatus::Assigned,
                RunsheetStatus::InProgress,
            ])->latest()->get();

        return Inertia::render('admin/bookings/index', [
            'bookings' => $bookings,
            'pickers' => $pickers,
            'couriers' => $couriers,
            'activeRunsheets' => $activeRunsheets,
            'filters' => $request->only(['search', 'status', 'sort', 'direction', 'trashed']),
        ]);
    }

    public function create(ReferenceDataService $referenceDataService)
    {
        $senders = Sender::orderBy('first_name')->get()->unique('email')->values();
        $areas = $referenceDataService->activeAreas();
        $provinces = $referenceDataService->activeProvinces();
        $boxTypes = $referenceDataService->activeBoxTypes();
        $boxPrices = $referenceDataService->boxPrices();

        $pickers = User::where('role', Role::Picker)
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('admin/bookings/create', [
            'senders' => $senders,
            'areas' => $areas,
            'provinces' => $provinces,
            'boxTypes' => $boxTypes,
            'boxPrices' => $boxPrices,
            'pickers' => $pickers,
            'pickupZones' => $referenceDataService->activePickupZones(),
        ]);
    }

    public function store(StoreAdminBookingRequest $request)
    {
        $validated = $request->validated();
        
        DB::beginTransaction();
        try {
            $senderId = $validated['sender_id'] ?? null;

            if (!empty($validated['is_new_sender'])) {
                $password = Str::password(12);
                
                // Create the User without firing events to prevent
                // UserObserver from auto-creating a duplicate Sender
                // with placeholder data — we create the real Sender below.
                $user = User::withoutEvents(function () use ($validated, $password) {
                    return User::create([
                        'name' => $validated['sender_first_name'] . ' ' . $validated['sender_last_name'],
                        'email' => $validated['sender_email'],
                        'password' => Hash::make($password),
                        'role' => Role::Sender,
                    ]);
                });

                $user->notify(new AccountCreatedByAdmin($user, $password));

                $sender = Sender::updateOrCreate(
                    ['email' => $validated['sender_email']],
                    [
                        'user_id' => $user->id,
                        'first_name' => $validated['sender_first_name'],
                        'last_name' => $validated['sender_last_name'],
                        'mobile' => $validated['sender_mobile'],
                        'address' => $validated['sender_address'],
                        'suburb' => $validated['sender_suburb'] ?? null,
                        'state' => $validated['sender_state'] ?? null,
                        'postcode' => $validated['sender_postcode'] ?? null,
                        'pickup_zone_id' => $validated['pickup_zone_id'] ?? null,
                    ]
                );

                $senderId = $sender->id;
            }

            // File uploads
            $proofOfPaymentPath = null;
            if ($request->hasFile('proof_of_payment')) {
                $proofOfPaymentPath = $request->file('proof_of_payment')->store('proofs_of_payment', 'public');
            }

            $declarationFormPath = null;
            if ($request->hasFile('declaration_form')) {
                $declarationFormPath = $request->file('declaration_form')->store('declarations', 'public');
            }

            $bookingData = Arr::only($validated, [
                'status', 'preferred_date', 'pickup_zone_id',
                'payment_status', 'payment_method', 'payment_reference', 'declaration_form_status', 'notes', 'admin_notes',
                'empty_box_count', 'empty_box_fee',
            ]);
            $bookingData['sender_id'] = $senderId;

            if (!empty($validated['request_empty_box']) || !empty($validated['empty_box_count'])) {
                $bookingData['empty_box_count'] = (int) ($validated['empty_box_count'] ?? 1);
                $bookingData['empty_box_fee'] = (float) ($validated['empty_box_fee'] ?? 10.00);
            } else {
                $bookingData['empty_box_count'] = 0;
                $bookingData['empty_box_fee'] = 10.00;
            }
            
            if ($proofOfPaymentPath) {
                $bookingData['proof_of_payment'] = $proofOfPaymentPath;
            }
            if ($declarationFormPath) {
                $bookingData['declaration_form_path'] = $declarationFormPath;
            }

            $bookingData['is_manual'] = true;

            $booking = Booking::create($bookingData);

            // Resolve single recipient for the entire booking
            $firstBox = $validated['boxes'][0] ?? [];
            $recipientId = $firstBox['recipient_id'] ?? null;

            if (! $recipientId) {
                $recipient = Recipient::create([
                    'sender_id' => $senderId,
                    'name' => trim(($firstBox['recipient_first_name'] ?? '') . ' ' . ($firstBox['recipient_last_name'] ?? '')),
                    'first_name' => $firstBox['recipient_first_name'] ?? null,
                    'last_name' => $firstBox['recipient_last_name'] ?? null,
                    'email' => $firstBox['recipient_email'] ?? null,
                    'phone_number' => $firstBox['recipient_phone'] ?? null,
                    'address' => $firstBox['recipient_address'] ?? null,
                    'city' => $firstBox['recipient_city'] ?? null,
                    'province' => $firstBox['recipient_province'] ?? null,
                    'zip_code' => $firstBox['recipient_zip_code'] ?? null,
                    'landmarks' => $firstBox['recipient_landmarks'] ?? null,
                    'area_id' => $firstBox['area_id'] ?? null,
                ]);
                $recipientId = $recipient->id;
            }

            // Create boxes linked to single recipient
            foreach ($validated['boxes'] as $index => $boxData) {

                $boxStatus = match($booking->status) {
                    BookingStatus::Collected => BoxStatus::Collected->value,
                    BookingStatus::Cancelled => BoxStatus::Cancelled->value,
                    default => BoxStatus::Pending->value,
                };

                $boxRecord = [
                    'booking_id' => $booking->id,
                    'recipient_id' => $recipientId,
                    'status' => $boxStatus,
                    'area_id' => $boxData['area_id'],
                    'is_custom_size' => !empty($boxData['is_custom_size']),
                    'is_door_to_door' => !empty($boxData['is_door_to_door']),
                ];

                if (!empty($boxData['is_custom_size'])) {
                    $boxRecord['custom_length'] = $boxData['custom_length'] ?? null;
                    $boxRecord['custom_width'] = $boxData['custom_width'] ?? null;
                    $boxRecord['custom_height'] = $boxData['custom_height'] ?? null;
                } else {
                    $boxRecord['box_type_id'] = $boxData['box_type_id'];
                }

                $box = Box::create($boxRecord);

                if ($booking->status === BookingStatus::Collected) {
                    $serialNumber = SerialNumber::where('status', SerialNumberStatus::Available->value)->first();
                    if ($serialNumber) {
                        $serialNumber->update([
                            'status' => SerialNumberStatus::Assigned->value,
                            'box_id' => $box->id,
                            'assigned_by' => $validated['picker_id'] ?? auth()->id(),
                            'allocated_at' => now(),
                        ]);
                        $box->update(['serial_number' => $serialNumber->serial_number]);
                    }
                }
            }

            // Always generate an invoice for admin-created bookings unless they are explicitly saved as Draft
            if ($booking->status !== BookingStatus::Draft) {
                $invoice = Invoice::generateForBooking($booking);

                $paymentStatus = $booking->payment_status instanceof PaymentStatus
                    ? $booking->payment_status
                    : PaymentStatus::tryFrom((string) $booking->payment_status);

                if ($paymentStatus === PaymentStatus::Paid) {
                    Payment::create([
                        'invoice_id' => $invoice->id,
                        'amount' => $invoice->amount,
                        'payment_method' => $booking->payment_method ?? 'bank_transfer',
                        'reference_number' => $booking->payment_reference ?? 'Manual Admin Entry',
                        'paid_at' => now(),
                        'collected_by' => auth()->id(),
                        'confirmed_at' => now(),
                        'confirmed_by' => auth()->id(),
                        'is_cash_payment' => false,
                    ]);
                }
            }

            // Send booking notification to the sender
            if ($booking->sender && $booking->sender->user) {
                $booking->sender->user->notify(new \App\Notifications\BookingCreatedByAdmin($booking));
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return back()->withErrors(['status' => 'Failed to create booking: ' . $e->getMessage()])->withInput();
        }

        return redirect()->route('admin.bookings.index')->with('success', 'Booking created successfully.');
    }

    public function show(Booking $booking)
    {
        if (!$booking->is_read) {
            $booking->update(['is_read' => true]);
        }
        if ($booking->payment_status === PaymentStatus::Pending->value && $booking->proof_of_payment && !$booking->is_payment_read) {
            $booking->update(['is_payment_read' => true]);
        }

        $booking->load(['sender', 'boxes.recipient', 'boxes.boxType', 'invoice']);

        return Inertia::render('admin/bookings/show', [
            'booking' => $booking->toHistoricalPayload(),
        ]);
    }

    public function edit(Booking $booking)
    {
        $senders = Sender::orderBy('first_name')->get();
        $referenceDataService = app(ReferenceDataService::class);

        return Inertia::render('admin/bookings/edit', [
            'booking' => $booking->load(['pickupZone']),
            'senders' => $senders,
            'pickupZones' => $referenceDataService->activePickupZones(),
        ]);
    }

    public function update(UpdateAdminBookingRequest $request, Booking $booking)
    {
        $validated = $request->validated();
        $bookingData = Arr::only($validated, [
            'sender_id', 'status', 'preferred_date', 'pickup_zone_id',
            'payment_status', 'payment_method', 'payment_reference', 'declaration_form_status', 'notes', 'admin_notes',
        ]);

        if ($request->hasFile('proof_of_payment')) {
            $bookingData['proof_of_payment'] = $request->file('proof_of_payment')->store('proofs_of_payment', 'public');
        }

        try {
            $booking->bypassStatusValidation = true;
            $booking->update($bookingData);
        } catch (\RuntimeException $e) {
            return back()->withErrors(['status' => $e->getMessage()])->withInput();
        }

        $paymentStatus = $booking->payment_status instanceof PaymentStatus ? $booking->payment_status->value : (string) $booking->payment_status;

        if ($paymentStatus === PaymentStatus::Paid->value || $paymentStatus === 'paid') {
            $invoice = $booking->invoice()->first() ?: Invoice::generateForBooking($booking);
            if ($invoice && ! $invoice->payments()->exists()) {
                $method = $booking->payment_method ?? 'bank_transfer';
                $reference = !empty($booking->payment_reference) ? $booking->payment_reference : (in_array($method, ['cash', 'cash_on_pickup']) ? 'Cash Payment' : 'Manual Admin Entry');

                Payment::create([
                    'invoice_id' => $invoice->id,
                    'amount' => $invoice->amount,
                    'payment_method' => $method,
                    'reference_number' => $reference,
                    'paid_at' => now(),
                    'collected_by' => auth()->id(),
                    'confirmed_at' => now(),
                    'confirmed_by' => auth()->id(),
                    'is_cash_payment' => in_array($method, ['cash', 'cash_on_pickup']),
                    'confirmation_note' => 'Manually recorded via Admin Booking Edit',
                ]);
            }
        }

        // Update recipient info on boxes/recipients
        $booking->load('boxes.recipient');
        $booking->boxes->each(function ($box) use ($validated) {
            if ($box->recipient) {
                $box->recipient->update([
                    'name' => $validated['recipient_name'],
                ]);

                // If destination is provided, try to update city/province (City, Province format)
                if (! empty($validated['destination'])) {
                    $parts = explode(',', $validated['destination']);
                    if (count($parts) >= 2) {
                        $box->recipient->update([
                            'city' => trim($parts[0]),
                            'province' => trim($parts[1]),
                        ]);
                    }
                }
            }
        });

        return redirect()->route('admin.bookings.index')->with('success', 'Booking updated successfully.');
    }

    public function viewDeclaration(Booking $booking)
    {
        $booking->load(['sender', 'boxes.recipient', 'boxes.boxType', 'boxes.batch']);

        return Inertia::render('admin/bookings/print-declaration', [
            'booking' => $booking,
            'declarationSettings' => $this->settingsService->getDeclarationSettings(),
        ]);
    }

    public function printDeclarationPdf(Booking $booking, Request $request)
    {
        $booking->load(['sender', 'boxes.recipient', 'boxes.boxType', 'boxes.batch']);

        $boxId = $request->input('box_id');
        if ($boxId) {
            $boxes = $booking->boxes->filter(function ($b) use ($boxId) {
                return (string) $b->id === (string) $boxId || $b->tracking_number === $boxId;
            })->values();
        } else {
            $boxes = $booking->boxes;
        }

        $boxCount = $boxes->count();
        $declarationSettings = $this->settingsService->getDeclarationSettings();

        $pdf = Pdf::loadView('declaration-blank', compact('booking', 'boxes', 'boxCount', 'declarationSettings'))
            ->setPaper('a4', 'portrait');

        return $pdf->stream("declaration-booking-{$booking->reference_number}.pdf");
    }

    public function viewDeclarationFile(Booking $booking)
    {
        if (empty($booking->declaration_form_path)) {
            abort(404, 'Declaration file not found.');
        }

        $path = $booking->declaration_form_path;
        $disksToCheck = [
            config('filesystems.disks.google.clientId') ? 'google' : null,
            'local',
            'public'
        ];

        $foundDisk = null;
        foreach (array_filter($disksToCheck) as $disk) {
            if (\Illuminate\Support\Facades\Storage::disk($disk)->exists($path)) {
                $foundDisk = $disk;
                break;
            }
        }

        if (! $foundDisk) {
            abort(404, 'File does not exist in storage.');
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $storage */
        $storage = \Illuminate\Support\Facades\Storage::disk($foundDisk);

        return $storage->response($path);
    }

    public function accept(Booking $booking, Request $request)
    {
        if ($booking->status !== BookingStatus::Pending) {
            return back()->with('error', 'Only pending bookings can be accepted.');
        }

        $validated = $request->validate([
            'admin_notes' => 'nullable|string|max:1000',
        ]);

        $booking->bypassStatusValidation = true;
        $booking->update([
            'status' => BookingStatus::Confirmed,
            'confirmed_at' => now(),
            'admin_notes' => $validated['admin_notes'] ?? $booking->admin_notes,
        ]);

        return redirect()->route('admin.bookings.index')->with('success', 'Booking accepted successfully.');
    }

    public function assignCourier(Booking $booking, Request $request)
    {
        if ($booking->payment_status !== PaymentStatus::Paid) {
            return back()->with('error', 'This booking must be paid before a courier can be assigned.');
        }

        if (! $booking->hasCompletedPickupRunsheet()) {
            return back()->with('error', 'Assign a picker and complete pickup before assigning a courier.');
        }

        if (! $booking->hasWarehouseHandoffCompleted()) {
            return back()->with('error', 'Courier can only be assigned after warehouse handoff is complete.');
        }

        $validated = $request->validate([
            'courier_id' => 'required|exists:users,id',
            'runsheet_id' => 'nullable|exists:runsheets,id',
        ]);

        try {
            $this->bookings->assignToRunsheet(
                $booking,
                $validated['courier_id'],
                $validated['runsheet_id'] ?? null
            );

            return redirect()->route('admin.bookings.index')
                ->with('success', 'Booking assigned successfully.');
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function assignPicker(Booking $booking, Request $request)
    {
        if ($booking->status !== BookingStatus::Confirmed) {
            return back()->with('error', 'Booking must be Confirmed before a picker can be assigned.');
        }

        if (! in_array($booking->payment_status, [PaymentStatus::Paid, PaymentStatus::Pending, PaymentStatus::CashOnPickup], true)) {
            return back()->with('error', 'This booking must be paid, pending, or payment on pickup before a picker can be assigned.');
        }

        $validated = $request->validate([
            'picker_id' => 'required|exists:users,id',
            'runsheet_id' => 'nullable|exists:runsheets,id',
        ]);

        try {
            $this->bookings->assignPickerToRunsheet(
                $booking,
                (int) $validated['picker_id'],
                isset($validated['runsheet_id']) ? (int) $validated['runsheet_id'] : null
            );

            return redirect()->route('admin.bookings.index')
                ->with('success', 'Picker assigned successfully.');
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function bulkAccept(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'status' => 'nullable|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Booking::query();
            $query = $this->applyFilters($query, $request);
            $bookings = $query->where('status', BookingStatus::Pending)
                ->get();
        } else {
            $bookings = Booking::whereIn('id', $validated['ids'])
                ->where('status', BookingStatus::Pending)
                ->get();
        }

        foreach ($bookings as $booking) {
            $booking->bypassStatusValidation = true;
            $booking->update([
                'status' => BookingStatus::Confirmed,
                'confirmed_at' => now(),
            ]);
        }

        return redirect()->route('admin.bookings.index')->with('success', count($bookings).' bookings accepted successfully.');
    }

    public function bulkCancel(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'status' => 'nullable|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Booking::query();
            $query = $this->applyFilters($query, $request);
            $bookings = $query->get();
        } else {
            $bookings = Booking::whereIn('id', $validated['ids'])->get();
        }

        foreach ($bookings as $booking) {
            try {
                $booking->bypassStatusValidation = true;
                $booking->update(['status' => BookingStatus::Cancelled]);
            } catch (\Exception $e) {
                // Skip if transition is not allowed
            }
        }

        return redirect()->route('admin.bookings.index')->with('success', 'Selected bookings cancelled where allowed.');
    }

    public function bulkUpdateStatus(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'filter_status' => 'nullable|string',
            'status' => 'required|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Booking::query();
            $requestForFilters = $request->duplicate();
            $requestForFilters->merge(['status' => $request->filter_status]);
            $query = $this->applyFilters($query, $requestForFilters);
            $bookings = $query->get();
        } else {
            $bookings = Booking::whereIn('id', $validated['ids'])->get();
        }

        $newStatus = BookingStatus::tryFrom($validated['status']);
        if (!$newStatus) {
            return redirect()->back()->with('error', 'Invalid status.');
        }

        $updatedCount = 0;
        foreach ($bookings as $booking) {
            try {
                if ($booking->status->canTransitionTo($newStatus)) {
                    $booking->status = $newStatus;
                    
                    if ($newStatus === BookingStatus::Confirmed && !$booking->confirmed_at) {
                        $booking->confirmed_at = now();
                    } elseif ($newStatus === BookingStatus::Shipped && !$booking->shipped_at) {
                        $booking->shipped_at = now();
                    }

                    $booking->save();
                    $updatedCount++;
                }
            } catch (\Exception $e) {
                // Skip
            }
        }

        return redirect()->back()->with('success', $updatedCount . ' bookings updated successfully.');
    }

    public function bulkUpdatePaymentStatus(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'filter_status' => 'nullable|string',
            'payment_status' => 'required|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Booking::query();
            $requestForFilters = $request->duplicate();
            $requestForFilters->merge(['status' => $request->filter_status]);
            $query = $this->applyFilters($query, $requestForFilters);
            $bookings = $query->get();
        } else {
            $bookings = Booking::whereIn('id', $validated['ids'])->get();
        }

        $newPaymentStatus = PaymentStatus::tryFrom($validated['payment_status']);
        if (!$newPaymentStatus) {
            return redirect()->back()->with('error', 'Invalid payment status.');
        }

        $updatedCount = 0;
        foreach ($bookings as $booking) {
            $booking->payment_status = $newPaymentStatus;
            $booking->save();

            if ($newPaymentStatus === PaymentStatus::Paid) {
                $invoice = $booking->invoice()->first();
                if ($invoice && ! $invoice->payments()->exists()) {
                    \App\Models\Payment::create([
                        'invoice_id' => $invoice->id,
                        'amount' => $invoice->amount,
                        'payment_method' => $booking->payment_method ?? 'bank_transfer',
                        'reference_number' => $booking->payment_reference ?? 'Bulk Admin Update',
                        'paid_at' => now(),
                        'collected_by' => auth()->id(),
                        'confirmed_at' => now(),
                        'confirmed_by' => auth()->id(),
                        'is_cash_payment' => ($booking->payment_method ?? '') === 'cash',
                        'confirmation_note' => 'Manually recorded via Booking Bulk Payment Status Update',
                    ]);
                }
            }

            $updatedCount++;
        }

        return redirect()->back()->with('success', $updatedCount . ' bookings payment status updated.');
    }

    public function bulkUpdateNotes(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'filter_status' => 'nullable|string',
            'admin_notes' => 'nullable|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Booking::query();
            $requestForFilters = $request->duplicate();
            $requestForFilters->merge(['status' => $request->filter_status]);
            $query = $this->applyFilters($query, $requestForFilters);
            $bookings = $query->get();
        } else {
            $bookings = Booking::whereIn('id', $validated['ids'])->get();
        }

        $updatedCount = 0;
        foreach ($bookings as $booking) {
            $booking->admin_notes = $validated['admin_notes'] ?? null;
            $booking->save();
            $updatedCount++;
        }

        return redirect()->back()->with('success', $updatedCount . ' bookings internal notes updated.');
    }

    public function bulkDestroySelected(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'status' => 'nullable|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Booking::query();
            $query = $this->applyFilters($query, $request);
            $bookings = $query->get();
        } else {
            $bookings = Booking::whereIn('id', $validated['ids'])->get();
        }

        $deleted = 0;
        $skipped = 0;

        foreach ($bookings as $booking) {
            $status = $booking->status instanceof BookingStatus ? $booking->status->value : $booking->status;
            
            $canDelete = in_array($status, [BookingStatus::Pending->value, BookingStatus::Draft->value, BookingStatus::Cancelled->value], true);
            if (auth()->user()?->role === Role::SuperAdmin) {
                $canDelete = true;
            }

            if ($canDelete) {
                $booking->delete();
                $deleted++;
            } else {
                $skipped++;
            }
        }

        $message = "{$deleted} bookings archived successfully.";
        if ($skipped > 0) {
            $message .= " {$skipped} bookings skipped because they are not pending, draft, or cancelled.";
            return redirect()->route('admin.bookings.index')->with('warning', $message);
        }

        return redirect()->route('admin.bookings.index')->with('success', $message);
    }

    public function destroy(Booking $booking)
    {
        $status = $booking->status instanceof BookingStatus ? $booking->status->value : $booking->status;
        $canDelete = in_array($status, [BookingStatus::Pending->value, BookingStatus::Draft->value, BookingStatus::Cancelled->value], true);
        
        if (auth()->user()?->role === Role::SuperAdmin) {
            $canDelete = true;
        }

        if (! $canDelete) {
            return back()->with('error', 'Cannot delete a booking unless its status is pending, draft, or cancelled.');
        }

        $booking->delete();

        return redirect()->route('admin.bookings.index')->with('success', 'Booking archived successfully.');
    }

    public function restore($id)
    {
        if (auth()->user()?->role !== Role::SuperAdmin) {
            abort(403, 'Unauthorized');
        }

        $booking = Booking::withTrashed()->findOrFail($id);
        $booking->restore();

        return redirect()->back()->with('success', 'Booking restored successfully.');
    }

    public function bulkAssignToRunsheet(Request $request, RunsheetService $runsheetService)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'status' => 'nullable|string',
            'runsheet_id' => 'required|exists:runsheets,id',
        ]);

        if ($request->boolean('select_all')) {
            $query = Booking::query();
            $query = $this->applyFilters($query, $request);
            $bookings = $query->get();
        } else {
            $bookings = Booking::whereIn('id', $validated['ids'])->get();
        }

        $runsheet = Runsheet::findOrFail($validated['runsheet_id']);
        $bookingIds = $bookings->pluck('id')->toArray();

        try {
            if ($runsheet->type === RunsheetType::Delivery) {
                $boxIds = $bookings->load('boxes')->flatMap(fn (Booking $booking) => $booking->boxes->pluck('id'))->all();
                $runsheetService->attachBoxes($runsheet, $boxIds);
            } else {
                $runsheetService->attachBookings($runsheet, $bookingIds);
            }

            return redirect()->route('admin.bookings.index')->with('success', count($bookingIds).' bookings assigned to runsheet successfully.');
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    private function applyFilters($query, Request $request)
    {
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('reference_number', 'like', "%{$search}%")
                    ->orWhereHas('sender', function ($cq) use ($search) {
                        $cq->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"]);
                    })
                    ->orWhereHas('boxes.recipient', function ($rq) use ($search) {
                        $rq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        if ($request->filled('declaration_form_status')) {
            if ($request->declaration_form_status === 'submitted') {
                $query->whereIn('declaration_form_status', ['submitted_online', 'physical_copy_received']);
            } else {
                $query->where('declaration_form_status', $request->declaration_form_status);
            }
        }

        $sortableColumns = [
            'reference_number',
            'status',
            'payment_status',
            'preferred_date',
            'created_at',
        ];

        $sort = in_array($request->sort, $sortableColumns) ? $request->sort : 'created_at';
        $direction = in_array($request->direction, ['asc', 'desc']) ? $request->direction : 'desc';

        return $query->orderBy($sort, $direction)->orderBy('id', 'desc');
    }
}
