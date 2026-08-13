<?php

namespace App\Http\Middleware;

use App\Services\SettingsService;
use Illuminate\Http\Request;
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
            'tracking_steps' => app(\App\Services\TrackingStepService::class)->getSteps(),
            'locale' => app()->getLocale(),
            'translations' => [
                'ui' => Lang::get('ui'),
                'messages' => Lang::get('messages'),
                'statuses' => Lang::get('statuses'),
                'emails' => Lang::get('emails'),
            ],
            'auth' => [
                'user' => $request->user(),
                'impersonator_id' => $request->session()->get('impersonator_id'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'sidebarCounts' => function () use ($request) {
                $user = $request->user();
                if (! $user) {
                    return null;
                }

                return \Illuminate\Support\Facades\Cache::remember("user.{$user->id}.sidebar_counts", now()->addSeconds(15), function () use ($user) {
                    $role = $user->role instanceof \BackedEnum ? $user->role->value : $user->role;
                    $isAdmin = in_array($role, ['super_admin', 'admin']);

                    if ($isAdmin) {
                        return [
                            'bookings' => \App\Models\Booking::where('status', \App\Enums\BookingStatus::Pending->value)->where('is_read', false)->count(),
                            'payments' => \App\Models\Booking::where('payment_status', \App\Enums\PaymentStatus::Pending->value)->whereNotNull('proof_of_payment')->where('is_payment_read', false)->count() + \App\Models\Payment::where('is_cash_payment', true)->whereNotNull('paid_at')->whereNull('confirmed_at')->where('is_read', false)->count(),
                            'enquiries' => \App\Models\Enquiry::where('is_read', false)->count(),
                            'batches' => \App\Models\Batch::where('status', \App\Enums\BatchStatus::Arrived->value)->where('is_read', false)->count(),
                            'systemHealth' => \App\Models\DataIntegrityWarning::where('is_resolved', false)->count(),
                        ];
                    }

                    if ($role === 'sender') {
                        $sender = $user->sender;
                        if (! $sender) {
                            return ['myBookings' => 0];
                        }

                        $actionNeededCount = $sender->bookings()
                            ->whereNotIn('status', [\App\Enums\BookingStatus::Draft->value, \App\Enums\BookingStatus::Cancelled->value])
                            ->where(function ($q) {
                                $q->where('payment_status', \App\Enums\PaymentStatus::Pending->value)
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
        ];
    }
}
