import type { PageProps } from '@inertiajs/core';
import { Head, usePage, Link, router } from '@inertiajs/react';
import {
    Package,
    TrendingUp,
    Users,
    Calendar,
    Clock,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    MapPin,
    Truck,
    Inbox,
    Plus,
    FileText,
    CreditCard,
} from 'lucide-react';
import React from 'react';
import { QuickActions } from '@/components/admin/quick-actions';
import Heading from '@/components/common/heading';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import * as integrityRoutes from '@/routes/admin/data-integrity/index';
import type { BreadcrumbItem, Auth } from '@/types';


const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
    },
];

interface DashboardStats {
    activeBoxes: number;
    pendingCollections: number;
    batchesInTransit: number;
    totalSenders: number;
    missingDeclarations?: number;
    outstandingPayments?: number;
    outstandingBalance?: string | null;
}

interface RecentBooking {
    id: number;
    reference_number: string;
    name: string;
    destination: string;
    date: string;
    status: string;
}

interface DashboardAlerts {
    dispatchReadyBoxes: number;
    deliveryReadyBookings: number;
    arrivedBatches: number;
    unreadEnquiries: number;
    integrityWarnings: number;
}

interface RunsheetItem {
    id: number;
    area: string;
    driver: string;
    stops: number;
    status: string;
}

interface AdminDashboardProps {
    stats: DashboardStats;
    recentBookings: RecentBooking[];
    alerts: DashboardAlerts;
    todaysRunsheets: RunsheetItem[];
}

