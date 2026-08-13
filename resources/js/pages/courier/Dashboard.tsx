import { Head, Link } from '@inertiajs/react';
import { Package, Truck, QrCode, PlayCircle, ClipboardList, CheckCircle, Clock, ArrowRight, Phone, MessageSquare, Navigation, AlertTriangle, MapPin } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Courier Dashboard', href: '/courier/dashboard' },
];

interface Stats {
    totalBoxes: number;
    collected: number;
    pending: number;
    delivered: number;
    activeRunsheets: number;
}

const completedDeliveryStatuses = ['delivered', 'cancelled', 'held', 'damaged'];

const getRunsheetBoxes = (runsheet: any) => {
    const directBoxes = Array.isArray(runsheet?.boxes) ? runsheet.boxes : [];

    if (directBoxes.length > 0) {
        return directBoxes.map((box: any) => ({ ...box, booking: box.booking ?? null }));
    }

    return (runsheet?.bookings ?? []).flatMap((booking: any) =>
        (booking.boxes ?? []).map((box: any) => ({ ...box, booking })),
    );
};

const countUniqueBookings = (boxes: any[]) =>
    new Set(boxes.map((box: any) => box.booking?.id ?? box.booking_id).filter(Boolean)).size;

export default function CourierDashboard({ runsheets, stats }: { runsheets: any[]; stats: Stats }) {
    const activeRun =
        runsheets.find((r) => r.status === 'in_progress') ??
        runsheets[0] ??
        null;
    const scheduledDate = activeRun ? new Date(activeRun.scheduled_date) : null;
    const runTitle = scheduledDate?.toDateString() === new Date().toDateString()
        ? "Today's Delivery Run"
        : 'Next Delivery Run';
    const runBoxes = activeRun ? getRunsheetBoxes(activeRun) : [];
    const allActiveBoxes = runsheets.flatMap(getRunsheetBoxes);
    const toDeliverCount = runBoxes.filter((box: any) => !completedDeliveryStatuses.includes(box.status)).length;
    const deliveredCount = runBoxes.filter((box: any) => box.status === 'delivered').length;
    const toDeliverStat = allActiveBoxes.filter((box: any) => !completedDeliveryStatuses.includes(box.status)).length;
    const nextDelivery = runBoxes.find((box: any) => !completedDeliveryStatuses.includes(box.status)) ?? runBoxes[0];
    const recipient = nextDelivery?.recipient;
    const recipientQuery = recipient
        ? [recipient.address, recipient.city, recipient.province].filter(Boolean).join(', ')
        : '';
    const runDate = scheduledDate
        ? scheduledDate.toLocaleDateString('en-PH', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        })
        : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Courier Dashboard" />

            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 pb-24 lg:p-10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-text">
                            Delivery Dashboard
                        </h1>
                        <p className="mt-1 text-sm text-brand-text-mid">
                            Focus on the next recipient, then capture proof when delivered.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/courier/scan"
                            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5"
                        >
                            <QrCode className="size-4" />
                            Scan Box
                        </Link>
                        <Link
                            href="/courier/runsheets"
                            className="btn-navy inline-flex items-center gap-2 px-4 py-2.5"
                        >
                            <ClipboardList className="size-4" />
                            Runsheets
                        </Link>
                    </div>
                </div>

                <section className="rounded-card border border-brand-sand bg-white p-5 shadow-sm">
                    {activeRun ? (
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                            <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-brand-warm px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-navy">
                                        {runTitle}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs font-semibold text-brand-text-mid">
                                        <Clock className="size-3.5" />
                                        {runDate}
                                    </span>
                                </div>
                                <h2 className="font-serif text-2xl font-bold tracking-tight text-brand-text">
                                    {activeRun.area_description}
                                </h2>
                                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-brand-text-mid">
                                    <span className="flex items-center gap-1.5">
                                        <Package className="size-4 text-brand-secondary" />
                                        {runBoxes.length} boxes
                                    </span>
                                    {recipient && (
                                        <span className="flex items-center gap-1.5">
                                            <MapPin className="size-4 text-brand-secondary" />
                                            Next: {recipient.name}
                                        </span>
                                    )}
                                </div>
                                {toDeliverCount > 0 && (
                                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                        <span>Delivery proof is required before a box can be marked delivered.</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:w-72">
                                <RunMetric label="To Deliver" value={toDeliverCount} icon={Truck} />
                                <RunMetric label="Delivered" value={deliveredCount} icon={CheckCircle} />
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row xl:flex-col xl:self-stretch">
                                {recipient && (
                                    <div className="flex gap-2">
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(recipientQuery)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-warm text-brand-navy transition-colors hover:bg-brand-sand"
                                            title="Navigate"
                                        >
                                            <Navigation className="size-5" />
                                        </a>
                                        {recipient.phone_number && (
                                            <>
                                                <a
                                                    href={`tel:${recipient.phone_number}`}
                                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200"
                                                    title="Call recipient"
                                                >
                                                    <Phone className="size-5" />
                                                </a>
                                                <a
                                                    href={`sms:${recipient.phone_number}`}
                                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700 transition-colors hover:bg-blue-200"
                                                    title="Message recipient"
                                                >
                                                    <MessageSquare className="size-5" />
                                                </a>
                                            </>
                                        )}
                                    </div>
                                )}

                                <Link
                                    href="/courier/scan"
                                    className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 shadow-lg active:scale-95 xl:flex-1"
                                >
                                    <QrCode className="size-5" />
                                    Scan Next Box
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="font-serif text-2xl font-bold tracking-tight text-brand-text">
                                    No active delivery run
                                </h2>
                                <p className="mt-1 text-sm text-brand-text-mid">
                                    Assigned delivery runs will appear here when they are ready to start.
                                </p>
                            </div>
                            <Link
                                href="/courier/runsheets"
                                className="btn-navy inline-flex items-center justify-center gap-2 px-5 py-3"
                            >
                                <ClipboardList className="size-5" />
                                Review Runsheets
                            </Link>
                        </div>
                    )}
                </section>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                        title="To Deliver"
                        value={toDeliverStat}
                        icon={Clock}
                        color="text-brand-secondary"
                    />
                    <StatCard
                        title="Delivered"
                        value={stats.delivered}
                        icon={CheckCircle}
                        color="text-emerald-600"
                    />
                </div>

                {/* Active Runsheets List */}
                <div>
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="font-serif text-xl font-bold tracking-tight text-brand-text flex items-center gap-3">
                            <Truck className="size-6 text-brand-secondary" />
                            Active Runsheets
                        </h3>
                        <Link
                            href="/courier/runsheets"
                            className="flex items-center gap-1 text-sm font-bold text-brand-rust hover:underline transition-colors active:text-brand-primary"
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
                                    href={`/courier/runsheet/${runsheet.id}`}
                                    key={runsheet.id}
                                    className="card group flex flex-col p-6 transition-all hover:border-brand-secondary hover:shadow-md"
                                >
                                    <div className="mb-4 flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-widest uppercase ${
                                                        runsheet.status === 'assigned'
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
                                                    year: 'numeric'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-auto flex items-center gap-6 border-t border-brand-warm pt-4 text-sm text-brand-text-mid">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-warm group-hover:bg-brand-secondary/10 transition-colors">
                                                <Package className="size-4 text-brand-rust group-hover:text-brand-secondary" />
                                            </div>
                                            <span className="font-medium">
                                                {getRunsheetBoxes(runsheet).length}{' '}
                                                Boxes
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-warm group-hover:bg-brand-secondary/10 transition-colors">
                                                <PlayCircle className="size-4 text-brand-rust group-hover:text-brand-secondary" />
                                            </div>
                                            <span className="font-medium">
                                                {countUniqueBookings(getRunsheetBoxes(runsheet))}{' '}
                                                Bookings
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function RunMetric({ label, value, icon: Icon }: any) {
    return (
        <div className="rounded-lg border border-brand-warm bg-brand-warm/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-text-light">
                <Icon className="size-3.5 text-brand-secondary" />
                {label}
            </div>
            <div className="text-2xl font-black tracking-tight text-brand-text">{value}</div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color }: any) {
    return (
        <div className="card group flex items-center gap-4 p-4 transition-all hover:shadow-md">
            <div className="shrink-0">
                <div className="rounded-lg bg-brand-warm p-2.5 transition-colors group-hover:bg-brand-secondary/10">
                    <Icon className={`size-5 ${color}`} />
                </div>
            </div>
            <div className="min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-widest text-brand-text-light">
                    {title}
                </h3>
                <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-brand-text">
                    {value}
                </p>
            </div>
        </div>
    );
}

