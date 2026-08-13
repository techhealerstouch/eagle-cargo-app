<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\Role;
use App\Enums\CommissionType;
use App\Enums\BookingStatus;
use App\Enums\RunsheetStatus;
use App\Enums\BoxStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Notifications\Notification;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Str;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, TwoFactorAuthenticatable;

    protected $fillable = [
        'custom_id',
        'name',
        'email',
        'password',
        'role',
        'commission_type',
        'commission_rates',
        'stripe_account_id',
        'stripe_onboarding_completed',
        'preferred_payout_method',
        'ewallet_details',
    ];

    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    protected static function booted(): void
    {
        static::creating(function (User $user) {
            if (empty($user->custom_id)) {
                $prefix = 'LBA';
                
                $roleEnum = $user->role instanceof Role 
                    ? $user->role 
                    : (is_string($user->role) ? Role::tryFrom($user->role) : null);

                if ($roleEnum) {
                    $prefix = match ($roleEnum) {
                        Role::SuperAdmin => 'SA',
                        Role::Admin => 'AD',
                        Role::Courier => 'CR',
                        Role::Picker => 'PK',
                        Role::Warehouse => 'WH',
                        Role::Sender => 'SD',
                        Role::Recipient => 'RC',
                        default => 'LBA',
                    };
                }

                do {
                    $customId = $prefix . '-' . strtoupper(Str::random(6));
                    $exists = static::where('custom_id', $customId)->exists();
                } while ($exists);

                $user->custom_id = $customId;
            }
        });

        static::saving(function (User $user) {
            $roleEnum = $user->role instanceof Role 
                ? $user->role 
                : (is_string($user->role) ? Role::tryFrom($user->role) : null);

            if (empty($user->email_verified_at) && in_array($roleEnum, [Role::SuperAdmin, Role::Admin])) {
                $user->email_verified_at = now();
            }
        });
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'role' => Role::class, // Adjust depending on if Role Enum is castable directly
            'commission_type' => CommissionType::class,
            'commission_rates' => 'array',
            'ewallet_details' => 'array',
        ];
    }

    public function sender()
    {
        return $this->hasOne(Sender::class);
    }

    public function recipient()
    {
        return $this->hasOne(Recipient::class);
    }

    public function courier()
    {
        return $this->hasOne(Courier::class);
    }

    public function picker()
    {
        return $this->hasOne(Picker::class);
    }

    public function warehouseStaff()
    {
        return $this->hasOne(WarehouseStaff::class);
    }

    public function pickerRunsheets()
    {
        return $this->hasMany(Runsheet::class, 'picker_id');
    }

    public function courierRunsheets()
    {
        return $this->hasMany(Runsheet::class, 'courier_id');
    }

    public function notificationPreferences()
    {
        return $this->hasMany(NotificationPreference::class);
    }

    public function activityLogs()
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function commissions()
    {
        return $this->hasMany(Commission::class, 'picker_id');
    }

    public function payouts()
    {
        return $this->hasMany(Payout::class, 'picker_id');
    }

    /**
     * Route notifications for the Brevo SMS channel.
     */
    public function routeNotificationForBrevo(Notification $notification): ?string
    {
        return $this->sender?->mobile;
    }

    public function hasActiveTransactions(): bool
    {
        if ($this->sender) {
            $activeBookingsCount = Booking::where('sender_id', $this->sender->id)
                ->whereNotIn('status', [BookingStatus::Delivered->value, BookingStatus::Cancelled->value])
                ->count();
            if ($activeBookingsCount > 0) {
                return true;
            }
        }

        $activeRunsheetStatuses = RunsheetStatus::activeValues();

        if ($this->picker) {
            $activeRunsheets = Runsheet::where('picker_id', $this->id)
                ->whereIn('status', $activeRunsheetStatuses)
                ->count();
            if ($activeRunsheets > 0) {
                return true;
            }
        }

        if ($this->courier) {
            $activeRunsheets = Runsheet::where('courier_id', $this->id)
                ->whereIn('status', $activeRunsheetStatuses)
                ->count();
            if ($activeRunsheets > 0) {
                return true;
            }
        }
        
        if ($this->recipient) {
            $activeBoxesCount = Box::where('recipient_id', $this->recipient->id)
                ->whereNotIn('status', [BoxStatus::Delivered->value, BoxStatus::Cancelled->value])
                ->count();
            if ($activeBoxesCount > 0) {
                return true;
            }
        }

        return false;
    }
}
