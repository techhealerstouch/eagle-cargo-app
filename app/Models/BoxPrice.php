<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BoxPrice extends Model
{
    use HasFactory;

    protected $fillable = ['pickup_zone_id', 'area_id', 'box_type_id', 'price'];

    protected $casts = [
        'price' => 'decimal:2',
    ];

    public function area()
    {
        return $this->belongsTo(Area::class);
    }

    public function boxType()
    {
        return $this->belongsTo(BoxType::class)->withTrashed();
    }

    public function pickupZone()
    {
        return $this->belongsTo(PickupZone::class);
    }
}
