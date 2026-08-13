import type { PageProps } from '@inertiajs/core';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Eye, Activity, Shield, Search, Globe, Monitor, Smartphone, ArrowLeft,
    TrendingUp, Hash, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface TopSearchedItem {
    id: number;
    tracking_number?: string;
    reference_number?: string;
    search_count: number;
}

interface Stats {
    total_lookups_today: number;
    total_lookups_all_time: number;
    unique_ips_today: number;
    top_searched_boxes: TopSearchedItem[];
    top_searched_bookings: TopSearchedItem[];
}

interface LogEntry {
    id: number;
    search_query: string;
    trackable_type: string;
    trackable_id: number;
    ip_address: string | null;
    source: string;
    created_at: string;
}

interface PaginatedLogs {
    data: LogEntry[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: Array<{ url: string | null; label: string; active: boolean }>;
}

interface Filters {
    search: string | null;
    date_from: string | null;
    date_to: string | null;
    source: string | null;
}

interface Props {
    stats: Stats;
    logs: PaginatedLogs;
    filters: Filters;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Tracking Analytics', href: '/admin/tracking-analytics' },
];

export default function TrackingAnalyticsIndex({ stats, logs, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters.date_to ?? '');
    const [source, setSource] = useState(filters.source ?? '');

    const applyFilters = (e?: React.FormEvent) => {
        e?.preventDefault();
        router.get('/admin/tracking-analytics', {
            search: search || undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            source: source || undefined,
        }, { preserveState: true });
    };

    const clearFilters = () => {
        setSearch('');
        setDateFrom('');
        setDateTo('');
        setSource('');
        router.get('/admin/tracking-analytics', {}, { preserveState: true });
    };

    const hasActiveFilters = filters.search || filters.date_from || filters.date_to || filters.source;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tracking Analytics" />

            <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6 md:space-y-8">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                    <Heading
                        eyebrow="Intelligence"
                        title="Tracking Analytics"
                        description="Monitor public tracking searches, view lookup activity, and audit search logs across the system."
                    />
                </div>

                {/* Stats Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="card p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                <Activity className="size-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Today</span>
                        </div>
                        <div>
                            <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{stats.total_lookups_today}</p>
                            <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Lookups Today</p>
                        </div>
                    </div>

                    <div className="card p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                                <Eye className="size-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">All Time</span>
                        </div>
                        <div>
                            <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{stats.total_lookups_all_time}</p>
                            <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Total System Searches</p>
                        </div>
                    </div>

                    <div className="card p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                <Globe className="size-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Today</span>
                        </div>
                        <div>
                            <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{stats.unique_ips_today}</p>
                            <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Unique IP Addresses</p>
                        </div>
                    </div>
                </div>

                {/* Top Searched */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Top Searched Boxes */}
                    <div className="card">
                        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                            <TrendingUp className="size-4 text-purple-600 dark:text-purple-400" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Top Searched Boxes</h3>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {stats.top_searched_boxes.length === 0 && (
                                <div className="p-5 text-center text-xs text-zinc-400 italic">No box searches recorded yet.</div>
                            )}
                            {stats.top_searched_boxes.map((item, i) => (
                                <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40 text-[10px] font-black text-purple-700 dark:text-purple-300">
                                            {i + 1}
                                        </span>
                                        <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">{item.tracking_number}</span>
                                    </div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 text-[10px] font-bold text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800">
                                        <Eye className="size-3" /> {item.search_count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Searched Bookings */}
                    <div className="card">
                        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                            <TrendingUp className="size-4 text-indigo-600 dark:text-indigo-400" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Top Searched Bookings</h3>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {stats.top_searched_bookings.length === 0 && (
                                <div className="p-5 text-center text-xs text-zinc-400 italic">No booking searches recorded yet.</div>
                            )}
                            {stats.top_searched_bookings.map((item, i) => (
                                <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-[10px] font-black text-indigo-700 dark:text-indigo-300">
                                            {i + 1}
                                        </span>
                                        <span className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">{item.reference_number}</span>
                                    </div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 text-[10px] font-bold text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                                        <Eye className="size-3" /> {item.search_count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Search Audit Logs */}
                <div className="card">
                    <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="size-4 text-zinc-500" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                                Search Audit Log
                            </h3>
                            <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                                {logs.total} entries
                            </span>
                        </div>
                    </div>

                    {/* Filters */}
                    <form onSubmit={applyFilters} className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[180px]">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1.5">Search Query</label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="TRK-... or BK-..."
                                        className="w-full h-8 pl-8 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                                    />
                                </div>
                            </div>
                            <div className="min-w-[140px]">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1.5">From</label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                                />
                            </div>
                            <div className="min-w-[140px]">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1.5">To</label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                                />
                            </div>
                            <div className="min-w-[100px]">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1.5">Source</label>
                                <select
                                    value={source}
                                    onChange={(e) => setSource(e.target.value)}
                                    className="w-full h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                                >
                                    <option value="">All</option>
                                    <option value="web">Web</option>
                                    <option value="api">API</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button type="submit" size="sm" className="h-8 text-xs font-bold cursor-pointer">
                                    <Search className="size-3.5 mr-1" /> Filter
                                </Button>
                                {hasActiveFilters && (
                                    <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs font-bold text-zinc-500 cursor-pointer">
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </div>
                    </form>

                    {/* Logs Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80">
                                    <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Query</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Source</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">IP Address</th>
                                    <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {logs.data.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-10 text-center text-zinc-400 italic">
                                            No search logs found{hasActiveFilters ? ' matching your filters' : ''}.
                                        </td>
                                    </tr>
                                )}
                                {logs.data.map((log) => (
                                    <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-5 py-3">
                                            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{log.search_query}</span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={cn(
                                                "inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                                log.trackable_type === 'Box'
                                                    ? "bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200"
                                                    : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200"
                                            )}>
                                                {log.trackable_type}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 font-medium">
                                                {log.source === 'web' ? <Monitor className="size-3" /> : <Smartphone className="size-3" />}
                                                {log.source}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-zinc-500 dark:text-zinc-400">{log.ip_address ?? '—'}</td>
                                        <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {logs.last_page > 1 && (
                        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <p className="text-[11px] text-zinc-500 font-medium">
                                Showing {logs.from}–{logs.to} of {logs.total} results
                            </p>
                            <div className="flex items-center gap-1">
                                {logs.links.map((link, i) => {
                                    if (i === 0) {
                                        return (
                                            <Button
                                                key="prev"
                                                variant="ghost"
                                                size="sm"
                                                disabled={!link.url}
                                                onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                                className="h-7 w-7 p-0 cursor-pointer"
                                            >
                                                <ChevronLeft className="size-4" />
                                            </Button>
                                        );
                                    }
                                    if (i === logs.links.length - 1) {
                                        return (
                                            <Button
                                                key="next"
                                                variant="ghost"
                                                size="sm"
                                                disabled={!link.url}
                                                onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                                className="h-7 w-7 p-0 cursor-pointer"
                                            >
                                                <ChevronRight className="size-4" />
                                            </Button>
                                        );
                                    }
                                    return (
                                        <Button
                                            key={link.label}
                                            variant={link.active ? 'default' : 'ghost'}
                                            size="sm"
                                            disabled={!link.url}
                                            onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                            className={cn("h-7 min-w-7 px-2 text-[11px] font-bold cursor-pointer", link.active && "pointer-events-none")}
                                        >
                                            {link.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
