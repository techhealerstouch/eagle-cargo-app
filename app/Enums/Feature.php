<?php

namespace App\Enums;

enum Feature: string
{
    case ShippingUpdates = 'shipping_updates';

    public function name(): string
    {
        return match ($this) {
            self::ShippingUpdates => 'Shipping Updates',
            default => '',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::ShippingUpdates => 'Enable the shipping updates communication module.',
            default => '',
        };
    }

    /** @return list<string> */
    public function audiences(): array
    {
        return match ($this) {
            self::ShippingUpdates => ['Admin', 'Super Admin'],
            default => [],
        };
    }
}
