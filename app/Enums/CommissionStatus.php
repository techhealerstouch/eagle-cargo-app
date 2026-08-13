<?php

namespace App\Enums;

enum CommissionStatus: string
{
    case PENDING = 'pending';
    case PAID = 'paid';
    case CANCELLED = 'cancelled';
}
