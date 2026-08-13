<?php

namespace App\Concerns;

use App\Models\EntityVersion;
use App\Services\EntityVersionService;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;

trait VersionsEntity
{
    public static function bootVersionsEntity(): void
    {
        static::created(function ($model): void {
            static::captureVersion($model, 'created');
        });

        static::updated(function ($model): void {
            static::captureVersion($model, 'updated');
        });

        static::deleted(function ($model): void {
            static::captureVersion($model, 'deleted');
        });

        if (in_array(SoftDeletes::class, class_uses_recursive(static::class), true)) {
            static::restored(function ($model): void {
                static::captureVersion($model, 'restored');
            });
        }
    }

    public function entityVersions()
    {
        return $this->morphMany(EntityVersion::class, 'entity');
    }

    protected static function captureVersion($model, string $reason): void
    {
        if (! Schema::hasTable('entity_versions')) {
            return;
        }

        $context = method_exists($model, 'versioningContext') ? $model->versioningContext() : null;
        app(EntityVersionService::class)->capture($model, $reason, $context);
    }
}
