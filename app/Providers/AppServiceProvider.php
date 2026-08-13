<?php

namespace App\Providers;

use App\Enums\Role;
use App\Models\Area;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\ShippingUpdate;
use App\Models\User;
use App\Jobs\AuditDataIntegrityJob;
use App\Observers\BatchObserver;
use App\Observers\BookingObserver;
use App\Observers\BoxObserver;
use App\Observers\DatabaseNotificationObserver;
use App\Observers\InvoiceObserver;
use App\Observers\PaymentObserver;
use App\Observers\RecipientObserver;
use App\Observers\ReferenceDataObserver;
use App\Observers\RunsheetObserver;
use App\Observers\ShippingUpdateObserver;
use App\Observers\UserObserver;
use App\Policies\AdminPolicy;
use App\Repositories\Contracts\BatchRepositoryInterface;
use App\Repositories\Contracts\BookingRepositoryInterface;
use App\Repositories\Contracts\BoxRepositoryInterface;
use App\Repositories\Contracts\NotificationPreferenceRepositoryInterface;
use App\Repositories\Contracts\TrackingRepositoryInterface;
use App\Repositories\Eloquent\BatchRepository;
use App\Repositories\Eloquent\BookingRepository;
use App\Repositories\Eloquent\BoxRepository;
use App\Repositories\Eloquent\NotificationPreferenceRepository;
use App\Repositories\Eloquent\TrackingRepository;
use App\Services\SettingsService;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use App\Notifications\Channels\BrevoSmsChannel;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            BookingRepositoryInterface::class,
            BookingRepository::class,
        );
        $this->app->bind(
            TrackingRepositoryInterface::class,
            TrackingRepository::class,
        );
        $this->app->bind(
            BoxRepositoryInterface::class,
            BoxRepository::class,
        );
        $this->app->bind(
            BatchRepositoryInterface::class,
            BatchRepository::class,
        );
        $this->app->bind(
            NotificationPreferenceRepositoryInterface::class,
            NotificationPreferenceRepository::class,
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureRateLimiting();

        // Register custom Brevo SMS notification channel
        Notification::extend('brevo', function ($app) {
            return new BrevoSmsChannel();
        });

        // Override configuration dynamically from settings
        if (! app()->runningUnitTests()) {
            try {
                $settingsService = app(SettingsService::class);
                $appName = $settingsService->get('app_name');
                if ($appName) {
                    config(['app.name' => $appName]);
                    config(['mail.from.name' => $appName]);
                }
            } catch (\Throwable $e) {
                // Silence errors if settings table doesn't exist yet (e.g. during migrations/seeding)
            }
        }

        Booking::observe(BookingObserver::class);
        Batch::observe(BatchObserver::class);
        Box::observe(BoxObserver::class);
        Invoice::observe(InvoiceObserver::class);
        Payment::observe(PaymentObserver::class);
        Runsheet::observe(RunsheetObserver::class);
        User::observe(UserObserver::class);
        Area::observe(ReferenceDataObserver::class);
        BoxType::observe(ReferenceDataObserver::class);
        BoxPrice::observe(ReferenceDataObserver::class);
        ShippingUpdate::observe(ShippingUpdateObserver::class);
        DatabaseNotification::observe(DatabaseNotificationObserver::class);
        Recipient::observe(RecipientObserver::class);

        // Trigger real-time data integrity audits on key model changes
        $auditModels = [
            Booking::class,
            Batch::class,
            Box::class,
            Invoice::class,
            Payment::class,
            Runsheet::class,
        ];

        foreach ($auditModels as $model) {
            $model::saved(fn () => AuditDataIntegrityJob::dispatch());
            $model::deleted(fn () => AuditDataIntegrityJob::dispatch());
        }

        Gate::define('access-admin', function (User $user) {
            return in_array($user->role, [Role::SuperAdmin, Role::Admin]);
        });

        Gate::define('access-warehouse', function (User $user) {
            return in_array($user->role, [Role::SuperAdmin, Role::Admin, Role::Warehouse]);
        });

        Gate::define('viewPulse', function (User $user) {
            return $user->role === Role::SuperAdmin;
        });

        Gate::guessPolicyNamesUsing(function (string $modelClass) {
            $class = class_basename($modelClass);
            $policy = 'App\\Policies\\'.$class.'Policy';
            if (class_exists($policy)) {
                return $policy;
            }

            return AdminPolicy::class;
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    /**
     * Centralized request limits keep high-volume endpoints predictable.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', fn (Request $request): Limit => Limit::perMinute(120)
            ->by($this->rateLimitKey($request)));

        RateLimiter::for('public-tracking', function (Request $request): array {
            $identifier = (string) ($request->route('tracking_number')
                ?? $request->input('tracking_number')
                ?? $request->input('ref')
                ?? '');

            $limits = [
                Limit::perMinute(60)->by('tracking-ip:'.$request->ip()),
            ];

            if ($identifier !== '') {
                $limits[] = Limit::perMinute(20)
                    ->by('tracking-number:'.sha1(strtolower(trim($identifier))));
            }

            return $limits;
        });

        RateLimiter::for('forms', fn (Request $request): Limit => Limit::perMinute(20)
            ->by($this->rateLimitKey($request)));

        RateLimiter::for('booking-writes', fn (Request $request): Limit => Limit::perMinute(40)
            ->by($this->rateLimitKey($request)));

        RateLimiter::for('payments', fn (Request $request): Limit => Limit::perMinute(20)
            ->by($this->rateLimitKey($request)));

        RateLimiter::for('uploads', fn (Request $request): Limit => Limit::perMinute(10)
            ->by($this->rateLimitKey($request)));

        RateLimiter::for('ops-scan', fn (Request $request): Limit => Limit::perMinute(120)
            ->by($this->rateLimitKey($request)));

        RateLimiter::for('admin-mutations', fn (Request $request): Limit => Limit::perMinute(80)
            ->by($this->rateLimitKey($request)));
    }

    private function rateLimitKey(Request $request): string
    {
        return $request->user()?->getAuthIdentifier()
            ? 'user:'.$request->user()->getAuthIdentifier()
            : 'ip:'.$request->ip();
    }
}
