<?php

namespace App\Concerns;

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Auth;

trait LogsActivity
{
    public static function bootLogsActivity(): void
    {
        static::created(function ($model) {
            self::logAction($model, 'created', $model->getAttributes());
        });

        static::updated(function ($model) {
            $changes = [];
            foreach ($model->getDirty() as $key => $newValue) {
                $oldValue = $model->getOriginal($key);
                // Convert enum values to their string representation for logging
                $changes[$key] = [
                    'old' => $oldValue instanceof \BackedEnum ? $oldValue->value : $oldValue,
                    'new' => $newValue instanceof \BackedEnum ? $newValue->value : $newValue,
                ];
            }
            if (! empty($changes)) {
                self::logAction($model, 'updated', $changes);
            }
        });

        static::deleted(function ($model) {
            self::logAction($model, 'deleted', $model->getAttributes());
        });
    }

    protected static function logAction($model, string $action, array $changes): void
    {
        ActivityLog::create([
            'user_id' => Auth::id(),
            'model_type' => get_class($model),
            'model_id' => $model->id,
            'action' => $action,
            'changes' => $changes,
        ]);
    }
}
