<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class Phone implements ValidationRule
{
    protected string $label;

    public function __construct(string $label = 'phone number')
    {
        $this->label = $label;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (empty($value)) {
            $fail("The {$this->label} is required.");
            return;
        }

        $cleaned = preg_replace('/[\s\-\(\)]+/', '', $value);

        // Detect country code / dial code prefix
        if (str_starts_with($cleaned, '+61') || str_starts_with($cleaned, '04') || (strlen($cleaned) === 9 && str_starts_with($cleaned, '4'))) {
            // Australia
            if (!preg_match('/^(\+61|0)4\d{8}$/', $cleaned)) {
                $fail("The {$this->label} must be a valid Australian mobile number (e.g. 04XXXXXXXX or +614XXXXXXXX).");
            }
        } elseif (str_starts_with($cleaned, '+63') || str_starts_with($cleaned, '09') || (strlen($cleaned) === 10 && str_starts_with($cleaned, '9'))) {
            // Philippines
            if (!preg_match('/^(\+63|0)9\d{9}$/', $cleaned)) {
                $fail("The {$this->label} must be a valid Philippine mobile number (e.g. 09XXXXXXXXX or +639XXXXXXXXX).");
            }
        } elseif (str_starts_with($cleaned, '+64') || str_starts_with($cleaned, '02')) {
            // New Zealand
            if (!preg_match('/^(\+64|0)2\d{7,9}$/', $cleaned)) {
                $fail("The {$this->label} must be a valid New Zealand mobile number (e.g. 02XXXXXXXX).");
            }
        } elseif (str_starts_with($cleaned, '+1') || (strlen($cleaned) === 10 && preg_match('/^[2-9]/', $cleaned))) {
            // US / Canada
            if (!preg_match('/^(\+1)?[2-9]\d{9}$/', $cleaned)) {
                $fail("The {$this->label} must be a valid US/Canada phone number (10 digits).");
            }
        } elseif (str_starts_with($cleaned, '+44') || str_starts_with($cleaned, '07')) {
            // United Kingdom
            if (!preg_match('/^(\+44|0)7\d{9}$/', $cleaned)) {
                $fail("The {$this->label} must be a valid UK mobile number (e.g. 07XXXXXXXXX).");
            }
        } elseif (str_starts_with($cleaned, '+65')) {
            // Singapore
            if (!preg_match('/^(\+65)?[89]\d{7}$/', $cleaned)) {
                $fail("The {$this->label} must be a valid Singapore mobile number (8 digits).");
            }
        } else {
            // General fallback
            if (!preg_match('/^\+?\d{5,16}$/', $cleaned)) {
                $fail("The {$this->label} must be a valid international phone number.");
            }
        }
    }
}
