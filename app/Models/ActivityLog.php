<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class ActivityLog extends Model
{
    protected $fillable = [
        'request_id',
        'user_id',
        'impersonator_id',
        'model_type',
        'model_id',
        'action',
        'description',
        'event_category',
        'context',
        'ip_address',
        'user_agent',
        'changes',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function impersonator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'impersonator_id')->withTrashed();
    }

    public function subject(): MorphTo
    {
        return $this->morphTo('model');
    }

    public function scopeSearch(Builder $query, ?string $search): Builder
    {
        if (blank($search)) {
            return $query;
        }

        return $query->where(function (Builder $nested) use ($search) {
            $nested->where('description', 'like', "%{$search}%")
                ->orWhere('action', 'like', "%{$search}%")
                ->orWhere('ip_address', 'like', "%{$search}%")
                ->orWhere('model_type', 'like', "%{$search}%")
                ->orWhere('model_id', $search)
                ->orWhereHas('user', function (Builder $userQuery) use ($search) {
                    $userQuery->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
        });
    }

    public function scopeCategory(Builder $query, ?string $category): Builder
    {
        if (blank($category) || $category === 'all') {
            return $query;
        }

        return $query->where('event_category', $category);
    }

    public function scopeAction(Builder $query, ?string $action): Builder
    {
        if (blank($action) || $action === 'all') {
            return $query;
        }

        return $query->where('action', $action);
    }

    public function scopeModelType(Builder $query, ?string $modelType): Builder
    {
        if (blank($modelType) || $modelType === 'all') {
            return $query;
        }

        return $query->where('model_type', $modelType);
    }

    public function scopeUserId(Builder $query, ?int $userId): Builder
    {
        if (blank($userId)) {
            return $query;
        }

        return $query->where('user_id', $userId);
    }

    public function scopeDateRange(Builder $query, ?string $startDate, ?string $endDate): Builder
    {
        if (! empty($startDate)) {
            $query->whereDate('created_at', '>=', $startDate);
        }

        if (! empty($endDate)) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        return $query;
    }

    public function scopeRequestId(Builder $query, ?string $requestId): Builder
    {
        if (blank($requestId)) {
            return $query;
        }

        return $query->where('request_id', $requestId);
    }
}
