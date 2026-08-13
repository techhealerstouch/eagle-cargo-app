import { useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Save, ArrowLeft, User, ShieldCheck, Mail, Lock, Info, Phone, MapPin, ChevronDown } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import CommissionCalculatorForm from '@/components/admin/users/commission-calculator-form';
import PhoneInput from '@/components/ui/PhoneInput';

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
    sender: { label: 'CUSTOMER (SENDER)', bg: 'bg-blue-50/80', text: 'text-blue-700', border: 'border-blue-200' },
    courier: { label: 'COURIER (SERVICE AREA)', bg: 'bg-amber-50/80', text: 'text-amber-800', border: 'border-amber-200' },
    picker: { label: 'PICKER (FIELD AGENT)', bg: 'bg-emerald-50/80', text: 'text-emerald-800', border: 'border-emerald-200' },
    warehouse: { label: 'WAREHOUSE STAFF', bg: 'bg-purple-50/80', text: 'text-purple-800', border: 'border-purple-200' },
    admin: { label: 'ADMINISTRATOR', bg: 'bg-slate-100', text: 'text-slate-900', border: 'border-slate-300' },
    super_admin: { label: 'SUPER ADMIN', bg: 'bg-rose-50/80', text: 'text-rose-800', border: 'border-rose-200' },
};

interface User {
    id: number;
    custom_id?: string;
    name: string;
    email: string;
    role: string;
    courier?: {
        area_id?: number | null;
        mobile?: string | null;
        address?: string | null;
        suburb?: string | null;
        state?: string | null;
        postcode?: string | null;
    } | null;
    picker?: {
        mobile?: string | null;
        address?: string | null;
        suburb?: string | null;
        state?: string | null;
        postcode?: string | null;
        pickup_zone_id?: number | null;
        pickup_zone?: { id: number; name: string } | null;
    } | null;
    sender?: {
        mobile?: string | null;
        address?: string | null;
        suburb?: string | null;
        state?: string | null;
        postcode?: string | null;
    } | null;
    warehouse_staff?: { mobile?: string | null; } | null;
    commission_type?: string | null;
    commission_rates?: any;
}

interface PickupZoneItem {
    id: number;
    name: string;
    code?: string;
    suburbs?: { id: number; name: string; postcode?: string }[];
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
    sender: 'Customer / sender who creates and tracks package bookings.',
    courier: 'Field agent assigned to service areas for door-to-door parcel pickup & delivery.',
    picker: 'Agent responsible for package collection with configured commission rates.',
    warehouse: 'Staff member managing warehouse inventory, status updates, and container packing.',
    admin: 'Administrator with management access to bookings, users, and financial reports.',
    super_admin: 'Master administrator with full system permissions across all features.',
};

