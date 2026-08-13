<?php

namespace App\Enums;

enum InvoiceStatus: string
{
    case Unpaid = 'unpaid';
    case Partial = 'partial';
    case Paid = 'paid';
    case Voided = 'voided';

    public function label(): string
    {
        return __('statuses.invoice.'.$this->value);
    }
}
