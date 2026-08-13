<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payout extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'picker_id',
        'total_amount',
        'payout_method',
        'payout_provider',
        'reference_number',
        'notes',
        'processed_by',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function picker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'picker_id');
    }

    public function processedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function commissions(): HasMany
    {
        return $this->hasMany(Commission::class);
    }
}
