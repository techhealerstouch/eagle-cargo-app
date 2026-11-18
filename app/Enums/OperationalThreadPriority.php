<?php

namespace App\Enums;

enum OperationalThreadPriority: string
{
    case Low = 'low';
    case Normal = 'normal';
    case Urgent = 'urgent';

    public function label(): string
    {
        return match ($this) {
            self::Low => 'Low Priority',
            self::Normal => 'Normal Priority',
            self::Urgent => 'Urgent Priority',
        };
    }
}
