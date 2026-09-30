<?php

namespace App\Enums;

enum CalendarEventCategory: string
{
    case Logistics = 'logistics';
    case Marketing = 'marketing';
    case Operations = 'operations';
    case Holiday = 'holiday';
    case Disruption = 'disruption';

    public function label(): string
    {
        return match ($this) {
            self::Logistics => 'Logistics & Shipping',
            self::Marketing => 'Marketing & Promos',
            self::Operations => 'Operations & Runs',
            self::Holiday => 'Holidays & Blackouts',
            self::Disruption => 'Advisories & Disruptions',
        };
    }
}
