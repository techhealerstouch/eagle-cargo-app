import React, { useMemo } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { Save, ArrowLeft, Building2 } from 'lucide-react';
import Heading from '@/components/common/heading';
import PhoneInput from '@/components/ui/PhoneInput';
import { validatePhone } from '@/lib/countries';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

export default function EditRecipient({ recipient, areas, provinces = [] }: any) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Recipients', href: '/recipients' },
        { title: 'Edit Recipient', href: '#' }
    ];

    const { data, setData, put, processing, errors, setError, clearErrors } = useForm({
        name: recipient.name || '',
        email: recipient.email || '',
        phone_number: recipient.phone_number || '',
        secondary_phone_number: recipient.secondary_phone_number || '',
        address: recipient.address || '',
        city: recipient.city || '',
        province: recipient.province || '',
        zip_code: recipient.zip_code || '',
        landmarks: recipient.landmarks || '',
        area_id: recipient.area_id || '',
    });

    const handleProvinceChange = (provinceName: string) => {
        const prov = (provinces || []).find((p: any) => p.name?.toLowerCase().trim() === provinceName.toLowerCase().trim());
        setData((prev: any) => ({
            ...prev,
            province: provinceName,
            ...(prov?.area_id ? { area_id: String(prov.area_id) } : {}),
        }));
    };

    const resolvedAreaName = useMemo(() => {
        if (data.area_id) {
            const found = (areas || []).find((a: any) => a.id.toString() === data.area_id.toString());
            if (found) return found.name;
        }
        return recipient?.area?.name || '';
    }, [data.area_id, areas, recipient]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        clearErrors();

        let hasErrors = false;

        if (data.phone_number) {
            const phoneError = validatePhone(data.phone_number, 'Phone Number', 'PH');
            if (phoneError) {
                setError('phone_number', phoneError);
                hasErrors = true;
            }
        }

        if (data.secondary_phone_number) {
            const secondaryPhoneError = validatePhone(data.secondary_phone_number, 'Secondary Phone Number', 'PH');
            if (secondaryPhoneError) {
                setError('secondary_phone_number', secondaryPhoneError);
                hasErrors = true;
            }
        }

        if (hasErrors) {
            return;
        }

        put(`/recipients/${recipient.id}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Recipient" />

            <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-8 md:space-y-10">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-zinc-100 dark:border-zinc-800 pb-10">
                    <div className="flex items-center gap-4">
                        <Link 
                            href="/recipients"
                            className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <Heading
                            eyebrow="Address Book"
                            title="Edit Recipient"
                            description={`Update details for ${recipient.name}`}
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-10 shadow-sm">
                    <form onSubmit={submit} className="space-y-8">
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">Contact Information</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Full Name *</label>
                                    <input
                                        type="text"
                                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-rust focus:border-brand-rust outline-none transition-all"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        required
                                    />
                                    {errors.name && <p className="mt-2 text-sm text-red-600">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Primary Phone Number</label>
                                    <PhoneInput
                                        value={data.phone_number}
                                        onChange={(val) => setData('phone_number', val)}
                                        defaultCountryCode="PH"
                                    />
                                    {errors.phone_number && <p className="mt-2 text-sm text-red-600">{errors.phone_number}</p>}
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">Secondary Contact Number</label>
                                        <span className="text-[10px] text-zinc-400 font-medium">Optional</span>
                                    </div>
                                    <PhoneInput
                                        value={data.secondary_phone_number}
                                        onChange={(val) => setData('secondary_phone_number', val)}
                                        defaultCountryCode="PH"
                                    />
                                    {errors.secondary_phone_number && <p className="mt-2 text-sm text-red-600">{errors.secondary_phone_number}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-rust focus:border-brand-rust outline-none transition-all"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                    />
                                    {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">Delivery Address</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Street Address *</label>
                                    <textarea
                                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-rust focus:border-brand-rust outline-none transition-all resize-none h-24"
                                        value={data.address}
                                        onChange={(e) => setData('address', e.target.value)}
                                        required
                                    />
                                    {errors.address && <p className="mt-2 text-sm text-red-600">{errors.address}</p>}
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">City *</label>
                                    <input
                                        type="text"
                                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-rust focus:border-brand-rust outline-none transition-all"
                                        value={data.city}
                                        onChange={(e) => setData('city', e.target.value)}
                                        required
                                    />
                                    {errors.city && <p className="mt-2 text-sm text-red-600">{errors.city}</p>}
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Province *</label>
                                    {provinces && provinces.length > 0 ? (
                                        <select
                                            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-rust focus:border-brand-rust outline-none transition-all cursor-pointer"
                                            value={data.province}
                                            onChange={(e) => handleProvinceChange(e.target.value)}
                                            required
                                        >
                                            <option value="" disabled>Select Province...</option>
                                            {provinces.map((prov: any) => (
                                                <option key={prov.id} value={prov.name}>
                                                    {prov.name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-rust focus:border-brand-rust outline-none transition-all"
                                            value={data.province}
                                            onChange={(e) => handleProvinceChange(e.target.value)}
                                            required
                                        />
                                    )}
                                    {errors.province && <p className="mt-2 text-sm text-red-600">{errors.province}</p>}
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Zip Code</label>
                                    <input
                                        type="text"
                                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-rust focus:border-brand-rust outline-none transition-all"
                                        value={data.zip_code}
                                        onChange={(e) => setData('zip_code', e.target.value)}
                                    />
                                    {errors.zip_code && <p className="mt-2 text-sm text-red-600">{errors.zip_code}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center justify-between">
                                        <span>Delivery Zone</span>
                                        <span className="text-xs font-normal text-zinc-400">Auto-resolved from province</span>
                                    </label>
                                    <div className="flex items-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                        <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                                        <span>{resolvedAreaName || 'Assigned automatically'}</span>
                                    </div>
                                    <input type="hidden" name="area_id" value={data.area_id} />
                                    {errors.area_id && <p className="mt-2 text-sm text-red-600">{errors.area_id}</p>}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Landmarks</label>
                                    <textarea
                                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-rust focus:border-brand-rust outline-none transition-all resize-none h-20"
                                        value={data.landmarks}
                                        onChange={(e) => setData('landmarks', e.target.value)}
                                        placeholder="Near a church, specific building color, etc."
                                    />
                                    {errors.landmarks && <p className="mt-2 text-sm text-red-600">{errors.landmarks}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-rust px-8 py-3 text-sm font-bold text-white shadow-xl shadow-brand-rust/20 hover:brightness-110 transition-all uppercase tracking-widest active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                {processing ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
