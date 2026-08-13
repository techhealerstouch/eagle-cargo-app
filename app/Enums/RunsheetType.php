<?php

namespace App\Enums;

enum RunsheetType: string
{
    case Pickup = 'pickup';
    case Delivery = 'delivery';

    public function label(): string
    {
        return __('statuses.runsheet_type.'.$this->value);
    }
}
