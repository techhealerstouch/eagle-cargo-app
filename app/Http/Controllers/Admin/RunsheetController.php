<?php

namespace App\Http\Controllers\Admin;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreRunsheetRequest;
use App\Http\Requests\Admin\UpdateRunsheetRequest;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Runsheet;
use App\Models\User;
use App\Services\RunsheetService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class RunsheetController extends Controller
{
    public function __construct(private readonly RunsheetService $runsheetService) {}

    public function index(Request $request)
    {
        return redirect()->route('admin.runsheets.pickups');
    }

    public function pickups(Request $request)
    {
        $query = Runsheet::query()
            ->where('type', RunsheetType::Pickup)
            ->with([
                'picker:id,name,email,role',
                'picker.picker:id,user_id,mobile',
                'bookings.sender',
                'bookings.boxes',
            ]);

        $this->applyFilters($query, $request);

        $sortableColumns = ['status', 'created_at'];
        $sort = in_array($request->sort, $sortableColumns) ? $request->sort : 'created_at';
        $direction = in_array($request->direction, ['asc', 'desc']) ? $request->direction : 'desc';

        $runsheets = $query->orderBy($sort, $direction)->paginate(10)->withQueryString();

        $availablePickupsCount = $this->pickupEligibleBookingsQuery()->count();

        return Inertia::render('admin/runsheets/pickups/index', [
            'runsheets' => $runsheets,
            'filters' => $request->only(['search', 'status', 'sort', 'direction']),
            'availablePickupsCount' => $availablePickupsCount,
        ]);
    }

    public function deliveries(Request $request)
    {
        $query = Runsheet::query()
            ->where('type', RunsheetType::Delivery)
            ->with([
                'courier:id,name,email,role',
                'courier.courier:id,user_id,mobile',
                'boxes.booking.sender',
            ]);

        $this->applyFilters($query, $request);

        $sortableColumns = ['status', 'created_at'];
        $sort = in_array($request->sort, $sortableColumns) ? $request->sort : 'created_at';
        $direction = in_array($request->direction, ['asc', 'desc']) ? $request->direction : 'desc';

        $runsheets = $query->orderBy($sort, $direction)->paginate(10)->withQueryString();

        $incomingDeliveriesCount = $this->deliveryEligibleBoxesQuery()->count();

        return Inertia::render('admin/runsheets/deliveries/index', [
            'runsheets' => $runsheets,
            'filters' => $request->only(['search', 'status', 'sort', 'direction']),
            'incomingDeliveriesCount' => $incomingDeliveriesCount,
        ]);
    }

    private function applyFilters($query, Request $request)
    {
        $query->when($request->search, function ($q, $search) {
            $q->where(function ($qq) use ($search) {
                $qq->where('area_description', 'like', "%{$search}%")
                    ->orWhereHas('courier', function ($qqq) use ($search) {
                        $qqq->where('name', 'like', "%{$search}%")
                            ->orWhereHas('courier', function ($qqqq) use ($search) {
                                $qqqq->where('mobile', 'like', "%{$search}%");
                            });
                    })
                    ->orWhereHas('picker', function ($qqq) use ($search) {
                        $qqq->where('name', 'like', "%{$search}%")
                            ->orWhereHas('picker', function ($qqqq) use ($search) {
                                $qqqq->where('mobile', 'like', "%{$search}%");
                            });
                    })
                    ->orWhereHas('bookings', function ($qqq) use ($search) {
                        $qqq->where('reference_number', 'like', "%{$search}%")
                            ->orWhereHas('boxes', function ($qqqq) use ($search) {
                                $qqqq->where('tracking_number', 'like', "%{$search}%");
                            });
                    });
            });
        })->when($request->status, function ($q, $status) {
            $q->where('status', $status);
        });
    }

    public function show(Runsheet $runsheet)
    {
        $runsheet->load([
            'courier:id,name,email,role',
            'courier.courier:id,user_id,mobile',
            'picker:id,name,email,role',
            'picker.picker:id,user_id,mobile',
            'bookings.sender',
            'bookings.boxes.recipient.area', 'boxes.booking.sender', 'boxes.recipient.area',
        ]);

        return Inertia::render('admin/runsheets/show', [
            'runsheet' => $runsheet,
        ]);
    }

    public function create(Request $request)
    {
        $type = $request->query('type', 'pickup');

        if ($type === 'delivery') {
            return $this->createDelivery();
        }

        return $this->createPickup($request);
    }

    public function createPickup(Request $request = null)
    {
        $pickers = User::where('role', Role::Picker)
            ->with('picker:id,user_id,mobile')
            ->withCount(['pickerRunsheets as active_runsheet_count' => function ($q) {
                $q->whereIn('status', RunsheetStatus::activeValues());
            }])
            ->orderBy('name')
            ->get();

        $bookingIds = [];
        if ($request) {
            if ($request->has('booking_ids')) {
                $bookingIdsVal = $request->input('booking_ids');
                if (is_string($bookingIdsVal)) {
                    $bookingIds = array_filter(explode(',', $bookingIdsVal));
                } elseif (is_array($bookingIdsVal)) {
                    $bookingIds = $bookingIdsVal;
                }
            } elseif ($request->has('booking_id')) {
                $bookingIds = [$request->input('booking_id')];
            }
        }

        $pickupEligibleBookingsQuery = $this->pickupEligibleBookingsQuery();

        if (!empty($bookingIds)) {
            $specificBookings = Booking::whereIn('id', $bookingIds)->with('sender')->get();
            $otherBookings = $pickupEligibleBookingsQuery->whereNotIn('id', $bookingIds)->limit(150)->get();
            $pickupEligibleBookings = $specificBookings->concat($otherBookings);
        } else {
            $pickupEligibleBookings = $pickupEligibleBookingsQuery->limit(150)->get();
        }

        $recommendedStartingSerial = \App\Models\SerialNumber::where('status', \App\Enums\SerialNumberStatus::Available->value)
            ->orderBy('id', 'asc')
            ->first()?->serial_number;

        return Inertia::render('admin/runsheets/pickups/create', [
            'pickers' => $pickers,
            'runsheetTypes' => collect(RunsheetType::cases())
                ->map(fn (RunsheetType $type) => [
                    'name' => $type->name,
                    'value' => $type->value,
                ])
                ->values(),
            'pickupEligibleBookings' => $pickupEligibleBookings,
            'recommendedStartingSerial' => $recommendedStartingSerial,
        ]);
    }

    public function createDelivery()
    {
        $couriers = User::where('role', Role::Courier)
            ->with(['courier:id,user_id,mobile,area_id', 'courier.area'])
            ->withCount(['courierRunsheets as active_runsheet_count' => function ($q) {
                $q->whereIn('status', RunsheetStatus::activeValues());
            }])
            ->orderBy('name')
            ->get();

        $deliveryEligibleBoxes = $this->deliveryEligibleBoxesQuery()
            ->limit(50)
            ->get();

        return Inertia::render('admin/runsheets/deliveries/create', [
            'couriers' => $couriers,
            'runsheetTypes' => collect(RunsheetType::cases())
                ->map(fn (RunsheetType $type) => [
                    'name' => $type->name,
                    'value' => $type->value,
                ])
                ->values(),
            'deliveryEligibleBoxes' => $deliveryEligibleBoxes,
        ]);
    }

    public function store(StoreRunsheetRequest $request)
    {
        $validated = $this->normalizeAssignees($request->validated());

        $runsheet = null;

        try {
            DB::transaction(function () use ($validated, &$runsheet): void {
                $this->assertNonEmptyBookingsForActiveStatus($validated);

                $runsheet = Runsheet::create(Arr::except($validated, ['booking_ids', 'box_ids', 'stop_sequence', 'starting_serial_number']));

                if ($runsheet->type === RunsheetType::Delivery) {
                    if (! empty($validated['box_ids'])) {
                        $this->runsheetService->attachBoxes($runsheet, $validated['box_ids']);

                        if (! empty($validated['stop_sequence'])) {
                            $this->runsheetService->reorderBoxes($runsheet, $validated['stop_sequence']);
                        }
                    }
                } else {
                    if (! empty($validated['booking_ids'])) {
                        $this->runsheetService->attachBookings($runsheet, $validated['booking_ids'], $validated['starting_serial_number'] ?? null);

                        if (! empty($validated['stop_sequence'])) {
                            $this->runsheetService->reorderBookings($runsheet, $validated['stop_sequence']);
                        }
                    }
                }
            });
        } catch (\InvalidArgumentException $e) {
            return back()->withInput()->with('error', $e->getMessage());
        }

        if (! $runsheet) {
            return back()->withInput()->with('error', 'Unable to create runsheet.');
        }

        $redirectRoute = RunsheetType::from($validated['type']) === RunsheetType::Pickup
            ? 'admin.runsheets.pickups'
            : 'admin.runsheets.deliveries';

        $runsheet->load(['bookings.boxes', 'boxes', 'picker.picker', 'courier.courier']);

        $contactMobile = null;
        if ($runsheet->picker && $runsheet->picker->picker) {
            $contactMobile = $runsheet->picker->picker->mobile;
        } elseif ($runsheet->courier && $runsheet->courier->courier) {
            $contactMobile = $runsheet->courier->courier->mobile;
        }

        return redirect()->route($redirectRoute)->with([
            'success' => 'Runsheet created successfully.',
            'runsheet' => [
                'id' => $runsheet->id,
                'scheduled_date' => $runsheet->scheduled_date,
                'status' => $runsheet->status,
                'area_description' => $runsheet->area_description,
                'type' => $runsheet->type,
                'bookings' => $runsheet->bookings->map(fn ($b) => [
                    'id' => $b->id,
                    'reference_number' => $b->reference_number,
                    'boxes' => $b->boxes->map(fn ($box) => ['id' => $box->id, 'tracking_number' => $box->tracking_number])->toArray(),
                ])->toArray(),
                'boxes' => $runsheet->boxes->map(fn ($b) => ['id' => $b->id, 'tracking_number' => $b->tracking_number])->toArray(),
                'contact_mobile' => $contactMobile,
            ],
        ]);
    }

    public function edit(Runsheet $runsheet)
    {
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

        $pickupEligibleBookings = $this->pickupEligibleBookingsQuery($runsheet)
            ->limit(150)
            ->get();

        $deliveryEligibleBoxes = $this->deliveryEligibleBoxesQuery($runsheet)
            ->limit(50)
            ->get();

        if ($runsheet->type === RunsheetType::Delivery) {
            $runsheet->load(['boxes.booking.sender', 'boxes.recipient.area']);

            return Inertia::render('admin/runsheets/deliveries/edit', [
                'runsheet' => $runsheet,
                'couriers' => $couriers,
                'deliveryEligibleBoxes' => $deliveryEligibleBoxes,
            ]);
        }

        $runsheet->load(['bookings.sender']);

        return Inertia::render('admin/runsheets/pickups/edit', [
            'runsheet' => $runsheet,
            'pickers' => $pickers,
            'pickupEligibleBookings' => $pickupEligibleBookings,
        ]);
    }

    public function update(UpdateRunsheetRequest $request, Runsheet $runsheet)
    {
        // Item 15: Completed runsheet immutability
        if ($runsheet->status === RunsheetStatus::Completed) {
            return back()->with('error', 'Completed runsheets cannot be edited.');
        }

        $validated = $this->normalizeAssignees($request->validated());

        try {
            DB::transaction(function () use ($validated, $runsheet): void {
                $this->assertNonEmptyBookingsForActiveStatus($validated, $runsheet);

                $nextStatus = RunsheetStatus::from($validated['status']);
                $currentStatus = $runsheet->status;
                if (! $currentStatus instanceof RunsheetStatus) {
                    $currentStatus = RunsheetStatus::from((string) $currentStatus);
                }

                $runsheet->update(Arr::except($validated, ['booking_ids', 'box_ids', 'stop_sequence', 'status']));

                if ($currentStatus !== $nextStatus) {
                    $this->runsheetService->transition($runsheet, $nextStatus);
                }

                if ($runsheet->type === RunsheetType::Delivery) {
                    if (isset($validated['box_ids'])) {
                        $this->runsheetService->syncBoxes(
                            $runsheet,
                            $validated['box_ids'],
                            $validated['stop_sequence'] ?? null
                        );
                    }
                } else {
                    if (isset($validated['booking_ids'])) {
                        $this->runsheetService->syncBookings(
                            $runsheet,
                            $validated['booking_ids'],
                            $validated['stop_sequence'] ?? null
                        );
                    }
                }
            });
        } catch (\InvalidArgumentException $e) {
            return back()->withInput()->with('error', $e->getMessage());
        }

        $redirectRoute = $runsheet->type === RunsheetType::Pickup
            ? 'admin.runsheets.pickups'
            : 'admin.runsheets.deliveries';

        return redirect()->route($redirectRoute)->with('success', 'Runsheet updated successfully.');
    }

    public function attachBookings(Runsheet $runsheet, Request $request)
    {
        $validated = $request->validate([
            'booking_ids' => 'required|array',
            'booking_ids.*' => 'exists:bookings,id',
        ]);

        try {
            if ($runsheet->type === RunsheetType::Delivery) {
                $bookings = Booking::with('boxes')->whereIn('id', $validated['booking_ids'])->get();
                $boxIds = $bookings->flatMap(fn (Booking $booking) => $booking->boxes->pluck('id'))->all();
                $this->runsheetService->attachBoxes($runsheet, $boxIds);
            } else {
                $this->runsheetService->attachBookings($runsheet, $validated['booking_ids']);
            }
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', 'Bookings attached to runsheet successfully.');
    }

    public function reorder(Runsheet $runsheet, Request $request)
    {
        if ($runsheet->status === RunsheetStatus::Completed) {
            return back()->with('error', 'Completed runsheets cannot be reordered.');
        }

        $validated = $request->validate([
            'booking_ids' => 'required_without_all:box_ids,stop_sequence|array',
            'booking_ids.*' => 'integer|exists:bookings,id',
            'box_ids' => 'required_without_all:booking_ids,stop_sequence|array',
            'box_ids.*' => 'integer|exists:boxes,id',
            'stop_sequence' => 'required_without_all:booking_ids,box_ids|array',
            'stop_sequence.*' => 'integer',
        ]);

        try {
            $runsheetType = $runsheet->type instanceof RunsheetType
                ? $runsheet->type
                : RunsheetType::from((string) $runsheet->type);

            if ($runsheetType === RunsheetType::Delivery) {
                $boxIds = $validated['box_ids'] ?? $validated['stop_sequence'] ?? null;

                if (! is_array($boxIds)) {
                    throw ValidationException::withMessages([
                        'box_ids' => 'Box IDs are required to reorder a delivery runsheet.',
                    ]);
                }

                $this->runsheetService->reorderBoxes($runsheet, $boxIds);
            } else {
                $bookingIds = $validated['booking_ids'] ?? $validated['stop_sequence'] ?? null;

                if (! is_array($bookingIds)) {
                    throw ValidationException::withMessages([
                        'booking_ids' => 'Booking IDs are required to reorder a pickup runsheet.',
                    ]);
                }

                $this->runsheetService->reorderBookings($runsheet, $bookingIds);
            }
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', 'Stop order updated successfully.');
    }

    public function destroy(Runsheet $runsheet)
    {
        $status = $runsheet->status instanceof RunsheetStatus ? $runsheet->status->value : $runsheet->status;
        if (in_array($status, [RunsheetStatus::InProgress->value, RunsheetStatus::Completed->value], true)) {
            return back()->with('error', 'Cannot delete a runsheet that is currently in progress or completed.');
        }

        $type = $runsheet->type;
        $runsheet->delete();

        $redirectRoute = $type === RunsheetType::Pickup
            ? 'admin.runsheets.pickups'
            : 'admin.runsheets.deliveries';

        return redirect()->route($redirectRoute)->with('success', 'Runsheet deleted successfully.');
    }

    private function normalizeAssignees(array $validated): array
    {
        $runsheetType = RunsheetType::from($validated['type']);

        if ($runsheetType === RunsheetType::Pickup) {
            $validated['picker_id'] = (int) ($validated['picker_id'] ?? $validated['courier_id']);
            $validated['courier_id'] = null;

            return $validated;
        }

        $validated['courier_id'] = (int) $validated['courier_id'];
        $validated['picker_id'] = null;

        return $validated;
    }

    private function assertNonEmptyBookingsForActiveStatus(array $validated, ?Runsheet $runsheet = null): void
    {
        $status = RunsheetStatus::from((string) $validated['status']);
        $type = isset($validated['type']) ? RunsheetType::from((string) $validated['type']) : $runsheet?->type;

        if (! in_array($status, [RunsheetStatus::Assigned, RunsheetStatus::InProgress], true)) {
            return;
        }

        if ($type === RunsheetType::Delivery) {
            if (array_key_exists('box_ids', $validated)) {
                $boxIds = is_array($validated['box_ids']) ? $validated['box_ids'] : [];
                if (count($boxIds) === 0) {
                    throw new \InvalidArgumentException('At least one box is required when runsheet status is assigned or in progress.');
                }

                return;
            }
            if (! $runsheet || ! $runsheet->boxes()->exists()) {
                throw new \InvalidArgumentException('At least one box is required when runsheet status is assigned or in progress.');
            }
        } else {
            if (array_key_exists('booking_ids', $validated)) {
                $bookingIds = is_array($validated['booking_ids']) ? $validated['booking_ids'] : [];
                if (count($bookingIds) === 0) {
                    throw new \InvalidArgumentException('At least one booking is required when runsheet status is assigned or in progress.');
                }

                return;
            }
            if (! $runsheet || ! $runsheet->bookings()->exists()) {
                throw new \InvalidArgumentException('At least one booking is required when runsheet status is assigned or in progress.');
            }
        }
    }

    private function pickupEligibleBookingsQuery(?Runsheet $editingRunsheet = null)
    {
        return Booking::query()
            ->where('status', BookingStatus::Confirmed)
            ->whereIn('payment_status', [PaymentStatus::Paid, PaymentStatus::Pending, PaymentStatus::CashOnPickup])
            ->whereHas('boxes', function ($query) {
                $query->where('status', BoxStatus::Pending->value);
            })
            ->whereDoesntHave('runsheets', function ($query) use ($editingRunsheet) {
                $query->where('type', RunsheetType::Pickup->value)
                    ->whereIn('status', RunsheetStatus::activeValues());

                if ($editingRunsheet) {
                    $query->where('runsheets.id', '!=', $editingRunsheet->id);
                }
            })
            ->with(['sender', 'boxes']);
    }

    private function deliveryEligibleBoxesQuery(?Runsheet $editingRunsheet = null)
    {
        return Box::query()
            ->whereHas('booking', function ($q) {
                $q->whereIn('status', [
                    BookingStatus::Confirmed,
                    BookingStatus::Collected,
                    BookingStatus::Shipped,
                    BookingStatus::PartiallyDelivered,
                ])
                    ->where('payment_status', PaymentStatus::Paid)
                    ->whereHas('runsheets', function ($rq) {
                        $rq->where('type', RunsheetType::Pickup->value)
                            ->where('status', RunsheetStatus::Completed->value);
                    })
                    ->whereDoesntHave('runsheets', function ($rq) {
                        $rq->where('type', RunsheetType::Pickup->value)
                            ->whereIn('status', RunsheetStatus::activeValues());
                    });
            })
            ->where('status', '!=', BoxStatus::OutForDelivery->value)
            ->whereNotIn('status', [
                BoxStatus::Delivered->value,
                BoxStatus::Cancelled->value,
                BoxStatus::Held->value,
                BoxStatus::Damaged->value,
            ])
            ->where(function ($q) {
                $q->whereHas('updates', function ($updateQuery) {
                    $updateQuery->whereIn('tracking_phase', [
                        'received_manila_warehouse',
                        'sorting',
                        'dispatched_to_local_hub',
                    ])->orWhereHas('milestone', function ($milestoneQuery) {
                        $milestoneQuery->where('is_warehouse_handoff', true);
                    });
                });
            })
            ->whereDoesntHave('runsheets', function ($query) use ($editingRunsheet) {
                $query->where('type', RunsheetType::Delivery->value)
                    ->whereIn('status', RunsheetStatus::activeValues());

                if ($editingRunsheet) {
                    $query->where('runsheets.id', '!=', $editingRunsheet->id);
                }
            })
            ->with(['booking.sender', 'recipient.area']);
    }
}
