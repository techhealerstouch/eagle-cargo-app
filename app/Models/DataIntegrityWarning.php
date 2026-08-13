<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DataIntegrityWarning extends Model
{
    protected $fillable = [
        'type',
        'severity',
        'record_type',
        'record_id',
        'message',
        'is_resolved',
        'resolved_at',
        'metadata',
    ];

    protected $casts = [
        'is_resolved' => 'boolean',
        'resolved_at' => 'datetime',
        'metadata' => 'array',
    ];

    /**
     * The "booted" method of the model.
     */
    protected static function booted(): void
    {
        static::created(function ($warning) {
            broadcast(new \App\Events\SystemHealthUpdated());
        });

        static::updated(function ($warning) {
            broadcast(new \App\Events\SystemHealthUpdated());
        });

        static::deleted(function ($warning) {
            broadcast(new \App\Events\SystemHealthUpdated());
        });
    }

    /**
     * Get the associated record (Booking, Box, etc.)
     */
    public function record()
    {
        return $this->morphTo();
    }
}
