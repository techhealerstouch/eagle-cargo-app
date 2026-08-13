import React, { useState, useRef, useEffect } from 'react';
import { Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SuburbOption = {
    name: string;
    postcode?: string | null;
};

interface SuburbSelectProps {
    value: string;
    onChange: (suburbName: string, postcode?: string) => void;
    suburbs?: SuburbOption[];
    placeholder?: string;
    className?: string;
    id?: string;
    name?: string;
}

export function SuburbSelect({
    value,
    onChange,
    suburbs = [],
    placeholder = 'Type suburb or postcode...',
    className,
    id,
    name,
}: SuburbSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync input value with external prop changes (e.g. from map pin or initial load)
    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    // Check available space below to decide if dropdown should open upward or downward
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 220 && rect.top > spaceBelow) {
                setOpenUpward(true);
            } else {
                setOpenUpward(false);
            }
        }
    }, [isOpen]);

    // Filter suburbs based on input value
    const filteredSuburbs = inputValue.trim() === ''
        ? suburbs
        : suburbs.filter((s) =>
            s.name.toLowerCase().includes(inputValue.toLowerCase()) ||
            (s.postcode && s.postcode.toString().toLowerCase().includes(inputValue.toLowerCase()))
          );

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (suburb: SuburbOption) => {
        setInputValue(suburb.name);
        onChange(suburb.name, suburb.postcode || undefined);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        onChange(newValue);
        setIsOpen(true);
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <input type="hidden" id={id} name={name} value={value} />
            
            {/* Direct Autocomplete Text Input */}
            <div className="relative flex items-center">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    className={cn(
                        'h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 pr-8 text-xs font-medium text-zinc-900 focus:border-brand-rust focus:outline-none focus:ring-1 focus:ring-brand-rust dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100',
                        className
                    )}
                />
                <Search className="absolute right-3 size-3.5 text-zinc-400 pointer-events-none" />
            </div>

            {/* Suggestions Dropdown Menu */}
            {isOpen && (
                <div
                    className={cn(
                        'absolute left-0 right-0 z-50 max-h-52 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-xl transition-all dark:border-zinc-800 dark:bg-zinc-900',
                        openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
                    )}
                >
                    {filteredSuburbs.length === 0 ? (
                        <div className="px-3 py-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                            No matching registered suburb
                        </div>
                    ) : (
                        filteredSuburbs.slice(0, 100).map((suburb) => {
                            const isSelected = suburb.name.toLowerCase() === value.toLowerCase();
                            return (
                                <div
                                    key={`${suburb.name}-${suburb.postcode || ''}`}
                                    onClick={() => handleSelect(suburb)}
                                    className={cn(
                                        'flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800',
                                        isSelected && 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                                    )}
                                >
                                    <span>
                                        {suburb.name} {suburb.postcode ? <span className="text-zinc-400 font-normal ml-1">({suburb.postcode})</span> : null}
                                    </span>
                                    {isSelected && <Check className="size-3.5 text-emerald-600" />}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
