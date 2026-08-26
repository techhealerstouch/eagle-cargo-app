<?php

namespace App\Models;

use App\Concerns\LogsActivity;
use App\Concerns\VersionsEntity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use Illuminate\Notifications\Notification;

class Sender extends Model
{
    use HasFactory, LogsActivity, Notifiable, SoftDeletes, VersionsEntity;

    protected static function booted(): void
    {
        static::forceDeleting(function (Sender $sender) {
            if ($sender->bookings()->withTrashed()->exists()) {
                throw new \LogicException(
                    "Cannot force-delete Sender #{$sender->id}: related bookings exist. "
                    .'Remove or reassign all bookings first to prevent cascading data loss.'
                );
            }
        });
    }

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'country',
        'mobile',
        'secondary_mobile',
        'address',
        'suburb',
        'state',
        'postcode',
        'latitude',
        'longitude',
        'user_id',
        'pickup_zone_id',
        'zoho_contact_id',
    ];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function pickupZone()
    {
        return $this->belongsTo(PickupZone::class);
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }

    public function recipients()
    {
        return $this->hasMany(Recipient::class);
    }

    /**
     * Route notifications for the Brevo SMS channel.
     */
    public function routeNotificationForBrevo(Notification $notification): ?string
    {
        return $this->mobile;
    }
}
