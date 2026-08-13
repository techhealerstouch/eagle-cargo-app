<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class TrackingLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'trackable_type',
        'trackable_id',
        'search_query',
        'ip_address',
        'user_agent',
        'source',
    ];

    /**
     * Get the parent trackable model (Booking or Box).
     */
    public function trackable(): MorphTo
    {
        return $this->morphTo();
    }
}
