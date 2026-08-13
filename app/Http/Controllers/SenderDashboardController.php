<?php

namespace App\Http\Controllers;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\DataIntegrityWarning;
use App\Models\Enquiry;
use App\Models\Payment;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use App\Services\ReferenceDataService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Stripe\PaymentIntent;
use Stripe\Stripe;

class SenderDashboardController extends Controller
{
    public function index()
    {
        /** @var User $user */
        $user = Auth::user();

        // Admin/Super Admin — render the admin dashboard with real stats
        if ($isAdmin = in_array($user->role, [Role::Admin, Role::SuperAdmin])) {
            return $this->adminDashboard();
        }

        // Recipient — redirect to recipient dashboard
        if ($user->role === Role::Recipient) {
            return redirect()->route('recipient.dashboard');
        }

        // Picker — redirect to picker dashboard
        if ($user->role === Role::Picker) {
            return redirect()->route('picker.dashboard');
        }

        // Courier — redirect to courier dashboard
        if ($user->role === Role::Courier) {
            return redirect()->route('courier.dashboard');
        }

        // Warehouse — redirect to warehouse dashboard
        if ($user->role === Role::Warehouse) {
            return redirect()->route('warehouse.dashboard');
        }

        $sender = $user->sender()->with('recipients.area')->first();
        $activeBoxStatuses = array_map(fn (BoxStatus $status) => $status->value, [
            BoxStatus::Collected,
            BoxStatus::ReceivedByWarehouse,
            BoxStatus::LoadedToContainer,
            BoxStatus::InTransit,
            BoxStatus::Arrived,
            BoxStatus::OutForDelivery,
            BoxStatus::Damaged,
            BoxStatus::Held,
        ]);
        $history = collect();

        if ($sender) {
            $recentBookings = fn () => $sender->bookings()
                ->with(['boxes.recipient.area', 'boxes.boxType', 'invoice'])
                ->where('status', '!=', BookingStatus::Draft);

            $history = $recentBookings()
                ->whereHas('boxes', fn ($query) => $query->whereIn('status', $activeBoxStatuses))
                ->latest()
                ->limit(20)
                ->get()
                ->concat(
                    $recentBookings()
                        ->whereHas('boxes', fn ($query) => $query->where('status', BoxStatus::Pending))
                        ->latest()
                        ->limit(20)
                        ->get()
                )
                ->concat(
                    $recentBookings()
                        ->whereHas('boxes')
                        ->whereDoesntHave('boxes', fn ($query) => $query->where('status', '!=', BoxStatus::Delivered->value))
                        ->latest()
                        ->limit(20)
                        ->get()
                )
                ->unique('id')
                ->sortByDesc('created_at')
                ->values();
        }

        // Identify bookings requiring action
        $missingDeclaration = ($sender
            ? $sender->bookings()
                ->whereNotIn('status', [BookingStatus::Draft, BookingStatus::Cancelled])
                ->whereNull('declaration_form_path')
                ->where(function ($query) {
                    $query->whereNull('declaration_data')
                        ->orWhere('declaration_data', '[]');
                })
                ->latest()
                ->limit(20)
                ->get()
            : collect())
            ->map(fn ($b) => [
                'id' => $b->id,
                'reference_number' => $b->reference_number ?? "BK-{$b->id}",
                'reason' => 'Missing Declaration Form',
                'action_url' => route('track.declaration.form', $b->id),
                'type' => 'declaration',
            ]);

        $pendingPayment = ($sender
            ? $sender->bookings()
                ->whereNotIn('status', [BookingStatus::Draft, BookingStatus::Cancelled])
                ->where('payment_status', PaymentStatus::Pending)
                ->latest()
                ->limit(20)
                ->get()
            : collect())
            ->map(fn ($b) => [
                'id' => $b->id,
                'reference_number' => $b->reference_number ?? "BK-{$b->id}",
                'reason' => 'Payment Pending',
                'action_url' => route('bookings.pay', $b->id),
                'type' => 'payment',
            ]);

        $bookingsRequiringAction = $missingDeclaration->concat($pendingPayment)->values();
        $bookingQuery = $sender ? $sender->bookings() : Booking::query()->whereRaw('1 = 0');
        $stats = [
            'total' => (clone $bookingQuery)->where('status', '!=', BookingStatus::Draft)->count(),
            'active' => (clone $bookingQuery)
                ->where('status', '!=', BookingStatus::Draft)
                ->whereHas('boxes', fn ($query) => $query->whereIn('status', $activeBoxStatuses))
                ->count(),
            'pending' => (clone $bookingQuery)
                ->where('status', '!=', BookingStatus::Draft)
                ->whereHas('boxes', fn ($query) => $query->where('status', BoxStatus::Pending))
                ->count(),
            'delivered' => (clone $bookingQuery)
                ->where('status', '!=', BookingStatus::Draft)
                ->whereHas('boxes')
                ->whereDoesntHave('boxes', fn ($query) => $query->where('status', '!=', BoxStatus::Delivered->value))
                ->count(),
            'contacts' => $sender?->recipients->count() ?? 0,
        ];

        return Inertia::render('sender/Dashboard', [
            'sender' => $sender,
            'history' => $history,
            'recipients' => $sender ? $sender->recipients : [],
            'stats' => $stats,
            'bookingsRequiringAction' => $bookingsRequiringAction,
            'areas' => Inertia::lazy(fn () => app(ReferenceDataService::class)->activeAreas()),
            'boxTypes' => Inertia::lazy(fn () => app(ReferenceDataService::class)->activeBoxTypes()),
            'boxPrices' => Inertia::lazy(fn () => app(ReferenceDataService::class)->boxPrices()),
            'pageTitle' => 'Dashboard',
            'breadcrumbs' => [
                ['title' => 'Home', 'href' => route('dashboard')],
            ],
        ]);
    }

