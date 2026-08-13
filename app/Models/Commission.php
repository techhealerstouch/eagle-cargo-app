<?php

namespace App\Models;

use App\Enums\CommissionStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Commission extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'picker_id',
        'box_id',
        'payout_id',
        'amount',
        'status',
        'distance_km',
        'type',
        'breakdown',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'status' => CommissionStatus::class,
            'breakdown' => 'array',
        ];
    }

    public function picker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'picker_id');
    }

    public function box(): BelongsTo
    {
        return $this->belongsTo(Box::class);
    }

    public function payout(): BelongsTo
    {
        return $this->belongsTo(Payout::class);
    }
}
