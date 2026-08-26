<?php

namespace App\Enums;

enum BookingType: string
{
    case DropOff = 'drop_off';
    case HomePickup = 'home_pickup';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::DropOff => 'Drop-Off',
            self::HomePickup => 'Home Pick-Up',
            self::Other => 'Other',
        };
    }

    public function invoiceSubjectPrefix(): string
    {
        return match ($this) {
            self::DropOff => 'BOX DROP OFF',
            self::HomePickup => 'HOME PICK-UP',
            self::Other => 'OTHER',
        };
    }
}
