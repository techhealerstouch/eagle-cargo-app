<?php

namespace App\Models;

use App\Enums\TrackingPhase;
use Illuminate\Database\Eloquent\Model;

class BoxUpdate extends Model
{
    protected $fillable = [
        'client_uuid',
        'box_id',
        'area_milestone_id',
        'status',
        'tracking_step_key',
        'location',
        'description',
        'tracking_phase',
        'updated_by',
        'is_admin_override',
        'steps_bypassed',
        'created_at',
    ];

    protected $casts = [
        'tracking_phase' => TrackingPhase::class,
        'is_admin_override' => 'boolean',
        'steps_bypassed' => 'integer',
    ];

    public function box()
    {
        return $this->belongsTo(Box::class);
    }

    public function milestone()
    {
        return $this->belongsTo(AreaMilestone::class, 'area_milestone_id');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
