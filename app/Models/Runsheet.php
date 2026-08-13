<?php

namespace App\Models;

use App\Concerns\NormalizesNotes;
use App\Concerns\VersionsEntity;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Runsheet extends Model
{
    use HasFactory, NormalizesNotes, SoftDeletes, VersionsEntity;

    protected $fillable = [
        'courier_id',
        'picker_id',
        'scheduled_date',
        'timeslot',
        'area_description',
        'status',
        'type',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'datetime',
            'status' => RunsheetStatus::class,
            'type' => RunsheetType::class,
        ];
    }

    public function courier()
    {
        return $this->belongsTo(User::class, 'courier_id');
    }

    public function picker()
    {
        return $this->belongsTo(User::class, 'picker_id');
    }

    public function bookings()
    {
        return $this->belongsToMany(Booking::class)
            ->withPivot('sequence')
            ->withTimestamps()
            ->orderByPivot('sequence')
            ->orderBy('bookings.created_at')
            ->orderBy('bookings.id');
    }
    public function boxes()
    {
        return $this->belongsToMany(Box::class, 'box_runsheet')
            ->withPivot('sequence')
            ->withTimestamps()
            ->orderByPivot('sequence')
            ->orderBy('boxes.created_at')
            ->orderBy('boxes.id');
    }
}
