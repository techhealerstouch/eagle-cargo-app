<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Suburb extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'postcode',
        'pickup_zone_id',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::saved(function () {
            \Illuminate\Support\Facades\Cache::forget('reference.suburbs.active');
        });

        static::deleted(function () {
            \Illuminate\Support\Facades\Cache::forget('reference.suburbs.active');
        });
    }

    public function pickupZone(): BelongsTo
    {
        return $this->belongsTo(PickupZone::class);
    }
}
