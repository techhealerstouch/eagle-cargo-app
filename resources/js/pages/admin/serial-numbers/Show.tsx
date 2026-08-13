import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Package, Clock, Truck, CheckCircle2, User, FileText, AlertTriangle } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/common/heading';
import type { BreadcrumbItem } from '@/types';
import { format } from 'date-fns';
import { humanize } from '@/lib/utils';

interface SerialNumber {
    id: number;
    serial_number: string;
    status: string;
    allocated_at: string | null;
    created_at: string;
    assigned_by_user?: {
        name: string;
    };
    box?: {
        id: number;
        tracking_number: string;
        status: string;
        created_at: string;
        box_type?: {
            name: string;
        };
        batch?: {
            id: number;
            batch_number: string;
            status: string;
        };
        booking?: {
            id: number;
            reference_number: string;
            sender?: {
                first_name: string;
                last_name: string;
                suburb?: string;
                state?: string;
            };
            runsheets?: {
                id: number;
                type: string;
                status: string;
                scheduled_date: string;
                picker?: {
                    name: string;
                };
            }[];
        };
        recipient?: {
            name: string;
            city?: string;
            province?: string;
        };
        runsheets?: {
            id: number;
            type: string;
            status: string;
            scheduled_date: string;
            courier?: {
                name: string;
            };
        }[];
    };
}

const STATUS_COLORS: Record<string, string> = {
    Available: 'bg-green-500/10 text-green-600 border border-green-500/20',
    Allocated: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    Assigned: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
    Void: 'bg-red-500/10 text-red-600 border border-red-500/20',
};

