import { Head, useForm, Link } from '@inertiajs/react';
import { Save, ArrowLeft, User, Phone, MapPin, Globe, ShieldCheck, Info } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PhoneInput from '@/components/ui/PhoneInput';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Area {
    id: number;
    name: string;
}

interface Recipient {
    id: number;
    name: string;
    phone_number: string | null;
    address: string;
    city: string;
    province: string;
    zip_code: string | null;
    landmarks: string | null;
    area_id: number | null;
    sender: { first_name: string; last_name: string } | null;
}

export default function RecipientsEdit({ recipient, areas }: { recipient: Recipient; areas: Area[] }) {
    const { data, setData, put, processing, errors } = useForm({
        name: recipient.name,
        phone_number: recipient.phone_number || '',
        address: recipient.address,
        city: recipient.city,
        province: recipient.province,
        zip_code: recipient.zip_code || '',
        landmarks: recipient.landmarks || '',
        area_id: recipient.area_id?.toString() || '',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Recipients', href: '/admin/recipients' },
        { title: 'Edit Recipient', href: '#' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/admin/recipients/${recipient.id}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Recipient | Admin" />
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-brand-warm/20 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/recipients"
                            className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Heading
                                eyebrow="Beneficiary Management"
                                title="Edit Recipient"
                                description="Update recipient contact and address details."
                            />
                            {recipient.sender && (
                                <span className="rounded-xl bg-brand-warm/30 px-5 py-2 font-mono text-xs font-black text-brand-rust tracking-tight border border-brand-rust/10 shadow-sm flex items-center gap-2">
                                    <User className="size-3.5" />
                                    LINKED SENDER: {recipient.sender.first_name} {recipient.sender.last_name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 max-w-4xl mx-auto w-full flex-1 card border-brand-warm/20 shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <div className="bg-brand-warm/5 p-8 border-b border-brand-warm/10 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="h-10 w-1 bg-brand-rust rounded-full"></div>
                            <h2 className="font-serif text-xl font-bold text-brand-rust uppercase tracking-tight">Recipient Details</h2>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-brand-warm/20 shadow-sm">
                            <ShieldCheck className="size-4 text-brand-secondary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-rust">DESTINATION DATA</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                            <div className="space-y-3 md:col-span-2">
                                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Recipient Name</Label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="name"
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="Full recipient name"
                                    />
                                </div>
                                {errors.name && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.name}</p>
                                )}
                            </div>

                             <div className="space-y-3">
                                 <Label htmlFor="phone_number" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Primary Contact Number</Label>
                                 <PhoneInput
                                     value={data.phone_number || ''}
                                     onChange={val => setData('phone_number', val)}
                                     defaultCountryCode="PH"
                                 />
                             </div>

                            <div className="space-y-3">
                                <Label htmlFor="area_id" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Delivery Area</Label>
                                <div className="relative">
                                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <select
                                        id="area_id"
                                        title="Select area"
                                        value={data.area_id}
                                        onChange={(e) => setData('area_id', e.target.value)}
                                        className="flex h-12 w-full rounded-xl border border-brand-warm/20 bg-white pl-11 pr-4 text-[11px] font-black uppercase tracking-widest text-brand-rust focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm appearance-none cursor-pointer"
                                    >
                                        <option value="">Select area...</option>
                                        {areas.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                                    </select>
                                </div>
                            </div>

                            <div className="col-span-1 my-4 flex items-center gap-4 md:col-span-2">
                                <div className="h-px flex-1 bg-brand-warm/10"></div>
                                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-brand-rust/40">Address Details</span>
                                <div className="h-px flex-1 bg-brand-warm/10"></div>
                            </div>

                            <div className="space-y-3 md:col-span-2">
                                <Label htmlFor="address" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Delivery Address</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-6 size-4 text-brand-rust/40" />
                                    <textarea
                                        id="address"
                                        placeholder="House/Unit No., Street Name, Barangay"
                                        value={data.address}
                                        onChange={(e) => setData('address', e.target.value)}
                                        className="flex min-h-32 w-full rounded-xl border border-brand-warm/20 bg-white pl-11 pr-4 py-4 font-bold text-sm focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                    />
                                </div>
                                {errors.address && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.address}</p>
                                )}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="city" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">City / Town</Label>
                                <Input
                                    id="city"
                                    className="h-12 rounded-xl border-brand-warm/20 bg-white px-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                    value={data.city}
                                    onChange={(e) => setData('city', e.target.value)}
                                    placeholder="e.g. Quezon City"
                                />
                                {errors.city && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.city}</p>
                                )}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="province" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Province</Label>
                                <Input
                                    id="province"
                                    className="h-12 rounded-xl border-brand-warm/20 bg-white px-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                    value={data.province}
                                    onChange={(e) => setData('province', e.target.value)}
                                    placeholder="e.g. Metro Manila"
                                />
                                {errors.province && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.province}</p>
                                )}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="zip_code" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Postal Code</Label>
                                <Input
                                    id="zip_code"
                                    className="h-12 rounded-xl border-brand-warm/20 bg-white px-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                    value={data.zip_code}
                                    onChange={(e) => setData('zip_code', e.target.value)}
                                    placeholder="e.g. 1100"
                                />
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="landmarks" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Landmarks</Label>
                                <div className="relative">
                                    <Info className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="landmarks"
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.landmarks}
                                        onChange={(e) => setData('landmarks', e.target.value)}
                                        placeholder="e.g. Near Brgy. Hall"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-5 pt-10 border-t border-brand-warm/10">
                            <Link href="/admin/recipients" className="px-10 h-14 flex items-center justify-center rounded-2xl border-2 border-brand-warm/20 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-brand-warm/5 transition-all active:scale-95 text-muted-foreground">
                                Cancel
                            </Link>
                            <Button
                                type="submit"
                                disabled={processing}
                                variant="success"
                                className="px-14 h-14 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl flex items-center gap-4 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                <Save className="size-4" />
                                {processing ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

