<?php

namespace App\Enums;

enum SerialNumberStatus: string
{
    case Available = 'Available';
    case Allocated = 'Allocated';
    case Assigned = 'Assigned';
    case Void = 'Void';
}
