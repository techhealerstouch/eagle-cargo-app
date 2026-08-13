import { Head, Link, useForm } from '@inertiajs/react';
import { Save, ArrowLeft, Receipt, DollarSign, CreditCard, ShieldCheck, RefreshCw, Upload, FileText, X, FileCheck } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Invoice {
    id: number;
    invoice_number: string;
    amount: number;
    status: string;
    or_number?: string;
    due_date?: string;
    booking: {
        reference_number: string;
        sender: { first_name: string; last_name: string };
    };
}

export default function InvoicesEdit({ invoice }: { invoice: Invoice }) {
    const { data, setData, post, processing, errors } = useForm({
        _method: 'put',
        amount: invoice.amount.toString(),
        status: invoice.status,
        or_number: invoice.or_number || '',
        due_date: invoice.due_date ? invoice.due_date.split('T')[0] : '', // format for date input
        payment_method: 'bank_transfer',
        reference_number: '',
        proof_of_payment: null as File | null,
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Invoices', href: '/admin/invoices' },
        { title: 'Edit Invoice', href: '#' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/admin/invoices/${invoice.id}`, {
            forceFormData: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${invoice.invoice_number} | Admin`} />
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
                        <div className="flex items-center gap-4">
                            <Heading
                                eyebrow="Billing"
                                title="Edit Invoice"
                                description={`Update billing details for ${invoice.booking.sender.first_name} ${invoice.booking.sender.last_name} (${invoice.booking.reference_number}).`}
                            />
                            <span className="rounded-xl bg-brand-warm/30 px-5 py-2 font-mono text-xs font-black text-brand-rust tracking-tight border border-brand-rust/10 shadow-sm flex items-center gap-2">
                                <RefreshCw className="size-3.5" />
                                {invoice.invoice_number}
                            </span>
                        </div>
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
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-rust">Update</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
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

                            <div className="space-y-3">
                                <Label htmlFor="or_number" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Official Receipt Number</Label>
                                <div className="relative">
                                    <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="or_number"
                                        type="text"
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-black focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm font-mono text-brand-rust"
                                        value={data.or_number}
                                        onChange={(e) =>
                                            setData('or_number', e.target.value)
                                        }
                                        placeholder="Optional OR Number"
                                    />
                                </div>
                                {errors.or_number && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.or_number}</p>
                                )}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="due_date" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Due Date</Label>
                                <div className="relative">
                                    <Input
                                        id="due_date"
                                        type="date"
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white px-4 font-black focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm font-mono text-brand-rust"
                                        value={data.due_date}
                                        onChange={(e) =>
                                            setData('due_date', e.target.value)
                                        }
                                    />
                                </div>
                                {errors.due_date && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.due_date}</p>
                                )}
                            </div>
                        </div>

                        {data.status === 'paid' && (
                            <div className="mt-8 rounded-3xl bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-white p-8 border-2 border-emerald-200/80 shadow-lg relative overflow-hidden transition-all duration-300">
                                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-6 mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="size-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0">
                                            <FileCheck className="size-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-serif text-lg font-bold text-emerald-950 tracking-tight flex items-center gap-2">
                                                Payment Verification Required
                                            </h3>
                                            <p className="text-xs text-emerald-800/80 font-medium mt-0.5">
                                                Marking as Paid will generate a verified record directly in the Payments table.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-3.5 py-1.5 rounded-full border border-emerald-300/60 shadow-2xs">
                                        Mandatory
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                                    <div className="space-y-3">
                                        <Label htmlFor="payment_method" className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-900/90 ml-1">
                                            Payment Method <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="relative">
                                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-emerald-600/60" />
                                            <select
                                                id="payment_method"
                                                title="Payment Method"
                                                className="flex h-12 w-full rounded-xl border border-emerald-200/80 bg-white pl-11 pr-4 text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm appearance-none cursor-pointer"
                                                value={data.payment_method}
                                                onChange={(e) => setData('payment_method', e.target.value)}
                                            >
                                                <option value="bank_transfer">Bank Transfer</option>
                                                <option value="cash">Cash</option>
                                                <option value="pay_id">Pay ID</option>
                                                <option value="stripe">Stripe</option>
                                                <option value="afterpay">Afterpay</option>
                                                <option value="square">Square</option>
                                                <option value="cash_on_pickup">Cash on Pickup</option>
                                                <option value="cheque">Cheque</option>
                                            </select>
                                        </div>
                                        {errors.payment_method && (
                                            <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.payment_method}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <Label htmlFor="reference_number" className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-900/90 ml-1 flex items-center gap-1">
                                            Reference / Transaction No. {['cash', 'cash_on_pickup'].includes(data.payment_method) ? <span className="text-[10px] lowercase tracking-normal text-emerald-700/80 font-semibold">(optional for cash)</span> : <span className="text-red-500">*</span>}
                                        </Label>
                                        <div className="relative">
                                            <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-emerald-600/60" />
                                            <Input
                                                id="reference_number"
                                                type="text"
                                                className="h-12 rounded-xl border-emerald-200/80 bg-white pl-11 pr-4 text-xs font-bold text-emerald-950 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm font-mono placeholder:font-sans placeholder:font-normal placeholder:text-muted-foreground"
                                                value={data.reference_number}
                                                onChange={(e) => setData('reference_number', e.target.value)}
                                                placeholder={['cash', 'cash_on_pickup'].includes(data.payment_method) ? "Optional note or receipt # for cash" : "e.g. TRN-9827346 or Bank Receipt #"}
                                            />
                                        </div>
                                        {errors.reference_number && (
                                            <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.reference_number}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3 md:col-span-2">
                                        <Label htmlFor="proof_of_payment" className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-900/90 ml-1">
                                            Proof of Payment (Image or PDF) <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="relative border-2 border-dashed border-emerald-300/80 rounded-2xl p-6 bg-white/80 hover:bg-white transition-all text-center group cursor-pointer shadow-2xs">
                                            <Upload className="size-8 text-emerald-400 mx-auto mb-3 group-hover:text-emerald-600 transition-colors" />
                                            <div className="text-xs font-bold text-emerald-950 mb-1">
                                                {data.proof_of_payment ? data.proof_of_payment.name : 'Click to select or drag proof of payment document'}
                                            </div>
                                            <p className="text-[11px] text-emerald-700/80">Supports JPG, PNG, or PDF (Max 5MB)</p>
                                            <input
                                                id="proof_of_payment"
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={(e) => setData('proof_of_payment', e.target.files ? e.target.files[0] : null)}
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                title="Upload proof of payment"
                                            />
                                            {data.proof_of_payment && (
                                                <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 py-2 px-4 rounded-xl border border-emerald-200 w-fit mx-auto shadow-xs">
                                                    <FileText className="size-4 shrink-0" />
                                                    <span className="truncate max-w-xs">{data.proof_of_payment.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setData('proof_of_payment', null);
                                                        }}
                                                        className="ml-2 text-emerald-600 hover:text-red-600 transition-colors p-1"
                                                        title="Remove file"
                                                    >
                                                        <X className="size-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {errors.proof_of_payment && (
                                            <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.proof_of_payment}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

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
                                {processing ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

