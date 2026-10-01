<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GuestBookingAccessChallenge extends Model
{
    protected $fillable = [
        'booking_id',
        'purpose',
        'code_hash',
        'expires_at',
        'verified_at',
        'consumed_at',
        'attempts',
        'revoked_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'verified_at' => 'datetime',
        'consumed_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query
            ->whereNull('revoked_at')
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now());
    }
}
