import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Pencil, User, Mail, Phone, MapPin, Calendar, Package, Users, Compass, ExternalLink } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import Pagination, { type PaginationData } from '@/components/common/pagination';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface SenderDetail {
    id: number;
    first_name: string;
    last_name: string;
    email?: string | null;
    mobile?: string | null;
    secondary_mobile?: string | null;
    address?: string | null;
    suburb?: string | null;
    state?: string | null;
    postcode?: string | null;
    country?: string | null;
    created_at: string;
    pickupZone?: { id: number; name: string } | null;
    recipients?: Array<{
        id: number;
        name: string;
        phone_number?: string | null;
        secondary_phone_number?: string | null;
        city?: string | null;
        province?: string | null;
        address?: string | null;
        area?: { id: number; name: string } | null;
    }>;
}

interface BookingItem {
    id: number;
    reference_number: string;
    service_type?: string;
    status?: string | { value: string; label?: string };
    created_at: string;
    pickup_zone?: { name: string } | null;
    destination?: string;
}

interface SenderShowProps {
    sender: SenderDetail;
    bookings: PaginationData & { data: BookingItem[] };
    stats?: {
        totalBookingsCount?: number;
        recipientsCount?: number;
    };
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    confirmed: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    assigned_picker: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20',
    picked_up: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
    in_warehouse: 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/20',
    shipped: 'bg-teal-500/10 text-teal-600 border border-teal-500/20',
    out_for_delivery: 'bg-blue-600/10 text-blue-700 border border-blue-600/20',
    delivered: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
    cancelled: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
};

