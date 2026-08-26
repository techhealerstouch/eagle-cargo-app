import { Head, Link, useForm } from '@inertiajs/react';
import {
    Save,
    ArrowLeft,
    Receipt,
    CreditCard,
    ShieldCheck,
    RefreshCw,
    Upload,
    FileText,
    X,
    FileCheck,
    Package,
    ExternalLink,
    Sparkles,
    MapPin,
    User,
    Calendar,
    Info,
    Truck
} from 'lucide-react';
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
    booking_snapshot?: any;
    line_items_snapshot?: any[];
    sender_snapshot?: any;
    booking?: {
        id: number;
        reference_number: string;
        booking_type?: string;
        destination?: string;
        boxes?: any[];
        sender?: {
            first_name: string;
            last_name: string;
            email?: string;
            mobile?: string;
            address?: string;
        };
    };
}

const BOOKING_TYPE_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
    drop_off: {
        label: 'Drop-Off',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
        icon: 'package',
    },
    home_pickup: {
        label: 'Home Pick-Up',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        icon: 'truck',
    },
    other: {
        label: 'Other',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
        icon: 'sparkles',
    },
};

const BOOKING_TYPE_SUBJECT_PREFIXES: Record<string, string> = {
    drop_off: 'BOX DROP OFF',
    home_pickup: 'HOME PICK-UP',
    other: 'OTHER',
};

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
        { title: invoice.invoice_number, href: `/admin/invoices/${invoice.id}` },
        { title: 'Edit', href: '#' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/admin/invoices/${invoice.id}`, {
            forceFormData: true,
        });
    };

    // Resolve Sender details (live booking sender or historical snapshot)
    const sender = invoice.booking?.sender || invoice.sender_snapshot || {};
    const senderName = `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'N/A';
    const bookingRef = invoice.booking?.reference_number || invoice.booking_snapshot?.reference_number || 'N/A';
    const bookingId = invoice.booking?.id;
    const rawBookingType = invoice.booking?.booking_type || invoice.booking_snapshot?.booking_type || 'drop_off';
    const destination = invoice.booking?.destination || invoice.booking_snapshot?.destination || 'N/A';
    const boxesCount = invoice.booking?.boxes?.length ?? invoice.line_items_snapshot?.length ?? 0;

    // Booking Type badge config
    const typeConfig = BOOKING_TYPE_CONFIG[rawBookingType] || {
        label: String(rawBookingType).replace(/_/g, ' ').toUpperCase(),
        badgeClass: 'bg-zinc-50 text-zinc-700 border-zinc-200/80',
        icon: 'package',
    };

    // Calculate dynamic subject line preview
    const normalizedType = String(rawBookingType).toLowerCase().replace(/[-_]/g, ' ').trim();
    let subjectPrefix = BOOKING_TYPE_SUBJECT_PREFIXES[rawBookingType];
    if (!subjectPrefix) {
        if (normalizedType === 'drop off' || normalizedType === 'box drop off') {
            subjectPrefix = 'BOX DROP OFF';
        } else if (normalizedType === 'home pickup' || normalizedType === 'home pick up' || normalizedType === 'pickup') {
            subjectPrefix = 'HOME PICK-UP';
        } else {
            subjectPrefix = String(rawBookingType).replace(/_/g, ' ').toUpperCase();
        }
    }

    const lineItems = invoice.line_items_snapshot || [];
    const batchNumbers = Array.from(new Set(lineItems.map((i: any) => i.batch_number).filter(Boolean)));
    const dynamicSubject = batchNumbers.length > 0
        ? `${subjectPrefix}: BATCH ${batchNumbers.join(', ')} SHIPMENT`
        : subjectPrefix;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${invoice.invoice_number} | Admin`} />
            <div className="flex h-full flex-1 flex-col gap-6 p-6 lg:p-8 max-w-7xl mx-auto w-full">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border pb-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/admin/invoices/${invoice.id}`}
                            className="mt-1 rounded-lg p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-xs"
                            title="Return to Invoice"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div>
                            <Heading
                                eyebrow="Billing & Invoicing"
                                title="Edit Invoice"
                                description={`Update billing amounts and payment reconciliation for ${senderName}.`}
                            />
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <span className="rounded-md bg-muted px-3 py-1 font-mono text-xs font-semibold text-foreground border border-border flex items-center gap-1.5">
                                    <RefreshCw className="size-3.5 text-muted-foreground" />
                                    {invoice.invoice_number}
                                </span>

                                {bookingId ? (
                                    <Link
                                        href={`/admin/bookings/${bookingId}`}
                                        className="rounded-md bg-white px-3 py-1 font-mono text-xs font-medium text-zinc-700 hover:text-blue-600 hover:border-blue-200 border border-zinc-200 shadow-2xs flex items-center gap-1.5 transition-colors group"
                                        title="View Linked Booking"
                                    >
                                        <Package className="size-3.5 text-zinc-400 group-hover:text-blue-500" />
                                        <span>{bookingRef}</span>
                                        <ExternalLink className="size-3 text-zinc-400 opacity-60 group-hover:opacity-100" />
                                    </Link>
                                ) : (
                                    <span className="rounded-md bg-zinc-100 px-3 py-1 font-mono text-xs font-medium text-zinc-600 border border-zinc-200 flex items-center gap-1.5">
                                        <Package className="size-3.5 text-zinc-400" />
                                        {bookingRef}
                                    </span>
                                )}

                                <span className={`rounded-md px-3 py-1 text-xs font-medium border flex items-center gap-1.5 ${typeConfig.badgeClass}`}>
                                    {rawBookingType === 'home_pickup' ? (
                                        <Truck className="size-3.5" />
                                    ) : rawBookingType === 'other' ? (
                                        <Sparkles className="size-3.5" />
                                    ) : (
                                        <Package className="size-3.5" />
                                    )}
                                    {typeConfig.label}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href={`/admin/invoices/${invoice.id}`}
                            className="px-3.5 py-2 rounded-lg border border-border bg-white text-xs font-medium text-muted-foreground hover:text-foreground shadow-2xs hover:bg-muted/40 transition-all flex items-center gap-1.5"
                        >
                            <FileText className="size-4 text-muted-foreground" />
                            View Invoice
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Main Form: Billing & Payment Data (8 Cols) */}
                    <div className="lg:col-span-8 card border border-border shadow-xs rounded-xl bg-white overflow-hidden">
                        <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-5 w-1 bg-brand-rust rounded-full"></div>
                                <div>
                                    <h2 className="text-base font-semibold text-foreground">Invoice Financials</h2>
                                    <p className="text-xs text-muted-foreground">Modify rates, payment status, and verification records.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-border shadow-2xs">
                                <ShieldCheck className="size-3.5 text-brand-rust" />
                                <span className="text-[11px] font-medium text-muted-foreground">Financial Edit</span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="amount" className="text-xs font-medium text-foreground">
                                        Amount (AUD) <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center text-muted-foreground text-sm font-medium">
                                            $
                                        </div>
                                        <Input
                                            id="amount"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="h-10 rounded-lg border-input bg-white pl-8 pr-3 text-sm font-medium text-foreground focus:ring-1 focus:ring-ring transition-all"
                                            value={data.amount}
                                            onChange={(e) => setData('amount', e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {errors.amount && (
                                        <p className="text-xs text-red-500">{errors.amount}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="status" className="text-xs font-medium text-foreground">
                                        Payment Status <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                        <select
                                            id="status"
                                            title="Payment Status"
                                            className="flex h-10 w-full rounded-lg border border-input bg-white pl-10 pr-4 text-sm font-medium text-foreground focus:ring-1 focus:ring-ring transition-all cursor-pointer"
                                            value={data.status}
                                            onChange={(e) => setData('status', e.target.value)}
                                        >
                                            <option value="unpaid">Unpaid</option>
                                            <option value="partial">Partial</option>
                                            <option value="paid">Paid</option>
                                        </select>
                                    </div>
                                    {errors.status && (
                                        <p className="text-xs text-red-500">{errors.status}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="or_number" className="text-xs font-medium text-foreground">
                                        Official Receipt Number
                                    </Label>
                                    <div className="relative">
                                        <Receipt className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                        <Input
                                            id="or_number"
                                            type="text"
                                            className="h-10 rounded-lg border-input bg-white pl-10 pr-3 text-sm font-medium text-foreground font-mono focus:ring-1 focus:ring-ring transition-all"
                                            value={data.or_number}
                                            onChange={(e) => setData('or_number', e.target.value)}
                                            placeholder="Optional OR Number"
                                        />
                                    </div>
                                    {errors.or_number && (
                                        <p className="text-xs text-red-500">{errors.or_number}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="due_date" className="text-xs font-medium text-foreground">
                                        Due Date
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="due_date"
                                            type="date"
                                            className="h-10 rounded-lg border-input bg-white px-3 text-sm font-medium text-foreground focus:ring-1 focus:ring-ring transition-all"
                                            value={data.due_date}
                                            onChange={(e) => setData('due_date', e.target.value)}
                                        />
                                    </div>
                                    {errors.due_date && (
                                        <p className="text-xs text-red-500">{errors.due_date}</p>
                                    )}
                                </div>
                            </div>

                            {data.status === 'paid' && (
                                <div className="rounded-lg bg-emerald-50/50 p-5 border border-emerald-200 shadow-2xs relative overflow-hidden transition-all duration-300">
                                    <div className="flex items-center justify-between border-b border-emerald-200/70 pb-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                                                <FileCheck className="size-4" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-emerald-950">
                                                    Payment Verification
                                                </h3>
                                                <p className="text-xs text-emerald-800/80 mt-0.5">
                                                    Marking as Paid will generate a verified record directly in the Payments table.
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-medium bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded border border-emerald-200">
                                            Mandatory
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="payment_method" className="text-xs font-medium text-emerald-950">
                                                Payment Method <span className="text-red-500">*</span>
                                            </Label>
                                            <div className="relative">
                                                <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-700/60" />
                                                <select
                                                    id="payment_method"
                                                    title="Payment Method"
                                                    className="flex h-10 w-full rounded-lg border border-emerald-200 bg-white pl-10 pr-4 text-sm font-medium text-zinc-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer"
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
                                                <p className="text-xs text-red-600">{errors.payment_method}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="reference_number" className="text-xs font-medium text-emerald-950 flex items-center gap-1">
                                                Reference / Transaction No. {['cash', 'cash_on_pickup'].includes(data.payment_method) ? <span className="text-xs text-emerald-700/80 font-normal">(optional for cash)</span> : <span className="text-red-500">*</span>}
                                            </Label>
                                            <div className="relative">
                                                <Receipt className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-700/60" />
                                                <Input
                                                    id="reference_number"
                                                    type="text"
                                                    className="h-10 rounded-lg border-emerald-200 bg-white pl-10 pr-3 text-sm font-medium text-zinc-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                                                    value={data.reference_number}
                                                    onChange={(e) => setData('reference_number', e.target.value)}
                                                    placeholder={['cash', 'cash_on_pickup'].includes(data.payment_method) ? "Optional note or receipt # for cash" : "e.g. TRN-9827346 or Bank Receipt #"}
                                                />
                                            </div>
                                            {errors.reference_number && (
                                                <p className="text-xs text-red-600">{errors.reference_number}</p>
                                            )}
                                        </div>

                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="proof_of_payment" className="text-xs font-medium text-emerald-950">
                                                Proof of Payment (Image or PDF) <span className="text-red-500">*</span>
                                            </Label>
                                            <div className="relative border border-dashed border-emerald-300 rounded-lg p-4 bg-white/90 hover:bg-white transition-all text-center group cursor-pointer">
                                                <Upload className="size-6 text-emerald-500 mx-auto mb-1.5 group-hover:text-emerald-700 transition-colors" />
                                                <div className="text-xs font-medium text-zinc-900 mb-0.5">
                                                    {data.proof_of_payment ? data.proof_of_payment.name : 'Click to select or drag proof of payment document'}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground">Supports JPG, PNG, or PDF (Max 5MB)</p>
                                                <input
                                                    id="proof_of_payment"
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    onChange={(e) => setData('proof_of_payment', e.target.files ? e.target.files[0] : null)}
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                    title="Upload proof of payment"
                                                />
                                                {data.proof_of_payment && (
                                                    <div className="mt-2.5 flex items-center justify-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 py-1 px-2.5 rounded border border-emerald-200 w-fit mx-auto">
                                                        <FileText className="size-3.5 shrink-0" />
                                                        <span className="truncate max-w-xs">{data.proof_of_payment.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setData('proof_of_payment', null);
                                                            }}
                                                            className="ml-1.5 text-emerald-600 hover:text-red-600 transition-colors"
                                                            title="Remove file"
                                                        >
                                                            <X className="size-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {errors.proof_of_payment && (
                                                <p className="text-xs text-red-600">{errors.proof_of_payment}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                                <Link
                                    href={`/admin/invoices/${invoice.id}`}
                                    className="px-4 h-10 flex items-center justify-center rounded-lg border border-input text-xs font-medium hover:bg-muted transition-all active:scale-95 text-muted-foreground hover:text-foreground"
                                >
                                    Cancel
                                </Link>
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    variant="success"
                                    className="px-6 h-10 rounded-lg text-xs font-medium shadow-xs flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Save className="size-4" />
                                    {processing ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Sidebar: Context & Booking / Subject Info (4 Cols) */}
                    <div className="lg:col-span-4 space-y-5">
                        {/* Dynamic Subject Preview Card */}
                        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 shadow-2xs relative overflow-hidden">
                            <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-medium text-blue-900 flex items-center gap-1.5">
                                    <Sparkles className="size-3.5 text-blue-600" />
                                    Invoice Subject
                                </span>
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${typeConfig.badgeClass}`}>
                                    {typeConfig.label}
                                </span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-blue-200/80 shadow-2xs">
                                <p className="font-mono text-xs font-semibold text-blue-950 break-words">
                                    {dynamicSubject}
                                </p>
                            </div>
                            <p className="text-[11px] text-blue-800/80 leading-relaxed mt-2 flex items-start gap-1.5">
                                <Info className="size-3.5 shrink-0 text-blue-600 mt-0.5" />
                                <span>Subject updates dynamically based on the booking type & assigned container batches.</span>
                            </p>
                        </div>

                        {/* Booking Details Card */}
                        <div className="rounded-xl border border-border bg-white p-4 shadow-2xs space-y-3.5">
                            <div className="flex items-center justify-between border-b border-border pb-3">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Package className="size-4 text-muted-foreground" />
                                    Linked Booking
                                </h3>
                                {bookingId && (
                                    <Link
                                        href={`/admin/bookings/${bookingId}/edit`}
                                        className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                                    >
                                        Edit Booking <ExternalLink className="size-3" />
                                    </Link>
                                )}
                            </div>

                            <div className="space-y-2.5 text-xs">
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-muted-foreground font-normal flex items-center gap-1.5">
                                        <User className="size-3.5 text-zinc-400" /> Sender:
                                    </span>
                                    <span className="font-medium text-foreground text-right">{senderName}</span>
                                </div>

                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-muted-foreground font-normal flex items-center gap-1.5">
                                        <Package className="size-3.5 text-zinc-400" /> Reference:
                                    </span>
                                    <span className="font-mono font-medium text-foreground">{bookingRef}</span>
                                </div>

                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-muted-foreground font-normal flex items-center gap-1.5">
                                        <Truck className="size-3.5 text-zinc-400" /> Collection Type:
                                    </span>
                                    <span className={`px-2 py-0.5 rounded font-medium text-[11px] border ${typeConfig.badgeClass}`}>
                                        {typeConfig.label}
                                    </span>
                                </div>

                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-muted-foreground font-normal flex items-center gap-1.5">
                                        <MapPin className="size-3.5 text-zinc-400" /> Destination:
                                    </span>
                                    <span className="font-medium text-foreground text-right">{destination}</span>
                                </div>

                                {boxesCount > 0 && (
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-muted-foreground font-normal flex items-center gap-1.5">
                                            <Package className="size-3.5 text-zinc-400" /> Total Items:
                                        </span>
                                        <span className="font-medium text-foreground">{boxesCount} {boxesCount === 1 ? 'Box/Item' : 'Boxes/Items'}</span>
                                    </div>
                                )}
                            </div>

                            {bookingId && (
                                <div className="pt-3 border-t border-border">
                                    <Link
                                        href={`/admin/bookings/${bookingId}/edit`}
                                        className="w-full py-1.5 px-3 rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-xs font-medium text-foreground transition-all flex items-center justify-center gap-1.5"
                                    >
                                        Change Collection / Cargo
                                        <ExternalLink className="size-3 text-muted-foreground" />
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}


