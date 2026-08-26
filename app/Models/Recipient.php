<?php

namespace App\Models;

use App\Concerns\LogsActivity;
use App\Concerns\VersionsEntity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Recipient extends Model
{
    use HasFactory, LogsActivity, SoftDeletes, VersionsEntity;

    protected $fillable = [
        'sender_id', 'user_id', 'area_id', 'name', 'first_name', 'last_name', 'email', 'phone_number', 'secondary_phone_number',
        'address', 'city', 'province', 'zip_code', 'landmarks', 'latitude', 'longitude',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function sender()
    {
        return $this->belongsTo(Sender::class);
    }

    public function area()
    {
        return $this->belongsTo(Area::class);
    }

    public function boxes()
    {
        return $this->hasMany(Box::class);
    }
}