export default function SenderShow({ sender, bookings, stats = {} }: SenderShowProps) {
    const fullName = `${sender.first_name} ${sender.last_name}`.trim();
    const fullAddress = [sender.address, sender.suburb, sender.state, sender.postcode, sender.country]
        .filter(Boolean)
        .join(', ');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Senders Directory', href: '/admin/senders' },
        { title: fullName, href: `/admin/senders/${sender.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${fullName} | Sender Details`} />
            <div className="flex h-full flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-warm/20 pb-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/senders"
                            className="h-10 w-10 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 flex items-center justify-center transition-all shadow-2xs"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="font-sans text-2xl font-bold tracking-tight text-brand-text">{fullName}</h1>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-warm/30 text-brand-rust border border-brand-rust/20">
                                    Registered Sender
                                </span>
                            </div>
                            <p className="text-xs font-mono text-zinc-500 mt-1">
                                SENDER #{sender.id} • Registered on {new Date(sender.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href={`/admin/senders/${sender.id}/edit`}
                            className="bg-brand-rust text-white hover:bg-brand-rust/90 flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-md transition-all font-sans"
                        >
                            <Pencil className="size-4" />
                            Edit Sender Profile
                        </Link>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Primary Sender Details Card */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs">
                            <div className="flex items-center gap-4 border-b border-zinc-100 pb-5 mb-5">
                                <div className="h-14 w-14 rounded-2xl bg-brand-warm/20 text-brand-rust flex items-center justify-center font-bold text-xl">
                                    {sender.first_name.charAt(0).toUpperCase()}
                                    {sender.last_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-bold text-brand-text truncate text-base">{fullName}</h2>
                                    <p className="text-xs text-zinc-500 truncate flex items-center gap-1.5 mt-0.5">
                                        <Mail className="size-3.5 text-zinc-400" />
                                        {sender.email || <span className="italic">No Email</span>}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4 text-xs font-normal">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Sender Reference ID</span>
                                    <span className="font-mono font-semibold text-zinc-900 bg-zinc-50 px-2.5 py-1 rounded-md border border-zinc-200/60 inline-block">
                                        SND-{sender.id}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Primary Mobile</span>
                                    <span className="font-medium text-zinc-800 flex items-center gap-1.5 font-mono text-xs">
                                        <Phone className="size-3.5 text-zinc-400" />
                                        {sender.mobile || <span className="text-zinc-400 italic font-sans">Not provided</span>}
                                    </span>
                                </div>

                                {sender.secondary_mobile && (
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Secondary Mobile</span>
                                        <span className="font-medium text-zinc-800 flex items-center gap-1.5 font-mono text-xs">
                                            <Phone className="size-3.5 text-zinc-400" />
                                            {sender.secondary_mobile}
                                        </span>
                                    </div>
                                )}

                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Primary Address</span>
                                    <span className="font-medium text-zinc-800 flex items-start gap-1.5">
                                        <MapPin className="size-3.5 text-zinc-400 shrink-0 mt-0.5" />
                                        <span>{fullAddress || <span className="text-zinc-400 italic">Not provided</span>}</span>
                                    </span>
                                </div>

                                {sender.pickupZone && (
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Assigned Pickup Zone</span>
                                        <span className="font-medium text-zinc-800 flex items-center gap-1.5">
                                            <Compass className="size-3.5 text-zinc-400" />
                                            {sender.pickupZone.name}
                                        </span>
                                    </div>
                                )}

                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Registration Date</span>
                                    <span className="font-medium text-zinc-800 flex items-center gap-1.5">
                                        <Calendar className="size-3.5 text-zinc-400" />
                                        {new Date(sender.created_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Statistics and Associations */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        {/* Overview Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Bookings Created</p>
                                    <p className="font-bold text-brand-text text-2xl mt-1">{stats.totalBookingsCount ?? 0}</p>
                                </div>
                                <div className="h-12 w-12 rounded-xl bg-brand-warm/20 text-brand-rust flex items-center justify-center">
                                    <Package className="size-6" />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Saved Recipients</p>
                                    <p className="font-bold text-brand-text text-2xl mt-1">{stats.recipientsCount ?? (sender.recipients?.length || 0)}</p>
                                </div>
                                <div className="h-12 w-12 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center">
                                    <Users className="size-6" />
                                </div>
                            </div>
                        </div>

                        {/* Associated Bookings Table */}
                        <div className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                                <h3 className="font-bold text-brand-text text-sm uppercase tracking-wider flex items-center gap-2">
                                    <Package className="size-4 text-brand-rust" />
                                    Booking History
                                </h3>
                            </div>

                            {bookings.data.length > 0 ? (
                                <div className="overflow-x-auto w-full">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
                                                <th scope="col" className="px-6 py-3 font-semibold">Reference #</th>
                                                <th scope="col" className="px-6 py-3 font-semibold">Service Type</th>
                                                <th scope="col" className="px-6 py-3 font-semibold">Status</th>
                                                <th scope="col" className="px-6 py-3 font-semibold">Created Date</th>
                                                <th scope="col" className="px-6 py-3 font-semibold text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 text-xs font-normal">
                                            {bookings.data.map((b) => {
                                                const statusVal = typeof b.status === 'object' && b.status !== null ? b.status.value : String(b.status || 'pending');
                                                const statusColor = STATUS_COLORS[statusVal] || 'bg-zinc-100 text-zinc-700 border-zinc-200';
                                                return (
                                                    <tr key={b.id} className="hover:bg-zinc-50/60 transition-colors">
                                                        <td className="px-6 py-3.5 font-mono font-semibold text-brand-rust">
                                                            {b.reference_number || `#${b.id}`}
                                                        </td>
                                                        <td className="px-6 py-3.5 text-zinc-700 capitalize">
                                                            {b.service_type ? humanize(b.service_type) : 'Standard'}
                                                        </td>
                                                        <td className="px-6 py-3.5">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${statusColor}`}>
                                                                {humanize(statusVal)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3.5 text-zinc-500">
                                                            {new Date(b.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-3.5 text-right whitespace-nowrap">
                                                            <Link
                                                                href={`/admin/bookings/${b.id}`}
                                                                className="text-xs font-bold text-brand-rust hover:underline inline-flex items-center gap-1"
                                                            >
                                                                View <ExternalLink className="size-3" />
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <div className="border-t border-zinc-100">
                                        <Pagination data={bookings} />
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-xs text-zinc-400 italic">
                                    No bookings found for this sender.
                                </div>
                            )}
                        </div>

                        {/* Saved Recipients List */}
                        <div className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                                <h3 className="font-bold text-brand-text text-sm uppercase tracking-wider flex items-center gap-2">
                                    <Users className="size-4 text-cyan-600" />
                                    Associated Recipients ({sender.recipients?.length || 0})
                                </h3>
                            </div>

                            {sender.recipients && sender.recipients.length > 0 ? (
                                <div className="divide-y divide-zinc-100 text-xs">
                                    {sender.recipients.map((rec) => (
                                        <div key={rec.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-zinc-900 text-sm">{rec.name}</p>
                                                    {rec.area && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-600">
                                                            {rec.area.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-zinc-500 text-[11px] mt-1 flex items-center gap-2">
                                                    <span>{rec.city || '—'}, {rec.province || '—'}</span>
                                                    {rec.phone_number && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="font-mono">{rec.phone_number}</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/admin/recipients/${rec.id}`}
                                                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-all"
                                                >
                                                    View Recipient
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-xs text-zinc-400 italic">
                                    No saved recipients under this sender profile.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
