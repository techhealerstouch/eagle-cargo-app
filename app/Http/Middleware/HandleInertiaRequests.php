<?php

namespace App\Http\Middleware;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\Feature;
use App\Enums\PaymentStatus;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\DataIntegrityWarning;
use App\Models\Enquiry;
use App\Models\Payment;
use App\Services\SettingsService;
use App\Services\DeveloperAccess;
use App\Services\FeatureAccess;
use App\Services\TrackingStepService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Lang;
use Inertia\Middleware;
use Symfony\Component\HttpFoundation\Response;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Handle the incoming request.
     *
     * Skip Inertia processing for Livewire routes (if any).
     */
    public function handle(Request $request, \Closure $next): Response
    {
        if ($request->is('livewire/*')) {
            return $next($request);
        }

        if ($request->isMethod('GET') && $request->route()) {
            $routeName = $request->route()->getName() ?? '';
            if (str_starts_with($routeName, 'admin.') && (str_ends_with($routeName, '.index') || in_array($routeName, ['admin.runsheets.pickups', 'admin.runsheets.deliveries', 'admin.runsheets.pickups.calendar', 'admin.runsheets.deliveries.calendar']))) {
                $request->session()->put("admin_return_urls.{$routeName}", $request->fullUrl());
                $request->session()->put('admin_return_url', $request->fullUrl());
            }
        }

        $user = $request->user();
        if ($user && ! $user->hasVerifiedEmail()) {
            $roleVal = $user->role instanceof \App\Enums\Role ? $user->role->value : (string) $user->role;
            if (in_array($roleVal, ['courier', 'picker', 'warehouse', 'admin', 'super_admin'])) {
                $user->forceFill(['email_verified_at' => now()])->save();
            }
        }

        return parent::handle($request, $next);
    }

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $settingsService = app(SettingsService::class);

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'isLocal' => app()->environment('local'),
            'settings' => $settingsService->getGeneralSettings(),
            'logistics' => $settingsService->getLogisticsSettings(),
            'tracking_steps' => app(TrackingStepService::class)->getSteps(),
            'locale' => app()->getLocale(),
            'translations' => [
                'ui' => Lang::get('ui'),
                'messages' => Lang::get('messages'),
                'statuses' => Lang::get('statuses'),
                'emails' => Lang::get('emails'),
            ],
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'role' => $request->user()->role?->value,
                    'email_verified_at' => $request->user()->email_verified_at?->toISOString(),
                ] : null,
                'can' => function () use ($request) {
                    $featureAccess = app(FeatureAccess::class);
                    $flags = \App\Models\FeatureFlag::all()->keyBy('feature_key');
                    $enumKeys = collect(Feature::cases())->map(fn (Feature $f) => $f->value);
                    $allKeys = $flags->keys()->merge($enumKeys)->unique();

                    return [
                        'developerMode' => app(DeveloperAccess::class)->isDeveloper($request->user()) || (bool) $request->session()->get('impersonated_by_developer'),
                        'developerPreview' => (bool) $request->session()->get('developer_preview_mode', true),
                        'impersonatedByDeveloper' => (bool) $request->session()->get('impersonated_by_developer'),
                        'features' => $allKeys->mapWithKeys(fn (string $key) => [
                            $key => $featureAccess->canAccess($request->user(), $key),
                        ])->all(),
                        'featureDetails' => $allKeys->mapWithKeys(function (string $key) use ($flags, $featureAccess, $request) {
                            $flag = $flags->get($key);
                            return [
                                $key => [
                                    'enabled' => $featureAccess->canAccess($request->user(), $key),
                                    'status' => $flag?->status ?? ($flag?->enabled ? 'released' : 'hidden'),
                                    'maintenance_message' => $flag?->maintenance_message,
                                ],
                            ];
                        })->all(),
                    ];
                },
                'impersonator_id' => $request->session()->get('impersonator_id'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'sidebarCounts' => function () use ($request) {
                $user = $request->user();
                if (! $user) {
                    return null;
                }

                return Cache::remember("user.{$user->id}.sidebar_counts", now()->addSeconds(15), function () use ($user) {
                    $role = $user->role instanceof \BackedEnum ? $user->role->value : $user->role;
                    $isAdmin = in_array($role, ['super_admin', 'admin']);

                    if ($isAdmin) {
                        return [
                            'bookings' => Booking::where('status', BookingStatus::Pending->value)->where('is_read', false)->count(),
                            'payments' => Booking::where('payment_status', PaymentStatus::Pending->value)->whereNotNull('proof_of_payment')->where('is_payment_read', false)->count() + Payment::where('is_cash_payment', true)->whereNotNull('paid_at')->whereNull('confirmed_at')->where('is_read', false)->count(),
                            'enquiries' => Enquiry::where('is_read', false)->count(),
                            'batches' => Batch::where('status', BatchStatus::Arrived->value)->where('is_read', false)->count(),
                            'systemHealth' => DataIntegrityWarning::where('is_resolved', false)->count(),
                        ];
                    }

                    if ($role === 'sender') {
                        $sender = $user->sender;
                        if (! $sender) {
                            return ['myBookings' => 0];
                        }

                        $actionNeededCount = $sender->bookings()
                            ->whereNotIn('status', [BookingStatus::Draft->value, BookingStatus::Cancelled->value])
                            ->where(function ($q) {
                                $q->where('payment_status', PaymentStatus::Pending->value)
                                    ->orWhere(function ($sq) {
                                        $sq->whereNull('declaration_data')
                                            ->whereNull('declaration_form_path');
                                    });
                            })
                            ->count();

                        return [
                            'myBookings' => $actionNeededCount,
                        ];
                    }

                    return null;
                });
            },
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
                'runsheet' => fn () => $request->session()->get('runsheet'),
                'payment_override' => fn () => $request->session()->get('payment_override'),
            ],
            'admin_return_url' => function () use ($request) {
                $route = $request->route()?->getName() ?? '';
                $resourceIndexMap = [
                    'boxes' => 'admin.boxes.index',
                    'bookings' => 'admin.bookings.index',
                    'senders' => 'admin.senders.index',
                    'recipients' => 'admin.recipients.index',
                    'invoices' => 'admin.invoices.index',
                    'users' => 'admin.users.index',
                    'batches' => 'admin.batches.index',
                    'payments' => 'admin.payments.index',
                    'enquiries' => 'admin.enquiries.index',
                    'shipping-updates' => 'admin.shipping-updates.index',
                    'box-types' => 'admin.box-types.index',
                    'serial-numbers' => 'admin.serial-numbers.index',
                ];

                foreach ($resourceIndexMap as $resource => $indexRoute) {
                    if (str_starts_with($route, "admin.{$resource}.")) {
                        return $request->session()->get("admin_return_urls.{$indexRoute}")
                            ?? (\Illuminate\Support\Facades\Route::has($indexRoute) ? route($indexRoute) : null);
                    }
                }

                if (str_starts_with($route, 'admin.runsheets.')) {
                    $runsheet = $request->route('runsheet');
                    if ($runsheet) {
                        $type = is_object($runsheet) && isset($runsheet->type) ? $runsheet->type : null;
                        $isDelivery = ($type instanceof \App\Enums\RunsheetType && $type === \App\Enums\RunsheetType::Delivery)
                            || $type === 'delivery'
                            || (is_string($type) && strtolower($type) === 'delivery');
                        $targetRoute = $isDelivery ? 'admin.runsheets.deliveries' : 'admin.runsheets.pickups';
                        return $request->session()->get("admin_return_urls.{$targetRoute}")
                            ?? (\Illuminate\Support\Facades\Route::has($targetRoute) ? route($targetRoute) : null);
                    }
                    return $request->session()->get('admin_return_urls.admin.runsheets.pickups')
                        ?? (\Illuminate\Support\Facades\Route::has('admin.runsheets.pickups') ? route('admin.runsheets.pickups') : null);
                }

                return $request->session()->get('admin_return_url');
            },
        ];
    }
}
