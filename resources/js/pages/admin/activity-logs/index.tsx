import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertCircle,
    ArrowRight,
    Banknote,
    Box,
    Check,
    ChevronDown,
    Clock,
    Code2,
    Copy,
    CreditCard,
    Database,
    Download,
    ExternalLink,
    Eye,
    FileSpreadsheet,
    FileText,
    Filter,
    Globe,
    History,
    Key,
    Layers,
    Lock,
    LogOut,
    RefreshCw,
    Search,
    Server,
    ShieldAlert,
    ShieldCheck,
    SlidersHorizontal,
    Terminal,
    Trash2,
    Truck,
    UserCheck,
    UserCog,
    Users,
    X,
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import ActiveFilterChips from '@/components/common/active-filter-chips';
import Heading from '@/components/common/heading';
import Pagination, { type PaginationData } from '@/components/common/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface ActivityLogItem {
    id: number;
    request_id?: string | null;
    user_id?: number | null;
    impersonator_id?: number | null;
    model_type: string;
    model_id: number;
    action: string;
    description: string;
    event_category: string;
    context: string;
    ip_address?: string | null;
    user_agent?: string | null;
    changes?: Record<string, { old?: any; new?: any }> | Record<string, any> | null;
    created_at: string;
    user?: {
        id: number;
        name: string;
        email: string;
        role: string;
        custom_id?: string;
    } | null;
    impersonator?: {
        id: number;
        name: string;
        email: string;
    } | null;
}

interface ActivityLogsPageProps {
    logs: PaginationData & { data: ActivityLogItem[] };
    stats: {
        total_today: number;
        total_week: number;
        security_events_week: number;
        financial_events_week: number;
        active_actors_today: number;
    };
    filters: {
        search?: string;
        category?: string;
        action?: string;
        model_type?: string;
        user_id?: number | null;
        request_id?: string;
        start_date?: string;
        end_date?: string;
    };
    categories: Record<string, string>;
    available_models: Array<{ value: string; label: string }>;
    available_actions: string[];
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    logistics: Truck,
    financial: CreditCard,
    security: ShieldAlert,
    settings: SlidersHorizontal,
    user: Users,
    compliance: FileSpreadsheet,
    communication: Activity,
    general: Database,
};

const CATEGORY_COLORS: Record<string, string> = {
    logistics: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    financial: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    security: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    settings: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    user: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    compliance: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    communication: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    general: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
};

const ACTION_COLORS: Record<string, string> = {
    created: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    updated: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    deleted: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    restored: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    login: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
    logout: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
    failed_login: 'bg-red-600/15 text-red-700 dark:text-red-300 border-red-600/30 font-bold',
    exported: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
};

const CONTEXT_ICONS: Record<string, React.ElementType> = {
    web: Globe,
    api: Server,
    cli: Terminal,
    job: Clock,
    webhook: Activity,
};

const getEntityUrl = (modelType: string, modelId: number | string): string | null => {
    if (!modelType || !modelId) return null;
    const base = modelType.split('\\').pop() || modelType;
    switch (base) {
        case 'Booking':
            return `/admin/bookings/${modelId}`;
        case 'Box':
            return `/admin/boxes/${modelId}`;
        case 'Batch':
            return `/admin/batches/${modelId}`;
        case 'Runsheet':
            return `/admin/runsheets/${modelId}`;
        case 'Invoice':
            return `/admin/invoices/${modelId}`;
        case 'User':
            return `/admin/users/${modelId}/edit`;
        case 'Sender':
            return `/admin/senders/${modelId}`;
        case 'Recipient':
            return `/admin/recipients/${modelId}`;
        case 'Enquiry':
            return `/admin/enquiries/${modelId}`;
        case 'SerialNumber':
            return `/admin/serial-numbers/${modelId}`;
        case 'ShippingUpdate':
            return `/admin/shipping-updates/${modelId}`;
        default:
            return null;
    }
};

