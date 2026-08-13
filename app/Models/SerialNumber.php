<?php

namespace App\Models;

use App\Enums\SerialNumberStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SerialNumber extends Model
{
    use HasFactory;

    protected $fillable = [
        'serial_number',
        'status',
        'box_id',
        'assigned_by',
        'allocated_at',
    ];

    protected $casts = [
        'status' => SerialNumberStatus::class,
        'allocated_at' => 'datetime',
    ];

    public function box()
    {
        return $this->belongsTo(Box::class);
    }

    public function assignedByUser()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
