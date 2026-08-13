import { Head, Link, useForm } from '@inertiajs/react';
import { Save, ArrowLeft, User, Phone, Mail, MapPin, Globe, ShieldCheck } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PhoneInput from '@/components/ui/PhoneInput';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Sender {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    mobile: string;
    address: string;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
}

export default function SendersEdit({ sender }: { sender: Sender }) {
    const { data, setData, put, processing, errors } = useForm({
        first_name: sender.first_name,
        last_name: sender.last_name,
        email: sender.email,
        mobile: sender.mobile,
        address: sender.address,
        suburb: sender.suburb || '',
        state: sender.state || '',
        postcode: sender.postcode || '',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Senders', href: '/admin/senders' },
        { title: 'Edit Profile', href: '#' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/admin/senders/${sender.id}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${sender.first_name} | Admin`} />
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-brand-warm/20 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/senders"
                            className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Heading
                                eyebrow="Customer Relations"
                                title="Edit Sender Profile"
                                description="Update sender contact and address details."
                            />
                            <span className="rounded-xl bg-brand-warm/30 px-5 py-2 font-mono text-xs font-black text-brand-rust tracking-tight border border-brand-rust/10 shadow-sm">
                                {sender.email}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 max-w-4xl mx-auto w-full flex-1 card border-brand-warm/20 shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <div className="bg-brand-warm/5 p-8 border-b border-brand-warm/10 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="h-10 w-1 bg-brand-rust rounded-full"></div>
                            <h2 className="font-serif text-xl font-bold text-brand-rust uppercase tracking-tight">Sender Details</h2>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-brand-warm/20 shadow-sm">
                            <ShieldCheck className="size-4 text-brand-secondary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-rust">ACTIVE STAKEHOLDER</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                            {/* First Name */}
                            <div className="space-y-3">
                                <Label htmlFor="first_name" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">First Name</Label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="first_name"
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.first_name}
                                        onChange={(e) =>
                                            setData('first_name', e.target.value)
                                        }
                                        placeholder="Given Name"
                                    />
                                </div>
                                {errors.first_name && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.first_name}</p>
                                )}
                            </div>

                            {/* Last Name */}
                            <div className="space-y-3">
                                <Label htmlFor="last_name" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Last Name</Label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="last_name"
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.last_name}
                                        onChange={(e) =>
                                            setData('last_name', e.target.value)
                                        }
                                        placeholder="Family Name"
                                    />
                                </div>
                                {errors.last_name && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.last_name}</p>
                                )}
                            </div>

                            {/* Email */}
                            <div className="space-y-3">
                                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="email"
                                        type="email"
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.email}
                                        onChange={(e) =>
                                            setData('email', e.target.value)
                                        }
                                        placeholder="jane.doe@example.com"
                                    />
                                </div>
                                {errors.email && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.email}</p>
                                )}
                            </div>

                            {/* Mobile */}
                            <div className="space-y-3">
                                <Label htmlFor="mobile" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Phone Number</Label>
                                <PhoneInput
                                    value={data.mobile || ''}
                                    onChange={val => setData('mobile', val)}
                                    defaultCountryCode="AU"
                                />
                                {errors.mobile && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.mobile}</p>
                                )}
                            </div>

                            <div className="col-span-1 my-4 flex items-center gap-4 md:col-span-2">
                                <div className="h-px flex-1 bg-brand-warm/10"></div>
                                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-brand-rust/40">Address Details</span>
                                <div className="h-px flex-1 bg-brand-warm/10"></div>
                            </div>

                            {/* Address */}
                            <div className="space-y-3 md:col-span-2">
                                <Label htmlFor="address" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Street Address</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="address"
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.address}
                                        onChange={(e) =>
                                            setData('address', e.target.value)
                                        }
                                        placeholder="Civic Number & Street Name"
                                    />
                                </div>
                                {errors.address && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.address}</p>
                                )}
                            </div>

                            {/* Suburb */}
                            <div className="space-y-3">
                                <Label htmlFor="suburb" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Suburb / City</Label>
                                <div className="relative">
                                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="suburb"
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.suburb}
                                        onChange={(e) =>
                                            setData('suburb', e.target.value)
                                        }
                                        placeholder="Sydney Area"
                                    />
                                </div>
                                {errors.suburb && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.suburb}</p>
                                )}
                            </div>

                            {/* State & Postcode */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <Label htmlFor="state" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">State</Label>
                                    <Input
                                        id="state"
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white px-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.state}
                                        onChange={(e) =>
                                            setData('state', e.target.value)
                                        }
                                        placeholder="NSW"
                                    />
                                    {errors.state && (
                                        <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.state}</p>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="postcode" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Postcode</Label>
                                    <Input
                                        id="postcode"
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white px-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.postcode}
                                        onChange={(e) =>
                                            setData('postcode', e.target.value)
                                        }
                                        placeholder="2000"
                                    />
                                    {errors.postcode && (
                                        <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.postcode}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-5 pt-10 border-t border-brand-warm/10">
                            <Link
                                href="/admin/senders"
                                className="px-10 h-14 flex items-center justify-center rounded-2xl border-2 border-brand-warm/20 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-brand-warm/5 transition-all active:scale-95 text-muted-foreground"
                            >
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