const renderInlineChanges = (changes: any) => {
    if (!changes || typeof changes !== 'object') return null;

    const entries = Object.entries(changes).filter(
        ([_, val]: [string, any]) => val && typeof val === 'object' && ('old' in val || 'new' in val)
    );

    if (entries.length === 0) return null;

    const previewEntries = entries.slice(0, 2);
    const remainingCount = entries.length - previewEntries.length;

    const formatVal = (v: any) => {
        if (v === null || v === undefined) return '<null>';
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        if (typeof v === 'object') return JSON.stringify(v);
        const str = String(v);
        return str.length > 18 ? str.slice(0, 16) + '…' : str;
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {previewEntries.map(([field, val]: [string, any]) => (
                <span
                    key={field}
                    className="inline-flex items-center gap-1 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800/80 border border-brand-sand/40 dark:border-zinc-700/60 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300"
                >
                    <span className="font-semibold text-zinc-500 dark:text-zinc-400">{field}:</span>
                    <span className="line-through text-rose-500/80">{formatVal(val.old)}</span>
                    <ArrowRight className="size-2.5 text-zinc-400" />
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatVal(val.new)}</span>
                </span>
            ))}
            {remainingCount > 0 && (
                <span className="text-[10px] text-zinc-400 font-medium">
                    +{remainingCount} more
                </span>
            )}
        </div>
    );
};

