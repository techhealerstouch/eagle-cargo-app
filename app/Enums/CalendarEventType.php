<?php

namespace App\Enums;

enum CalendarEventType: string
{
    case Cutoff = 'cutoff';
    case Sailing = 'sailing';
    case Arrival = 'arrival';
    case PickupRun = 'pickup_run';
    case DeliveryRun = 'delivery_run';
    case Holiday = 'holiday';
    case Promo = 'promo';
    case Community = 'community';
    case Maintenance = 'maintenance';
    case Custom = 'custom';

    public function label(): string
    {
        return match ($this) {
            self::Cutoff => 'Cargo Cut-off',
            self::Sailing => 'Vessel Sailing',
            self::Arrival => 'Port Arrival / Devanning',
            self::PickupRun => 'Pickup Run',
            self::DeliveryRun => 'Delivery Run',
            self::Holiday => 'Public Holiday',
            self::Promo => 'Promotion / Campaign',
            self::Community => 'Community & Pop-up',
            self::Maintenance => 'Operations & Maintenance',
            self::Custom => 'Custom Event',
        };
    }

    public function defaultColor(): string
    {
        return match ($this) {
            self::Cutoff => '#DC2626',      // Red
            self::Sailing => '#2563EB',     // Blue
            self::Arrival => '#0D9488',     // Teal
            self::PickupRun => '#16A34A',   // Green
            self::DeliveryRun => '#059669', // Emerald
            self::Holiday => '#E11D48',     // Rose
            self::Promo => '#D97706',       // Amber
            self::Community => '#7C3AED',   // Purple
            self::Maintenance => '#475569', // Slate
            self::Custom => '#6366F1',      // Indigo
        };
    }
}
