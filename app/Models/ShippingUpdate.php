<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShippingUpdate extends Model
{
    protected $fillable = [
        'type',
        'title',
        'body',
        'is_published',
        'published_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
