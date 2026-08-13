<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Area extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'description', 'door_to_door_fee', 'is_active'];

    protected $casts = [
        'door_to_door_fee' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function milestones()
    {
        return $this->hasMany(AreaMilestone::class)->orderBy('sequence_order');
    }

    public function prices()
    {
        return $this->hasMany(BoxPrice::class);
    }

    public function recipients()
    {
        return $this->hasMany(Recipient::class);
    }

    public function provinces()
    {
        return $this->hasMany(Province::class);
    }
}
