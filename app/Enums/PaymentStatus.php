<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case CashOnPickup = 'cash_on_pickup';
    case CashCollected = 'cash_collected';
    case BalancePending = 'balance_pending';
    case PartiallyPaid = 'partially_paid';

    public function label(): string
    {
        return __('statuses.payment.'.$this->value);
    }
}
