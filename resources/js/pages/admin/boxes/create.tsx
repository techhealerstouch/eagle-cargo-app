import { Head, Link, useForm } from '@inertiajs/react';
import { Save, ArrowLeft } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';

import type { BreadcrumbItem } from '@/types';

interface Booking {
    id: number;
    reference_number: string;
    sender: { first_name: string; last_name: string };
}

export default function BoxesCreate({ bookings }: { bookings: Booking[] }) {
    const { data, setData, post, processing, errors } = useForm({
        booking_id: '',
        status: 'pending',
        courier_notes: '',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Boxes', href: '/admin/boxes' },
        { title: 'Register Box', href: '/boxes/create' },
    ];

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        post('/admin/boxes');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Register Box | Admin" />
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-brand-warm/20 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/boxes"
                            className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <Heading
                            eyebrow="Asset Management"
                            title="Register New Box"
                            description="Link a physical box to an existing booking."
                        />
                    </div>
                </div>

                <div className="mt-8 max-w-2xl mx-auto w-full flex-1 card card-padding border-brand-warm/20 shadow-sm rounded-3xl bg-white">
                    <div className="mb-10 flex items-center gap-3">
                        <div className="h-10 w-1 bg-brand-rust rounded-full"></div>
                        <h2 className="font-serif text-xl font-bold text-brand-rust uppercase tracking-tight">Box Registration</h2>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="booking_id" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Booking</Label>
                                <select
                                    id="booking_id"
                                    name="booking_id"
                                    title="Booking"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all"
                                    value={data.booking_id}
                                    onChange={(e) =>
                                        setData('booking_id', e.target.value)
                                    }
                                >
                                    <option value="">Select a booking</option>
                                    {bookings.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.reference_number} — {b.sender.first_name} {b.sender.last_name}
                                        </option>
                                    ))}
                                </select>
                                {errors.booking_id && (
                                    <p className="text-sm text-red-500 font-medium ml-1">{errors.booking_id}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="status" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Initial Status</Label>
                                <select
                                    id="status"
                                    title="Status"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all"
                                    value={data.status}
                                    onChange={(e) =>
                                        setData('status', e.target.value)
                                    }
                                >
                                    <option value="pending">Pending</option>
                                    <option value="collected">Collected</option>
                                    <option value="warehouse">Warehouse</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                </select>
                                {errors.status && (
                                    <p className="text-sm text-red-500 font-medium ml-1">{errors.status}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="courier_notes" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Courier Notes</Label>
                                <textarea
                                    id="courier_notes"
                                    className="min-h-32 w-full rounded-md border border-input bg-brand-sand/10 px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all"
                                    value={data.courier_notes}
                                    onChange={(e) =>
                                        setData('courier_notes', e.target.value)
                                    }
                                    placeholder="e.g. Fragile contents, handle with care"
                                />
                                {errors.courier_notes && (
                                    <p className="text-sm text-red-500 font-medium ml-1">{errors.courier_notes}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 border-t border-brand-warm/10 pt-10">
                            <Link href="/admin/boxes" className="btn-outline px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95">
                                Cancel
                            </Link>
                            <Button
                                type="submit"
                                disabled={processing}
                                variant="success"
                                className="flex items-center gap-3 px-10 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                <Save className="size-4" />
                                Create Box
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
