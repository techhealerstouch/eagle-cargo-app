import { router } from '@inertiajs/react';
import { RotateCcw } from 'lucide-react';

import { sanitizeQueryParams } from '@/components/common/filter-query-utils';
import type { FilterQueryParams } from '@/components/common/filter-query-utils';
import { cn } from '@/lib/utils';

interface ClearFiltersButtonProps {
    routeName: string;
    queryParams?: FilterQueryParams;
    className?: string;
    preserveState?: boolean;
}

const EXCLUDED_KEYS = new Set(['page']);

export default function ClearFiltersButton({
    routeName,
    queryParams = {},
    className,
    preserveState = true,
}: ClearFiltersButtonProps) {
    const sanitized = sanitizeQueryParams(queryParams);
    const hasActiveFilters = Object.keys(sanitized).some(
        (key) => !EXCLUDED_KEYS.has(key),
    );

    const clearFilters = () => {
        if (!hasActiveFilters) {
            return;
        }

        router.get(routeName, {}, { preserveState, replace: true });
    };

    return (
        <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className={cn(
                'inline-flex h-9 items-center gap-2 rounded-xl border border-brand-warm/20 px-3.5 text-xs font-medium transition-colors',
                hasActiveFilters
                    ? 'text-brand-rust hover:bg-brand-warm/10'
                    : 'cursor-not-allowed text-zinc-400',
                className,
            )}
            aria-label="Clear active filters"
        >
            <RotateCcw className="size-3.5" />
            Clear Filters
        </button>
    );
}