export default function SerialNumberShow({ serialNumber }: { serialNumber: SerialNumber }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin/dashboard' },
        { title: 'Serial Numbers', href: '/admin/serial-numbers' },
        { title: serialNumber.serial_number, href: `/admin/serial-numbers/${serialNumber.id}` },
    ];

    const box = serialNumber.box;
    const pickupRunsheets = box?.booking?.runsheets?.filter(r => r.type === 'pickup') || [];
    const deliveryRunsheets = box?.runsheets?.filter(r => r.type === 'delivery') || [];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Serial Number ${serialNumber.serial_number} | Admin`} />

            <div className="mx-auto mb-10 w-full max-w-7xl animate-fade-in p-4 lg:p-6">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/serial-numbers"
                            className="group flex h-10 w-10 items-center justify-center rounded-xl border border-brand-sand bg-white text-brand-text-mid shadow-sm transition-all hover:border-brand-secondary hover:text-brand-secondary"
                        >
                            <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-1" />
                        </Link>

                        <div className="space-y-1">
                            <Heading eyebrow="Logistics" title="Serial Number Details" />
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-sm font-bold text-zinc-500">#{serialNumber.serial_number}</span>
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${STATUS_COLORS[serialNumber.status] || STATUS_COLORS.draft}`}>
                                    {serialNumber.status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Serial Number Meta */}
                        <div className="rounded-xl border border-brand-sand bg-white p-5 sm:p-6 shadow-sm">
                            <h3 className="font-serif text-xl font-bold text-brand-navy mb-4 border-b border-brand-warm pb-3">Serial Information</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Generated At</span>
                                    <p className="text-sm font-medium text-brand-navy">
                                        {format(new Date(serialNumber.created_at), 'MMM d, yyyy h:mm a')}
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Allocated At</span>
                                    <p className="text-sm font-medium text-brand-navy">
                                        {serialNumber.allocated_at ? format(new Date(serialNumber.allocated_at), 'MMM d, yyyy h:mm a') : '-'}
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Allocated By</span>
                                    <p className="text-sm font-medium text-brand-navy">
                                        {serialNumber.assigned_by_user?.name || '-'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Box Details */}
                        {box ? (
                            <div className="rounded-xl border border-brand-sand bg-white p-5 sm:p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-4 border-b border-brand-warm pb-3">
                                    <h3 className="font-serif text-xl font-bold text-brand-navy">Assigned Box Details</h3>
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-brand-warm/20 text-brand-text`}>
                                        {humanize(box.status)}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Tracking Number</span>
                                        <p className="font-mono text-lg font-bold text-brand-rust">
                                            <Link href={`/admin/boxes/${box.id}`} className="hover:underline">
                                                {box.tracking_number}
                                            </Link>
                                        </p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Booking Reference</span>
                                        <p className="font-mono text-lg font-bold text-brand-navy">
                                            {box.booking?.reference_number || '-'}
                                        </p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Sender Name</span>
                                        <p className="text-sm font-medium text-brand-navy capitalize">
                                            {box.booking?.sender ? `${box.booking.sender.first_name} ${box.booking.sender.last_name}` : '-'}
                                        </p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Picked By</span>
                                        <p className="text-sm font-medium text-brand-navy capitalize">
                                            {pickupRunsheets.length > 0 && pickupRunsheets[0].picker ? pickupRunsheets[0].picker.name : '-'}
                                        </p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Recipient Name</span>
                                        <p className="text-sm font-medium text-brand-navy capitalize">
                                            {box.recipient?.name || '-'}
                                        </p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Origin</span>
                                        <p className="text-sm font-medium text-brand-navy capitalize">
                                            {box.booking?.sender ? [box.booking.sender.suburb, box.booking.sender.state].filter(Boolean).join(', ') : '-'}
                                        </p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Destination</span>
                                        <p className="text-sm font-medium text-brand-navy capitalize">
                                            {box.recipient ? [box.recipient.city, box.recipient.province].filter(Boolean).join(', ') : '-'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-brand-sand bg-zinc-50 p-8 shadow-sm flex flex-col items-center justify-center text-center">
                                <Package className="size-12 text-zinc-300 mb-4" />
                                <h3 className="font-serif text-lg font-bold text-brand-navy mb-1">No Box Assigned</h3>
                                <p className="text-sm text-zinc-500 max-w-sm">This serial number has not yet been assigned to a physical box or booking.</p>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Journey Timeline */}
                    <div className="lg:col-span-1">
                        <div className="rounded-xl border border-brand-sand bg-white p-5 sm:p-6 shadow-sm h-full">
                            <h3 className="font-serif text-xl font-bold text-brand-navy mb-6 border-b border-brand-warm pb-3">Box Journey</h3>
                            
                            {!box ? (
                                <p className="text-sm text-zinc-500 text-center italic mt-10">Journey begins once a box is assigned.</p>
                            ) : (
                                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-200 before:to-transparent">
                                    
                                    {/* Box Creation / Assignment */}
                                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-brand-warm/20 text-brand-rust shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
                                            <Package className="size-4" />
                                        </div>
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white border border-brand-sand/50 p-3 rounded-lg shadow-sm">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-brand-navy text-xs">Box Assigned</span>
                                                <span className="text-[10px] text-zinc-400">{format(new Date(box.created_at), 'MMM d, yyyy')}</span>
                                            </div>
                                            <p className="text-[11px] text-zinc-500">Box record created and linked to this serial.</p>
                                        </div>
                                    </div>

                                    {/* Pickup Runsheets */}
                                    {pickupRunsheets.map((runsheet) => (
                                        <div key={`pickup-${runsheet.id}`} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-emerald-50 text-emerald-600 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
                                                <User className="size-4" />
                                            </div>
                                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white border border-brand-sand/50 p-3 rounded-lg shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-brand-navy text-xs">Pickup Runsheet</span>
                                                    <span className="text-[10px] text-zinc-400">{runsheet.scheduled_date ? format(new Date(runsheet.scheduled_date), 'MMM d, yyyy') : '-'}</span>
                                                </div>
                                                <p className="text-[11px] text-zinc-500">Assigned to Picker: <span className="font-medium text-zinc-700">{runsheet.picker?.name || '-'}</span></p>
                                                <span className="mt-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-semibold text-zinc-600 uppercase tracking-wider">
                                                    {humanize(runsheet.status)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Batch Assignment */}
                                    {box.batch && (
                                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-50 text-blue-600 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
                                                <FileText className="size-4" />
                                            </div>
                                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white border border-brand-sand/50 p-3 rounded-lg shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-brand-navy text-xs">Assigned to Batch</span>
                                                </div>
                                                <p className="text-[11px] text-zinc-500">Batch Number: <Link href={`/admin/batches/${box.batch.id}`} className="font-medium text-brand-rust hover:underline">{box.batch.batch_number}</Link></p>
                                                <span className="mt-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-semibold text-zinc-600 uppercase tracking-wider">
                                                    {humanize(box.batch.status)}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Delivery Runsheets */}
                                    {deliveryRunsheets.map((runsheet) => (
                                        <div key={`delivery-${runsheet.id}`} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-purple-50 text-purple-600 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
                                                <Truck className="size-4" />
                                            </div>
                                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white border border-brand-sand/50 p-3 rounded-lg shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-brand-navy text-xs">Delivery Runsheet</span>
                                                    <span className="text-[10px] text-zinc-400">{runsheet.scheduled_date ? format(new Date(runsheet.scheduled_date), 'MMM d, yyyy') : '-'}</span>
                                                </div>
                                                <p className="text-[11px] text-zinc-500">Assigned to Courier: <span className="font-medium text-zinc-700">{runsheet.courier?.name || '-'}</span></p>
                                                <span className="mt-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-semibold text-zinc-600 uppercase tracking-wider">
                                                    {humanize(runsheet.status)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Delivered Status */}
                                    {box.status === 'delivered' && (
                                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-green-500 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm">
                                                <CheckCircle2 className="size-5" />
                                            </div>
                                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white border border-green-200 p-3 rounded-lg shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-green-700 text-xs">Delivered</span>
                                                </div>
                                                <p className="text-[11px] text-zinc-500">The box has been successfully delivered to the recipient.</p>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
