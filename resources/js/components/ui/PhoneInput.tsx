import React, { useEffect, useState, useRef } from 'react';
import { COUNTRIES, Country } from '@/lib/countries';

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
    defaultCountryCode?: string; // "AU" or "PH"
    name?: string; // Add name prop to support hidden inputs in Inertia/HTML forms
}

export const formatNationalNumber = (digits: string, countryCode: string): string => {
    // digits contains only numbers
    if (!digits) return '';

    let clean = digits.replace(/\D/g, '');

    if (countryCode === 'PH') {
        // Ensure it starts with '0' (auto-prepend if they start typing '9')
        if (clean.startsWith('9') && clean.length <= 10) {
            clean = '0' + clean;
        }
        
        // Limit to 11 digits
        clean = clean.slice(0, 11);
        
        // Format as: 09XX XXX XXXX
        const parts: string[] = [];
        if (clean.length > 0) {
            parts.push(clean.slice(0, 4));
        }
        if (clean.length > 4) {
            parts.push(clean.slice(4, 7));
        }
        if (clean.length > 7) {
            parts.push(clean.slice(7, 11));
        }
        return parts.join(' ');
    }

    if (countryCode === 'AU') {
        // Ensure it starts with '0' (auto-prepend if they start typing '4')
        if (clean.startsWith('4') && clean.length <= 9) {
            clean = '0' + clean;
        }
        
        // Limit to 10 digits
        clean = clean.slice(0, 10);
        
        // Format as: 04XX XXX XXX
        const parts: string[] = [];
        if (clean.length > 0) {
            parts.push(clean.slice(0, 4));
        }
        if (clean.length > 4) {
            parts.push(clean.slice(4, 7));
        }
        if (clean.length > 7) {
            parts.push(clean.slice(7, 10));
        }
        return parts.join(' ');
    }

    // Fallback for other countries: format in groups of 4, max 15 digits
    clean = clean.slice(0, 15);
    const parts: string[] = [];
    for (let i = 0; i < clean.length; i += 4) {
        parts.push(clean.slice(i, i + 4));
    }
    return parts.join(' ');
};

const parsePhoneNumber = (phone: string, defaultCode: string = 'AU'): { country: Country; national: string } => {
    const cleaned = (phone || '').replace(/[\s\-\(\)]/g, '');
    
    // Sort countries by dialCode length desc to match +1242 before +1
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    
    // Try to find matching dialCode prefix
    for (const c of sorted) {
        if (cleaned.startsWith(c.dialCode)) {
            let national = cleaned.slice(c.dialCode.length);
            // Prepend leading 0 for AU/PH if not present
            if (c.code === 'AU' && !national.startsWith('0') && national.startsWith('4')) {
                national = '0' + national;
            } else if (c.code === 'PH' && !national.startsWith('0') && national.startsWith('9')) {
                national = '0' + national;
            }
            return { country: c, national };
        }
    }
    
    // Fallback: Check if it starts with 0 and matches default country conventions
    const au = COUNTRIES.find(c => c.code === 'AU')!;
    const ph = COUNTRIES.find(c => c.code === 'PH')!;
    
    if (cleaned.startsWith('04') && defaultCode === 'AU') {
        return { country: au, national: cleaned };
    }
    if (cleaned.startsWith('09') && defaultCode === 'PH') {
        return { country: ph, national: cleaned };
    }
    if (cleaned.startsWith('4') && defaultCode === 'AU') {
        return { country: au, national: '0' + cleaned };
    }
    if (cleaned.startsWith('9') && defaultCode === 'PH') {
        return { country: ph, national: '0' + cleaned };
    }
    
    // Default to the specified default country
    const defaultCountry = COUNTRIES.find(c => c.code === defaultCode) || au;
    return {
        country: defaultCountry,
        national: cleaned
    };
};

export default function PhoneInput({
    value,
    onChange,
    disabled = false,
    className = '',
    defaultCountryCode = 'AU',
    name,
}: PhoneInputProps) {
    const parsed = parsePhoneNumber(value, defaultCountryCode);
    const [selectedCountry, setSelectedCountry] = useState<Country>(parsed.country);
    const [nationalNumber, setNationalNumber] = useState<string>(formatNationalNumber(parsed.national, parsed.country.code));

    // Track internal value updates to prevent loop
    const internalValueRef = useRef<string>(value);

    useEffect(() => {
        if (value !== internalValueRef.current) {
            const res = parsePhoneNumber(value, defaultCountryCode);
            setSelectedCountry(res.country);
            setNationalNumber(formatNationalNumber(res.national, res.country.code));
            internalValueRef.current = value;
        }
    }, [value, defaultCountryCode]);

    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const country = COUNTRIES.find(c => c.code === e.target.value);
        if (!country) return;
        
        setSelectedCountry(country);
        
        // Re-format existing digits for the new country format
        const digits = nationalNumber.replace(/\D/g, '');
        const formatted = formatNationalNumber(digits, country.code);
        setNationalNumber(formatted);
        
        const cleanDigits = formatted.replace(/\s/g, '');
        let sendDigits = cleanDigits;
        if (country.code === 'AU' && sendDigits.startsWith('04')) {
            sendDigits = sendDigits.slice(1);
        } else if (country.code === 'PH' && sendDigits.startsWith('09')) {
            sendDigits = sendDigits.slice(1);
        }
        
        const newValue = sendDigits ? `${country.dialCode}${sendDigits}` : '';
        internalValueRef.current = newValue;
        onChange(newValue);
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputVal = e.target.value;
        const digits = inputVal.replace(/\D/g, ''); // Extract only digits
        
        const formatted = formatNationalNumber(digits, selectedCountry.code);
        setNationalNumber(formatted);
        
        // Generate combined international string for parent state
        const cleanDigits = formatted.replace(/\s/g, '');
        let sendDigits = cleanDigits;
        if (selectedCountry.code === 'AU' && sendDigits.startsWith('04')) {
            sendDigits = sendDigits.slice(1);
        } else if (selectedCountry.code === 'PH' && sendDigits.startsWith('09')) {
            sendDigits = sendDigits.slice(1);
        }
        
        const newValue = sendDigits ? `${selectedCountry.dialCode}${sendDigits}` : '';
        internalValueRef.current = newValue;
        onChange(newValue);
    };

    const getPlaceholder = () => {
        if (selectedCountry.code === 'AU') {
            return '04XX XXX XXX';
        }
        if (selectedCountry.code === 'PH') {
            return '09XX XXX XXXX';
        }
        return 'Phone number';
    };

    return (
        <div className={`flex rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden focus-within:border-zinc-400 dark:focus-within:border-zinc-600 focus-within:ring-2 focus-within:ring-zinc-100 dark:focus-within:ring-zinc-800 h-12 w-full transition-all ${disabled ? 'bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed opacity-80' : ''} ${className}`}>
            {name && <input type="hidden" name={name} value={value} />}
            <select
                className="bg-transparent pl-3 pr-2 text-xs md:text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none border-r border-zinc-200 dark:border-zinc-800 h-full cursor-pointer focus:bg-white dark:focus:bg-zinc-900"
                value={selectedCountry.code}
                disabled={disabled}
                onChange={handleCountryChange}
                aria-label="Country Code"
            >
                {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code} className="text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900">
                        {c.flag} {c.dialCode}
                    </option>
                ))}
            </select>
            <input
                type="tel"
                disabled={disabled}
                placeholder={getPlaceholder()}
                className="flex-1 bg-transparent px-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none h-full disabled:cursor-not-allowed"
                value={nationalNumber}
                onChange={handleNumberChange}
            />
        </div>
    );
}
