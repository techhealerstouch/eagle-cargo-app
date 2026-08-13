<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BoxType extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'description', 'dimensions', 'is_active'];

    public function prices()
    {
        return $this->hasMany(BoxPrice::class);
    }

    /**
     * Parse the dimensions string (e.g. "50x50x50") and return CBM.
     */
    public function getStandardCbm(): ?float
    {
        if (empty($this->dimensions)) {
            return null;
        }

        $parts = explode('x', strtolower(str_replace(' ', '', $this->dimensions)));
        if (count($parts) === 3) {
            $length = (float) $parts[0];
            $width = (float) $parts[1];
            $height = (float) $parts[2];
            return round(($length * $width * $height) / 1_000_000, 6);
        }

        return null;
    }

    public function boxes()
    {
        return $this->hasMany(Box::class);
    }
}
