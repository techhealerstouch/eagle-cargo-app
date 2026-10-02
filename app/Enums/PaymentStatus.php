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
        $key = 'statuses.payment.'.$this->value;
        $trans = __($key);
        if ($trans !== $key) {
            return $trans;
        }

        return match ($this) {
            self::Pending => 'Pending',
            self::Paid => 'Paid',
            self::CashOnPickup => 'Payment on Pickup',
            self::CashCollected => 'Cash Collected',
            self::BalancePending => 'Balance Pending',
            self::PartiallyPaid => 'Partially Paid',
        };
    }
}
