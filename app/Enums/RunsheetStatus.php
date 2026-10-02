<?php

namespace App\Enums;

enum RunsheetStatus: string
{
    case Draft = 'draft';
    case Assigned = 'assigned';
    case InProgress = 'in_progress';
    case Completed = 'completed';

    public static function activeValues(): array
    {
        return [
            self::Assigned->value,
            self::InProgress->value,
        ];
    }

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Draft => $next === self::Assigned,
            self::Assigned => $next === self::InProgress,
            self::InProgress => $next === self::Completed,
            self::Completed => false,
        };
    }

    public function label(): string
    {
        $key = 'statuses.runsheet.'.$this->value;
        $trans = __($key);
        if ($trans !== $key) {
            return $trans;
        }

        return match ($this) {
            self::Draft => 'Draft',
            self::Assigned => 'Assigned',
            self::InProgress => 'In Progress',
            self::Completed => 'Completed',
        };
    }
}
