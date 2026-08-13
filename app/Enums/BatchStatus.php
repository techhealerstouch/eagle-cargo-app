<?php

namespace App\Enums;

enum BatchStatus: string
{
    case Open = 'open';
    case Loading = 'loading';
    case ReadyToClose = 'ready_to_close';
    case Sailed = 'sailed';
    case Arrived = 'arrived';
    case Delivered = 'delivered';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Open => in_array($next, [self::Loading, self::ReadyToClose], true),
            self::Loading => in_array($next, [self::Open, self::ReadyToClose], true),
            self::ReadyToClose => in_array($next, [self::Loading, self::Sailed], true),
            self::Sailed => $next === self::Arrived,
            self::Arrived => $next === self::Delivered,
            self::Delivered => false,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Open',
            self::Loading => 'Loading',
            self::ReadyToClose => 'Ready to Close',
            self::Sailed => 'Sailed',
            self::Arrived => 'Arrived',
            self::Delivered => 'Delivered',
        };
    }
}
