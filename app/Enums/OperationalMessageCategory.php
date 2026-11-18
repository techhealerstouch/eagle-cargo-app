<?php

namespace App\Enums;

enum OperationalMessageCategory: string
{
    case PickupSchedule = 'pickup_schedule';
    case CustomerConcern = 'customer_concern';
    case ScheduleChange = 'schedule_change';
    case General = 'general';

    public function label(): string
    {
        return match ($this) {
            self::PickupSchedule => 'Pickup Schedule',
            self::CustomerConcern => 'Customer Concern',
            self::ScheduleChange => 'Schedule Change',
            self::General => 'General Operations',
        };
    }
}
