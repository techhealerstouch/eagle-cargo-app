<?php

namespace App\Models;

use App\Enums\Feature;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FeatureFlag extends Model
{
    use HasFactory;

    protected $fillable = [
        'feature_key',
        'name',
        'description',
        'status',
        'audiences',
        'maintenance_message',
        'is_system',
        'enabled',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'audiences' => 'array',
            'is_system' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (FeatureFlag $flag) {
            if ($flag->isDirty('enabled') && ! $flag->isDirty('status')) {
                $flag->status = $flag->enabled ? 'released' : 'hidden';
            } elseif ($flag->isDirty('status')) {
                $flag->enabled = ($flag->status === 'released');
            } elseif ($flag->status === 'released' || $flag->enabled) {
                $flag->status = 'released';
                $flag->enabled = true;
            } else {
                $flag->status = $flag->status ?: 'hidden';
                $flag->enabled = false;
            }
        });
    }

    public function isReleased(): bool
    {
        return $this->status === 'released' || (bool) $this->enabled;
    }

    public function isUnderMaintenance(): bool
    {
        return $this->status === 'maintenance';
    }

    public function isHidden(): bool
    {
        return $this->status === 'hidden' || ($this->status === null && ! $this->enabled);
    }

    public function allowsRole(string|\App\Enums\Role|null $role): bool
    {
        if (empty($this->audiences)) {
            return true;
        }

        if (in_array('*', $this->audiences, true)) {
            return true;
        }

        if (! $role) {
            return false;
        }

        $roleVal = $role instanceof \App\Enums\Role ? $role->value : strtolower(str_replace(' ', '_', (string) $role));

        $normalizedAudiences = array_map(function ($aud) {
            return strtolower(str_replace(' ', '_', (string) $aud));
        }, $this->audiences);

        return in_array($roleVal, $normalizedAudiences, true);
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
