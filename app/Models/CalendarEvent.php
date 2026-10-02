<?php

namespace App\Models;

use App\Concerns\LogsActivity;
use App\Concerns\VersionsEntity;
use App\Enums\CalendarEventCategory;
use App\Enums\CalendarEventType;
use App\Enums\CalendarEventVisibility;
use Carbon\Carbon;
use Database\Factories\CalendarEventFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CalendarEvent extends Model
{
    /** @use HasFactory<CalendarEventFactory> */
    use HasFactory, LogsActivity, SoftDeletes, VersionsEntity;

    protected $fillable = [
        'title',
        'description',
        'event_type',
        'category',
        'visibility',
        'start_date',
        'end_date',
        'is_all_day',
        'is_blocking',
        'color_hex',
        'badge_label',
        'location',
        'batch_id',
        'runsheet_id',
        'pickup_zone_id',
        'area_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'event_type' => CalendarEventType::class,
            'category' => CalendarEventCategory::class,
            'visibility' => CalendarEventVisibility::class,
            'start_date' => 'datetime',
            'end_date' => 'datetime',
            'is_all_day' => 'boolean',
            'is_blocking' => 'boolean',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function runsheet(): BelongsTo
    {
        return $this->belongsTo(Runsheet::class);
    }

    public function pickupZone(): BelongsTo
    {
        return $this->belongsTo(PickupZone::class);
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    /**
     * Scope to filter events based on the user's role.
     */
    public function scopeForUser(Builder $query, ?User $user): Builder
    {
        if (! $user) {
            return $query->where('visibility', CalendarEventVisibility::Public->value);
        }

        $role = $user->role instanceof \App\Enums\Role ? $user->role->value : (string) ($user->role ?? 'sender');

        if (in_array($role, ['admin', 'super_admin'], true)) {
            return $query; // Admin sees all visibilities
        }

        if (in_array($role, ['warehouse', 'picker', 'courier'], true)) {
            return $query->whereIn('visibility', [
                CalendarEventVisibility::Public->value,
                CalendarEventVisibility::CustomerOnly->value,
                CalendarEventVisibility::StaffOnly->value,
            ]);
        }

        // Senders & Recipients
        return $query->whereIn('visibility', [
            CalendarEventVisibility::Public->value,
            CalendarEventVisibility::CustomerOnly->value,
        ]);
    }

    /**
     * Scope to query events that overlap with a given date range.
     */
    public function scopeInRange(Builder $query, Carbon|string $start, Carbon|string $end): Builder
    {
        $start = Carbon::parse($start)->startOfDay();
        $end = Carbon::parse($end)->endOfDay();

        return $query->where(function (Builder $q) use ($start, $end) {
            $q->whereBetween('start_date', [$start, $end])
                ->orWhereBetween('end_date', [$start, $end])
                ->orWhere(function (Builder $sub) use ($start, $end) {
                    $sub->where('start_date', '<=', $start)
                        ->where('end_date', '>=', $end);
                });
        });
    }

    /**
     * Scope to find booking blackout/blocking events.
     */
    public function scopeBlocking(Builder $query): Builder
    {
        return $query->where('is_blocking', true);
    }
}
