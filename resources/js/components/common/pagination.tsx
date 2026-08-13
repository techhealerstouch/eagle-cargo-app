import { Link } from '@inertiajs/react';
import * as React from 'react';

export interface PaginationData {
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
    links: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
}

interface PaginationProps {
    data: PaginationData;
    className?: string;
}

export default function Pagination({ data, className }: PaginationProps) {
    const rawLinks = Array.isArray(data?.links) ? data.links : (data?.links ? Object.values(data.links) : []);
    const linksList = rawLinks.filter(Boolean);

    if (!data || linksList.length <= 1 || data.total === 0) {
        return null;
    }

    return (
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-200/80 bg-zinc-50/50 px-4 py-3 ${className || ''}`}>
            <div className="text-xs text-zinc-500 font-normal">
                {data.from && data.to ? (
                    <>
                        Showing <span className="font-semibold text-zinc-900">{data.from}</span> to{' '}
                        <span className="font-semibold text-zinc-900">{data.to}</span> of{' '}
                        <span className="font-semibold text-zinc-900">{data.total}</span> entries
                    </>
                ) : (
                    <>Showing <span className="font-semibold text-zinc-900">{data.total}</span> entries</>
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
                                className="h-8 px-2.5 inline-flex items-center justify-center rounded-lg text-xs font-medium text-zinc-300 pointer-events-none select-none"
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
                                    ? 'bg-zinc-900 text-white shadow-2xs font-semibold'
                                    : 'bg-white border border-zinc-200/80 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300'
                            }`}
                            dangerouslySetInnerHTML={{ __html: formattedLabel }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