export default function UsersEdit({
    user,
    areas = [],
    pickupZones = [],
}: {
    user: User;
    areas?: { id: number; name: string }[];
    pickupZones?: PickupZoneItem[];
}) {
    const { auth } = usePage<{ auth: any }>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';
    const isOwnProfile = auth?.user?.id === user.id;
    const [rawJsonMode, setRawJsonMode] = useState(false);

    // Initial rates extraction for visual form
    const initialRates = user.commission_rates || {};
    const [commissionForm, setCommissionForm] = useState({
        flatAmount: String(initialRates.amount ?? '5.00'),
        percentageRate: String(initialRates.percentage ?? '5.00'),
        sizeJumbo: String(initialRates.sizes?.Jumbo ?? '10.00'),
        sizeRegular: String(initialRates.sizes?.Regular ?? '7.00'),
        sizeSmall: String(initialRates.sizes?.Small ?? '5.00'),
    });

    const { data, setData, put, processing, errors, transform } = useForm({
        name: user.name,
        email: user.email,
        mobile: user.courier?.mobile || user.picker?.mobile || user.sender?.mobile || user.warehouse_staff?.mobile || '',
        address: user.courier?.address || user.picker?.address || user.sender?.address || '',
        suburb: user.courier?.suburb || user.picker?.suburb || user.sender?.suburb || '',
        state: user.courier?.state || user.picker?.state || user.sender?.state || '',
        postcode: user.courier?.postcode || user.picker?.postcode || user.sender?.postcode || '',
        role: user.role,
        password: '',
        password_confirmation: '',
        area_id: user.courier?.area_id ? String(user.courier.area_id) : '',
        pickup_zone_id: user.picker?.pickup_zone_id ? String(user.picker.pickup_zone_id) : '',
        commission_type: user.commission_type || 'flat',
        commission_rates: user.commission_rates ? JSON.stringify(user.commission_rates, null, 2) : '{\n  "amount": 5.0\n}',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'User Management', href: '/admin/users' },
        { title: 'Edit User', href: '#' },
    ];

    const handleCommissionChange = (key: keyof typeof commissionForm, value: string) => {
        const updated = { ...commissionForm, [key]: value };
        setCommissionForm(updated);

        const jsonObject = {
            amount: parseFloat(updated.flatAmount) || 0,
            percentage: parseFloat(updated.percentageRate) || 0,
            sizes: {
                Jumbo: parseFloat(updated.sizeJumbo) || 0,
                Regular: parseFloat(updated.sizeRegular) || 0,
                Small: parseFloat(updated.sizeSmall) || 0,
            },
        };
        setData('commission_rates', JSON.stringify(jsonObject, null, 2));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let finalRates: any = null;
        if (data.role === 'picker') {
            if (rawJsonMode) {
                try {
                    finalRates = JSON.parse(data.commission_rates);
                } catch (err) {
                    alert('Invalid JSON in Commission Rates');
                    return;
                }
            } else {
                if (data.commission_type === 'flat') {
                    finalRates = { amount: parseFloat(commissionForm.flatAmount) || 0 };
                } else if (data.commission_type === 'percentage') {
                    finalRates = { percentage: parseFloat(commissionForm.percentageRate) || 0 };
                } else {
                    finalRates = {
                        sizes: {
                            Jumbo: parseFloat(commissionForm.sizeJumbo) || 0,
                            Regular: parseFloat(commissionForm.sizeRegular) || 0,
                            Small: parseFloat(commissionForm.sizeSmall) || 0,
                        },
                    };
                }
            }
        }
        
        transform((data) => ({
            ...data,
            commission_rates: data.role === 'picker' ? finalRates : null,
            commission_type: data.role === 'picker' ? data.commission_type : null,
            area_id: data.role === 'courier' ? data.area_id : null,
            pickup_zone_id: data.role === 'picker' ? data.pickup_zone_id : null,
        }));
        
        put(`/admin/users/${user.id}`);
    };

    const currentRoleBadge = ROLE_CONFIG[data.role] || ROLE_CONFIG['courier'];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${user.name} | Admin`} />
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/users"
                            className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Heading
                                eyebrow="Identity & Access"
                                title="Edit User Account"
                                description="Update profile details, contact information, and role assignments."
                            />
                            <span className="rounded-xl bg-muted px-3.5 py-1.5 font-mono text-xs font-bold text-brand-navy border border-border shadow-2xs">
                                {user.email}
                            </span>
                            {user.custom_id && (
                                <span className="rounded-xl bg-muted px-3.5 py-1.5 font-mono text-xs font-bold text-brand-navy border border-border shadow-2xs">
                                    ID: {user.custom_id}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-4 max-w-3xl mx-auto w-full flex-1 bg-card border border-border/80 shadow-sm rounded-2xl p-8 md:p-10">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-6 border-b border-border/60 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="h-5 w-1 bg-brand-navy rounded-full"></div>
                            <h2 className="font-serif text-base md:text-lg font-bold text-brand-navy uppercase tracking-wider">
                                ACCOUNT & PROFILE EDITING
                            </h2>
                        </div>
                        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border ${currentRoleBadge.bg} ${currentRoleBadge.border} shadow-2xs transition-all`}>
                            <ShieldCheck className={`size-4 ${currentRoleBadge.text}`} />
                            <span className={`text-[10px] font-extrabold uppercase tracking-widest ${currentRoleBadge.text}`}>
                                {currentRoleBadge.label}
                            </span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-9">
                        {/* SECTION 1: IDENTITY & ROLE */}
                        <div className="space-y-6">
                            <div className="border-b border-border/50 pb-2.5">
                                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-foreground">
                                    1. IDENTITY & CREDENTIALS
                                </h3>
                            </div>

                            {/* Full Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                                    FULL NAME <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
                                    <Input
                                        id="name"
                                        className="h-12 rounded-xl border-border bg-card pl-11 pr-4 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="Legal Full Name"
                                        maxLength={100}
                                        required
                                    />
                                </div>
                                {errors.name && (
                                    <p className="text-[11px] font-bold text-red-500 ml-0.5 uppercase tracking-wider">{errors.name}</p>
                                )}
                            </div>

                            {/* Email Address & User Role Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                                        EMAIL ADDRESS <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
                                        <Input
                                            id="email"
                                            type="email"
                                            className="h-12 rounded-xl border-border bg-card pl-11 pr-4 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs"
                                            value={data.email}
                                            onChange={(e) => setData('email', e.target.value)}
                                            placeholder="user@example.com"
                                            maxLength={255}
                                            required
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="text-[11px] font-bold text-red-500 ml-0.5 uppercase tracking-wider">{errors.email}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="role" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                                        USER ROLE <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                        <select
                                            id="role"
                                            title={isOwnProfile ? 'You cannot change your own role' : 'Select role'}
                                            disabled={isOwnProfile}
                                            className="flex h-12 w-full rounded-xl border border-border bg-card px-4 pr-10 text-xs font-bold uppercase tracking-wider text-foreground focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                            value={data.role}
                                            onChange={(e) => setData('role', e.target.value)}
                                        >
                                            <option value="sender">CUSTOMER (SENDER)</option>
                                            <option value="courier">COURIER</option>
                                            <option value="picker">PICKER</option>
                                            <option value="warehouse">WAREHOUSE STAFF</option>
                                            <option value="admin">ADMINISTRATOR</option>
                                            {isSuperAdmin && (
                                                <option value="super_admin">SUPER ADMIN</option>
                                            )}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
                                    </div>
                                    {isOwnProfile ? (
                                        <p className="text-[11px] font-bold text-brand-secondary ml-0.5 uppercase tracking-wider flex items-center gap-1.5 mt-1.5">
                                            <Info className="size-3.5" />
                                            You cannot change your own role. Ask another admin to update it.
                                        </p>
                                    ) : ROLE_DESCRIPTIONS[data.role] && (
                                        <p className="text-[11px] font-normal text-muted-foreground mt-1.5 ml-0.5 leading-snug">
                                            {ROLE_DESCRIPTIONS[data.role]}
                                        </p>
                                    )}
                                    {errors.role && (
                                        <p className="text-[11px] font-bold text-red-500 ml-0.5 uppercase tracking-wider">{errors.role}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: CONTACT & LOCATION DETAILS */}
                        {['courier', 'picker', 'sender', 'warehouse'].includes(data.role) && (
                            <div className="space-y-6 pt-2">
                                <div className="border-b border-border/50 pb-2.5">
                                    <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-foreground">
                                        2. CONTACT & LOCATION DETAILS
                                    </h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Mobile Phone */}
                                    <div className="space-y-2">
                                        <Label htmlFor="mobile" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                                            MOBILE PHONE NUMBER
                                        </Label>
                                        <PhoneInput
                                            value={data.mobile || ''}
                                            onChange={(val) => setData('mobile', val)}
                                            defaultCountryCode="AU"
                                        />
                                        {errors.mobile && (
                                            <p className="text-[11px] font-bold text-red-500 ml-0.5 uppercase tracking-wider">{errors.mobile}</p>
                                        )}
                                    </div>

                                    {/* Street Address */}
                                    <div className="space-y-2">
                                        <Label htmlFor="address" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                                            STREET ADDRESS
                                        </Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
                                            <Input
                                                id="address"
                                                className="h-12 rounded-xl border-border bg-card pl-11 pr-4 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs"
                                                value={data.address}
                                                onChange={(e) => setData('address', e.target.value)}
                                                placeholder="Street Address, Unit / Suite"
                                                maxLength={200}
                                            />
                                        </div>
                                        {errors.address && (
                                            <p className="text-[11px] font-bold text-red-500 ml-0.5 uppercase tracking-wider">{errors.address}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Suburb, State, Postcode Breakdown */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="suburb" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                                            SUBURB / CITY
                                        </Label>
                                        <Input
                                            id="suburb"
                                            className="h-12 rounded-xl border-border bg-card px-4 text-xs font-semibold text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs"
                                            value={data.suburb}
                                            onChange={(e) => setData('suburb', e.target.value)}
                                            placeholder="e.g. Parramatta"
                                            maxLength={100}
                                        />
                                        {errors.suburb && (
                                            <p className="text-[11px] font-bold text-red-500 ml-0.5 uppercase tracking-wider">{errors.suburb}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="state" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                                            STATE / TERRITORY
                                        </Label>
                                        <Input
                                            id="state"
                                            className="h-12 rounded-xl border-border bg-card px-4 text-xs font-semibold text-foreground uppercase placeholder:text-muted-foreground/60 placeholder:normal-case focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs"
                                            value={data.state}
                                            onChange={(e) => setData('state', e.target.value.toUpperCase().slice(0, 10))}
                                            placeholder="e.g. NSW"
                                            maxLength={10}
                                        />
                                        {errors.state && (
                                            <p className="text-[11px] font-bold text-red-500 ml-0.5 uppercase tracking-wider">{errors.state}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="postcode" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                                            POSTCODE / ZIP
                                        </Label>
                                        <Input
                                            id="postcode"
                                            className="h-12 rounded-xl border-border bg-card px-4 text-xs font-mono font-bold text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs"
                                            value={data.postcode}
                                            onChange={(e) => setData('postcode', e.target.value.replace(/[^0-9A-Za-z-]/g, '').slice(0, 8))}
                                            placeholder="2000"
                                            maxLength={8}
                                        />
                                        {errors.postcode && (
                                            <p className="text-[11px] font-bold text-red-500 ml-0.5 uppercase tracking-wider">{errors.postcode}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SECTION 3: ROLE ASSIGNMENTS & SETTINGS */}
                        {(data.role === 'courier' || data.role === 'picker') && (
                            <div className="space-y-6 pt-2">
                                <div className="border-b border-border/50 pb-2.5">
                                    <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-foreground">
                                        3. TERRITORY & ROLE ASSIGNMENTS
                                    </h3>
                                </div>

                                {data.role === 'courier' && (
                                    <div className="space-y-2 md:col-span-2 transition-all duration-300 animate-in fade-in">
                                        <Label htmlFor="area_id" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                                            SERVICE AREA
                                        </Label>
                                        <div className="relative">
                                            <select
                                                id="area_id"
                                                title="Select service area"
                                                className="flex h-12 w-full rounded-xl border border-border bg-card px-4 pr-10 text-xs font-bold uppercase tracking-wider text-foreground focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs appearance-none cursor-pointer"
                                                value={data.area_id}
                                                onChange={(e) => setData('area_id', e.target.value)}
                                            >
                                                <option value="">None (Global / Unassigned)</option>
                                                {areas.map((area) => (
                                                    <option key={area.id} value={String(area.id)}>
                                                        {area.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
                                        </div>
                                        {errors.area_id && (
                                            <p className="text-[11px] font-bold text-red-500 ml-0.5 uppercase tracking-wider">{errors.area_id}</p>
                                        )}
                                    </div>
                                )}

                                {data.role === 'picker' && (
                                    <>
                                        <div className="space-y-2 md:col-span-2 transition-all duration-300 animate-in fade-in">
                                            <Label htmlFor="pickup_zone_id" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5 flex items-center justify-between">
                                                <span>ASSIGNED PICKUP AREA / ZONE <span className="text-red-500">*</span></span>
                                            </Label>
                                            <div className="relative">
                                                <select
                                                    id="pickup_zone_id"
                                                    title="Select pickup area"
                                                    className="flex h-12 w-full rounded-xl border border-border bg-card px-4 pr-10 text-xs font-bold uppercase tracking-wider text-foreground focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs appearance-none cursor-pointer"
                                                    value={data.pickup_zone_id}
                                                    onChange={(e) => setData('pickup_zone_id', e.target.value)}
                                                    required
                                                >
                                                    <option value="">SELECT REQUIRED PICKUP AREA / ZONE</option>
                                                    {pickupZones.map((zone) => (
                                                        <option key={zone.id} value={String(zone.id)}>
                                                            {zone.name.toUpperCase()} {zone.suburbs && zone.suburbs.length > 0 ? `(${zone.suburbs.length} SUBURBS)` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
                                            </div>
                                            {errors.pickup_zone_id && (
                                                <p className="text-[11px] font-bold text-red-500 ml-0.5 uppercase tracking-wider">{errors.pickup_zone_id}</p>
                                            )}
                                            {data.pickup_zone_id && (() => {
                                                const selectedZone = pickupZones.find(z => String(z.id) === data.pickup_zone_id);
                                                if (selectedZone?.suburbs && selectedZone.suburbs.length > 0) {
                                                    return (
                                                        <div className="mt-2 p-3 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground">
                                                            <span className="font-bold text-foreground block mb-1">Covered Suburbs in {selectedZone.name}:</span>
                                                            <span className="leading-relaxed">
                                                                {selectedZone.suburbs.slice(0, 12).map(s => `${s.name}${s.postcode ? ` (${s.postcode})` : ''}`).join(', ')}
                                                                {selectedZone.suburbs.length > 12 ? ` + ${selectedZone.suburbs.length - 12} more` : ''}
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>

                                        <div className="space-y-3 md:col-span-2 transition-all duration-300 animate-in fade-in pt-2">
                                            <div className="py-2 flex items-center justify-between gap-4">
                                                <div className="h-px flex-1 bg-border/60"></div>
                                                <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-muted-foreground">
                                                    COMMISSION SETTINGS
                                                </span>
                                                <div className="h-px flex-1 bg-border/60"></div>
                                            </div>
                                        </div>

                                        <CommissionCalculatorForm
                                            commissionType={data.commission_type}
                                            setCommissionType={(type) => setData('commission_type', type)}
                                            commissionRates={data.commission_rates}
                                            setCommissionRates={(rates) => setData('commission_rates', rates)}
                                            commissionForm={commissionForm}
                                            handleCommissionChange={handleCommissionChange}
                                            rawJsonMode={rawJsonMode}
                                            setRawJsonMode={setRawJsonMode}
                                        />
                                    </>
                                )}
                            </div>
                        )}

                        {/* SECTION 4: PASSWORD SETTINGS */}
                        <div className="space-y-4 pt-2">
                            <div className="border-b border-border/50 pb-2.5">
                                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-foreground">
                                    4. PASSWORD SETTINGS (OPTIONAL)
                                </h3>
                            </div>

                            <div className="rounded-2xl border border-border/60 bg-muted/30 p-5 space-y-4 shadow-2xs">
                                <div className="flex items-center gap-2">
                                    <Info className="size-4 text-muted-foreground/70" />
                                    <p className="text-xs font-normal text-muted-foreground">
                                        Leave password fields empty to keep the user's current password.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                                            NEW PASSWORD
                                        </Label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
                                            <Input
                                                id="password"
                                                type="password"
                                                className="h-12 rounded-xl border-border bg-card pl-11 pr-4 text-xs font-semibold text-foreground focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs"
                                                value={data.password}
                                                onChange={(e) => setData('password', e.target.value)}
                                                placeholder="Optional: min 8 characters"
                                            />
                                        </div>
                                        {errors.password && (
                                            <p className="text-[11px] font-bold text-red-500 ml-0.5 uppercase tracking-wider">{errors.password}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password_confirmation" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                                            CONFIRM NEW PASSWORD
                                        </Label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
                                            <Input
                                                id="password_confirmation"
                                                type="password"
                                                className="h-12 rounded-xl border-border bg-card pl-11 pr-4 text-xs font-semibold text-foreground focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs"
                                                value={data.password_confirmation}
                                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                                placeholder="Repeat password"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Action Buttons */}
                        <div className="flex items-center justify-end gap-5 pt-8 border-t border-border/50">
                            <Link
                                href="/admin/users"
                                className="px-6 py-3 rounded-xl text-xs font-extrabold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                            >
                                CANCEL
                            </Link>
                            <Button
                                type="submit"
                                disabled={processing}
                                variant="success"
                                className="px-8 h-12 rounded-xl text-xs font-extrabold uppercase tracking-widest flex items-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="size-4" />
                                {processing ? 'SAVING...' : 'SAVE CHANGES'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
