import { Head, Link, router } from '@inertiajs/react';
import { Package, User, PlusCircle, ArrowRight, Calculator, CheckCircle2, Truck, Search, AlertCircle, FileText, Printer, CreditCard, Loader2, MapPin, TrendingUp, Sparkles, Clock } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import Heading from '@/components/common/heading';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';
import { getSenderDashboardStatusStep, isActiveBoxStatus, isPendingBoxStatus, summarizeBookingBoxStatuses } from './sender-dashboard-statuses';

export default function Dashboard({
    sender,
    history = [],
    recipients = [],
    areas = [],
    boxTypes = [],
    boxPrices = [],
    stats = { total: 0, active: 0, pending: 0, delivered: 0, contacts: 0 },
    bookingsRequiringAction = [],
    pageTitle = 'Dashboard',
    breadcrumbs = []
}: any) {
    const [isCalcLoading, setIsCalcLoading] = useState(false);
    const defaultBreadcrumbs: BreadcrumbItem[] = breadcrumbs.length > 0 ? breadcrumbs : [{ title: 'Home', href: '/dashboard' }];

    useEffect(() => {
        if (areas.length === 0 || boxTypes.length === 0) {
            setIsCalcLoading(true);
            router.reload({
                only: ['areas', 'boxTypes', 'boxPrices'],
                onFinish: () => setIsCalcLoading(false)
            });
        }
    }, []);

    const [calcBoxType, setCalcBoxType] = useState('');
    const [calcArea, setCalcArea] = useState('');
    const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'delivered'>('active');
    const [searchQuery, setSearchQuery] = useState('');

    const estimatedPrice = boxPrices?.find((p: any) =>
        p.area_id.toString() === calcArea && p.box_type_id.toString() === calcBoxType
    )?.price;

    const filteredHistory = useMemo(() => {
        let items = (history || []).filter((b: any) => b.status.toUpperCase() !== 'DRAFT');

        if (searchQuery) {
            items = items.filter((b: any) => b.reference_number?.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        switch (activeTab) {
            case 'active':
                return items.filter((b: any) => b.boxes?.some((box: any) => isActiveBoxStatus(box.status)));
            case 'pending':
                return items.filter((b: any) => b.boxes?.some((box: any) => isPendingBoxStatus(box.status)));
            case 'delivered':
                return items.filter((b: any) => b.boxes?.length > 0 && b.boxes?.every((box: any) => box.status.toUpperCase() === 'DELIVERED'));
            default:
                return items;
        }
    }, [history, activeTab, searchQuery]);

    const getStatusStep = (status: string) => {
        return getSenderDashboardStatusStep(status);
    };

    const getStatusStyle = (status: string) => {
        const normalized = status.toUpperCase();
        if (normalized === 'DELIVERED') {
            return 'text-emerald-700 bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40';
        }
        if (['PENDING', 'DRAFT'].includes(normalized)) {
            return 'text-zinc-700 bg-zinc-100 border-zinc-200/80 dark:bg-zinc-900/80 dark:text-zinc-300 dark:border-zinc-800';
        }
        return 'text-amber-700 bg-amber-50 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40';
    };

    const StatusProgress = ({ status }: { status: string }) => {
        const step = getStatusStep(status);
        const percentage = Math.min(Math.max(step * 25, 15), 100);
        const barColor = status.toUpperCase() === 'DELIVERED'
            ? 'bg-emerald-500 dark:bg-emerald-400'
            : (status.toUpperCase() === 'PENDING' ? 'bg-zinc-400 dark:bg-zinc-600' : 'bg-amber-500 dark:bg-amber-400');

        return (
            <div className="w-28 space-y-1">
                <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-500 ease-out", barColor)}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={defaultBreadcrumbs}>
            <Head title={`Customer ${pageTitle}`} />

            <div className="mx-auto max-w-7xl p-4 md:p-8 pb-16 md:pb-8 space-y-6">
                {/* Header Banner */}
                <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-6 md:p-8 shadow-sm text-white">
                    <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-brand-rust/10 blur-3xl pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/10 text-xs font-medium text-zinc-200">
                                <Sparkles className="size-3.5 text-amber-400" />
                                <span>Sender Dashboard</span>
                                {stats.active > 0 && (
                                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-bold">
                                        {stats.active} Active
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                                Welcome Back, {sender?.first_name || 'Sender'}
                            </h1>
                            <p className="text-xs md:text-sm text-zinc-300/90 max-w-xl leading-relaxed">
                                Track your balikbayan shipments, compute shipping quotes, and manage saved contacts seamlessly.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Link
                                href="/book"
                                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-brand-rust px-6 h-11 text-xs font-semibold text-white shadow-md hover:bg-brand-rust/90 transition-all duration-300 active:scale-95 group"
                                prefetch
                            >
                                <PlusCircle className="h-4 w-4 group-hover:rotate-90 transition-transform duration-500" />
                                Book a Pickup
                            </Link>
                        </div>
                    </div>

                    {/* Quick Actions Row */}
                    <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Link
                            href="/book"
                            className="group flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300"
                            prefetch
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-brand-rust/20 text-brand-rust dark:text-orange-400 group-hover:scale-110 transition-transform">
                                    <PlusCircle className="size-4" />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-semibold text-white">New Booking</p>
                                    <p className="text-[10px] text-zinc-400">Ship a Balikbayan box</p>
                                </div>
                            </div>
                            <ArrowRight className="size-3.5 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
                        </Link>

                        <Link
                            href="/track"
                            className="group flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300"
                            prefetch
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
                                    <Truck className="size-4" />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-semibold text-white">Track a Shipment</p>
                                    <p className="text-[10px] text-zinc-400">Real-time status updates</p>
                                </div>
                            </div>
                            <ArrowRight className="size-3.5 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
                        </Link>

                        <Link
                            href="/book"
                            className="group flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300"
                            prefetch
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                                    <MapPin className="size-4" />
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-semibold text-white">Ship to a Contact</p>
                                    <p className="text-[10px] text-zinc-400">Select a saved recipient</p>
                                </div>
                            </div>
                            <ArrowRight className="size-3.5 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
                        </Link>
                    </div>
                </div>

                {/* Required Actions Section */}
                {bookingsRequiringAction.length > 0 && (
                    <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-5 md:p-6 shadow-xs">
                        <div className="flex items-start sm:items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                                <AlertCircle className="size-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">Required Actions</h3>
                                <p className="text-xs text-amber-800/90 dark:text-amber-300/80 mt-0.5">Your attention is needed. Declaration forms must be submitted on or before pickup.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {bookingsRequiringAction.map((action: any) => (
                                <Link
                                    key={`${action.type}-${action.id}`}
                                    href={action.action_url}
                                    className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-amber-200/50 dark:border-amber-900/30 rounded-xl hover:border-amber-500/60 hover:shadow-xs transition-all duration-300 group"
                                    prefetch
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`p-2 rounded-lg shrink-0 transition-colors ${action.type === 'payment' ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-500 dark:text-blue-400' : 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'} group-hover:scale-105`}>
                                            {action.type === 'payment' ? <CreditCard className="size-4" /> : <FileText className="size-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 truncate">{action.reference_number}</div>
                                            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">{action.reason}</div>
                                        </div>
                                    </div>
                                    <ArrowRight className="size-4 text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-white group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Dashboard Interactive Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Orders Card */}
                    <button
                        onClick={() => setActiveTab('active')}
                        className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/80 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 text-left group relative overflow-hidden"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Total Orders</span>
                            <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
                                <Package className="size-5" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white font-sans">{stats.total}</span>
                            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">bookings</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                            <span className="flex items-center gap-1">
                                <TrendingUp className="size-3.5 text-zinc-400" />
                                Lifetime total
                            </span>
                            <span className="text-[10px] font-semibold text-brand-rust opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
                        </div>
                    </button>

                    {/* Active In-Transit Card */}
                    <button
                        onClick={() => setActiveTab('active')}
                        className={cn(
                            "p-5 rounded-2xl bg-white dark:bg-zinc-900 border transition-all duration-300 text-left group relative overflow-hidden",
                            activeTab === 'active'
                                ? "border-amber-500 ring-2 ring-amber-500/20 dark:ring-amber-500/10 shadow-sm"
                                : "border-zinc-200/70 dark:border-zinc-800/80 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700"
                        )}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Active</span>
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300">
                                <Truck className="size-5" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400 font-sans">{stats.active}</span>
                            <span className="text-xs text-amber-600/70 dark:text-amber-400/70 font-medium">in transit</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                            <span className="flex items-center gap-1">
                                <Clock className="size-3.5 text-amber-500" />
                                Currently moving
                            </span>
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Filter Active →</span>
                        </div>
                    </button>

                    {/* Delivered Card */}
                    <button
                        onClick={() => setActiveTab('delivered')}
                        className={cn(
                            "p-5 rounded-2xl bg-white dark:bg-zinc-900 border transition-all duration-300 text-left group relative overflow-hidden",
                            activeTab === 'delivered'
                                ? "border-emerald-500 ring-2 ring-emerald-500/20 dark:ring-emerald-500/10 shadow-sm"
                                : "border-zinc-200/70 dark:border-zinc-800/80 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700"
                        )}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Delivered</span>
                            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                                <CheckCircle2 className="size-5" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 font-sans">{stats.delivered}</span>
                            <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-medium">received</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                            <span className="flex items-center gap-1">
                                <CheckCircle2 className="size-3.5 text-emerald-550" />
                                Completed boxes
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Filter Delivered →</span>
                        </div>
                    </button>

                    {/* Contacts Card */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/80 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 group relative overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Contacts</span>
                            <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 rounded-xl group-hover:scale-110 transition-transform duration-300">
                                <User className="size-5" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white font-sans">{stats.contacts}</span>
                            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">contacts</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                            <span className="flex items-center gap-1">
                                <User className="size-3.5 text-zinc-400" />
                                Saved recipients
                            </span>
                            <Link href="/book" className="text-[10px] font-semibold text-brand-rust hover:underline" prefetch>+ Add New</Link>
                        </div>
                    </div>
                </div>

                {/* Main Content Layout Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Shipment List & Filters */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Tab Navigation & Search */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/70 dark:border-zinc-800 pb-3">
                            <div className="flex items-center gap-6">
                                {(['active', 'pending', 'delivered'] as const).map((tab) => {
                                    const tabCount = tab === 'active' ? stats.active : tab === 'pending' ? stats.pending : stats.delivered;
                                    const isActive = activeTab === tab;

                                    return (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 ${
                                                isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                                            }`}
                                        >
                                            {tab}
                                            {tabCount > 0 && (
                                                <span className={cn(
                                                    "inline-flex items-center justify-center h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold leading-none transition-colors",
                                                    isActive ? 'bg-brand-rust text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                                )}>
                                                    {tabCount}
                                                </span>
                                            )}
                                            {isActive && (
                                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-rust rounded-full" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="relative group w-full sm:w-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 group-focus-within:text-zinc-800 dark:group-focus-within:text-zinc-200 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search bookings..."
                                    className="h-9 pl-9 pr-4 text-xs font-medium bg-zinc-50/80 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust w-full sm:w-56 transition-all placeholder:text-zinc-400 text-zinc-900 dark:text-white"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Shipment List Container */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-900 rounded-2xl overflow-hidden shadow-xs min-h-[400px]">
                            {filteredHistory.length > 0 ? (
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-900/60">
                                    {filteredHistory.map((booking: any) => {
                                        const statusSummary = summarizeBookingBoxStatuses(booking.boxes || []);

                                        return (
                                            <div key={booking.id} className="p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-all duration-300 group">
                                                <div className="flex items-center gap-4 w-full min-w-0">
                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 text-zinc-500 dark:text-zinc-400 group-hover:scale-105 transition-all duration-300">
                                                        <Package className="size-6 text-zinc-700 dark:text-zinc-300" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <Link href={`/track?tracking_number=${booking.reference_number}`} className="inline-block max-w-full">
                                                            <div className="font-semibold text-zinc-900 dark:text-white tracking-tight uppercase text-base font-mono leading-none hover:text-brand-rust transition-colors truncate">
                                                                {booking.reference_number}
                                                            </div>
                                                        </Link>
                                                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-2 overflow-hidden">
                                                            <span className="truncate">{new Date(booking.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                                                            <span className="text-zinc-300 dark:text-zinc-700 shrink-0">•</span>
                                                            <span className="shrink-0 font-medium">{booking.boxes?.length} {booking.boxes?.length === 1 ? 'Box' : 'Boxes'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-none border-zinc-100 dark:border-zinc-900 pt-4 md:pt-0">
                                                    <div className="flex flex-col items-start md:items-end gap-2">
                                                        <div className={cn(
                                                            "text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border transition-colors",
                                                            getStatusStyle(statusSummary.status)
                                                        )}>
                                                            {statusSummary.label || humanize(statusSummary.status)}
                                                        </div>
                                                        <StatusProgress status={statusSummary.status} />
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {booking.declaration_form_status !== 'missing' && (
                                                            <a
                                                                href={`/track/declaration/${booking.id}/view`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-900 dark:hover:bg-zinc-100 hover:text-white dark:hover:text-zinc-900 transition-all shadow-2xs active:scale-95"
                                                                title="Print declaration"
                                                            >
                                                                <Printer className="size-4" />
                                                            </a>
                                                        )}
                                                        <Link
                                                            href={`/track?tracking_number=${booking.reference_number}`}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-900 dark:hover:bg-zinc-100 hover:text-white dark:hover:text-zinc-900 transition-all shadow-2xs active:scale-95 group/btn"
                                                            title="Track shipment"
                                                            prefetch
                                                        >
                                                            <ArrowRight className="size-4 transform group-hover/btn:translate-x-0.5 transition-transform" />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[350px] px-6 text-center">
                                    <div className="h-16 w-16 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl flex items-center justify-center mb-4 border border-zinc-200/50 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600">
                                        <Package className="size-8" />
                                    </div>
                                    <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">No {activeTab} Bookings</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed">
                                        {searchQuery ? `No reference matches "${searchQuery}"` : `You don't have any shipments currently in the ${activeTab} phase.`}
                                    </p>
                                    {!searchQuery && (
                                        <Link
                                            href="/book"
                                            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-all"
                                            prefetch
                                        >
                                            <PlusCircle className="size-3.5" /> Book a New Shipment
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Calculator & Recent Contacts */}
                    <div className="space-y-6">
                        {/* Price Calculator Mini Widget */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-900 p-6 rounded-2xl shadow-xs transition-all">
                            <h3 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5 mb-5">
                                <div className="p-2 bg-brand-rust/10 text-brand-rust dark:text-orange-400 rounded-lg">
                                    <Calculator className="size-4.5" />
                                </div>
                                Price Calculator
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="calc-box-type" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 block">Box Type</label>
                                    <select
                                        id="calc-box-type"
                                        className="w-full h-10 px-3 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust text-zinc-900 dark:text-white transition-all cursor-pointer"
                                        value={calcBoxType}
                                        onChange={(e) => setCalcBoxType(e.target.value)}
                                    >
                                        <option value="">Select Package...</option>
                                        {boxTypes?.filter((bt: any) => !bt.name?.toLowerCase().includes('cbm') && bt.name?.toLowerCase() !== 'custom box').map((bt: any) => (
                                            <option key={bt.id} value={bt.id}>{bt.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="calc-area" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 block">Destination</label>
                                    <select
                                        id="calc-area"
                                        className="w-full h-10 px-3 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust text-zinc-900 dark:text-white transition-all cursor-pointer"
                                        value={calcArea}
                                        onChange={(e) => setCalcArea(e.target.value)}
                                    >
                                        <option value="">Select Region...</option>
                                        {areas?.map((a: any) => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-2">
                                    {isCalcLoading ? (
                                        <div className="py-6 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                            <Loader2 className="size-4 text-brand-rust animate-spin mb-2" />
                                            <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Loading Rates...</p>
                                        </div>
                                    ) : estimatedPrice ? (
                                        <div className="text-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-5 rounded-xl shadow-md relative overflow-hidden group">
                                            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Door-to-Door Estimate</span>
                                            <div className="text-3xl font-extrabold text-white tracking-tight mt-1">${estimatedPrice}</div>
                                            <Link
                                                href={`/book?box_type_id=${calcBoxType}&area_id=${calcArea}`}
                                                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-brand-rust text-white py-2.5 text-xs font-bold hover:bg-brand-rust/90 transition-all active:scale-95 shadow-sm"
                                                prefetch
                                            >
                                                Book This Route <ArrowRight className="size-3.5" />
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 text-center uppercase tracking-wider bg-zinc-50/80 dark:bg-zinc-900/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                            Select box & destination to compute quote
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Recent Contacts */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-900 p-6 rounded-2xl shadow-xs transition-all space-y-4">
                            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-3">
                                <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                                    <User className="size-4 text-zinc-500" />
                                    Recent Contacts
                                </h2>
                                <Link href="/book" className="text-xs font-semibold text-brand-rust hover:underline" prefetch>New Booking</Link>
                            </div>
                            <div className="grid grid-cols-1 gap-3 max-h-75 overflow-y-auto pr-1">
                                {recipients.length > 0 ? (
                                    recipients.slice(0, 4).map((recipient: any) => {
                                        const initials = recipient.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                                        return (
                                            <div key={recipient.id} className="p-3.5 bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl transition-all duration-300 group flex justify-between items-center">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 border border-zinc-300/40 dark:border-zinc-700">
                                                        {initials}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">{recipient.name}</div>
                                                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">{recipient.city || 'Provincial'}</div>
                                                    </div>
                                                </div>
                                                <Link
                                                    href={`/book?recipient_id=${recipient.id}`}
                                                    className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-brand-rust hover:border-brand-rust hover:text-white dark:hover:bg-brand-rust dark:hover:border-brand-rust transition-all duration-200 active:scale-95 shadow-2xs"
                                                    title="Ship to this contact"
                                                    prefetch
                                                >
                                                    <PlusCircle className="size-4" />
                                                </Link>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-8 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center px-4">
                                        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">No recent contacts saved yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
