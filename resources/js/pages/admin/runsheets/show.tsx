import { Head, Link, router } from '@inertiajs/react';
import {
    Calendar,
    MapPin,
    Truck,
    User,
    ArrowLeft,
    CheckCircle,
    Clock,
    Package,
    Navigation,
    ArrowDown,
    ArrowUp,
} from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/common/heading';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// Mock types since we are not strictly typing inertia props in this demo file
interface ShowProps {
    runsheet: any;
}

const enumLabels: Record<string, string> = {
    draft: 'Draft',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    completed: 'Completed',
    paid: 'Paid',
    pending: 'Pending',
    cash_on_pickup: 'Payment on Pickup',
    cash_collected: 'Cash Collected',
};

const normalizeEnum = (value: unknown) => String(value ?? '').toLowerCase();

const enumLabel = (value: unknown) => {
    const normalized = normalizeEnum(value);

    return enumLabels[normalized] ?? normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export default function Show({ runsheet }: ShowProps) {
    const runsheetType = normalizeEnum(runsheet.type);
    const runsheetStatus = normalizeEnum(runsheet.status);
    const isPickup = runsheetType === 'pickup';
    const isCompleted = runsheetStatus === 'completed';
    const items = isPickup ? (runsheet.bookings ?? []) : (runsheet.boxes ?? []);

    const [stopIds, setStopIds] = useState<number[]>(
        items.map((item: any) => item.id)
    );

    const backUrl = isPickup ? '/admin/runsheets/pickups' : '/admin/runsheets/deliveries';


    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin/dashboard' },
        { title: isPickup ? 'Pickup Runsheets' : 'Delivery Runsheets', href: backUrl },
        { title: `Runsheet ${runsheet.id}`, href: '#' },
    ];

    const driverName =
        isPickup
            ? runsheet.picker?.name || 'Unassigned'
            : runsheet.courier?.name || 'Unassigned';

    const formatDate = (dateString: string) => {
        if (!dateString) {
            return 'Not scheduled';
        }

        const date = new Date(dateString);

        return date.toLocaleDateString('en-AU', {
            weekday: 'short',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const getStatusStyle = (status: string) => {
        const normalized = normalizeEnum(status);

        if (normalized === 'draft') {
            return 'bg-gray-100 text-gray-800 border-gray-200';
        }

        if (normalized === 'in_progress') {
            return 'bg-amber-100 text-amber-800 border-amber-200';
        }

        if (normalized === 'completed') {
            return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        }

        return 'bg-blue-100 text-blue-800 border-blue-200';
    };

    const getStatusIcon = (status: string) => {
        const normalized = normalizeEnum(status);

        if (normalized === 'completed') {
            return <CheckCircle className="size-5" />;
        }

        if (normalized === 'in_progress') {
            return <Navigation className="size-5" />;
        }

        return <Clock className="size-5" />;
    };

    
    const itemById = new Map(items.map((item: any) => [item.id, item]));
    const orderedItems = stopIds
        .map((id) => itemById.get(id))
        .filter(Boolean);
    const canReorder = !isCompleted && orderedItems.length > 1;

    const reorderStop = (itemId: number, direction: -1 | 1) => {
        const currentIndex = stopIds.indexOf(itemId);

        const nextIndex = currentIndex + direction;

        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= stopIds.length) {
            return;
        }

        const nextStopIds = [...stopIds];
        [nextStopIds[currentIndex], nextStopIds[nextIndex]] = [nextStopIds[nextIndex], nextStopIds[currentIndex]];
        setStopIds(nextStopIds);

        router.post(`/admin/runsheets/${runsheet.id}/reorder`, isPickup ? {
            booking_ids: nextStopIds,
        } : {
            box_ids: nextStopIds,
        }, {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Runsheet ${runsheet.id} | Admin`} />

            <div className="flex h-full flex-1 flex-col gap-6 p-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href={backUrl}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-brand-text-mid shadow-sm transition-colors hover:border-brand-rust hover:text-brand-rust dark:bg-zinc-900"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <Heading
                            title={`Runsheet #${runsheet.id}`}
                            description="Detailed view of this runsheet and its bookings."
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <span
                            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold tracking-wide uppercase shadow-sm ${getStatusStyle(
                                runsheet.status
                            )}`}
                        >
                            {getStatusIcon(runsheet.status)}
                            {enumLabel(runsheet.status)}
                        </span>
                        
                        {/* Only allow editing if not completed */}
                        {!isCompleted && (
                            <Link
                                href={`/admin/runsheets/${runsheet.id}/edit`}
                                className="btn-primary"
                            >
                                Edit Runsheet
                            </Link>
                        )}
                    </div>
                </div>

                {/* Logistics Info Cards */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="card p-6 border-l-4 border-l-brand-rust">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-warm/20 text-brand-rust">
                                <MapPin className="size-5" />
                            </div>
                            <h3 className="font-semibold text-brand-text">
                                Area & Type
                            </h3>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xl font-bold text-brand-text">
                                {runsheet.area_description}
                            </p>
                            <p className="text-sm text-brand-text-mid">
                                Type: <strong>{isPickup ? 'Pickup' : 'Delivery'}</strong>
                            </p>
                        </div>
                    </div>

                    <div className="card p-6">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-warm/20 text-brand-teal">
                                <Calendar className="size-5" />
                            </div>
                            <h3 className="font-semibold text-brand-text">
                                Scheduled Date
                            </h3>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xl font-bold text-brand-text">
                                {formatDate(runsheet.scheduled_date)}
                            </p>
                            <p className="text-sm text-brand-text-mid">
                                {runsheet.timeslot || 'No specific timeslot assigned'}
                            </p>
                        </div>
                    </div>

                    <div className="card p-6">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-warm/20 text-brand-primary">
                                {isPickup ? (
                                    <User className="size-5" />
                                ) : (
                                    <Truck className="size-5" />
                                )}
                            </div>
                            <h3 className="font-semibold text-brand-text">
                                {isPickup ? 'Assigned Picker' : 'Assigned Courier'}
                            </h3>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xl font-bold text-brand-text">
                                {driverName}
                            </p>
                            <p className="text-sm text-brand-text-mid">
                                Notes: {runsheet.notes || 'None'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Assigned Stops/Bookings */}
                <div className="card mt-2">
                    <div className="border-b border-border p-6">
                        <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-brand-text">
                            <Package className="size-5 text-brand-rust" />
                            Assigned Stops ({items.length})
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left font-medium">
                            <thead className="bg-brand-cream/50 text-sm text-brand-text-mid dark:bg-zinc-800/50">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Stop</th>
                                    <th className="px-6 py-4 font-semibold">{isPickup ? "Booking Ref" : "Box Tracking"}</th>
                                    <th className="px-6 py-4 font-semibold">Sender</th>
                                    <th className="px-6 py-4 font-semibold">Preferred Time</th>
                                    <th className="px-6 py-4 font-semibold">Destination</th>
                                    <th className="px-6 py-4 font-semibold">{isPickup ? 'Boxes' : 'Recipient'}</th>
                                    <th className="px-6 py-4 font-semibold">Payment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-solid divide-border/50 text-sm">
                                {orderedItems.length > 0 ? (
                                    orderedItems.map((item: any, index: number) => {
                                        const reference = isPickup ? (item.reference_number || `BK-${item.id}`) : (item.tracking_number || `BOX-${item.id}`);
                                        const sender = isPickup ? item.sender : item.booking?.sender;
                                        const link = isPickup ? `/admin/bookings/${item.id}` : `/admin/boxes/${item.id}`;
                                        
                                        return (
                                        <tr
                                            key={item.id}
                                            className="transition-colors hover:bg-brand-cream/10 dark:hover:bg-white/5"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex size-9 items-center justify-center rounded-full bg-brand-rust/10 font-mono text-xs font-black text-brand-rust">
                                                        {index + 1}
                                                    </span>
                                                    {canReorder && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                disabled={index === 0}
                                                                onClick={() => reorderStop(item.id, -1)}
                                                                className="rounded-lg border border-border p-1.5 text-brand-text-mid transition-colors hover:border-brand-rust hover:text-brand-rust disabled:cursor-not-allowed disabled:opacity-30"
                                                                title="Move stop up"
                                                            >
                                                                <ArrowUp className="size-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={index === orderedItems.length - 1}
                                                                onClick={() => reorderStop(item.id, 1)}
                                                                className="rounded-lg border border-border p-1.5 text-brand-text-mid transition-colors hover:border-brand-rust hover:text-brand-rust disabled:cursor-not-allowed disabled:opacity-30"
                                                                title="Move stop down"
                                                            >
                                                                <ArrowDown className="size-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Link 
                                                    href={link}
                                                    className="font-bold text-brand-rust hover:underline"
                                                >
                                                    {reference}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4">
                                                {sender?.first_name} {sender?.last_name}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isPickup && item.preferred_date ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-brand-text">
                                                            {new Date(item.preferred_date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                        </span>
                                                        <span className="text-[10px] text-brand-text-mid">
                                                            {new Date(item.preferred_date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) !== '12:00 am' 
                                                                ? new Date(item.preferred_date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
                                                                : 'Anytime'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-brand-text-mid italic opacity-50">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-brand-text-mid">
                                                {isPickup ? (item.destination || 'Philippines') : (item.recipient?.area?.name || 'Local')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {isPickup ? (
                                                        <>
                                                            <span className="text-xs font-bold text-brand-text-mid mb-1">
                                                                {item.boxes?.length || 0} box(es)
                                                            </span>
                                                            {item.boxes?.map((box: any) => (
                                                                <Link
                                                                    key={box.id}
                                                                    href={`/admin/boxes?search=${box.tracking_number}`}
                                                                    className="font-mono text-[10px] bg-brand-warm/10 hover:bg-brand-rust/10 hover:text-brand-rust border border-brand-warm/20 px-2 py-0.5 rounded transition-colors w-fit"
                                                                    title={`View box ${box.tracking_number}`}
                                                                >
                                                                    {box.tracking_number}
                                                                </Link>
                                                            ))}
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-brand-text-mid">
                                                            {item.recipient?.name || 'No recipient'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isPickup ? (
                                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                        normalizeEnum(item.payment_status) === 'paid'
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                            : normalizeEnum(item.payment_status) === 'cash_on_pickup'
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                                    }`}>
                                                        {enumLabel(item.payment_status)}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                                        Paid
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-6 py-8 text-center text-brand-text-mid"
                                        >
                                            <div className="flex flex-col items-center justify-center">
                                                <Package className="mb-2 size-8 opacity-20" />
                                                <p>No items assigned to this runsheet yet.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
