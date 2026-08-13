<?php

namespace App\Models;

use App\Enums\NotificationChannel;
use App\Enums\NotificationEvent;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationPreference extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'channel',
        'event_type',
        'enabled',
    ];

    protected function casts(): array
    {
        return [
            'channel' => NotificationChannel::class,
            'event_type' => NotificationEvent::class,
            'enabled' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