function AdminDashboard() {
    const { auth, stats, recentBookings, alerts, todaysRunsheets } =
        usePage<PageProps & AdminDashboardProps & { auth: Auth }>().props;

    const isSuperAdmin = auth.user?.role === 'super_admin';

    React.useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ only: ['alerts', 'stats', 'todaysRunsheets', 'recentBookings'] });
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex h-full flex-1 flex-col gap-8 p-8">
            {/* Header */}
            <div className="mb-2 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
                <Heading
                    eyebrow="DASHBOARD OPERATIONS"
                    title="Dashboard"
                    description="Your central command for monitoring box logistics and terminal activity."
                />

                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href="/admin/bookings/create"
                        className="btn-primary flex items-center gap-2 shadow-md"
                    >
                        <Plus className="size-4" /> New Booking
                    </Link>
                    <Link
                        href="/admin/bookings"
                        className="btn-outline flex items-center gap-2"
                    >
                        <Clock className="size-4" /> Recent Activity
                    </Link>
                    <Link
                        href="/track"
                        className="btn-outline flex items-center gap-2"
                    >
                        <Package className="size-4" /> Track a Box
                    </Link>
                </div>
            </div>

            {/* Quick Stats - Compact 6-card row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <StatCard
                    title="Active Boxes"
                    value={stats.activeBoxes.toLocaleString()}
                    trend="Currently tracked"
                    icon={Package}
                    trendUp={stats.activeBoxes > 0}
                    href="/admin/boxes"
                />
                <StatCard
                    title="Pending Pickups"
                    value={stats.pendingCollections.toLocaleString()}
                    trend="Needs runsheet"
                    icon={Clock}
                    trendUp={false}
                    href="/admin/bookings?status=pending"
                />
                <StatCard
                    title="Batches Sailing"
                    value={stats.batchesInTransit.toLocaleString()}
                    trend="Shipping to PH"
                    icon={Truck}
                    trendUp={stats.batchesInTransit > 0}
                    href="/admin/batches?status=sailed"
                />
                <StatCard
                    title="Total Senders"
                    value={stats.totalSenders.toLocaleString()}
                    trend="Registered"
                    icon={Users}
                    trendUp={stats.totalSenders > 0}
                    href="/admin/senders"
                />
                <StatCard
                    title="Missing Declarations"
                    value={(stats.missingDeclarations ?? 0).toLocaleString()}
                    trend={(stats.missingDeclarations ?? 0) > 0 ? 'Forms required' : 'All submitted'}
                    icon={FileText}
                    trendUp={(stats.missingDeclarations ?? 0) === 0}
                    href="/admin/bookings?declaration_form_status=missing"
                />
                <StatCard
                    title="Outstanding Payments"
                    value={(stats.outstandingPayments ?? 0).toLocaleString()}
                    trend={
                        stats.outstandingBalance
                            ? `${stats.outstandingBalance} due`
                            : (stats.outstandingPayments ?? 0) > 0
                              ? 'Awaiting payment'
                              : 'All settled'
                    }
                    icon={CreditCard}
                    trendUp={(stats.outstandingPayments ?? 0) === 0}
                    href="/admin/bookings?payment_status=unpaid"
                />
            </div>

            {/* Two Column Layout for Main Content */}
            <div className="mt-2 grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Left Column: Recent Activity (Takes up 2/3) */}
                <div className="flex flex-col gap-8 lg:col-span-2">
                    <div className="card flex h-full w-full flex-col overflow-hidden p-8">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="flex items-center gap-3 font-serif text-2xl font-bold tracking-tight text-brand-text">
                                <Calendar className="size-6 text-brand-rust" />
                                Recent Bookings
                            </h2>
                            <Link
                                href="/admin/bookings"
                                className="flex items-center gap-1 text-sm font-semibold text-brand-rust transition-colors hover:text-brand-primary hover:underline"
                            >
                                View all <ArrowRight className="size-4" />
                            </Link>
                        </div>

                        <div className="w-full overflow-x-auto">
                            {recentBookings.length > 0 ? (
                            <table className="w-full border-collapse text-left whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-border bg-brand-warm/10 dark:bg-brand-warm/20 text-sm text-brand-text-mid">
                                        <th className="rounded-tl-lg px-5 py-4 font-semibold">
                                            Booking ID
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Sender
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Destination
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Date
                                        </th>
                                        <th className="rounded-tr-lg px-5 py-4 font-semibold">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentBookings.map((booking) => (
                                        <BookingRow
                                            key={booking.id}
                                            id={booking.id}
                                            referenceNumber={booking.reference_number}
                                            name={booking.name}
                                            dest={booking.destination}
                                            date={booking.date}
                                            status={booking.status}
                                        />
                                    ))}
                                </tbody>
                            </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-brand-text-mid">
                                    <Inbox className="mb-3 size-10 opacity-40" />
                                    <p className="text-sm font-medium">No bookings yet</p>
                                    <p className="mt-1 text-xs">Bookings will appear here as they come in.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Alerts & Quick Actions (Takes up 1/3) */}
                <div className="flex flex-col gap-8">
                    {/* Action Needed */}
                    <div className="card w-full border-l-4 border-l-brand-primary bg-brand-warm/10 dark:bg-brand-warm/20 p-8">
                        <h2 className="mb-6 flex items-center gap-3 font-serif text-xl font-bold text-brand-text">
                            <AlertCircle className="size-6 text-brand-primary" />
                            Attention Needed
                        </h2>
                        <ul className="space-y-6">
                            {alerts.dispatchReadyBoxes > 0 && (
                            <li className="flex items-start gap-4">
                                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-primary shadow-sm shadow-brand-primary/50 animate-pulse"></div>
                                <div>
                                    <p className="text-base leading-none font-semibold text-brand-primary">
                                        <Link href="/admin/runsheets/create?type=pickup" className="hover:underline">
                                            {alerts.dispatchReadyBoxes} pickup {alerts.dispatchReadyBoxes === 1 ? 'is' : 'are'} ready for dispatch
                                        </Link>
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed text-brand-text-mid">
                                        Assign to a runsheet for warehouse
                                        pickup.
                                    </p>
                                </div>
                            </li>
                            )}
                            {alerts.deliveryReadyBookings > 0 && (
                            <li className="flex items-start gap-4">
                                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500 shadow-sm shadow-sky-500/50 animate-pulse"></div>
                                <div>
                                    <p className="text-base leading-none font-semibold text-sky-600 dark:text-sky-500">
                                        <Link href="/admin/runsheets/create?type=delivery" className="hover:underline">
                                            {alerts.deliveryReadyBookings} {alerts.deliveryReadyBookings === 1 ? 'delivery is' : 'deliveries are'} ready for dispatch
                                        </Link>
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed text-brand-text-mid">
                                        Assign to a courier runsheet for final delivery.
                                    </p>
                                </div>
                            </li>
                            )}
                            {alerts.arrivedBatches > 0 && (
                            <li className="flex items-start gap-4">
                                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50 animate-pulse"></div>
                                <div>
                                    <p className="text-base leading-none font-semibold text-purple-600 dark:text-purple-500">
                                        <Link href="/admin/batches?status=arrived" className="hover:underline">
                                            {alerts.arrivedBatches} {alerts.arrivedBatches === 1 ? 'batch has' : 'batches have'} arrived (Ready for Delivery)
                                        </Link>
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed text-brand-text-mid">
                                        Batch has arrived at destination and boxes need to be marked ready for delivery.
                                    </p>
                                </div>
                            </li>
                            )}
                            {alerts.unreadEnquiries > 0 && (
                            <li className="flex items-start gap-4">
                                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></div>
                                <div>
                                    <p className="text-base leading-none font-semibold text-amber-600 dark:text-amber-500">
                                        <Link href="/admin/enquiries" className="hover:underline">
                                            {alerts.unreadEnquiries} unread sender {alerts.unreadEnquiries === 1 ? 'enquiry' : 'enquiries'}
                                        </Link>
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed text-brand-text-mid">
                                        Pending replies from the contact form.
                                    </p>
                                </div>
                            </li>
                            )}
                            {isSuperAdmin && alerts.integrityWarnings > 0 && (
                            <li className="flex items-start gap-4">
                                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-sm shadow-red-500/50 animate-pulse"></div>
                                <div>
                                    <p className="text-base leading-none font-semibold text-red-600">
                                        <Link href={integrityRoutes.index.url()} className="hover:underline">
                                            {alerts.integrityWarnings} system health {alerts.integrityWarnings === 1 ? 'warning' : 'warnings'}
                                        </Link>
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed text-brand-text-mid">
                                        Potential orphan records or missing documentation detected.
                                    </p>
                                </div>
                            </li>
                            )}
                            {alerts.dispatchReadyBoxes === 0 && alerts.deliveryReadyBookings === 0 && alerts.arrivedBatches === 0 && alerts.unreadEnquiries === 0 && (!isSuperAdmin || alerts.integrityWarnings === 0) && (
                            <li className="flex items-start gap-4">
                                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div>
                                <div>
                                    <p className="text-base leading-none font-semibold text-brand-text">
                                        All clear!
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed text-brand-text-mid">
                                        No items need your attention right now.
                                    </p>
                                </div>
                            </li>
                            )}
                        </ul>
                    </div>

                    {/* Today's Runsheets */}
                    <div className="card w-full flex-1 p-8">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="font-serif text-xl font-bold tracking-tight text-brand-text">
                                Today's Runsheets
                            </h2>
                        </div>
                        <div className="space-y-4">
                            {todaysRunsheets.length > 0 ? (
                                todaysRunsheets.map((rs) => (
                                    <div key={rs.id} className="group flex cursor-pointer items-center justify-between rounded-xl border border-border bg-brand-cream/10 p-5 transition-all duration-300 hover:border-brand-rust hover:shadow-md">
                                        <div className="flex items-center gap-4">
                                            <div className={`rounded-xl p-2.5 transition-transform group-hover:scale-110 ${rs.status === 'Active' ? 'bg-brand-rust/10 text-brand-rust' : 'bg-brand-sand/50 text-brand-text-mid'}`}>
                                                {rs.status === 'Active' ? <CheckCircle className="size-5" /> : <MapPin className="size-5" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-brand-text">
                                                    {rs.area}
                                                </p>
                                                <p className="mt-1 text-xs text-brand-text-mid">
                                                    Driver: {rs.driver} • {rs.stops} {rs.stops === 1 ? 'stop' : 'stops'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`rounded-full border px-3 py-1 text-xs font-bold tracking-wider uppercase ${
                                            rs.status === 'Active'
                                                ? 'border-emerald-200 bg-emerald-100/50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                : 'border-border bg-brand-warm/10 dark:bg-brand-warm/20 text-brand-text-mid'
                                        }`}>
                                            {rs.status}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-brand-text-mid">
                                    <MapPin className="mb-2 size-8 opacity-40" />
                                    <p className="text-sm font-medium">No runsheets today</p>
                                </div>
                            )}
                        </div>
                        <Link
                            href="/admin/runsheets"
                            className="btn-outline mt-6 w-full justify-center py-2.5 text-sm font-semibold"
                        >
                            Manage Runsheets
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    trend,
    icon: Icon,
    trendUp,
    href,
}: any) {
    const cardContent = (
        <div className="relative z-10 flex flex-col justify-between h-full">
            {/* Top row: Title and Icon */}
            <div className="flex items-center justify-between gap-1.5 mb-1">
                <h3 className="text-xs font-semibold text-brand-text-mid transition-colors group-hover:text-brand-rust truncate">
                    {title}
                </h3>
                <div className="rounded-lg p-1.5 shrink-0 bg-brand-rust/10 text-brand-rust transition-transform duration-200 group-hover:scale-105">
                    <Icon className="size-3.5" />
                </div>
            </div>

            {/* Middle: Value */}
            <div className="mb-1">
                <p className="text-xl font-bold tracking-tight text-brand-text truncate">
                    {value}
                </p>
            </div>

            {/* Bottom row: Trend / Subtext */}
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-brand-text-mid truncate">
                <TrendingUp
                    className={`size-3 shrink-0 ${
                        trendUp ? 'text-emerald-500' : 'text-brand-text-mid scale-x-[-1] rotate-180'
                    }`}
                />
                <span className="truncate text-brand-text-mid">
                    {trend}
                </span>
            </div>
        </div>
    );

    const classes = 'card relative w-full overflow-hidden p-3.5 border-border group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-brand-rust/40';

    if (href) {
        return (
            <Link href={href} className={classes}>
                {cardContent}
            </Link>
        );
    }

    return (
        <div className={classes}>
            {cardContent}
        </div>
    );
}

function BookingRow({ id, referenceNumber, name, dest, date, status }: any) {
    let statusClass = 'bg-gray-100/50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700';

    if (status === 'Confirmed') {
        statusClass = 'bg-blue-50/50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
    }

    if (status === 'Pending') {
        statusClass = 'bg-amber-50/50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
    }

    if (status === 'Collected') {
        statusClass = 'bg-emerald-50/50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
    }

    if (status === 'In Transit') {
        statusClass = 'bg-indigo-50/50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800';
    }

    const isNew = date.includes('second') || date.includes('minute') || date.includes('hour') || date.includes('now');

    return (
        <tr className={`group border-b border-border transition-colors last:border-0 ${isNew ? 'bg-emerald-50/40 hover:bg-emerald-100/40 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20' : 'hover:bg-brand-cream/20'}`}>
            <td className="px-5 py-5 text-sm font-semibold text-brand-text">
                <div className="flex items-center gap-2">
                    <Link
                        href={`/admin/bookings/${id}`}
                        className="transition-colors group-hover:text-brand-rust group-hover:underline"
                    >
                        {referenceNumber}
                    </Link>
                    {isNew && (
                        <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.25 text-[10px] font-black uppercase tracking-wider text-emerald-800 border border-emerald-200 shadow-sm dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                            New
                        </span>
                    )}
                </div>
            </td>
            <td className="px-5 py-5 text-sm font-medium text-brand-text">
                {name}
            </td>
            <td className="px-5 py-5 text-sm text-brand-text-mid">{dest}</td>
            <td className="px-5 py-5 text-sm text-brand-text-mid">{date}</td>
            <td className="px-5 py-5">
                <span
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide uppercase ${statusClass}`}
                >
                    {status}
                </span>
            </td>
        </tr>
    );
}

export default function Dashboard() {
    // Determine the user's role from the shared page props
    const { auth } = usePage<PageProps & { auth: Auth }>().props;
    const role = auth.user ? (auth.user as any).role || 'sender' : 'guest';
    const isAdmin = role === 'super_admin' || role === 'admin';

    // In a real app we'd conditionally render based on isAdmin.
    // Here we assume this dashboard is mainly requested for admin view right now.
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard | Box Tracker" />
            <div className="flex h-full flex-1 flex-col bg-brand-cream/5 dark:bg-brand-cream/10">
                {isAdmin ? (
                    <AdminDashboard />
                ) : (
                    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 p-8">
                        <div className="card max-w-lg p-12 text-center">
                            <h2 className="mb-4 font-serif text-2xl font-bold text-brand-text">
                                Welcome back, {auth.user?.name || 'Sender'}!
                            </h2>
                            <p className="mb-6 leading-relaxed text-brand-text-mid">
                                Your sender dashboard is currently being
                                prepared. Soon you'll be able to manage your
                                bookings here.
                            </p>
                            <Link href="/book" className="btn-primary">
                                Book a Box Now
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
