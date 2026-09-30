<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Promotion extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'description',
        'type',
        'value',
        'min_box_count',
        'buy_quantity',
        'free_quantity',
        'min_spend',
        'max_discount',
        'max_uses',
        'uses_count',
        'max_uses_per_user',
        'applicable_pickup_zones',
        'applicable_box_types',
        'first_time_sender_only',
        'valid_from',
        'valid_to',
        'is_active',
    ];

    protected $casts = [
        'valid_from' => 'datetime',
        'valid_to' => 'datetime',
        'is_active' => 'boolean',
        'first_time_sender_only' => 'boolean',
        'applicable_pickup_zones' => 'array',
        'applicable_box_types' => 'array',
        'value' => 'decimal:2',
        'min_spend' => 'decimal:2',
        'max_discount' => 'decimal:2',
    ];

    public function redemptions()
    {
        return $this->hasMany(PromotionRedemption::class);
    }
}
