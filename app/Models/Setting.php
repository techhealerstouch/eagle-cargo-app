<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'type',
        'group',
        'display_name',
    ];

    /**
     * Cast the setting value based on its type.
     */
    public function getValueAttribute($value)
    {
        return match ($this->type) {
            'int' => (int) $value,
            'bool' => $value === '1' || $value === 'true',
            'json' => json_decode($value ?? '[]', true),
            default => $value,
        };
    }
}
