<?php

namespace App\Enums;

enum Role: string
{
    case Developer = 'developer';
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    case Courier = 'courier';
    case Picker = 'picker';
    case Warehouse = 'warehouse';
    case Sender = 'sender';
    case Recipient = 'recipient';
}
