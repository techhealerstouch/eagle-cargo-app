<?php

namespace App\Models;

use App\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;

class WarehouseStaff extends Model
{
    use HasFactory, LogsActivity, Notifiable, SoftDeletes;

    protected $table = 'warehouse_staff';

    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'email',
        'mobile',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
