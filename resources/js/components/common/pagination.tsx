import { Link } from '@inertiajs/react';
import * as React from 'react';

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface PaginationData {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
    links: PaginationLink[] | Record<string, PaginationLink>;
}

interface PaginationProps {
    data?: PaginationData | null;
    className?: string;
}

export default function Pagination({ data, className }: PaginationProps) {
    if (!data) {
        return null;
    }

    const rawLinks: PaginationLink[] = Array.isArray(data.links)
        ? data.links
        : (data.links ? (Object.values(data.links) as PaginationLink[]) : []);
    const linksList = rawLinks.filter((link): link is PaginationLink => Boolean(link && link.label));

    if (linksList.length <= 1 || data.total === 0) {
        return null;
    }

    return (
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border bg-brand-warm/10 dark:bg-brand-warm/20 px-4 py-3 ${className || ''}`}>
            <div className="text-xs text-brand-text-mid font-normal">
                {data.from && data.to ? (
                    <>
                        Showing <span className="font-semibold text-brand-text">{data.from}</span> to{' '}
                        <span className="font-semibold text-brand-text">{data.to}</span> of{' '}
                        <span className="font-semibold text-brand-text">{data.total}</span> entries
                    </>
                ) : (
                    <>Showing <span className="font-semibold text-brand-text">{data.total}</span> entries</>
                )}
            </div>

            <div className="flex items-center gap-1 flex-wrap justify-center">
                {linksList.map((link, idx) => {
                    const formattedLabel = String(link.label || '')
                        .replace('&laquo; Previous', 'Prev')
                        .replace('Next &raquo;', 'Next');

                    if (!link.url) {
                        return (
                            <span
                                key={idx}
                                className="h-8 px-2.5 inline-flex items-center justify-center rounded-lg text-xs font-medium text-brand-text-light/50 pointer-events-none select-none"
                                dangerouslySetInnerHTML={{ __html: formattedLabel }}
                            />
                        );
                    }

                    return (
                        <Link
                            key={idx}
                            href={link.url}
                            preserveState
                            preserveScroll
                            className={`h-8 px-3 inline-flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                                link.active
                                    ? 'bg-brand-primary dark:bg-brand-rust text-white dark:text-brand-cream shadow-2xs font-semibold'
                                    : 'bg-card border border-border text-brand-text-mid hover:bg-brand-warm/40 hover:text-brand-text hover:border-brand-sand dark:hover:border-border'
                            }`}
                            dangerouslySetInnerHTML={{ __html: formattedLabel }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
