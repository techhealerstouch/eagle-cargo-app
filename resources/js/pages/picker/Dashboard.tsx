import { Head, Link, router } from '@inertiajs/react';
import {
    Package,
    Truck,
    QrCode,
    PlayCircle,
    ClipboardList,
    CheckCircle2,
    Clock,
    ArrowRight,
    Banknote,
    RefreshCw,
    MapPin,
    Calendar,
    Sparkles,
    ChevronRight,
} from 'lucide-react';
import { useCallback, useState, useEffect, useRef } from 'react';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

// Skeleton component for loading states
function DashboardSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-40 rounded-3xl bg-slate-200/70 dark:bg-slate-800/50" />
            <div className="grid grid-cols-2 gap-3">
                <div className="h-24 rounded-2xl bg-slate-200/70 dark:bg-slate-800/50" />
                <div className="h-24 rounded-2xl bg-slate-200/70 dark:bg-slate-800/50" />
                <div className="h-24 rounded-2xl bg-slate-200/70 dark:bg-slate-800/50" />
                <div className="h-24 rounded-2xl bg-slate-200/70 dark:bg-slate-800/50" />
            </div>
        </div>
    );
}

// Pull-to-refresh hook
function usePullToRefresh(onRefresh: () => Promise<void>) {
    const [isPulling, setIsPulling] = useState(false);
    const startYRef = useRef(0);
    const startXRef = useRef(0);
    const isMovingRef = useRef(false);

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            startYRef.current = e.touches[0].clientY;
            startXRef.current = e.touches[0].clientX;
            isMovingRef.current = window.scrollY <= 10;
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isMovingRef.current || window.scrollY > 10) {
                return;
            }

            const deltaY = e.touches[0].clientY - startYRef.current;
            const deltaX = Math.abs(e.touches[0].clientX - startXRef.current);

            if (deltaY > 50 && deltaX < 30) {
                setIsPulling(true);
            }
        };

        const handleTouchEnd = async () => {
            if (isPulling) {
                await onRefresh();
            }

            setIsPulling(false);
            isMovingRef.current = false;
        };

        document.addEventListener('touchstart', handleTouchStart, {
            passive: true,
        });
        document.addEventListener('touchmove', handleTouchMove, {
            passive: true,
        });
        document.addEventListener('touchend', handleTouchEnd, {
            passive: true,
        });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [onRefresh, isPulling]);

    return isPulling;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Picker Dashboard', href: '/picker/dashboard' },
];

interface Stats {
    totalBoxes: number;
    collected: number;
    pending: number;
    activeRunsheets: number;
    cashDue: number;
}