    public const DASHBOARD_CACHE_KEY = 'dashboard.admin.summary';

    /**
     * Admin dashboard with real database stats.
     */
    private function adminDashboard()
    {
        $dashboard = Cache::remember(self::DASHBOARD_CACHE_KEY, now()->addMinutes(10), function () {
            $activeBoxes = Box::whereNotIn('status', [BoxStatus::Delivered, BoxStatus::Cancelled])->count();
            $pendingCollections = Booking::where('status', BookingStatus::Pending)->doesntHave('runsheets')->count();
            $batchesInTransit = Batch::where('status', BatchStatus::Sailed)->count();
            $totalSenders = Sender::count();

            $recentBookings = Booking::with(['sender', 'boxes.recipient'])
                ->where('status', '!=', BookingStatus::Draft)
                ->latest()
                ->take(5)
                ->get()
                ->map(fn (Booking $b) => [
                    'id' => $b->id,
                    'reference_number' => $b->reference_number ?? "BK-{$b->id}",
                    'name' => $b->sender
                        ? "{$b->sender->first_name} {$b->sender->last_name}"
                        : 'Unknown',
                    'destination' => $b->destination ?? 'N/A',
                    'date' => $b->created_at->diffForHumans(),
                    'status' => ucfirst($b->status?->value ?? 'pending'),
                ]);

            $todaysRunsheets = Runsheet::with('courier')
                ->withCount('bookings')
                ->whereDate('scheduled_date', today())
                ->get()
                ->map(fn (Runsheet $r) => [
                    'id' => $r->id,
                    'area' => $r->area_description,
                    'driver' => $r->courier ? $r->courier->name : 'Unassigned',
                    'stops' => $r->bookings_count,
                    'status' => ucfirst($r->status?->value ?? 'draft'),
                ]);

            return [
                'stats' => [
                    'activeBoxes' => $activeBoxes,
                    'pendingCollections' => $pendingCollections,
                    'batchesInTransit' => $batchesInTransit,
                    'totalSenders' => $totalSenders,
                ],
                'recentBookings' => $recentBookings,
                'todaysRunsheets' => $todaysRunsheets,
            ];
        });

        // Real-time alerts (no cache)
        $pickupReadyBoxes = Box::where('status', BoxStatus::Pending)
            ->whereHas('booking', function ($q) {
                $q->where('status', BookingStatus::Confirmed)
                    ->whereDoesntHave('runsheets', function ($query) {
                        $query->where('type', RunsheetType::Pickup->value)
                            ->whereIn('status', RunsheetStatus::activeValues());
                    });
            })
            ->count();

        $deliveryReadyBookings = Booking::whereIn('status', [
            BookingStatus::Confirmed,
            BookingStatus::Collected,
            BookingStatus::Shipped,
            BookingStatus::PartiallyDelivered,
        ])
            ->where('payment_status', PaymentStatus::Paid)
            ->whereHas('boxes')
            ->whereHas('undeliveredBoxes')
            ->whereHas('runsheets', function ($query) {
                $query->where('type', RunsheetType::Pickup->value)
                    ->where('status', RunsheetStatus::Completed->value);
            })
            ->whereDoesntHave('runsheets', function ($query) {
                $query->where('type', RunsheetType::Pickup->value)
                    ->whereIn('status', RunsheetStatus::activeValues());
            })
            ->whereDoesntHave('runsheets', function ($query) {
                $query->where('type', RunsheetType::Delivery->value)
                    ->whereIn('status', array_merge(RunsheetStatus::activeValues(), [RunsheetStatus::Completed->value]));
            })
            ->whereDoesntHave('boxes', function ($boxQuery) {
                $boxQuery->whereDoesntHave('updates', function ($updateQuery) {
                    $updateQuery->whereIn('tracking_phase', [
                        'received_manila_warehouse',
                        'sorting',
                        'dispatched_to_local_hub',
                    ])->orWhereHas('milestone', function ($milestoneQuery) {
                        $milestoneQuery->where('is_warehouse_handoff', true);
                    });
                });
            })
            ->count();

        $arrivedBatchesCount = Batch::where('status', BatchStatus::Arrived)->count();
        $unreadEnquiries = Enquiry::where('is_read', false)->count();
        $integrityWarningsCount = DataIntegrityWarning::where('is_resolved', false)->count();

        return Inertia::render('admin/Dashboard', [
            'stats' => $dashboard['stats'],
            'recentBookings' => $dashboard['recentBookings'],
            'todaysRunsheets' => $dashboard['todaysRunsheets'],
            'alerts' => [
                'dispatchReadyBoxes' => $pickupReadyBoxes,
                'deliveryReadyBookings' => $deliveryReadyBookings,
                'arrivedBatches' => $arrivedBatchesCount,
                'unreadEnquiries' => $unreadEnquiries,
                'integrityWarnings' => $integrityWarningsCount,
            ],
        ]);
    }

