<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GeneratedReport extends Model
{
    protected $fillable = [
        'type',
        'filename',
        'parameters',
        'user_id',
    ];

    protected $casts = [
        'parameters' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
