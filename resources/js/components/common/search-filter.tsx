import { router } from '@inertiajs/react';
import { debounce } from 'lodash';
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { sanitizeQueryParams } from '@/components/common/filter-query-utils';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchFilterProps {
    label?: string;
    placeholder?: string;
    routeName: string;
    queryParams?: Record<string, any>;
    searchKey?: string;
    ariaLabel?: string;
}

export default function SearchFilter({
    label,
    placeholder = 'Search...',
    routeName,
    queryParams = {},
    searchKey = 'search',
    ariaLabel = 'Search',
}: SearchFilterProps) {
    const externalValue = queryParams[searchKey];
    const normalizedExternalValue = externalValue === undefined || externalValue === null
        ? ''
        : String(externalValue);

    const [value, setValue] = useState(normalizedExternalValue);

    const handleSearch = useMemo(
        () => debounce((searchValue: string) => {
            router.get(
                routeName,
                sanitizeQueryParams({ ...queryParams, [searchKey]: searchValue, page: 1 }),
                { preserveState: true, replace: true }
            );
        }, 300),
        [routeName, queryParams, searchKey]
    );

    useEffect(() => {
        setValue(normalizedExternalValue);
    }, [normalizedExternalValue]);

    useEffect(() => {
        return () => {
            handleSearch.cancel();
        };
    }, [handleSearch]);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        handleSearch(newValue);
    };

    const clearSearch = () => {
        setValue('');
        router.get(
            routeName,
            sanitizeQueryParams({ ...queryParams, [searchKey]: undefined, page: 1 }),
            { preserveState: true, replace: true }
        );
    };

    return (
        <div className="flex flex-col gap-1.5 w-full max-w-sm">
            {label && (
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-brand-text-mid/70 px-1">
                    <span className="h-px w-2 bg-brand-rust/20"></span>
                    {label}
                </span>
            )}
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-brand-rust/5 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-all duration-500"></div>
                <div className="relative flex items-center">
                    <Search className="absolute left-4 h-3.5 w-3.5 text-brand-text-mid transition-colors group-focus-within:text-brand-rust" />
                    <Input
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        aria-label={ariaLabel}
                        className="h-11 pl-10 pr-12 rounded-xl border border-border bg-card transition-all focus:bg-card focus:border-brand-rust/40 focus:ring-2 focus:ring-brand-rust/10 placeholder:text-brand-text-light/60 font-medium text-sm text-brand-text shadow-2xs"
                    />
                    <div className="absolute right-4 flex items-center gap-2">
                        {value ? (
                            <button
                                type="button"
                                onClick={clearSearch}
                                aria-label="Clear search"
                                className="text-brand-text-light hover:text-brand-rust transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        ) : (
                            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-brand-warm/20 px-1.5 font-mono text-[10px] font-bold text-brand-text-mid">
                                <span className="text-[10px]">⌘</span>K
                            </kbd>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

