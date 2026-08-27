import { Head, Link, useForm } from '@inertiajs/react';
import {
    Save,
    ArrowLeft,
    Package,
    User,
    MapPin,
    ShieldCheck,
    Info,
    FileCheck,
    CreditCard,
    Receipt,
    Upload,
    FileText,
    X,
    Truck,
    Sparkles,
    ClipboardList,
    AlertTriangle,
    Printer,
    ExternalLink,
    Banknote,
    CheckCircle2,
} from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Sender {
    id: number;
    first_name: string;
    last_name: string;
}

interface Booking {
    id: number;
    sender_id: number;
    pickup_zone_id?: number | null;
    status: string;
    booking_type?: string | null;
    recipient_name: string;
    destination: string;
    preferred_date: string | null;
    payment_status: string;
    payment_method: string | null;
    declaration_form_status: string;
    declaration_form_path?: string | null;
    notes: string;
    admin_notes: string;
    reference_number: string;
    payment_reference?: string | null;
    proof_of_payment?: string | null;
}

const BOOKING_TYPE_CONFIG: Record<string, { label: string; badgeClass: string }> = {
    drop_off: {
        label: 'Drop-Off',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
    },
    home_pickup: {
        label: 'Home Pick-Up',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    },
    other: {
        label: 'Other',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
    },
};

const DECLARATION_STATUS_CONFIG: Record<
    string,
    {
        label: string;
        badgeClass: string;
        icon: React.ComponentType<{ className?: string }>;
        panelBg: string;
        panelBorder: string;
        panelTitle: string;
        panelDescription: string;
        panelTitleColor: string;
        panelDescColor: string;
    }
> = {
    missing: {
        label: 'Missing / Awaiting',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: AlertTriangle,
        panelBg: 'bg-amber-50/80',
        panelBorder: 'border-amber-200',
        panelTitle: 'Declaration Form Required',
        panelDescription:
            'The sender has not submitted a digital customs declaration yet. A completed customs declaration is mandatory for customs clearance and container loading in the Philippines.',
        panelTitleColor: 'text-amber-900',
        panelDescColor: 'text-amber-800/90',
    },
    submitted_online: {
        label: 'Submitted Online',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        icon: FileCheck,
        panelBg: 'bg-indigo-50/80',
        panelBorder: 'border-indigo-200',
        panelTitle: 'Digital Declaration Available',
        panelDescription:
            'The sender completed and submitted their customs declaration online. You can view, review, and print the generated digital declaration document below.',
        panelTitleColor: 'text-indigo-950',
        panelDescColor: 'text-indigo-800/90',
    },
    physical_copy_received: {
        label: 'Physical Copy Received',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: CheckCircle2,
        panelBg: 'bg-emerald-50/80',
        panelBorder: 'border-emerald-200',
        panelTitle: 'Physical Copy Verified',
        panelDescription:
            'A physical paper copy of the customs declaration has been received and verified by warehouse or collection staff.',
        panelTitleColor: 'text-emerald-950',
        panelDescColor: 'text-emerald-800/90',
    },
};

