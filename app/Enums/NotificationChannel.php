<?php

namespace App\Enums;

enum NotificationChannel: string
{
    case Email = 'email';
    case Sms = 'sms';
    case Push = 'push';
    case InApp = 'in_app';

    public function label(): string
    {
        return match ($this) {
            self::Email => 'Email',
            self::Sms => 'SMS',
            self::Push => 'Push Notification',
            self::InApp => 'In-App',
        };
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
