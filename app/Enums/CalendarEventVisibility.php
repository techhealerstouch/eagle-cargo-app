<?php

namespace App\Enums;

enum CalendarEventVisibility: string
{
    case Public = 'public';
    case CustomerOnly = 'customer_only';
    case StaffOnly = 'staff_only';
    case AdminOnly = 'admin_only';

    public function label(): string
    {
        return match ($this) {
            self::Public => 'Public (Everyone)',
            self::CustomerOnly => 'Customers (Senders & Recipients)',
            self::StaffOnly => 'Staff Only (Pickers, Warehouse, Drivers)',
            self::AdminOnly => 'Admin Only',
        };
    }
}