    public function bookings(Request $request)
    {
        /** @var User $user */
        $user = Auth::user();

        if ($user->role !== Role::Sender) {
            return redirect()->route('dashboard');
        }

        // Sync Stripe payment status if returning from Checkout
        if ($request->has('payment_intent')) {
            $paymentIntentId = $request->query('payment_intent');
            $payment = Payment::where('stripe_payment_intent_id', $paymentIntentId)->first();

            if ($payment && $payment->stripe_status !== 'succeeded') {
                try {
                    Stripe::setApiKey(config('services.stripe.secret'));
                    $intent = PaymentIntent::retrieve($paymentIntentId);

                    if ($intent->status === 'succeeded') {
                        DB::transaction(function () use ($payment, $intent) {
                            $lockedPayment = Payment::where('id', $payment->id)->lockForUpdate()->first();
                            if ($lockedPayment && $lockedPayment->stripe_status !== 'succeeded') {
                                $lockedPayment->update([
                                    'stripe_status' => 'succeeded',
                                    'paid_at' => now(),
                                    'reference_number' => $intent->id,
                                ]);
                            }
                        });
                    }
                } catch (\Exception $e) {
                    Log::error('Stripe sync failed: '.$e->getMessage());
                }
            }
        }

        $sender = $user->sender;
        $search = trim((string) $request->input('search', ''));
        $history = $sender
            ? $sender->bookings()
                ->with(['boxes.recipient.area', 'boxes.boxType', 'boxes.updates', 'invoice'])
                ->when($search !== '', function ($query) use ($search) {
                    $query->where(function ($bookingQuery) use ($search) {
                        $bookingQuery->where('reference_number', 'like', "%{$search}%")
                            ->orWhereHas('boxes', fn ($boxQuery) => $boxQuery->where('tracking_number', 'like', "%{$search}%"));
                    });
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
            : null;

        return Inertia::render('sender/Bookings', [
            'sender' => $sender,
            'history' => $history,
            'filters' => ['search' => $search],
            'pageTitle' => 'My Bookings',
            'breadcrumbs' => [
                ['title' => 'Home', 'href' => route('dashboard')],
                ['title' => 'My Bookings', 'href' => route('sender.bookings')],
            ],
        ]);
    }
}
