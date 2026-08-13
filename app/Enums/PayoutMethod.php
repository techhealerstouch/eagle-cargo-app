<?php

namespace App\Enums;

enum PayoutMethod: string
{
    case Stripe = 'stripe';
    case Cash = 'cash';
    case Ewallet = 'ewallet';

    public function label(): string
    {
        return match ($this) {
            self::Stripe => 'Stripe Transfer',
            self::Cash => 'Cash',
            self::Ewallet => 'E-wallet',
        };
    }
}
