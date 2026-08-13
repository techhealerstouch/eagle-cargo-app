<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AreaMilestone extends Model
{
    use SoftDeletes;

    protected $fillable = ['area_id', 'name', 'location', 'sequence_order', 'is_final_delivery', 'is_warehouse_handoff'];

    protected $casts = [
        'is_final_delivery' => 'boolean',
        'is_warehouse_handoff' => 'boolean',
    ];

    public function area()
    {
        return $this->belongsTo(Area::class);
    }
}
