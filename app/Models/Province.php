<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Province extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'area_id', 'is_active'];

    public function area()
    {
        return $this->belongsTo(Area::class);
    }
}
