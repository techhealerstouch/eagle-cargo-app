import { router } from '@inertiajs/react';
import { X } from 'lucide-react';

import { sanitizeQueryParams  } from '@/components/common/filter-query-utils';
import type {FilterQueryParams} from '@/components/common/filter-query-utils';
import { cn, humanize } from '@/lib/utils';

interface ActiveFilterChipsProps {
    routeName: string;
    queryParams?: FilterQueryParams;
    labels?: Record<string, string>;
    className?: string;
}

const EXCLUDED_KEYS = new Set(['page']);

function formatValue(value: unknown): string {
    if (Array.isArray(value)) {
        return value.join(', ');
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    return String(value);
}

export default function ActiveFilterChips({
    routeName,
    queryParams = {},
    labels = {},
    className,
}: ActiveFilterChipsProps) {
    const sanitizedParams = sanitizeQueryParams(queryParams);
    
    // Extract sort/direction to handle them as a unified chip
    const sortField = sanitizedParams.sort;
    const sortDirection = sanitizedParams.direction;
    
    const activeFilters = Object.entries(sanitizedParams).filter(
        ([key]) => !EXCLUDED_KEYS.has(key) && key !== 'sort' && key !== 'direction',
    );

    if (activeFilters.length === 0 && !sortField) {
        return null;
    }

    const removeFilter = (key: string) => {
        const updates: Record<string, any> = { [key]: undefined, page: 1 };
        
        // If removing sort, also remove direction
        if (key === 'sort') {
            updates.direction = undefined;
        }

        router.get(
            routeName,
            sanitizeQueryParams({
                ...queryParams,
                ...updates
            }),
            { preserveState: true, replace: true },
        );
    };

    return (
        <div className={cn('flex flex-wrap items-center gap-2', className)}>
            {/* Standard Filters */}
            {activeFilters.map(([key, value]) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => removeFilter(key)}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-warm/20 bg-brand-warm/5 px-3 py-1.5 text-xs transition-colors hover:bg-brand-warm/10"
                    aria-label={`Remove ${labels[key] ?? humanize(key)} filter`}
                >
                    <span className="font-medium text-brand-rust">
                        {labels[key] ?? humanize(key)}
                    </span>
                    <span className="max-w-45 truncate font-semibold text-zinc-700">
                        {formatValue(value)}
                    </span>
                    <X className="size-3 text-zinc-500" />
                </button>
            ))}

            {/* Unified Sort Chip */}
            {sortField && (
                <button
                    type="button"
                    onClick={() => removeFilter('sort')}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-warm/20 bg-brand-warm/5 px-3 py-1.5 text-xs transition-colors hover:bg-brand-warm/10 ring-1 ring-brand-rust/20 shadow-sm"
                    aria-label="Remove sorting"
                >
                    <span className="font-medium text-brand-rust">
                        Sort
                    </span>
                    <span className="max-w-45 truncate font-semibold text-zinc-700">
                        {humanize(String(sortField))} ({String(sortDirection).toUpperCase()})
                    </span>
                    <X className="size-3 text-zinc-500" />
                </button>
            )}
        </div>
    );
}

