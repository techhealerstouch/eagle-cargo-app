<?php

namespace App\Enums;

enum BatchStatus: string
{
    case Open = 'open';
    case Loading = 'loading';
    case ReadyToClose = 'ready_to_close';
    case Sailed = 'sailed';
    case Arrived = 'arrived';
    case UnderCustomsClearance = 'under_customs_clearance';
    case ReleasedByBoc = 'released_by_boc';
    case ReceivedAtWarehouse = 'received_at_warehouse';

    public function isTerminal(): bool
    {
        return $this === self::ReceivedAtWarehouse;
    }

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Open => in_array($next, [self::Loading, self::ReadyToClose], true),
            self::Loading => in_array($next, [self::Open, self::ReadyToClose], true),
            self::ReadyToClose => in_array($next, [self::Open, self::Loading, self::Sailed], true),
            self::Sailed => in_array($next, [self::Open, self::Loading, self::Arrived], true),
            self::Arrived => in_array($next, [self::Open, self::Loading, self::UnderCustomsClearance, self::ReleasedByBoc, self::ReceivedAtWarehouse], true),
            self::UnderCustomsClearance => in_array($next, [self::Open, self::Loading, self::ReleasedByBoc, self::ReceivedAtWarehouse], true),
            self::ReleasedByBoc => in_array($next, [self::Open, self::Loading, self::ReceivedAtWarehouse], true),
            self::ReceivedAtWarehouse => in_array($next, [self::Open, self::Loading], true),
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Open',
            self::Loading => 'Loading',
            self::ReadyToClose => 'Ready to Close',
            self::Sailed => 'Sailed',
            self::Arrived => 'Arrived at Port',
            self::UnderCustomsClearance => 'Under BOC Clearance',
            self::ReleasedByBoc => 'Released by BOC',
            self::ReceivedAtWarehouse => 'Received at Manila Warehouse',
        };
    }
}
