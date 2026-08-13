import { Link } from '@inertiajs/react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

interface SortLinkProps {
    label: string;
    sortField: string;
    currentSort?: string;
    currentDirection?: string;
    routeName: string;
    queryParams?: Record<string, any>;
}

export default function SortLink({
    label,
    sortField,
    currentSort,
    currentDirection,
    routeName,
    queryParams = {},
}: SortLinkProps) {
    const isActive = currentSort === sortField;
    const nextDirection = isActive && currentDirection === 'asc' ? 'desc' : 'asc';

    return (
        <Link
            href={routeName}
            data={{ ...queryParams, sort: sortField, direction: nextDirection, page: 1 }}
            className="group inline-flex items-center gap-1.5 transition-colors hover:text-brand-rust"
            preserveState
            replace
        >
            <span className="text-xs font-medium">
                {label}
            </span>
            <span className="flex items-center">
                {isActive ? (
                    currentDirection === 'asc' ? (
                        <ChevronUp className="size-3 text-brand-rust" />
                    ) : (
                        <ChevronDown className="size-3 text-brand-rust" />
                    )
                ) : (
                    <ChevronsUpDown className="size-3 opacity-20 group-hover:opacity-100" />
                )}
            </span>
        </Link>
    );
}

