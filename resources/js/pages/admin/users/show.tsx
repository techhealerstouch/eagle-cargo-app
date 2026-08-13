import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Pencil, User as UserIcon, ShieldCheck, Mail, Calendar, Phone, MapPin, Fingerprint, Truck, ClipboardList, Package, DollarSign, Percent, AlertCircle } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface UserDetail {
    id: number;
    custom_id?: string;
    name: string;
    email: string;
    role: string | { value: string; label?: string };
    created_at: string;
    updated_at?: string;
    deleted_at?: string | null;
    commission_type?: string | null;
    commission_rates?: any;
    courier?: {
        id: number;
        mobile?: string | null;
        address?: string | null;
        suburb?: string | null;
        state?: string | null;
        postcode?: string | null;
        area_id?: number | null;
        area?: { id: number; name: string } | null;
    } | null;
    picker?: {
        id: number;
        mobile?: string | null;
        address?: string | null;
        suburb?: string | null;
        state?: string | null;
        postcode?: string | null;
        pickup_zone_id?: number | null;
        pickup_zone?: { id: number; name: string } | null;
    } | null;
    sender?: {
        id: number;
        mobile?: string | null;
        address?: string | null;
        suburb?: string | null;
        state?: string | null;
        postcode?: string | null;
    } | null;
    warehouse_staff?: {
        id: number;
        mobile?: string | null;
    } | null;
}

interface UserShowProps {
    user: UserDetail;
    stats?: {
        pickerRunsheetsCount?: number;
        courierRunsheetsCount?: number;
        totalBookingsCount?: number;
        totalCommissionsAmount?: number;
    };
    recentActivity?: any[];
}

const ROLE_COLORS: Record<string, string> = {
    super_admin: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
    admin: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20',
    courier: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    picker: 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/20',
    warehouse: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    sender: 'bg-zinc-500/10 text-zinc-600 border border-zinc-500/20',
};

const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    courier: 'Courier',
    picker: 'Picker',
    warehouse: 'Warehouse Staff',
    sender: 'Sender',
};

