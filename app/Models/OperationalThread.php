<?php

namespace App\Models;

use App\Enums\OperationalMessageCategory;
use App\Enums\OperationalThreadPriority;
use App\Enums\OperationalThreadStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OperationalThread extends Model
{
    use HasFactory;

    protected $fillable = [
        'subject',
        'category',
        'priority',
        'status',
        'picker_id',
        'creator_id',
        'runsheet_id',
        'booking_id',
        'last_message_at',
        'resolved_at',
        'resolved_by',
        'resolution_note',
    ];

    protected $casts = [
        'category' => OperationalMessageCategory::class,
        'status' => OperationalThreadStatus::class,
        'priority' => OperationalThreadPriority::class,
        'last_message_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function picker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'picker_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    /** @return BelongsTo<User, $this> */
    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /** @return BelongsTo<Runsheet, $this> */
    public function runsheet(): BelongsTo
    {
        return $this->belongsTo(Runsheet::class);
    }

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    /** @return HasMany<OperationalMessage, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(OperationalMessage::class, 'thread_id')->orderBy('created_at', 'asc');
    }

    /** @return HasOne<OperationalMessage, $this> */
    public function latestMessage(): HasOne
    {
        return $this->hasOne(OperationalMessage::class, 'thread_id')->latestOfMany();
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', '!=', OperationalThreadStatus::Resolved->value);
    }

    public function scopeForPicker(Builder $query, int $pickerId): Builder
    {
        return $query->where('picker_id', $pickerId);
    }

    public function unreadCountFor(User $user): int
    {
        return $this->messages()
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->count();
    }
}
