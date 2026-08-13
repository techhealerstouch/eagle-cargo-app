import { Head, Link, router } from '@inertiajs/react';
import {
    Package,
    Truck,
    QrCode,
    PlayCircle,
    ClipboardList,
    CheckCircle,
    Clock,
    ArrowRight,
    Banknote,
    RefreshCw,
} from 'lucide-react';
import { useCallback, useState, useEffect, useRef } from 'react';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

// Skeleton component for loading states
function DashboardSkeleton() {
    return (
        <div className="animate-pulse">
            {/* Header skeleton */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-3">
                    <div className="h-8 w-48 rounded-lg bg-brand-warm/50" />
                    <div className="h-4 w-72 rounded-md bg-brand-warm/30" />
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-24 rounded-lg bg-brand-warm/30" />
                    <div className="h-10 w-28 rounded-lg bg-brand-warm/30" />
                </div>
            </div>
            {/* Stats skeleton */}
            <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="card h-24 bg-brand-warm/20" />
                ))}
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
        runsheets[0] ??
        null;
    const cashBookings =
        activeRun?.bookings.filter(
            (booking: any) => booking.payment_status === 'cash_on_pickup',
        ) ?? [];
    const cashDue = cashBookings.reduce((sum: number, booking: any) => {
        const bookingTotal = (booking.boxes ?? []).reduce(
            (boxSum: number, box: any) =>
                boxSum + Number.parseFloat(box.price_charged ?? '0'),
            0,
        );

        return sum + bookingTotal;
    }, 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Picker Dashboard" />

            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 pb-24 lg:p-10">
                {(isPulling || isRefreshing) && (
                    <div className="sticky top-2 z-30 mx-auto flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-xs font-bold text-white shadow-lg">
                        <RefreshCw
                            className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
                        />
                        {isRefreshing
                            ? 'Refreshing dashboard...'
                            : 'Release to refresh'}
                    </div>
                )}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-text">
                            Pickup Dashboard
                        </h1>
                        <p className="mt-1 text-sm text-brand-text-mid">
                            Start with the next run, then scan or collect
                            payment as needed.
                        </p>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="btn-secondary order-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-50 sm:order-none"
                        >
                            <RefreshCw
                                className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
                            />
                            Refresh
                        </button>
                        <Link
                            href="/picker/scan"
                            className="btn-primary order-1 col-span-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:order-none"
                        >
                            <QrCode className="size-4" />
                            Scan Box
                        </Link>
                        <Link
                            href="/picker/runsheets"
                            className="btn-navy order-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:order-none"
                        >
                            <ClipboardList className="size-4" />
                            Runsheets
                        </Link>
                    </div>
                </div>

                {isRefreshing && runsheets.length === 0 ? (
                    <DashboardSkeleton />
                ) : null}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    <StatCard
                        title="Active Runs"
                        value={stats.activeRunsheets}
                        icon={Truck}
                        color="text-brand-rust"
                    />
                    <StatCard
                        title="Total Boxes"
                        value={stats.totalBoxes}
                        icon={Package}
                        color="text-brand-rust"
                    />
                    <StatCard
                        title="Pending Pickup"
                        value={stats.pending}
                        icon={Clock}
                        color="text-brand-secondary"
                    />
                    <StatCard
                        title="Collected"
                        value={stats.collected}
                        icon={CheckCircle}
                        color="text-emerald-600"
                    />
                    <StatCard
                        title="Cash Due"
                        value={`$${Number(stats.cashDue ?? cashDue).toFixed(2)}`}
                        icon={Banknote}
                        color="text-amber-600"
                        className="col-span-2 sm:col-span-1"
                    />
                </div>

                {/* Active Runsheets List */}
                <div>
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="flex items-center gap-3 font-serif text-xl font-bold tracking-tight text-brand-text">
                            <Truck className="size-6 text-brand-secondary" />
                            Active Runsheets
                        </h3>
                        <Link
                            href="/picker/runsheets"
                            className="flex items-center gap-1 text-sm font-bold text-brand-rust transition-colors hover:underline active:text-brand-primary"
                        >
                            View All <ArrowRight className="size-4" />
                        </Link>
                    </div>

                    {runsheets.length === 0 ? (
                        <div className="card border-dashed bg-brand-warm/10 py-16 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-warm/50">
                                <Truck className="size-8 text-brand-sand" />
                            </div>
                            <p className="font-serif text-lg font-medium text-brand-text-mid">
                                No active runsheets scheduled.
                            </p>
                            <p className="mt-2 text-sm text-brand-text-light">
                                Check back later or contact your admin.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            {runsheets.map((runsheet) => (
                                <Link
                                    href={`/picker/runsheet/${runsheet.id}`}
                                    key={runsheet.id}
                                    className="card group flex flex-col p-6 transition-all hover:border-brand-secondary hover:shadow-md"
                                >
                                    <div className="mb-4 flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-widest uppercase ${
                                                        runsheet.status ===
                                                        'assigned'
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                            : 'border-brand-sand bg-brand-warm/50 text-brand-text-mid'
                                                    }`}
                                                >
                                                    {humanize(runsheet.status)}
                                                </span>
                                                {runsheet.status === 'assigned' && (
                                                    <span className="rounded-full bg-brand-rust px-2 py-0.5 text-[10px] font-bold tracking-widest text-white uppercase animate-pulse shadow-sm">
                                                        New
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="mt-3 font-serif text-xl font-bold text-brand-text transition group-hover:text-brand-secondary">
                                                {runsheet.area_description}
                                            </h4>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-text-mid">
                                                <Clock className="size-4" />
                                                {new Date(
                                                    runsheet.scheduled_date,
                                                ).toLocaleDateString('en-PH', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-auto flex items-center gap-6 border-t border-brand-warm pt-4 text-sm text-brand-text-mid">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-warm transition-colors group-hover:bg-brand-secondary/10">
                                                <Package className="size-4 text-brand-rust group-hover:text-brand-secondary" />
                                            </div>
                                            <span className="font-medium">
                                                {runsheet.bookings.reduce(
                                                    (acc: number, curr: any) =>
                                                        acc +
                                                        (curr.boxes?.length ||
                                                            0),
                                                    0,
                                                )}{' '}
                                                Boxes
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-warm transition-colors group-hover:bg-brand-secondary/10">
                                                <PlayCircle className="size-4 text-brand-rust group-hover:text-brand-secondary" />
                                            </div>
                                            <span className="font-medium">
                                                {runsheet.bookings.length}{' '}
                                                Bookings
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mobile Sticky Bottom Scanner Trigger */}
                <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-brand-sand bg-white p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] sm:hidden">
                    <Link
                        href="/picker/scan"
                        className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 shadow-lg active:scale-95"
                    >
                        <QrCode className="size-5" />
                        Scan Box
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}

function StatCard({ title, value, icon: Icon, color, className = '' }: any) {
    return (
        <div className={`card group flex items-center gap-4 p-4 transition-all hover:shadow-md ${className}`}>
            <div className="shrink-0">
                <div className="rounded-lg bg-brand-warm p-2.5 transition-colors group-hover:bg-brand-secondary/10">
                    <Icon className={`size-5 ${color}`} />
                </div>
            </div>
            <div className="min-w-0">
                <h3 className="text-xs font-bold tracking-widest text-brand-text-light uppercase">
                    {title}
                </h3>
                <p className="mt-1 text-2xl leading-none font-bold tracking-tight text-brand-text">
                    {value}
                </p>
            </div>
        </div>
    );
}
