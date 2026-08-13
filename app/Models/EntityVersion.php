<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EntityVersion extends Model
{
    protected $fillable = [
        'entity_type',
        'entity_id',
        'version_number',
        'reason',
        'context_type',
        'context_id',
        'created_by',
        'snapshot',
    ];

    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
        ];
    }

    public function entity()
    {
        return $this->morphTo();
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
