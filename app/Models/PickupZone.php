<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PickupZone extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'description',
        'is_active',
        'pickup_windows',
        'blackout_dates',
        'lead_time_days',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'pickup_windows' => 'array',
        'blackout_dates' => 'array',
        'lead_time_days' => 'integer',
    ];

    public function boxPrices()
    {
        return $this->hasMany(BoxPrice::class);
    }

    public function suburbs()
    {
        return $this->hasMany(Suburb::class);
    }

    public function senders()
    {
        return $this->hasMany(Sender::class);
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }

    public function pickers()
    {
        return $this->hasMany(Picker::class);
    }
}
