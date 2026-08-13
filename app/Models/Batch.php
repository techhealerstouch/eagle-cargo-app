<?php

namespace App\Models;

use App\Concerns\LogsActivity;
use App\Concerns\VersionsEntity;
use App\Enums\BatchStatus;
use Database\Factories\BatchFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Batch extends Model
{
    /** @use HasFactory<BatchFactory> */
    use HasFactory, LogsActivity, VersionsEntity;

    protected $fillable = [
        'batch_number',
        'branch_name',
        'container_number',
        'seal_number',
        'container_size',
        'vessel_name',
        'shipping_line',
        'voyage_number',
        'origin_port',
        'destination_port',
        'capacity_boxes',
        'capacity_weight_kg',
        'capacity_cbm',
        'current_box_count',
        'current_weight_kg',
        'current_cbm',
        'cutoff_at',
        'closed_at',
        'sailed_at',
        'departed_at',
        'eta_at',
        'arrived_at',
        'delivered_at',
        'status',
    ];

    protected $casts = [
        'capacity_boxes' => 'integer',
        'capacity_weight_kg' => 'decimal:2',
        'capacity_cbm' => 'decimal:3',
        'current_box_count' => 'integer',
        'current_weight_kg' => 'decimal:2',
        'current_cbm' => 'decimal:3',
        'cutoff_at' => 'datetime',
        'closed_at' => 'datetime',
        'sailed_at' => 'datetime',
        'departed_at' => 'datetime',
        'eta_at' => 'datetime',
        'arrived_at' => 'datetime',
        'delivered_at' => 'datetime',
        'status' => BatchStatus::class,
    ];

    public function boxes()
    {
        return $this->hasMany(Box::class);
    }
}