export default function ActivityLogsIndex({
    logs,
    stats,
    filters,
    categories,
    available_models,
    available_actions,
}: ActivityLogsPageProps) {
    const { auth } = usePage<{ auth: any }>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';

    const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);
    const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const [search, setSearch] = useState(filters.search || '');
    const [category, setCategory] = useState(filters.category || 'all');
    const [action, setAction] = useState(filters.action || 'all');
    const [modelType, setModelType] = useState(filters.model_type || 'all');
    const [startDate, setStartDate] = useState(filters.start_date || '');
    const [endDate, setEndDate] = useState(filters.end_date || '');

    const applyFilters = (newFilters: Record<string, any>) => {
        const merged = {
            search,
            category: category === 'all' ? '' : category,
            action: action === 'all' ? '' : action,
            model_type: modelType === 'all' ? '' : modelType,
            user_id: filters.user_id,
            request_id: filters.request_id,
            start_date: startDate,
            end_date: endDate,
            ...newFilters,
        };

        // Clean out empty values
        const cleanParams: Record<string, any> = {};
        Object.entries(merged).forEach(([k, v]) => {
            if (v !== '' && v !== null && v !== undefined && v !== 'all') {
                cleanParams[k] = v;
            }
        });

        router.get('/admin/activity-logs', cleanParams, { preserveState: true, replace: true });
    };

    const handleCategoryTab = (val: string) => {
        setCategory(val);
        applyFilters({ category: val === 'all' ? '' : val });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters({ search });
    };

    const handleReset = () => {
        setSearch('');
        setCategory('all');
        setAction('all');
        setModelType('all');
        setStartDate('');
        setEndDate('');
        router.get('/admin/activity-logs', {}, { preserveState: true, replace: true });
    };

    const openDiffModal = (log: ActivityLogItem) => {
        setSelectedLog(log);
        setIsDiffModalOpen(true);
    };

    const copyJson = (data: any) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopied(true);
        toast.success('JSON copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    const exportUrl = () => {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.category && filters.category !== 'all') params.set('category', filters.category);
        if (filters.action && filters.action !== 'all') params.set('action', filters.action);
        if (filters.model_type && filters.model_type !== 'all') params.set('model_type', filters.model_type);
        if (filters.user_id) params.set('user_id', String(filters.user_id));
        if (filters.request_id) params.set('request_id', filters.request_id);
        if (filters.start_date) params.set('start_date', filters.start_date);
        if (filters.end_date) params.set('end_date', filters.end_date);
        return `/admin/activity-logs/export?${params.toString()}`;
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'System', href: '/admin/users' },
        { title: 'Audit Trail', href: '/admin/activity-logs' },
    ];

    const hasActiveFilters = !!(
        filters.search ||
        filters.request_id ||
        filters.user_id ||
        (filters.category && filters.category !== 'all') ||
        (filters.action && filters.action !== 'all') ||
        (filters.model_type && filters.model_type !== 'all') ||
        filters.start_date ||
        filters.end_date
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Audit Trail & Activity Logs | Admin" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
                {/* Header with Title & Export Button */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-brand-warm/20 dark:border-zinc-800 pb-6">
                    <Heading
                        eyebrow="Security & Governance"
                        title="Audit Trail & Activity Logs"
                        description="Immutable chronological logs of operations, financial changes, authentication events, logistics movements, and system configuration updates."
                    />
                    <div className="flex items-center gap-3">
                        {isSuperAdmin && (
                            <a
                                href={exportUrl()}
                                download
                                className="bg-white dark:bg-zinc-900 border border-brand-sand/60 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-brand-warm/30 dark:hover:bg-zinc-800 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-2xs"
                            >
                                <Download className="size-4 text-brand-primary" />
                                Export CSV
                            </a>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.reload({ only: ['logs', 'stats'] })}
                            className="rounded-xl flex items-center gap-2"
                        >
                            <RefreshCw className="size-3.5" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Telemetry / Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                    <div className="bg-white dark:bg-zinc-900 border border-brand-sand/40 dark:border-zinc-800 rounded-2xl p-4 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
                            <span className="text-xs font-medium uppercase tracking-wider">Today's Activity</span>
                            <Clock className="size-4 text-brand-primary" />
                        </div>
                        <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                            {stats.total_today.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1">Actions in last 24h</div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-brand-sand/40 dark:border-zinc-800 rounded-2xl p-4 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
                            <span className="text-xs font-medium uppercase tracking-wider">7-Day Volume</span>
                            <Layers className="size-4 text-blue-500" />
                        </div>
                        <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                            {stats.total_week.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1">Total weekly events</div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-brand-sand/40 dark:border-zinc-800 rounded-2xl p-4 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
                            <span className="text-xs font-medium uppercase tracking-wider">Financial Events</span>
                            <CreditCard className="size-4 text-emerald-500" />
                        </div>
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {stats.financial_events_week.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1">Payments, invoices, payouts</div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-brand-sand/40 dark:border-zinc-800 rounded-2xl p-4 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
                            <span className="text-xs font-medium uppercase tracking-wider">Security & Auth</span>
                            <ShieldAlert className="size-4 text-rose-500" />
                        </div>
                        <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                            {stats.security_events_week.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1">Logins, resets, security</div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-brand-sand/40 dark:border-zinc-800 rounded-2xl p-4 shadow-2xs">
                        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
                            <span className="text-xs font-medium uppercase tracking-wider">Active Actors</span>
                            <Users className="size-4 text-purple-500" />
                        </div>
                        <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                            {stats.active_actors_today.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1">Unique staff/users today</div>
                    </div>
                </div>

                {/* Category Navigation Tabs */}
                <div className="overflow-x-auto pb-1">
                    <Tabs value={category} onValueChange={handleCategoryTab} className="w-full">
                        <TabsList className="bg-brand-warm/20 dark:bg-zinc-900 p-1 rounded-xl h-auto flex-wrap gap-1">
                            <TabsTrigger value="all" className="rounded-lg text-xs font-medium py-1.5 px-3">
                                All Activities
                            </TabsTrigger>
                            {Object.entries(categories).map(([key, label]) => {
                                if (key === 'all') return null;
                                const Icon = CATEGORY_ICONS[key] || Database;
                                return (
                                    <TabsTrigger
                                        key={key}
                                        value={key}
                                        className="rounded-lg text-xs font-medium py-1.5 px-3 flex items-center gap-1.5"
                                    >
                                        <Icon className="size-3.5" />
                                        {label}
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>
                    </Tabs>
                </div>

                {/* Search & Multi-filter Toolbar */}
                <div className="bg-white dark:bg-zinc-900 border border-brand-sand/40 dark:border-zinc-800 rounded-2xl p-4 shadow-2xs space-y-3">
                    <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                            <Input
                                type="text"
                                placeholder="Search by description, actor name, email, IP address, or entity ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 h-10 bg-brand-warm/10 dark:bg-zinc-800/60 border-brand-sand/50 dark:border-zinc-700 rounded-xl text-sm"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch('');
                                        applyFilters({ search: '' });
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                            {/* Action filter dropdown */}
                            <select
                                value={action}
                                onChange={(e) => {
                                    setAction(e.target.value);
                                    applyFilters({ action: e.target.value === 'all' ? '' : e.target.value });
                                }}
                                className="h-10 px-3 bg-brand-warm/10 dark:bg-zinc-800/60 border border-brand-sand/50 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-200 outline-none"
                            >
                                <option value="all">All Actions</option>
                                {available_actions.map((act) => (
                                    <option key={act} value={act}>
                                        {act.toUpperCase()}
                                    </option>
                                ))}
                            </select>

                            {/* Model type filter dropdown */}
                            <select
                                value={modelType}
                                onChange={(e) => {
                                    setModelType(e.target.value);
                                    applyFilters({ model_type: e.target.value === 'all' ? '' : e.target.value });
                                }}
                                className="h-10 px-3 bg-brand-warm/10 dark:bg-zinc-800/60 border border-brand-sand/50 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-200 outline-none"
                            >
                                <option value="all">All Entity Types</option>
                                {available_models.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>

                            {/* Date inputs */}
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    applyFilters({ start_date: e.target.value });
                                }}
                                className="h-10 w-36 bg-brand-warm/10 dark:bg-zinc-800/60 border-brand-sand/50 dark:border-zinc-700 rounded-xl text-xs"
                                placeholder="Start Date"
                            />
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    applyFilters({ end_date: e.target.value });
                                }}
                                className="h-10 w-36 bg-brand-warm/10 dark:bg-zinc-800/60 border-brand-sand/50 dark:border-zinc-700 rounded-xl text-xs"
                                placeholder="End Date"
                            />

                            <Button type="submit" size="sm" className="h-10 px-4 rounded-xl font-semibold">
                                Search
                            </Button>

                            {hasActiveFilters && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleReset}
                                    className="h-10 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl"
                                >
                                    <X className="size-3.5 mr-1" />
                                    Clear
                                </Button>
                            )}
                        </div>
                    </form>

                    {(filters.request_id || filters.user_id) && (
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-brand-sand/30 dark:border-zinc-800 text-xs">
                            <span className="text-zinc-400 font-medium">Active filters:</span>
                            {filters.request_id && (
                                <Badge variant="outline" className="font-mono bg-brand-primary/10 text-brand-primary border-brand-primary/30 flex items-center gap-1.5 py-1 px-2.5">
                                    <Code2 className="size-3.5" />
                                    <span>Request: {filters.request_id}</span>
                                    <button
                                        type="button"
                                        onClick={() => applyFilters({ request_id: '' })}
                                        className="hover:text-rose-500 ml-1"
                                        title="Remove request filter"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </Badge>
                            )}
                            {filters.user_id && (
                                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 flex items-center gap-1.5 py-1 px-2.5">
                                    <Users className="size-3.5" />
                                    <span>Actor ID: #{filters.user_id}</span>
                                    <button
                                        type="button"
                                        onClick={() => applyFilters({ user_id: '' })}
                                        className="hover:text-rose-500 ml-1"
                                        title="Remove actor filter"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </Badge>
                            )}
                        </div>
                    )}
                </div>

                {/* Main Activity Table */}
                <div className="bg-white dark:bg-zinc-900 border border-brand-sand/40 dark:border-zinc-800 rounded-2xl shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-brand-sand/30 dark:border-zinc-800 bg-brand-warm/10 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                    <th className="py-3.5 px-4">Actor</th>
                                    <th className="py-3.5 px-4">Action & Category</th>
                                    <th className="py-3.5 px-4">Target Entity</th>
                                    <th className="py-3.5 px-4">Description</th>
                                    <th className="py-3.5 px-4">Network & Context</th>
                                    <th className="py-3.5 px-4">Time</th>
                                    <th className="py-3.5 px-4 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-sand/20 dark:divide-zinc-800/60">
                                {logs.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <History className="size-10 text-zinc-300 dark:text-zinc-700" />
                                                <p className="font-semibold text-zinc-700 dark:text-zinc-300">No activity records found</p>
                                                <p className="text-xs text-zinc-400">
                                                    {hasActiveFilters
                                                        ? 'Try clearing or relaxing your search filters.'
                                                        : 'Activity events will appear here as users interact with the system.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.data.map((log) => {
                                        const CategoryIcon = CATEGORY_ICONS[log.event_category] || Database;
                                        const ContextIcon = CONTEXT_ICONS[log.context] || Globe;
                                        const modelName = log.model_type.split('\\').pop() || log.model_type;
                                        const hasChanges = log.changes && Object.keys(log.changes).length > 0;
                                        const entityUrl = getEntityUrl(log.model_type, log.model_id);
                                        const isSecurityAnomaly =
                                            log.event_category === 'security' ||
                                            log.action === 'failed_login' ||
                                            (log.action === 'updated' && log.changes && 'role' in log.changes);

                                        return (
                                            <tr
                                                key={log.id}
                                                className={`transition-colors group ${
                                                    isSecurityAnomaly
                                                        ? 'bg-rose-500/5 dark:bg-rose-950/15 hover:bg-rose-500/10 dark:hover:bg-rose-950/25 border-l-2 border-l-rose-500'
                                                        : 'hover:bg-brand-warm/5 dark:hover:bg-zinc-800/30'
                                                }`}
                                            >
                                                {/* Actor Column */}
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    {log.user ? (
                                                        <div className="flex items-center gap-2.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => applyFilters({ user_id: log.user!.id })}
                                                                title={`Filter all logs by ${log.user.name}`}
                                                                className="size-8 rounded-full bg-brand-warm/30 dark:bg-zinc-800 hover:ring-2 hover:ring-brand-primary/50 flex items-center justify-center font-bold text-xs text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
                                                            >
                                                                {log.user.name.charAt(0).toUpperCase()}
                                                            </button>
                                                            <div>
                                                                <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => applyFilters({ user_id: log.user!.id })}
                                                                        className="hover:underline hover:text-brand-primary text-left cursor-pointer transition-colors"
                                                                        title={`Filter all logs by ${log.user.name}`}
                                                                    >
                                                                        {log.user.name}
                                                                    </button>
                                                                    {log.impersonator && (
                                                                        <Badge variant="outline" className="text-[10px] py-0 px-1 text-amber-600 bg-amber-50 dark:bg-amber-950/40">
                                                                            Impersonated
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                                                                    <span>{log.user.email}</span>
                                                                    <span className="text-zinc-300 dark:text-zinc-600">•</span>
                                                                    <span className="capitalize font-medium text-brand-primary">{log.user.role}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="size-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                                                <Server className="size-4" />
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-zinc-600 dark:text-zinc-400">System / Automated</div>
                                                                <div className="text-[11px] text-zinc-400">Queue / Webhook</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Action & Category Column */}
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span
                                                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border uppercase tracking-wider ${
                                                                    ACTION_COLORS[log.action] || 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200'
                                                                }`}
                                                            >
                                                                {log.action}
                                                            </span>
                                                            {isSecurityAnomaly && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-500/20 px-1.5 py-0.2 rounded" title="Security related event">
                                                                    <ShieldAlert className="size-3 text-rose-500" />
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span
                                                            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                                                                CATEGORY_COLORS[log.event_category] || 'text-zinc-500'
                                                            }`}
                                                        >
                                                            <CategoryIcon className="size-3" />
                                                            <span className="capitalize">{log.event_category}</span>
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Target Entity */}
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    {entityUrl ? (
                                                        <Link
                                                            href={entityUrl}
                                                            className="group/entity inline-block hover:text-brand-primary transition-colors"
                                                            title={`View ${modelName} #${log.model_id}`}
                                                        >
                                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover/entity:text-brand-primary group-hover/entity:underline flex items-center gap-1">
                                                                <span>{modelName}</span>
                                                                <ExternalLink className="size-2.5 opacity-0 group-hover/entity:opacity-100 transition-opacity text-brand-primary" />
                                                            </div>
                                                            <div className="text-[11px] text-zinc-400 font-mono group-hover/entity:text-brand-primary">
                                                                ID: #{log.model_id}
                                                            </div>
                                                        </Link>
                                                    ) : (
                                                        <div>
                                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                                                {modelName}
                                                            </div>
                                                            <div className="text-[11px] text-zinc-400 font-mono">
                                                                ID: #{log.model_id}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Description & Inline Changes */}
                                                <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                                                    <div className="text-zinc-900 dark:text-zinc-100 font-medium text-xs line-clamp-2">
                                                        {log.description || `${log.action} on ${modelName} #${log.model_id}`}
                                                    </div>
                                                    {log.action === 'updated' && renderInlineChanges(log.changes)}
                                                </td>

                                                {/* Network & Context */}
                                                <td className="py-3.5 px-4 whitespace-nowrap text-xs text-zinc-500">
                                                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                                        <Globe className="size-3 text-zinc-400" />
                                                        {log.ip_address || '127.0.0.1'}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[11px] text-zinc-400 mt-0.5 capitalize">
                                                        <ContextIcon className="size-3" />
                                                        <span>{log.context}</span>
                                                    </div>
                                                </td>

                                                {/* Time */}
                                                <td className="py-3.5 px-4 whitespace-nowrap text-xs text-zinc-500">
                                                    <div className="font-medium text-zinc-800 dark:text-zinc-200">
                                                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </div>
                                                    <div className="text-[11px] text-zinc-400">
                                                        {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </div>
                                                </td>

                                                {/* Details Button */}
                                                <td className="py-3.5 px-4 whitespace-nowrap text-right">
                                                    {hasChanges ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openDiffModal(log)}
                                                            className="h-8 px-2.5 rounded-lg text-xs font-semibold hover:bg-brand-warm/20 dark:hover:bg-zinc-800"
                                                        >
                                                            <Code2 className="size-3.5 mr-1.5 text-brand-primary" />
                                                            View Diffs
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openDiffModal(log)}
                                                            className="h-8 px-2.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-700"
                                                        >
                                                            <Eye className="size-3.5 mr-1" />
                                                            Details
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {logs.data.length > 0 && (
                        <div className="p-4 border-t border-brand-sand/30 dark:border-zinc-800">
                            <Pagination data={logs} />
                        </div>
                    )}
                </div>
            </div>

            {/* Visual Diff & Details Modal */}
            <Dialog open={isDiffModalOpen} onOpenChange={setIsDiffModalOpen}>
                <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between pr-4">
                            <div className="flex items-center gap-2 text-base font-bold">
                                <History className="size-5 text-brand-primary" />
                                Activity Record #{selectedLog?.id}
                            </div>
                            {selectedLog?.changes && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyJson(selectedLog.changes)}
                                    className="h-7 text-xs rounded-lg"
                                >
                                    {copied ? <Check className="size-3.5 mr-1 text-emerald-500" /> : <Copy className="size-3.5 mr-1" />}
                                    Copy JSON
                                </Button>
                            )}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-zinc-500">
                            {selectedLog?.description}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="space-y-4 pt-2">
                            {/* Meta Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-brand-warm/15 dark:bg-zinc-800/50 p-3.5 rounded-xl text-xs">
                                <div>
                                    <span className="text-zinc-400 block text-[11px] font-medium">Actor</span>
                                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                        {selectedLog.user ? selectedLog.user.name : 'System (Automated)'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-zinc-400 block text-[11px] font-medium">Action & Category</span>
                                    <span className="font-bold text-zinc-800 dark:text-zinc-200 capitalize">
                                        {selectedLog.action} ({selectedLog.event_category})
                                    </span>
                                </div>
                                <div>
                                    <span className="text-zinc-400 block text-[11px] font-medium">Target Entity</span>
                                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                        {selectedLog.model_type.split('\\').pop()} #{selectedLog.model_id}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-zinc-400 block text-[11px] font-medium">Timestamp</span>
                                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                        {new Date(selectedLog.created_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Network / Client Info */}
                            <div className="bg-zinc-50 dark:bg-zinc-800/30 border border-brand-sand/30 dark:border-zinc-800 p-3 rounded-xl text-xs space-y-2">
                                <div className="flex items-center justify-between text-zinc-500">
                                    <span>IP Address: <strong className="text-zinc-800 dark:text-zinc-200 font-mono">{selectedLog.ip_address || 'N/A'}</strong></span>
                                    <span>Context: <strong className="text-zinc-800 dark:text-zinc-200 uppercase">{selectedLog.context}</strong></span>
                                </div>
                                {selectedLog.request_id && (
                                    <div className="flex items-center justify-between bg-brand-warm/20 dark:bg-zinc-800/60 p-2 rounded-lg text-[11px]">
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                            <span className="text-zinc-400 font-medium whitespace-nowrap">Request Correlation ID:</span>
                                            <code className="font-mono font-bold text-zinc-700 dark:text-zinc-300 truncate">
                                                {selectedLog.request_id}
                                            </code>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-[10px]"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(selectedLog.request_id!);
                                                    toast.success('Correlation ID copied');
                                                }}
                                            >
                                                <Copy className="size-3 mr-1" />
                                                Copy
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 px-2 text-[10px] bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border-brand-primary/30"
                                                onClick={() => {
                                                    setIsDiffModalOpen(false);
                                                    applyFilters({ request_id: selectedLog.request_id });
                                                }}
                                            >
                                                Filter Related Events
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                {selectedLog.user_agent && (
                                    <div className="text-[11px] text-zinc-400 truncate">
                                        User Agent: {selectedLog.user_agent}
                                    </div>
                                )}
                            </div>

                            {/* Diffs Viewer */}
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                                    Changes & Payload
                                </h4>

                                {selectedLog.action === 'updated' && selectedLog.changes && typeof selectedLog.changes === 'object' && Object.values(selectedLog.changes)[0]?.old !== undefined ? (
                                    <div className="border border-brand-sand/40 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-brand-sand/20 dark:divide-zinc-800">
                                        <div className="grid grid-cols-12 bg-brand-warm/20 dark:bg-zinc-800/80 p-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                                            <div className="col-span-4">Field</div>
                                            <div className="col-span-4 text-rose-600 dark:text-rose-400">Previous Value (Old)</div>
                                            <div className="col-span-4 text-emerald-600 dark:text-emerald-400">Updated Value (New)</div>
                                        </div>
                                        {Object.entries(selectedLog.changes).map(([field, diff]: [string, any]) => (
                                            <div key={field} className="grid grid-cols-12 p-2.5 text-xs hover:bg-brand-warm/5">
                                                <div className="col-span-4 font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                                                    {field}
                                                </div>
                                                <div className="col-span-4 font-mono text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/20 p-1 rounded break-all">
                                                    {diff.old === null || diff.old === undefined
                                                        ? '<null>'
                                                        : typeof diff.old === 'object'
                                                        ? JSON.stringify(diff.old)
                                                        : String(diff.old)}
                                                </div>
                                                <div className="col-span-4 font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 p-1 rounded break-all">
                                                    {diff.new === null || diff.new === undefined
                                                        ? '<null>'
                                                        : typeof diff.new === 'object'
                                                        ? JSON.stringify(diff.new)
                                                        : String(diff.new)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : selectedLog.changes ? (
                                    <pre className="p-3 bg-zinc-900 text-zinc-100 text-xs font-mono rounded-xl overflow-x-auto max-h-72">
                                        {JSON.stringify(selectedLog.changes, null, 2)}
                                    </pre>
                                ) : (
                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl text-center text-xs text-zinc-400">
                                        No attribute modifications recorded for this event.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