export default function BookingsEdit({
    booking,
    senders,
    pickupZones = [],
}: {
    booking: Booking;
    senders: Sender[];
    pickupZones?: any[];
}) {
    // Format date properly for the input type="date"
    let formattedDate = '';

    if (booking.preferred_date) {
        try {
            formattedDate = new Date(booking.preferred_date)
                .toISOString()
                .split('T')[0];
        } catch {
            formattedDate = booking.preferred_date.split('T')[0];
        }
    }

    const { data, setData, post, processing, errors } = useForm({
        _method: 'put',
        sender_id: booking.sender_id.toString(),
        pickup_zone_id: booking.pickup_zone_id ? booking.pickup_zone_id.toString() : '',
        status: booking.status,
        booking_type: booking.booking_type || 'drop_off',
        recipient_name: booking.recipient_name || '',
        destination: booking.destination || '',
        preferred_date: formattedDate,
        payment_status: booking.payment_status,
        payment_method: booking.payment_method || 'bank_transfer',
        payment_reference: booking.payment_reference || '',
        proof_of_payment: null as File | null,
        declaration_form_status: booking.declaration_form_status || 'missing',
        declaration_form: null as File | null,
        notes: booking.notes || '',
        admin_notes: booking.admin_notes || '',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Bookings', href: '/admin/bookings' },
        { title: booking.reference_number, href: `/admin/bookings/${booking.id}` },
        { title: 'Edit', href: '#' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/admin/bookings/${booking.id}`, {
            forceFormData: true,
        });
    };

    const currentBookingType = data.booking_type || 'drop_off';
    const typeConfig = BOOKING_TYPE_CONFIG[currentBookingType] || {
        label: String(currentBookingType).replace(/_/g, ' ').toUpperCase(),
        badgeClass: 'bg-zinc-50 text-zinc-700 border-zinc-200/80',
    };

    const currentDeclarationConfig =
        DECLARATION_STATUS_CONFIG[data.declaration_form_status] ||
        DECLARATION_STATUS_CONFIG.missing;
    const DeclarationStatusIcon = currentDeclarationConfig.icon;

    const isCashPayment = ['cash', 'cash_on_pickup'].includes(data.payment_method || '');
    const isPaid = data.payment_status === 'paid';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit Booking ${booking.reference_number} | Admin`} />
            <div className="flex h-full flex-1 flex-col gap-6 p-6 lg:p-8 max-w-5xl mx-auto w-full">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border pb-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/admin/bookings/${booking.id}`}
                            className="mt-1 rounded-lg p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-xs"
                            title="Return to Booking"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div>
                            <Heading
                                eyebrow="Admin Booking"
                                title="Edit Booking"
                                description="Update booking details, collection type, payment verification, and customs declaration."
                            />
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <span className="rounded-md bg-muted px-3 py-1 font-mono text-xs font-semibold text-foreground border border-border flex items-center gap-1.5">
                                    <Package className="size-3.5 text-muted-foreground" />
                                    {booking.reference_number}
                                </span>
                                <span className={`rounded-md px-3 py-1 text-xs font-medium border flex items-center gap-1.5 ${typeConfig.badgeClass}`}>
                                    {currentBookingType === 'home_pickup' ? (
                                        <Truck className="size-3.5" />
                                    ) : currentBookingType === 'other' ? (
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
                            href={`/admin/bookings/${booking.id}`}
                            className="px-3.5 py-2 rounded-lg border border-border bg-white text-xs font-medium text-muted-foreground hover:text-foreground shadow-2xs hover:bg-muted/40 transition-all flex items-center gap-1.5"
                        >
                            <FileText className="size-4 text-muted-foreground" />
                            View Booking
                        </Link>
                    </div>
                </div>

                <div className="card border border-border shadow-xs rounded-xl bg-white overflow-hidden">
                    <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-5 w-1 bg-brand-rust rounded-full"></div>
                            <h2 className="text-base font-semibold text-foreground">Booking Details</h2>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-border shadow-2xs">
                            <ShieldCheck className="size-3.5 text-brand-rust" />
                            <span className="text-[11px] font-medium text-muted-foreground">Admin Edit</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                        {/* General Details 2-Column Grid */}
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            {/* Sender */}
                            <div className="space-y-2">
                                <Label htmlFor="sender_id" className="text-xs font-medium text-foreground">
                                    Sender <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                    <select
                                        id="sender_id"
                                        aria-label="Sender"
                                        disabled
                                        className="flex h-10 w-full items-center rounded-lg border border-input bg-muted/50 pl-10 pr-4 text-sm font-medium text-muted-foreground focus:ring-1 focus:ring-ring transition-all cursor-not-allowed opacity-70"
                                        value={data.sender_id}
                                        onChange={(e) => setData('sender_id', e.target.value)}
                                    >
                                        <option value="">Select a sender</option>
                                        {senders.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.first_name} {c.last_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {errors.sender_id && (
                                    <p className="text-xs text-red-500">
                                        {errors.sender_id}
                                    </p>
                                )}
                            </div>

                            {/* Booking Status */}
                            <div className="space-y-2">
                                <Label htmlFor="status" className="text-xs font-medium text-foreground">
                                    Booking Status <span className="text-red-500">*</span>
                                </Label>
                                <select
                                    id="status"
                                    aria-label="Status"
                                    className="flex h-10 w-full items-center rounded-lg border border-input bg-white px-3 text-sm font-medium text-foreground focus:ring-1 focus:ring-ring transition-all cursor-pointer"
                                    value={data.status}
                                    onChange={(e) => setData('status', e.target.value)}
                                >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="collected">Collected</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                                {errors.status && (
                                    <p className="text-xs text-red-500">
                                        {errors.status}
                                    </p>
                                )}
                            </div>

                            {/* Booking Type */}
                            <div className="space-y-2">
                                <Label htmlFor="booking_type" className="text-xs font-medium text-foreground">
                                    Booking Type (Collection Method) <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Truck className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                    <select
                                        id="booking_type"
                                        aria-label="Booking Type"
                                        className="flex h-10 w-full items-center rounded-lg border border-input bg-white pl-10 pr-4 text-sm font-medium text-foreground focus:ring-1 focus:ring-ring transition-all cursor-pointer"
                                        value={data.booking_type}
                                        onChange={(e) => setData('booking_type', e.target.value)}
                                    >
                                        <option value="drop_off">Drop-Off (Box Drop Off)</option>
                                        <option value="home_pickup">Home Pick-Up</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                {errors.booking_type && (
                                    <p className="text-xs text-red-500">
                                        {errors.booking_type}
                                    </p>
                                )}
                            </div>

                            {/* Pickup Area */}
                            <div className="space-y-2">
                                <Label htmlFor="pickup_zone_id" className="text-xs font-medium text-foreground">
                                    Pickup Area
                                </Label>
                                <select
                                    id="pickup_zone_id"
                                    aria-label="Pickup Area"
                                    className="flex h-10 w-full items-center rounded-lg border border-input bg-white px-3 text-sm font-medium text-foreground focus:ring-1 focus:ring-ring transition-all cursor-pointer"
                                    value={data.pickup_zone_id}
                                    onChange={(e) => setData('pickup_zone_id', e.target.value)}
                                >
                                    <option value="">Select Pickup Area</option>
                                    {pickupZones.map((z: any) => (
                                        <option key={z.id} value={z.id.toString()}>
                                            {z.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.pickup_zone_id && (
                                    <p className="text-xs text-red-500">
                                        {errors.pickup_zone_id}
                                    </p>
                                )}
                            </div>

                            {/* Payment Status */}
                            <div className="space-y-2">
                                <Label htmlFor="payment_status" className="text-xs font-medium text-foreground">
                                    Payment Status <span className="text-red-500">*</span>
                                </Label>
                                <select
                                    id="payment_status"
                                    aria-label="Payment Status"
                                    className="flex h-10 w-full items-center rounded-lg border border-input bg-white px-3 text-sm font-medium text-foreground focus:ring-1 focus:ring-ring transition-all cursor-pointer"
                                    value={data.payment_status}
                                    onChange={(e) => setData('payment_status', e.target.value)}
                                >
                                    <option value="pending">Pending</option>
                                    <option value="balance_pending">Balance Pending</option>
                                    <option value="partially_paid">Partially Paid</option>
                                    <option value="paid">Paid</option>
                                    <option value="cash_on_pickup">Payment on Pickup</option>
                                </select>
                                {errors.payment_status && (
                                    <p className="text-xs text-red-500">
                                        {errors.payment_status}
                                    </p>
                                )}
                            </div>

                            {/* Recipient */}
                            <div className="space-y-2">
                                <Label htmlFor="recipient_name" className="text-xs font-medium text-foreground">
                                    Recipient Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="recipient_name"
                                    className="h-10 rounded-lg border-input bg-white font-medium px-3 text-sm focus:ring-1 focus:ring-ring transition-all"
                                    value={data.recipient_name}
                                    onChange={(e) => setData('recipient_name', e.target.value)}
                                    placeholder="Full recipient name"
                                />
                                {errors.recipient_name && (
                                    <p className="text-xs text-red-500">
                                        {errors.recipient_name}
                                    </p>
                                )}
                            </div>

                            {/* Destination */}
                            <div className="space-y-2">
                                <Label htmlFor="destination" className="text-xs font-medium text-foreground">
                                    Destination
                                </Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                                    <Input
                                        id="destination"
                                        className="h-10 rounded-lg border-input bg-white pl-10 pr-3 font-medium text-sm focus:ring-1 focus:ring-ring transition-all"
                                        value={data.destination}
                                        onChange={(e) => setData('destination', e.target.value)}
                                        placeholder="e.g. Manila, Philippines"
                                    />
                                </div>
                                {errors.destination && (
                                    <p className="text-xs text-red-500">
                                        {errors.destination}
                                    </p>
                                )}
                            </div>

                            {/* Preferred Date */}
                            <div className="space-y-2">
                                <Label htmlFor="preferred_date" className="text-xs font-medium text-foreground">
                                    Preferred Pickup Date
                                </Label>
                                <Input
                                    id="preferred_date"
                                    type="date"
                                    className="h-10 rounded-lg border-input bg-white px-3 font-medium text-sm focus:ring-1 focus:ring-ring transition-all"
                                    value={data.preferred_date}
                                    onChange={(e) => setData('preferred_date', e.target.value)}
                                />
                                {errors.preferred_date && (
                                    <p className="text-xs text-red-500">
                                        {errors.preferred_date}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Dedicated Card 1: Payment Verification (Positioned above Customs Declaration) */}
                        <div className="rounded-xl p-6 border shadow-2xs relative overflow-hidden transition-all duration-300 space-y-5 bg-emerald-50/40 border-emerald-200/80">
                            <div className="flex items-center justify-between border-b pb-4 border-emerald-200/70">
                                <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-md text-white flex items-center justify-center shadow-2xs shrink-0 bg-emerald-600">
                                        <FileCheck className="size-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-emerald-950">
                                            Payment Details & Verification
                                        </h3>
                                        <p className="text-xs mt-0.5 text-emerald-800/80">
                                            Provide payment details and upload proof of payment. Marking as Paid will verify payment.
                                        </p>
                                    </div>
                                </div>
                                {isPaid && (
                                    <span className="text-[11px] font-medium bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded border border-emerald-200">
                                        Mandatory
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                {/* Payment Method */}
                                <div className="space-y-2">
                                    <Label htmlFor="payment_method_verify" className="text-xs font-medium text-emerald-950">
                                        Payment Method {isPaid && <span className="text-red-500">*</span>}
                                    </Label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-700/60" />
                                        <select
                                            id="payment_method_verify"
                                            title="Payment Method Verification"
                                            className="flex h-10 w-full rounded-lg border bg-white pl-10 pr-4 text-sm font-medium text-zinc-900 focus:ring-1 transition-all cursor-pointer border-emerald-200 focus:ring-emerald-500 focus:border-emerald-500"
                                            value={data.payment_method}
                                            onChange={(e) => setData('payment_method', e.target.value)}
                                        >
                                            <option value="bank_transfer">Bank Transfer</option>
                                            <option value="cash">Cash</option>
                                            <option value="pay_id">Pay ID</option>
                                            <option value="stripe">Stripe</option>
                                            <option value="afterpay">Afterpay (+6.3%)</option>
                                            <option value="square">Square</option>
                                            <option value="cash_on_pickup">Cash on Pickup</option>
                                            <option value="cheque">Cheque</option>
                                        </select>
                                    </div>
                                    {errors.payment_method && (
                                        <p className="text-xs text-red-600">{errors.payment_method}</p>
                                    )}
                                </div>

                                {/* Reference / Transaction Number */}
                                <div className="space-y-2">
                                    <Label htmlFor="payment_reference" className="text-xs font-medium flex items-center gap-1 text-emerald-950">
                                        Reference / Transaction No. {isPaid && !isCashPayment ? <span className="text-red-500">*</span> : <span className="text-xs font-normal text-emerald-700/80">(optional)</span>}
                                    </Label>
                                    <div className="relative">
                                        <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-700/60" />
                                        <Input
                                            id="payment_reference"
                                            type="text"
                                            className="h-10 rounded-lg bg-white pl-10 pr-3 text-sm font-medium text-zinc-900 focus:ring-1 transition-all font-mono border-emerald-200 focus:ring-emerald-500 focus:border-emerald-500"
                                            value={data.payment_reference}
                                            onChange={(e) => setData('payment_reference', e.target.value)}
                                            placeholder={isCashPayment ? "Optional note or receipt # for cash" : "e.g. TRN-9827346 or Bank Receipt #"}
                                        />
                                    </div>
                                    {errors.payment_reference && (
                                        <p className="text-xs text-red-600">{errors.payment_reference}</p>
                                    )}
                                </div>

                                {/* Proof of Payment Dropzone */}
                                <div className="space-y-2 md:col-span-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="proof_of_payment" className="text-xs font-medium text-emerald-950">
                                            Proof of Payment (Image or PDF){' '}
                                            {booking.proof_of_payment ? (
                                                <span className="text-xs font-normal text-emerald-700/80">(file on file — upload to replace)</span>
                                            ) : isCashPayment ? (
                                                <span className="text-xs font-normal text-emerald-700/80">(optional for cash)</span>
                                            ) : isPaid ? (
                                                <span className="text-red-500">*</span>
                                            ) : (
                                                <span className="text-xs text-emerald-700/80 font-normal">(optional)</span>
                                            )}
                                        </Label>
                                        {booking.proof_of_payment && (
                                            <a
                                                href={`/storage/${booking.proof_of_payment}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline text-emerald-700 hover:text-emerald-900"
                                            >
                                                <ExternalLink className="size-3" />
                                                View Current Proof
                                            </a>
                                        )}
                                    </div>
                                    <div className="relative border border-dashed rounded-lg p-4 bg-white/90 hover:bg-white transition-all text-center group cursor-pointer border-emerald-300">
                                        <Upload className="size-6 mx-auto mb-1.5 transition-colors text-emerald-500 group-hover:text-emerald-700" />
                                        <div className="text-xs font-medium text-zinc-900 mb-0.5">
                                            {data.proof_of_payment
                                                ? data.proof_of_payment.name
                                                : booking.proof_of_payment
                                                ? 'An existing proof is attached. Click to upload replacement.'
                                                : 'Click to select or drag proof of payment document'}
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
                                            <div className="mt-2.5 flex items-center justify-center gap-2 text-xs font-medium py-1 px-2.5 rounded border w-fit mx-auto text-emerald-800 bg-emerald-50 border-emerald-200">
                                                <FileText className="size-3.5 shrink-0" />
                                                <span className="truncate max-w-xs">{data.proof_of_payment.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setData('proof_of_payment', null);
                                                    }}
                                                    className="ml-1.5 transition-colors text-emerald-600 hover:text-red-600"
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

                        {/* Dedicated Card 2: Customs Declaration (Dedicated Blue Card) */}
                        <div className="rounded-xl bg-blue-50/40 p-6 border border-blue-200/80 shadow-2xs relative overflow-hidden transition-all duration-300 space-y-5">
                            {/* Header with Dynamic Badge */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-blue-200/70 gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                                        <ClipboardList className="size-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-blue-950">
                                            Customs Declaration
                                        </h3>
                                        <p className="text-xs text-blue-800/80 mt-0.5">
                                            Track, print, and upload the sender's customs declaration documentation.
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded border flex items-center gap-1.5 w-fit ${currentDeclarationConfig.badgeClass}`}>
                                    <DeclarationStatusIcon className="size-3" />
                                    {currentDeclarationConfig.label}
                                </span>
                            </div>

                            {/* Status Selector */}
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 items-start">
                                <div className="space-y-2">
                                    <Label htmlFor="declaration_form_status" className="text-xs font-medium text-blue-950">
                                        Declaration Form Status <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="declaration_form_status"
                                        aria-label="Declaration Form Status"
                                        className="flex h-10 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm font-medium text-zinc-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer"
                                        value={data.declaration_form_status}
                                        onChange={(e) => setData('declaration_form_status', e.target.value)}
                                    >
                                        <option value="missing">Missing / Awaiting</option>
                                        <option value="submitted_online">Submitted Online</option>
                                        <option value="physical_copy_received">Physical Copy Received</option>
                                    </select>
                                    {errors.declaration_form_status && (
                                        <p className="text-xs text-red-500">{errors.declaration_form_status}</p>
                                    )}
                                </div>

                                {/* Quick Action Buttons */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-blue-950">
                                        Declaration Actions
                                    </Label>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <a
                                            href={`/admin/bookings/${booking.id}/declaration`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 bg-white text-xs font-medium text-blue-900 hover:bg-blue-50 shadow-2xs transition-all"
                                        >
                                            <Printer className="size-3.5 text-blue-700" />
                                            View / Print Digital Form
                                        </a>

                                        {booking.declaration_form_path && (
                                            <a
                                                href={`/admin/bookings/${booking.id}/declaration-file`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-300 bg-white text-xs font-medium text-blue-900 hover:bg-blue-50 shadow-2xs transition-all"
                                            >
                                                <ExternalLink className="size-3.5 text-blue-700" />
                                                View Attached File
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Informational Status Panel */}
                            <div className={`p-4 rounded-lg border flex items-start gap-3 transition-all duration-200 ${currentDeclarationConfig.panelBg} ${currentDeclarationConfig.panelBorder}`}>
                                <DeclarationStatusIcon className={`size-5 mt-0.5 shrink-0 ${currentDeclarationConfig.panelTitleColor}`} />
                                <div className="space-y-1">
                                    <h4 className={`text-xs font-semibold ${currentDeclarationConfig.panelTitleColor}`}>
                                        {currentDeclarationConfig.panelTitle}
                                    </h4>
                                    <p className={`text-xs leading-relaxed ${currentDeclarationConfig.panelDescColor}`}>
                                        {currentDeclarationConfig.panelDescription}
                                    </p>
                                </div>
                            </div>

                            {/* Upload Area for Scanned Declaration Documents */}
                            <div className="space-y-2 pt-2 border-t border-blue-200/50">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="declaration_form" className="text-xs font-medium text-blue-950">
                                        Upload Scanned Document{' '}
                                        {booking.declaration_form_path ? (
                                            <span className="text-xs text-blue-800/80 font-normal">(file on file — upload to replace)</span>
                                        ) : (
                                            <span className="text-xs text-blue-800/80 font-normal">(optional — upload on sender's behalf)</span>
                                        )}
                                    </Label>
                                    {booking.declaration_form_path && (
                                        <a
                                            href={`/admin/bookings/${booking.id}/declaration-file`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:text-blue-900 hover:underline"
                                        >
                                            <ExternalLink className="size-3" />
                                            View Scanned File
                                        </a>
                                    )}
                                </div>
                                <div className="relative border border-dashed border-blue-300 rounded-lg p-4 bg-white/90 hover:bg-white transition-all text-center group cursor-pointer">
                                    <Upload className="size-6 text-blue-500 mx-auto mb-1.5 group-hover:text-blue-700 transition-colors" />
                                    <div className="text-xs font-medium text-zinc-900 mb-0.5">
                                        {data.declaration_form
                                            ? data.declaration_form.name
                                            : booking.declaration_form_path
                                            ? 'An existing form is attached. Click to upload replacement.'
                                            : 'Click to select or drag declaration form document'}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">Supports JPG, PNG, or PDF (Max 10MB)</p>
                                    <input
                                        id="declaration_form"
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => setData('declaration_form', e.target.files ? e.target.files[0] : null)}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        title="Upload declaration form"
                                    />
                                    {data.declaration_form && (
                                        <div className="mt-2.5 flex items-center justify-center gap-2 text-xs font-medium text-blue-800 bg-blue-50 py-1 px-2.5 rounded border border-blue-200 w-fit mx-auto">
                                            <FileText className="size-3.5 shrink-0" />
                                            <span className="truncate max-w-xs">{data.declaration_form.name}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setData('declaration_form', null);
                                                }}
                                                className="ml-1.5 text-blue-600 hover:text-red-600 transition-colors"
                                                title="Remove file"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {errors.declaration_form && (
                                    <p className="text-xs text-red-600">{errors.declaration_form}</p>
                                )}
                            </div>
                        </div>

                        {/* Additional Notes */}
                        <div className="p-5 bg-muted/20 rounded-xl border border-border space-y-4">
                            <div className="flex items-center gap-2">
                                <Info className="size-4 text-muted-foreground" />
                                <h3 className="text-xs font-semibold text-foreground">Additional Notes</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Notes */}
                                <div className="space-y-2">
                                    <Label htmlFor="notes" className="text-xs font-medium text-foreground">
                                        Notes for Courier
                                    </Label>
                                    <textarea
                                        id="notes"
                                        className="min-h-24 w-full rounded-lg border border-input bg-white p-3 text-xs font-normal text-foreground focus:ring-1 focus:ring-ring transition-all"
                                        value={data.notes}
                                        onChange={(e) => setData('notes', e.target.value)}
                                        placeholder="Pickup instructions for the courier..."
                                    />
                                </div>

                                {/* Admin Notes */}
                                <div className="space-y-2">
                                    <Label htmlFor="admin_notes" className="text-xs font-medium text-foreground">
                                        Internal Notes
                                    </Label>
                                    <textarea
                                        id="admin_notes"
                                        className="min-h-24 w-full rounded-lg border border-input bg-white p-3 text-xs font-normal text-foreground focus:ring-1 focus:ring-ring transition-all"
                                        value={data.admin_notes}
                                        onChange={(e) => setData('admin_notes', e.target.value)}
                                        placeholder="Internal notes only (not visible to sender)..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Form Submission Actions */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                            <Link
                                href={`/admin/bookings/${booking.id}`}
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
            </div>
        </AppLayout>
    );
}
