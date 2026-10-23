<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PickupNote extends Model
{
    use HasFactory;

    protected $fillable = [
        'runsheet_id',
        'booking_id',
        'picker_id',
        'note',
    ];

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

    /** @return BelongsTo<User, $this> */
    public function picker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'picker_id');
    }
}