export default function PickerDashboard({
    runsheets,
    stats,
}: {
    runsheets: any[];
    stats: Stats;
}) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        router.reload({
            only: ['runsheets', 'stats'],
            onFinish: () => setIsRefreshing(false),
        });
    }, []);
    const isPulling = usePullToRefresh(handleRefresh);

    const activeRun =
        runsheets.find((r) => r.status === 'in_progress') ??
        runsheets.find((r) => r.status === 'assigned') ??
        runsheets[0] ??
        null;

    const totalActiveBoxes = activeRun
        ? activeRun.bookings.reduce(
              (acc: number, curr: any) => acc + (curr.boxes?.length || 0),
              0,
          )
        : 0;

    const collectedActiveBoxes = activeRun
        ? activeRun.bookings.reduce(
              (acc: number, curr: any) =>
                  acc +
                  (curr.boxes?.filter((b: any) => b.status === 'collected')
                      ?.length || 0),
              0,
          )
        : 0;

    const activeProgressPct =
        totalActiveBoxes > 0
            ? Math.round((collectedActiveBoxes / totalActiveBoxes) * 100)
            : 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Picker Dashboard" />

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6 lg:p-8">
                {/* Pull to refresh pill */}
                {(isPulling || isRefreshing) && (
                    <div className="sticky top-3 z-30 mx-auto flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-xl">
                        <RefreshCw
                            className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
                        />
                        {isRefreshing
                            ? 'Syncing runsheets...'
                            : 'Release to refresh'}
                    </div>
                )}

                {/* Top Driver Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            </span>
                            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                On Duty • Ready
                            </span>
                        </div>
                        <h1 className="mt-0.5 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                            Driver Console
                        </h1>
                    </div>

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        title="Refresh data"
                        className="flex size-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-90 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    >
                        <RefreshCw
                            className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
                        />
                    </button>
                </div>

                {isRefreshing && runsheets.length === 0 ? (
                    <DashboardSkeleton />
                ) : (
                    <>
                        {/* Hero Card: Current / Next Active Run */}
                        {activeRun ? (
                            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-navy via-slate-900 to-slate-950 p-6 text-white shadow-xl shadow-brand-navy/20">
                                {/* Ambient decorative glow */}
                                <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-brand-primary/20 blur-3xl" />

                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-md">
                                            <Truck className="size-3.5 text-brand-sand" />
                                            {activeRun.status === 'in_progress'
                                                ? 'Active Run In Progress'
                                                : 'Assigned Run'}
                                        </div>
                                        <span className="text-xs font-bold text-slate-300">
                                            {new Date(
                                                activeRun.scheduled_date,
                                            ).toLocaleDateString('en-PH', {
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    </div>

                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                                            {activeRun.area_description ||
                                                `Runsheet #${activeRun.id}`}
                                        </h2>
                                        <p className="mt-1 text-xs font-semibold text-slate-300">
                                            {activeRun.bookings?.length || 0}{' '}
                                            Stops • {totalActiveBoxes} Total
                                            Boxes
                                        </p>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex justify-between text-xs font-bold">
                                            <span className="text-slate-300">
                                                Pickup Progress
                                            </span>
                                            <span className="text-emerald-400">
                                                {collectedActiveBoxes} /{' '}
                                                {totalActiveBoxes} Boxes (
                                                {activeProgressPct}%)
                                            </span>
                                        </div>
                                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                                                style={{
                                                    width: `${activeProgressPct}%`,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Direct Action Button */}
                                    <div className="pt-2">
                                        <Link
                                            href={`/picker/runsheet/${activeRun.id}`}
                                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary px-5 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-brand-primary/30 transition-all hover:bg-opacity-90 active:scale-95"
                                        >
                                            {activeRun.status === 'in_progress'
                                                ? 'Resume Active Run'
                                                : 'Open Runsheet & Start'}
                                            <ArrowRight className="size-4" />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white/80 p-8 text-center dark:border-slate-800 dark:bg-slate-900/60">
                                <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                                    <CheckCircle2 className="size-8" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                    All Caught Up!
                                </h3>
                                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    No active runs scheduled at the moment.
                                </p>
                            </div>
                        )}

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <StatTile
                                title="Active Runs"
                                value={stats.activeRunsheets}
                                icon={Truck}
                                color="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400"
                            />
                            <StatTile
                                title="Total Boxes"
                                value={stats.totalBoxes}
                                icon={Package}
                                color="text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400"
                            />
                            <StatTile
                                title="Collected"
                                value={stats.collected}
                                icon={CheckCircle2}
                                color="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400"
                            />
                            <StatTile
                                title="Cash to Collect"
                                value={`$${Number(stats.cashDue ?? 0).toFixed(0)}`}
                                icon={Banknote}
                                color="text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400"
                            />
                        </div>

                        {/* Runsheets List */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                                    Scheduled Runsheets
                                </h3>
                                <Link
                                    href="/picker/runsheets"
                                    className="flex items-center gap-1 text-xs font-black text-brand-primary hover:underline"
                                >
                                    View All <ChevronRight className="size-3.5" />
                                </Link>
                            </div>

                            {runsheets.length === 0 ? (
                                <div className="rounded-2xl border border-slate-100 bg-white/70 p-6 text-center text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
                                    No runsheets currently assigned.
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {runsheets.map((runsheet) => {
                                        const boxCount =
                                            runsheet.bookings.reduce(
                                                (acc: number, curr: any) =>
                                                    acc +
                                                    (curr.boxes?.length || 0),
                                                0,
                                            );
                                        const isAssigned =
                                            runsheet.status === 'assigned';
                                        const isInProgress =
                                            runsheet.status === 'in_progress';

                                        return (
                                            <Link
                                                key={runsheet.id}
                                                href={`/picker/runsheet/${runsheet.id}`}
                                                className="group flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:border-brand-primary hover:shadow-md active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900"
                                            >
                                                <div className="flex items-center gap-3.5 min-w-0">
                                                    <div
                                                        className={`flex size-11 shrink-0 items-center justify-center rounded-2xl font-black ${
                                                            isInProgress
                                                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                                                                : isAssigned
                                                                  ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        <Truck className="size-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate text-sm font-black text-slate-900 dark:text-white">
                                                                {runsheet.area_description ||
                                                                    `Runsheet #${runsheet.id}`}
                                                            </span>
                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                                                    isInProgress
                                                                        ? 'bg-amber-500 text-slate-950'
                                                                        : isAssigned
                                                                          ? 'bg-emerald-600 text-white'
                                                                          : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                                                }`}
                                                            >
                                                                {humanize(
                                                                    runsheet.status,
                                                                )}
                                                            </span>
                                                        </div>
                                                        <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                            {
                                                                runsheet
                                                                    .bookings
                                                                    ?.length
                                                            }{' '}
                                                            stops • {boxCount}{' '}
                                                            boxes
                                                        </p>
                                                    </div>
                                                </div>

                                                <ChevronRight className="size-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-brand-primary" />
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}

function StatTile({
    title,
    value,
    icon: Icon,
    color,
}: {
    title: string;
    value: string | number;
    icon: any;
    color: string;
}) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${color}`}
            >
                <Icon className="size-5" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">
                    {title}
                </p>
                <p className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                    {value}
                </p>
            </div>
        </div>
    );
}
