<?php

namespace App\Enums;

enum BookingStatus: string
{
    case Draft = 'draft';
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Collected = 'collected';
    case Shipped = 'shipped';
    case PartiallyDelivered = 'partially_delivered';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';

    public function canTransitionTo(self $target): bool
    {
        return match ($this) {
            self::Draft => in_array($target, [self::Pending, self::Confirmed, self::Cancelled]),
            self::Pending => in_array($target, [self::Confirmed, self::Collected, self::Shipped, self::Cancelled]),
            self::Confirmed => in_array($target, [self::Pending, self::Collected, self::Shipped, self::PartiallyDelivered, self::Delivered]),
            self::Collected => in_array($target, [self::Shipped, self::PartiallyDelivered, self::Delivered]),
            self::Shipped => in_array($target, [self::PartiallyDelivered, self::Delivered]),
            self::PartiallyDelivered => in_array($target, [self::Delivered]),
            self::Delivered => false, // Final state
            self::Cancelled => in_array($target, [self::Pending, self::Confirmed]), // Re-opening
        };
    }

    public function label(): string
    {
        return __('statuses.booking.'.$this->value);
    }
}
