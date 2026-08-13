import { Head, Link, useForm } from '@inertiajs/react';
import { Save, ArrowLeft, Receipt, CreditCard, DollarSign, ShieldCheck } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Booking {
    id: number;
    reference_number: string;
    sender: { first_name: string; last_name: string };
}

export default function InvoicesCreate({ bookings }: { bookings: Booking[] }) {
    const { data, setData, post, processing, errors } = useForm({
        booking_id: '',
        amount: '',
        status: 'unpaid',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Invoices', href: '/admin/invoices' },
        { title: 'Create Invoice', href: '#' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/invoices');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Invoice | Admin" />
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-brand-warm/20 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/invoices"
                            className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <Heading
                            eyebrow="Billing"
                            title="Create Invoice"
                            description="Create an invoice for a booking."
                        />
                    </div>
                </div>

                <div className="mt-8 max-w-2xl mx-auto w-full flex-1 card border-brand-warm/20 shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <div className="bg-brand-warm/5 p-8 border-b border-brand-warm/10 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="h-10 w-1 bg-brand-rust rounded-full"></div>
                            <h2 className="font-serif text-xl font-bold text-brand-rust uppercase tracking-tight">Invoice Details</h2>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-brand-warm/20 shadow-sm">
                            <ShieldCheck className="size-4 text-brand-secondary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-rust">Billing Record</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <Label htmlFor="booking_id" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Booking</Label>
                                <div className="relative">
                                    <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <select
                                        id="booking_id"
                                        title="Select booking"
                                        className="flex h-12 w-full rounded-xl border border-brand-warm/20 bg-white pl-11 pr-4 text-[11px] font-black uppercase tracking-widest text-brand-rust focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm appearance-none cursor-pointer"
                                        value={data.booking_id}
                                        onChange={(e) =>
                                            setData('booking_id', e.target.value)
                                        }
                                    >
                                        <option value="">Select a booking...</option>
                                        {bookings.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                REF: {b.reference_number} — {b.sender.first_name} {b.sender.last_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {errors.booking_id && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.booking_id}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                                <div className="space-y-3">
                                    <Label htmlFor="amount" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Amount (AUD)</Label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1 font-black text-brand-rust/40 text-[11px]">
                                            $
                                        </div>
                                        <Input
                                            id="amount"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-black focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm font-mono text-brand-rust"
                                            value={data.amount}
                                            onChange={(e) =>
                                                setData('amount', e.target.value)
                                            }
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {errors.amount && (
                                        <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.amount}</p>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <Label htmlFor="status" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Status</Label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                        <select
                                            id="status"
                                            title="Payment Status"
                                            className="flex h-12 w-full rounded-xl border border-brand-warm/20 bg-brand-warm/5 pl-11 pr-4 text-[11px] font-black uppercase tracking-widest text-brand-rust focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm appearance-none cursor-pointer"
                                            value={data.status}
                                            onChange={(e) =>
                                                setData('status', e.target.value)
                                            }
                                        >
                                            <option value="unpaid">Unpaid</option>
                                            <option value="partial">Partial</option>
                                            <option value="paid">Paid</option>
                                        </select>
                                    </div>
                                    {errors.status && (
                                        <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.status}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-5 pt-10 border-t border-brand-warm/10">
                            <Link
                                href="/admin/invoices"
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
                                {processing ? 'Saving...' : 'Create Invoice'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

