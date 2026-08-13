<?php

namespace App\Enums;

enum CommissionType: string
{
    case FLAT = 'flat';
    case SIZE = 'size';
    case PERCENTAGE = 'percentage';
}
