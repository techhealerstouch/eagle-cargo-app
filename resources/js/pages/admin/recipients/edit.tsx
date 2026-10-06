import { Head, useForm, Link, usePage } from '@inertiajs/react';
import {
    Save,
    ArrowLeft,
    User,
    MapPin,
    Globe,
    Info,
    Loader2,
} from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import PhoneInput from '@/components/ui/PhoneInput';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Area {
    id: number;
    name: string;
}

interface Province {
    id: number;
    name: string;
    area_id?: number | null;
}

interface Recipient {
    id: number;
    name: string;
    phone_number: string | null;
    secondary_phone_number?: string | null;
    address: string;
    city: string;
    province: string;
    zip_code: string | null;
    landmarks: string | null;
    area_id: number | null;
    sender: { first_name: string; last_name: string } | null;
}

export default function RecipientsEdit({
    recipient,
    areas,
    provinces = [],
}: {
    recipient: Recipient;
    areas: Area[];
    provinces?: Province[];
}) {
    const { admin_return_url } = usePage<any>().props;
    const { data, setData, put, processing, errors } = useForm({
        name: recipient.name || '',
        phone_number: recipient.phone_number || '',
        secondary_phone_number: recipient.secondary_phone_number || '',
        address: recipient.address || '',
        city: recipient.city || '',
        province: recipient.province || '',
        zip_code: recipient.zip_code || '',
        landmarks: recipient.landmarks || '',
        area_id: recipient.area_id?.toString() || '',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Recipients', href: admin_return_url || '/admin/recipients' },
        { title: recipient.name, href: `/admin/recipients/${recipient.id}` },
        { title: 'Edit', href: '#' },
    ];

    const normalizedProvinceValue = React.useMemo(() => {
        if (!data.province) return '';
        const match = provinces.find(
            (p) => p.name.toLowerCase() === data.province.toLowerCase()
        );
        return match ? match.name : data.province;
    }, [data.province, provinces]);

    const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedVal = e.target.value;
        const matched = provinces.find(
            (p) => p.name.toLowerCase() === selectedVal.toLowerCase()
        );
        if (matched?.area_id) {
            setData((prev) => ({
                ...prev,
                province: selectedVal,
                area_id: matched.area_id ? matched.area_id.toString() : prev.area_id,
            }));
        } else {
            setData('province', selectedVal);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/admin/recipients/${recipient.id}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${recipient.name} | Admin`} />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 sm:p-6 min-w-0 w-full max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link
                            href={admin_return_url || '/admin/recipients'}
                            className="size-9 shrink-0 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-center transition-all shadow-2xs"
                            title="Back to Recipients list"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                        <div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h1 className="font-sans text-xl font-bold tracking-tight text-foreground">
                                    Edit Recipient Profile
                                </h1>
                                {recipient.sender && (
                                    <Badge
                                        variant="outline"
                                        className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-brand-warm/30 text-brand-rust border-brand-rust/20 flex items-center gap-1"
                                    >
                                        <User className="size-3" />
                                        Linked Sender: {recipient.sender.first_name} {recipient.sender.last_name}
                                    </Badge>
                                )}
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium border border-border/70">
                                    #{recipient.id}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Update recipient contact information, delivery area, and destination address.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        <Button variant="outline" className="h-8.5 text-xs font-medium" asChild>
                            <Link href={admin_return_url || '/admin/recipients'}>
                                Cancel
                            </Link>
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={processing}
                            className="h-8.5 px-4 rounded-lg bg-brand-rust hover:bg-brand-rust/90 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-50"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="size-3.5" />
                                    <span>Save Changes</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Form Card */}
                <form onSubmit={handleSubmit} className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
                    <div className="p-5 sm:p-6 space-y-6">
                        {/* Recipient Information */}
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                                Recipient Information
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label htmlFor="name" className="text-xs font-medium text-foreground">
                                        Recipient Name <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
                                        <Input
                                            id="name"
                                            className="h-9 rounded-md pl-9 text-xs sm:text-sm"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            placeholder="Full recipient name"
                                            required
                                        />
                                    </div>
                                    {errors.name && (
                                        <p className="text-[11px] font-medium text-red-500 mt-0.5">{errors.name}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="phone_number" className="text-xs font-medium text-foreground">
                                        Primary Contact Number <span className="text-red-500">*</span>
                                    </Label>
                                    <PhoneInput
                                        value={data.phone_number || ''}
                                        onChange={(val) => setData('phone_number', val)}
                                        defaultCountryCode="PH"
                                        className="h-9 rounded-md"
                                    />
                                    {errors.phone_number && (
                                        <p className="text-[11px] font-medium text-red-500 mt-0.5">{errors.phone_number}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="secondary_phone_number" className="text-xs font-medium text-foreground">
                                            Secondary Contact Number
                                        </Label>
                                        <span className="text-[10px] text-muted-foreground">Optional</span>
                                    </div>
                                    <PhoneInput
                                        value={data.secondary_phone_number || ''}
                                        onChange={(val) => setData('secondary_phone_number', val)}
                                        defaultCountryCode="PH"
                                        className="h-9 rounded-md"
                                    />
                                    {errors.secondary_phone_number && (
                                        <p className="text-[11px] font-medium text-red-500 mt-0.5">{errors.secondary_phone_number}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label htmlFor="area_id" className="text-xs font-medium text-foreground">
                                        Delivery Area
                                    </Label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
                                        <select
                                            id="area_id"
                                            title="Select delivery area"
                                            value={data.area_id}
                                            onChange={(e) => setData('area_id', e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-4 text-xs sm:text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                                        >
                                            <option value="">Select area...</option>
                                            {areas.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {errors.area_id && (
                                        <p className="text-[11px] font-medium text-red-500 mt-0.5">{errors.area_id}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Delivery Address Details */}
                        <div className="border-t border-border/70 pt-5">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                                Address Details
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                                <div className="sm:col-span-12 space-y-1.5">
                                    <Label htmlFor="address" className="text-xs font-medium text-foreground">
                                        Delivery Address <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3 size-3.5 text-muted-foreground/60" />
                                        <textarea
                                            id="address"
                                            placeholder="House/Unit No., Street Name, Barangay"
                                            value={data.address}
                                            onChange={(e) => setData('address', e.target.value)}
                                            rows={3}
                                            className="flex min-h-[72px] w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-xs sm:text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            required
                                        />
                                    </div>
                                    {errors.address && (
                                        <p className="text-[11px] font-medium text-red-500 mt-0.5">{errors.address}</p>
                                    )}
                                </div>

                                <div className="sm:col-span-6 space-y-1.5">
                                    <Label htmlFor="city" className="text-xs font-medium text-foreground">
                                        City / Municipality
                                    </Label>
                                    <Input
                                        id="city"
                                        className="h-9 rounded-md text-xs sm:text-sm"
                                        value={data.city}
                                        onChange={(e) => setData('city', e.target.value)}
                                        placeholder="e.g. Quezon City"
                                    />
                                    {errors.city && (
                                        <p className="text-[11px] font-medium text-red-500 mt-0.5">{errors.city}</p>
                                    )}
                                </div>

                                <div className="sm:col-span-6 space-y-1.5">
                                    <Label htmlFor="province" className="text-xs font-medium text-foreground">
                                        Province <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="province"
                                        title="Select province"
                                        value={normalizedProvinceValue}
                                        onChange={handleProvinceChange}
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs sm:text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                                        required
                                    >
                                        <option value="">Select province...</option>
                                        {provinces.map((p) => (
                                            <option key={p.id} value={p.name}>
                                                {p.name}
                                            </option>
                                        ))}
                                        {data.province && !provinces.some((p) => p.name.toLowerCase() === data.province.toLowerCase()) && (
                                            <option value={data.province}>{data.province}</option>
                                        )}
                                    </select>
                                    {errors.province && (
                                        <p className="text-[11px] font-medium text-red-500 mt-0.5">{errors.province}</p>
                                    )}
                                </div>

                                <div className="sm:col-span-4 space-y-1.5">
                                    <Label htmlFor="zip_code" className="text-xs font-medium text-foreground">
                                        Postal Code
                                    </Label>
                                    <Input
                                        id="zip_code"
                                        className="h-9 rounded-md text-xs sm:text-sm"
                                        value={data.zip_code}
                                        onChange={(e) => setData('zip_code', e.target.value)}
                                        placeholder="e.g. 1100"
                                    />
                                    {errors.zip_code && (
                                        <p className="text-[11px] font-medium text-red-500 mt-0.5">{errors.zip_code}</p>
                                    )}
                                </div>

                                <div className="sm:col-span-8 space-y-1.5">
                                    <Label htmlFor="landmarks" className="text-xs font-medium text-foreground">
                                        Landmarks / Delivery Notes
                                    </Label>
                                    <div className="relative">
                                        <Info className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
                                        <Input
                                            id="landmarks"
                                            className="h-9 rounded-md pl-9 text-xs sm:text-sm"
                                            value={data.landmarks}
                                            onChange={(e) => setData('landmarks', e.target.value)}
                                            placeholder="e.g. Near Barangay Hall, Red Gate"
                                        />
                                    </div>
                                    {errors.landmarks && (
                                        <p className="text-[11px] font-medium text-red-500 mt-0.5">{errors.landmarks}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-5 py-3.5 bg-muted/20 border-t border-border/80 flex items-center justify-end gap-2.5">
                        <Button variant="outline" className="h-8.5 text-xs font-medium" asChild>
                            <Link href={admin_return_url || '/admin/recipients'}>
                                Cancel
                            </Link>
                        </Button>
                        <Button
                            type="submit"
                            disabled={processing}
                            className="h-8.5 px-4 rounded-lg bg-brand-rust hover:bg-brand-rust/90 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-50"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="size-3.5" />
                                    <span>Save Changes</span>
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
