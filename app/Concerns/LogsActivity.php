<?php

namespace App\Concerns;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

trait LogsActivity
{
    public static function bootLogsActivity(): void
    {
        static::created(function (Model $model): void {
            $changes = self::filterIgnoredAttributes($model->getAttributes());
            self::logAction($model, 'created', $changes);
        });

        static::updated(function (Model $model): void {
            $changes = [];
            $ignored = self::ignoredActivityAttributes();

            foreach ($model->getDirty() as $key => $newValue) {
                if (in_array($key, $ignored, true)) {
                    continue;
                }

                $oldValue = $model->getOriginal($key);

                // Convert enum values to string
                $old = $oldValue instanceof \BackedEnum ? $oldValue->value : $oldValue;
                $new = $newValue instanceof \BackedEnum ? $newValue->value : $newValue;

                // Only record if values are different
                if ($old !== $new) {
                    $changes[$key] = [
                        'old' => $old,
                        'new' => $new,
                    ];
                }
            }

            if (! empty($changes)) {
                self::logAction($model, 'updated', $changes);
            }
        });

        static::deleted(function (Model $model): void {
            $changes = self::filterIgnoredAttributes($model->getAttributes());
            self::logAction($model, 'deleted', $changes);
        });

        if (in_array(SoftDeletes::class, class_uses_recursive(static::class), true)) {
            static::restored(function (Model $model): void {
                self::logAction($model, 'restored', []);
            });
        }
    }

    protected static function logAction(Model $model, string $action, array $changes): void
    {
        if (! Schema::hasTable('activity_logs')) {
            return;
        }

        $category = method_exists($model, 'activityCategory')
            ? $model->activityCategory()
            : self::resolveCategoryForModel($model);

        $description = method_exists($model, 'activityDescription')
            ? $model->activityDescription($action, $changes)
            : self::generateDefaultDescription($model, $action, $changes);

        $context = app()->runningInConsole()
            ? 'cli'
            : (request()?->is('api/*') ? 'api' : 'web');

        $requestId = app()->bound('request_id')
            ? app('request_id')
            : (request()?->header('X-Request-ID') ?: null);

        $payload = [
            'user_id' => Auth::id(),
            'model_type' => get_class($model),
            'model_id' => (int) $model->getKey(),
            'action' => $action,
            'changes' => ! empty($changes) ? $changes : null,
        ];

        if (Schema::hasColumn('activity_logs', 'request_id')) {
            $payload['request_id'] = $requestId;
        }

        if (Schema::hasColumn('activity_logs', 'description')) {
            $payload['description'] = $description;
            $payload['event_category'] = $category;
            $payload['context'] = $context;
            $payload['ip_address'] = request()?->ip();
            $payload['user_agent'] = request()?->userAgent();
            $payload['impersonator_id'] = session('impersonator_id');
        }

        ActivityLog::create($payload);
    }

    protected static function ignoredActivityAttributes(): array
    {
        return [
            'updated_at',
            'created_at',
            'deleted_at',
            'remember_token',
            'password',
            'two_factor_secret',
            'two_factor_recovery_codes',
            'two_factor_confirmed_at',
            'email_verified_at',
        ];
    }

    protected static function filterIgnoredAttributes(array $attributes): array
    {
        $ignored = self::ignoredActivityAttributes();

        return array_filter(
            $attributes,
            fn ($key) => ! in_array($key, $ignored, true),
            ARRAY_FILTER_USE_KEY
        );
    }

    protected static function resolveCategoryForModel(Model $model): string
    {
        $baseName = class_basename($model);

        return match ($baseName) {
            'Batch', 'Booking', 'Box', 'Runsheet', 'BoxUpdate', 'ShippingUpdate' => 'logistics',
            'Payment', 'Invoice', 'Payout', 'Commission', 'BoxPrice' => 'financial',
            'Setting', 'Area', 'PickupZone', 'Suburb', 'Province', 'BoxType', 'AreaMilestone', 'SerialNumber' => 'settings',
            'User', 'Sender', 'Recipient', 'Picker', 'Courier', 'WarehouseStaff' => 'user',
            'Enquiry' => 'communication',
            default => 'general',
        };
    }

    protected static function generateDefaultDescription(Model $model, string $action, array $changes): string
    {
        $className = Str::headline(class_basename($model));
        $identifier = self::resolveModelIdentifier($model);

        $suffix = $identifier ? " ({$identifier})" : " #{$model->getKey()}";

        if ($action === 'created') {
            return "Created {$className}{$suffix}";
        }

        if ($action === 'deleted') {
            return "Deleted {$className}{$suffix}";
        }

        if ($action === 'restored') {
            return "Restored {$className}{$suffix}";
        }

        if ($action === 'updated') {
            $changedKeys = array_keys($changes);
            $count = count($changedKeys);

            if ($count === 1) {
                $field = Str::headline($changedKeys[0]);

                return "Updated {$field} on {$className}{$suffix}";
            }

            if ($count <= 3) {
                $fields = implode(', ', array_map(fn ($k) => Str::headline($k), $changedKeys));

                return "Updated {$fields} on {$className}{$suffix}";
            }

            return "Updated {$count} fields on {$className}{$suffix}";
        }

        return ucfirst($action)." {$className}{$suffix}";
    }

    protected static function resolveModelIdentifier(Model $model): ?string
    {
        if (isset($model->tracking_number)) {
            return (string) $model->tracking_number;
        }

        if (isset($model->reference_number)) {
            return (string) $model->reference_number;
        }

        if (isset($model->invoice_number)) {
            return (string) $model->invoice_number;
        }

        if (isset($model->name)) {
            return (string) $model->name;
        }

        if (isset($model->batch_number)) {
            return (string) $model->batch_number;
        }

        if (isset($model->serial_number)) {
            return (string) $model->serial_number;
        }

        if (isset($model->key)) {
            return (string) $model->key;
        }

        return null;
    }
}