export default function UserShow({ user, stats = {}, recentActivity = [] }: UserShowProps) {
    const { auth, isLocal } = usePage<{ auth: any; isLocal?: boolean }>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';
    const showImpersonate = !!(isLocal && isSuperAdmin && user.id !== auth?.user?.id);

    const roleStr = typeof user.role === 'object' && user.role !== null ? user.role.value : String(user.role || 'sender');
    const roleLabel = ROLE_LABELS[roleStr] || humanize(roleStr);
    const roleColor = ROLE_COLORS[roleStr] || 'bg-zinc-100 text-zinc-700 border-zinc-200';

    const mobileNumber = user.courier?.mobile || user.picker?.mobile || user.sender?.mobile || user.warehouse_staff?.mobile || null;
    const rawProfile = user.courier || user.picker || user.sender || null;
    const addressStreet = rawProfile?.address;
    const addressSuburb = rawProfile?.suburb;
    const addressState = rawProfile?.state;
    const addressPostcode = rawProfile?.postcode;

    const formattedLocation = [addressSuburb, addressState, addressPostcode].filter(Boolean).join(' ');
    const fullAddress = [addressStreet, formattedLocation].filter(Boolean).join(', ');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'User Management', href: '/admin/users' },
        { title: user.name, href: `/admin/users/${user.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${user.name} | User Details`} />
            <div className="flex h-full flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-warm/20 pb-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/users"
                            className="h-10 w-10 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 flex items-center justify-center transition-all shadow-2xs"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="font-serif text-2xl font-medium text-brand-text">{user.name}</h1>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${roleColor}`}>
                                    {roleLabel}
                                </span>
                                {user.deleted_at && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                                        Archived
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-mono text-zinc-500 mt-1">
                                {user.custom_id || `USR-${user.id}`} • Registered on {new Date(user.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {showImpersonate && (
                            <a
                                href={`/impersonate/${user.id}`}
                                title={`Impersonate ${user.name}`}
                                className="bg-zinc-100 text-zinc-700 hover:bg-zinc-200 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all font-sans"
                            >
                                <Fingerprint className="size-4" />
                                Impersonate
                            </a>
                        )}
                        <Link
                            href={`/admin/users/${user.id}/edit`}
                            className="bg-brand-rust text-white hover:bg-brand-rust/90 flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-md transition-all font-sans"
                        >
                            <Pencil className="size-4" />
                            Edit Profile
                        </Link>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Primary User Card */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs">
                            <div className="flex items-center gap-4 border-b border-zinc-100 pb-5 mb-5">
                                <div className="h-14 w-14 rounded-2xl bg-brand-warm/20 text-brand-rust flex items-center justify-center font-bold text-xl">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-bold text-brand-text truncate text-base">{user.name}</h2>
                                    <p className="text-xs text-zinc-500 truncate flex items-center gap-1.5 mt-0.5">
                                        <Mail className="size-3.5 text-zinc-400" />
                                        {user.email}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4 text-xs font-normal">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">User ID / Reference</span>
                                    <span className="font-mono font-semibold text-zinc-900 bg-zinc-50 px-2.5 py-1 rounded-md border border-zinc-200/60 inline-block">
                                        {user.custom_id || `USR-${user.id}`}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Contact Mobile</span>
                                    <span className="font-medium text-zinc-800 flex items-center gap-1.5">
                                        <Phone className="size-3.5 text-zinc-400" />
                                        {mobileNumber || <span className="text-zinc-400 italic">Not provided</span>}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Primary Address</span>
                                    <span className="font-medium text-zinc-800 flex items-start gap-1.5">
                                        <MapPin className="size-3.5 text-zinc-400 shrink-0 mt-0.5" />
                                        <span>{fullAddress || <span className="text-zinc-400 italic">Not provided</span>}</span>
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Role & Authorization</span>
                                    <span className="font-medium text-zinc-800 flex items-center gap-1.5">
                                        <ShieldCheck className="size-3.5 text-zinc-400" />
                                        {roleLabel}
                                    </span>
                                </div>

                                {roleStr === 'picker' && (
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Assigned Pickup Area / Zone</span>
                                        <span className="font-semibold text-brand-navy flex items-center gap-1.5">
                                            <MapPin className="size-3.5 text-brand-rust" />
                                            {user.picker?.pickup_zone?.name || <span className="text-zinc-400 italic font-normal">Not assigned</span>}
                                        </span>
                                    </div>
                                )}

                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-1">Account Created</span>
                                    <span className="font-medium text-zinc-800 flex items-center gap-1.5">
                                        <Calendar className="size-3.5 text-zinc-400" />
                                        {new Date(user.created_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Role Details & Stats */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        {/* Courier Info Card */}
                        {roleStr === 'courier' && (
                            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs">
                                <h3 className="font-bold text-brand-text text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Truck className="size-4 text-blue-600" />
                                    Courier Profile & Logistics Summary
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-600/80">Assigned Service Area</p>
                                        <p className="font-bold text-blue-900 text-base mt-1">
                                            {user.courier?.area?.name || <span className="text-zinc-400 italic text-sm font-normal">All / General</span>}
                                        </p>
                                    </div>
                                    <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-4">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Total Delivery Runsheets</p>
                                        <p className="font-bold text-zinc-900 text-xl mt-1">{stats.courierRunsheetsCount ?? 0}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Picker Info Card */}
                        {roleStr === 'picker' && (
                            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs">
                                <h3 className="font-bold text-brand-text text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <ClipboardList className="size-4 text-cyan-600" />
                                    Picker Profile & Commission Structure
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <div className="bg-cyan-50/50 border border-cyan-100 rounded-xl p-4">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700">Total Assigned Runsheets</p>
                                        <p className="font-bold text-cyan-950 text-xl mt-1">{stats.pickerRunsheetsCount ?? 0}</p>
                                    </div>
                                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Total Earned Commissions</p>
                                        <p className="font-bold text-emerald-950 text-xl mt-1">
                                            ${(stats.totalCommissionsAmount ?? 0).toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                <div className="border-t border-zinc-100 pt-4">
                                    <h4 className="font-semibold text-xs text-zinc-700 mb-2">Configured Commission Type: <span className="font-bold text-zinc-900 capitalize">{user.commission_type || 'Flat Rate'}</span></h4>
                                    {user.commission_rates && (
                                        <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-3.5 font-mono text-xs text-zinc-700">
                                            <pre className="whitespace-pre-wrap">{JSON.stringify(user.commission_rates, null, 2)}</pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Sender Info Card */}
                        {roleStr === 'sender' && (
                            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs">
                                <h3 className="font-bold text-brand-text text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Package className="size-4 text-brand-rust" />
                                    Sender Account Summary
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-brand-warm/10 border border-brand-warm/20 rounded-xl p-4">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-brand-text-mid">Total Bookings Created</p>
                                        <p className="font-bold text-brand-text text-2xl mt-1">{stats.totalBookingsCount ?? 0}</p>
                                    </div>
                                    <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-4 flex flex-col justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Sender Module Link</p>
                                        <Link
                                            href="/admin/senders"
                                            className="text-xs font-bold text-brand-rust hover:underline mt-2 inline-block"
                                        >
                                            View in Senders Directory →
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Admin / Warehouse / General Info */}
                        {['admin', 'super_admin', 'warehouse'].includes(roleStr) && (
                            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs">
                                <h3 className="font-bold text-brand-text text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <ShieldCheck className="size-4 text-purple-600" />
                                    System Administrative Scope
                                </h3>
                                <p className="text-xs text-zinc-600 leading-relaxed">
                                    This user has {roleLabel} permissions. They can access back-office tools, manage operational logs, and perform workflow operations according to their role policy.
                                </p>
                            </div>
                        )}

                        {/* Recent Activity Section */}
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs">
                            <h3 className="font-bold text-brand-text text-sm uppercase tracking-wider mb-4">
                                Recent Activity
                            </h3>
                            {recentActivity.length > 0 ? (
                                <div className="divide-y divide-zinc-100 text-xs">
                                    {recentActivity.map((item: any) => (
                                        <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="font-semibold text-zinc-900">
                                                    {item.reference_number || item.area_description || `Activity #${item.id}`}
                                                </p>
                                                <p className="text-zinc-500 text-[11px] mt-0.5">
                                                    {new Date(item.created_at || item.scheduled_date).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {item.status && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-700 capitalize">
                                                        {humanize(item.status)}
                                                    </span>
                                                )}
                                                {item.reference_number ? (
                                                    <Link
                                                        href={`/admin/bookings/${item.id}`}
                                                        className="text-xs font-semibold text-brand-rust hover:underline"
                                                    >
                                                        View Booking
                                                    </Link>
                                                ) : (
                                                    <Link
                                                        href={`/admin/runsheets/${item.id}`}
                                                        className="text-xs font-semibold text-brand-rust hover:underline"
                                                    >
                                                        View Runsheet
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-400 italic py-4">No recent activity recorded for this user.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
