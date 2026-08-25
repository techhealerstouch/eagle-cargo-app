import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Printer, Pencil, MapPin, Calendar, CreditCard, Package, Mail, Phone, Clock, Share2, FileText, CheckCircle2, AlertCircle, Info, Eye, CheckCircle, Loader2, Download, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface Recipient {
    id: number;
    name: string;
    address: string;
    city: string;
    province: string;
    zip_code: string;
    phone_number?: string;
    phone?: string;
    email?: string;
}

interface BoxType {
    id: number;
    name: string;
    dimensions: string | null;
}

interface BoxItem {
    id: number;
    tracking_number: string;
    status: string;
    courier_notes: string | null;
    weight: number | null;
    price_charged?: number | null;
    price_is_estimate?: boolean;
    is_custom_size?: boolean;
    custom_length?: number | null;
    custom_width?: number | null;
    custom_height?: number | null;
    recipient: Recipient | null;
    box_type: BoxType | null;
    destination: string;
    declaration_form_path?: string | null;
}

interface Booking {
    id: number;
    reference_number: string;
    status: string;
    recipient_name?: string;
    recipient_phone?: string;
    delivery_address?: string;
    delivery_notes?: string;
    destination: string;
    preferred_date: string | null;
    payment_status: string;
    payment_method: string | null;
    payment_reference?: string | null;
    notes: string | null;
    estimated_delivery?: string | null;
    shipping_method?: string;
    service_type?: string;
    booking_type?: string;
    declaration_form_status: string;
    declaration_form_path?: string | null;
    declaration_data?: any;
    created_at: string;
    updated_at: string;
    sender: {
        first_name: string;
        last_name: string;
        email?: string;
        phone?: string;
        mobile?: string;
        address?: string;
        suburb?: string;
        state?: string;
        postcode?: string;
    };
    boxes: BoxItem[];
    proof_of_payment?: string | null;
    invoice?: {
        id: number;
        invoice_number: string;
        amount: string | number;
        surcharge_amount?: number | null;
        status: string;
    } | null;
    is_manual?: boolean;
}

const BOX_STATUS_CONFIG: Record<string, { label: string, color: string, progress: number, subLabel: string }> = {
    'pending': { label: 'Pending', color: 'text-amber-500', progress: 10, subLabel: 'Awaiting Collection' },
    'collected': { label: 'Collected', color: 'text-blue-500', progress: 25, subLabel: 'In Warehouse/Sorting' },
    'received_by_branch': { label: 'Received', color: 'text-indigo-500', progress: 40, subLabel: 'At Warehouse' },
    'in_transit': { label: 'In Transit', color: 'text-sky-500', progress: 65, subLabel: 'On the way' },
    'arrived': { label: 'Arrived', color: 'text-emerald-500', progress: 90, subLabel: 'At Destination Country' },
    'out_for_delivery': { label: 'Out for Delivery', color: 'text-orange-500', progress: 95, subLabel: 'On the way to you' },
    'delivered': { label: 'Delivered', color: 'text-emerald-600', progress: 100, subLabel: 'Successfully Delivered' },
    'cancelled': { label: 'Cancelled', color: 'text-rose-500', progress: 0, subLabel: 'Booking Cancelled' },
};

const BOX_PROGRESS_WIDTH_CLASS: Record<number, string> = {
    0: 'w-0',
    10: 'w-[10%]',
    25: 'w-1/4',
    40: 'w-2/5',
    65: 'w-[65%]',
    90: 'w-[90%]',
    95: 'w-[95%]',
    100: 'w-full',
};

export default function BookingShow({ booking }: { booking: Booking }) {

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Bookings', href: '/admin/bookings' },
        { title: booking.reference_number, href: `/admin/bookings/${booking.id}` },
    ];

    const hasBoxes = booking.boxes && booking.boxes.length > 0;
    const isPending = booking.status === 'pending';
    const hasDeclaration = booking.declaration_form_status !== 'missing';
    const isQualifiedForAcceptance = isPending;

    const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
    const { post, processing, data, setData } = useForm({
        admin_notes: booking.notes || '',
    });

    const handleAccept = () => {
        post(`/admin/bookings/${booking.id}/accept`, {
            onSuccess: () => {
                setIsAcceptModalOpen(false);
            },
            onError: () => {
                toast.error('Failed to accept booking');
            }
        });
    };


    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Booking ${booking.reference_number} | Admin`} />

            <div className="flex min-h-screen w-full flex-col gap-8 p-6 lg:p-10 max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/bookings"
                            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-serif font-bold text-brand-rust">Booking Details</h1>
                                <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    booking.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                    booking.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                    'bg-muted text-muted-foreground border border-border'
                                }`}>
                                    {booking.status === 'confirmed' ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                                    {humanize(booking.status)}
                                </div>
                                <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    booking.booking_type === 'home_pickup'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : booking.booking_type === 'other'
                                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                            : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                                }`}>
                                    {booking.booking_type === 'home_pickup' ? 'Home Pick-Up' : booking.booking_type === 'other' ? 'Other' : 'Drop-Off'}
                                </div>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-sm">
                                <span className="font-mono font-bold text-brand-rust tracking-tight uppercase">
                                    {booking.reference_number}
                                </span>
                                <span className="text-muted-foreground/30">•</span>
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                    Updated {new Date(booking.updated_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => toast.info('Share functionality coming soon')}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                        >
                            <Share2 className="size-4" />
                            Share
                        </button>
                        <Link
                            href={`/admin/bookings/${booking.id}/edit`}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-brand-rust rounded-lg hover:opacity-90 transition-all shadow-sm"
                        >
                            <Pencil className="size-3.5" />
                            Edit Booking
                        </Link>
                        {isQualifiedForAcceptance && (
                            <Button
                                onClick={() => setIsAcceptModalOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all shadow-sm h-auto"
                            >
                                <CheckCircle className="size-3.5" />
                                Accept
                            </Button>
                        )}
                    </div>
                </div>

                {/* Manual Booking Banner */}
                {booking.is_manual && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-amber-800 uppercase tracking-widest">Admin Inputted</h4>
                            <p className="text-xs text-amber-700 mt-1">This booking was manually created by an administrator.</p>
                        </div>
                    </div>
                )}

                {/* Quick Info Bar */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-brand-rust/5 flex items-center justify-center text-brand-rust">
                            <Package className="size-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Boxes</p>
                            <p className="font-bold text-brand-rust">{hasBoxes ? `${booking.boxes.length} Unit(s)` : 'None'}</p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                        <div className={`size-9 rounded-lg flex items-center justify-center ${
                            booking.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-rust/5 text-brand-rust'
                        }`}>
                            <CreditCard className="size-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Payment</p>
                            <p className="font-bold text-brand-rust uppercase flex items-center gap-2">
                                {humanize(booking.payment_status)}
                                {booking.payment_status !== 'paid' && <AlertCircle className="size-3 text-brand-secondary" />}
                            </p>
                            {booking.payment_method && (
                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
                                    Via {humanize(booking.payment_method)}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-brand-rust/5 flex items-center justify-center text-brand-rust">
                            <MapPin className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Destination</p>
                            <p className="font-bold text-brand-rust truncate uppercase text-sm">{booking.destination}</p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-brand-rust/5 flex items-center justify-center text-brand-rust">
                            <Calendar className="size-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Date</p>
                            <p className="font-bold text-brand-rust uppercase text-sm">
                                {booking.preferred_date ? new Date(booking.preferred_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Pending'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Booking Sidebar */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-border bg-muted/20">
                                <h3 className="text-sm font-bold text-foreground">Sender & Recipient</h3>
                            </div>

                            <div className="divide-y divide-border">
                                {/* Sender Details */}
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="size-1.5 rounded-full bg-brand-rust"></div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shipper</p>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-lg font-serif font-bold text-brand-rust leading-tight uppercase">{booking.sender.first_name} {booking.sender.last_name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                <Mail className="size-3" /> {booking.sender.email || 'N/A'}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                                <Phone className="size-3" /> {booking.sender.mobile || booking.sender.phone || 'N/A'}
                                            </p>
                                        </div>
                                        <div className="pt-2 flex items-start gap-1.5 text-xs text-brand-rust/80">
                                            <MapPin className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                                            <div className="flex flex-col">
                                                <span>{booking.sender.address || 'N/A'}</span>
                                                {(booking.sender.suburb || booking.sender.state || booking.sender.postcode) && (
                                                    <span className="text-[10px] text-muted-foreground mt-0.5 uppercase">
                                                        {[booking.sender.suburb, booking.sender.state, booking.sender.postcode].filter(Boolean).join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Recipient Details */}
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="size-1.5 rounded-full bg-brand-secondary"></div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipient</p>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-lg font-serif font-bold text-brand-rust leading-tight uppercase">
                                                {booking.boxes?.[0]?.recipient?.name || booking.recipient_name || 'No Recipient'}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                                <Phone className="size-3" /> {booking.boxes?.[0]?.recipient?.phone_number || booking.boxes?.[0]?.recipient?.phone || booking.recipient_phone || 'N/A'}
                                            </p>
                                        </div>
                                        <div className="pt-2 flex items-start gap-1.5 text-xs text-brand-rust/80">
                                            <MapPin className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                                            <div className="flex flex-col">
                                                <span>{booking.boxes?.[0]?.recipient?.address || booking.delivery_address || 'No Address'}</span>
                                                <span className="text-[10px] text-muted-foreground mt-0.5 uppercase">
                                                    {[
                                                        booking.boxes?.[0]?.recipient?.city || booking.destination,
                                                        booking.boxes?.[0]?.recipient?.province,
                                                        booking.boxes?.[0]?.recipient?.zip_code ? `ZIP: ${booking.boxes[0].recipient.zip_code}` : null
                                                    ].filter(Boolean).join(', ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Internal Notes */}
                        {booking.notes && (
                            <div className="bg-brand-rust/5 border border-brand-rust/10 rounded-xl p-5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-rust/60 mb-2">Internal Notes</p>
                                <p className="text-sm font-serif italic text-brand-rust/90">"{booking.notes}"</p>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Documentation & Tracking */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Customs Documentation Section */}
                            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="size-4 text-brand-rust" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Customs Declaration</h3>
                                    </div>
                                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                        booking.declaration_form_status === 'submitted_online' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                        booking.declaration_form_status === 'physical_copy_received' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                        'bg-muted text-muted-foreground border-border'
                                    }`}>
                                        {humanize(booking.declaration_form_status)}
                                    </div>
                                </div>
                                <div className="p-5 flex-1 flex flex-col">
                                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-6">
                                        {booking.declaration_form_status === 'missing'
                                            ? "No declaration has been submitted yet. Required for customs clearance."
                                            : booking.declaration_form_status === 'physical_copy_received'
                                            ? "A physical copy of the form was handed to the picker and uploaded."
                                            : "The digital declaration form has been submitted and is ready for review."}
                                    </p>
                                    <div className="mt-auto flex flex-wrap gap-2">
                                        {booking.declaration_form_status !== 'missing' ? (
                                            <>
                                                {booking.declaration_form_path && (
                                                    <a
                                                        href={`/admin/bookings/${booking.id}/declaration-file`}
                                                        target="_blank"
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:opacity-90 transition-all shadow-sm"
                                                    >
                                                        <FileText className="size-3" /> View File
                                                    </a>
                                                )}
                                                {(!booking.declaration_form_path || booking.declaration_data) && (
                                                    <>
                                                        <a
                                                            href={`/admin/bookings/${booking.id}/declaration`}
                                                            target="_blank"
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-brand-rust text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:opacity-90 transition-all shadow-sm"
                                                        >
                                                            <Eye className="size-3" /> View / Print
                                                        </a>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-2">
                                                <AlertCircle className="size-3" /> Awaiting Submission
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Invoice Section */}
                            {booking.invoice?.id ? (
                                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                                    <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="size-4 text-brand-rust" />
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Billing</h3>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                            booking.invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                            booking.invoice.status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                            'bg-rose-50 text-rose-700 border-rose-100'
                                        }`}>
                                            {humanize(booking.invoice.status)}
                                        </div>
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="space-y-1 mb-6">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Invoice #{booking.invoice.invoice_number}</p>
                                            <p className="text-xl font-bold text-brand-rust">${Number(booking.invoice.amount).toFixed(2)}</p>
                                            {Number(booking.invoice.surcharge_amount || 0) > 0 && (
                                                <p className="text-[10px] text-brand-rust/70 uppercase font-bold tracking-widest">
                                                    Includes ${Number(booking.invoice.surcharge_amount || 0).toFixed(2)} Surcharge
                                                </p>
                                            )}
                                            
                                            {booking.payment_reference && (
                                                <div className="mt-3 text-xs text-muted-foreground border-t border-border pt-3">
                                                    <span className="font-bold uppercase tracking-wider text-[10px]">Ref:</span> <span className="text-brand-rust font-bold">{booking.payment_reference}</span>
                                                </div>
                                            )}
                                            
                                            {booking.proof_of_payment && (
                                                <div className="mt-1">
                                                    <a href={`/uploads/${booking.proof_of_payment}`} target="_blank" className="flex items-center gap-1.5 text-[10px] font-bold text-brand-rust hover:underline">
                                                        <FileText className="size-3" /> View Proof of Payment
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-auto flex flex-wrap gap-2">
                                            <Link
                                                href={`/admin/invoices/${booking.invoice.id}`}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-brand-rust text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:opacity-90 transition-all shadow-sm"
                                            >
                                                <Eye className="size-3" /> Details
                                            </Link>
                                            <a
                                                href={`/admin/invoices/${booking.invoice.id}/pdf`}
                                                className="flex items-center gap-2 px-3 py-1.5 border border-border text-muted-foreground text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-muted transition-all"
                                            >
                                                <Download className="size-3" /> PDF
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-muted/10 border border-dashed border-border rounded-xl flex flex-col items-center justify-center p-6 text-center">
                                    <CreditCard className="size-6 text-muted-foreground/30 mb-2" />
                                    <p className="text-xs font-bold text-muted-foreground uppercase">No Invoice Generated</p>
                                    
                                    {(booking.payment_reference || booking.proof_of_payment) && (
                                        <div className="mt-4 pt-4 border-t border-border/50 w-full flex flex-col items-center gap-2">
                                            {booking.payment_reference && (
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                                                    Ref: <span className="text-brand-rust">{booking.payment_reference}</span>
                                                </p>
                                            )}
                                            {booking.proof_of_payment && (
                                                <a href={`/uploads/${booking.proof_of_payment}`} target="_blank" className="flex items-center gap-1.5 text-[10px] font-bold text-brand-rust hover:underline">
                                                    <FileText className="size-3" /> View Proof of Payment
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Boxes Section */}
                        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Package className="size-4 text-brand-rust" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Boxes & Shipping Units</h3>
                                </div>
                                {hasBoxes && (
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-full border border-border">
                                        {booking.boxes.length} Total
                                    </span>
                                )}
                            </div>

                            <div className="flex-1">
                                {hasBoxes ? (
                                    booking.status !== 'pending' ? (
                                        <div className="flex flex-col divide-y divide-border">
                                            {booking.boxes.map((box, index) => (
                                                <div
                                                    key={box.id}
                                                    className="p-6 transition-all hover:bg-muted/5"
                                                >
                                                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                                                        <div className="space-y-4 flex-1">
                                                            <div className="flex items-center gap-3">
                                                                <span className="px-2 py-0.5 bg-foreground text-background text-[9px] font-bold uppercase tracking-wider rounded">
                                                                    BOX #{index + 1}
                                                                </span>
                                                                {box.is_custom_size ? (
                                                                    <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">
                                                                        Custom Size
                                                                    </span>
                                                                ) : box.box_type ? (
                                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                                        {box.box_type.name}
                                                                    </span>
                                                                ) : null}
                                                                {box.price_is_estimate && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200">
                                                                        Est. Price
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <Link href={`/admin/boxes/${box.id}`} className="text-xl font-bold text-brand-rust tracking-tight font-mono hover:underline">
                                                                    {box.tracking_number}
                                                                </Link>
                                                                <div className="flex items-center gap-2">
                                                                    {box.declaration_form_path && (
                                                                        <a
                                                                            href={`/uploads/${box.declaration_form_path}`}
                                                                            target="_blank"
                                                                            title="View Declaration Form"
                                                                            className="p-1.5 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-border transition-colors"
                                                                        >
                                                                            <FileText className="size-4" />
                                                                        </a>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        title="Print box label"
                                                                        className="p-1.5 text-muted-foreground hover:text-brand-rust hover:bg-brand-rust/5 rounded-lg border border-border transition-colors"
                                                                    >
                                                                        <Printer className="size-4" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-2">
                                                                <div className="space-y-1">
                                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Dimensions</p>
                                                                    <p className="text-sm font-bold text-brand-rust uppercase tracking-tight">
                                                                        {box.is_custom_size && box.custom_length && box.custom_width && box.custom_height
                                                                            ? `${box.custom_length}×${box.custom_width}×${box.custom_height} cm`
                                                                            : box.box_type?.dimensions || 'N/A'}
                                                                    </p>
                                                                    {box.is_custom_size && box.custom_length && box.custom_width && box.custom_height && (
                                                                        <p className="text-[9px] text-sky-600 font-bold uppercase">
                                                                            {((+box.custom_length * +box.custom_width * +box.custom_height) / 1_000_000).toFixed(4)} CBM
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Status</p>
                                                                    <div className={`text-xs font-bold flex items-center gap-2 uppercase ${BOX_STATUS_CONFIG[box.status]?.color || 'text-foreground'}`}>
                                                                        {BOX_STATUS_CONFIG[box.status]?.label || box.status}
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1 col-span-2 md:col-span-1">
                                                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Progress</p>
                                                                    <div className="space-y-1.5">
                                                                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full bg-brand-rust transition-all duration-500 ${BOX_PROGRESS_WIDTH_CLASS[BOX_STATUS_CONFIG[box.status]?.progress || 0] || 'w-0'}`}
                                                                            />
                                                                        </div>
                                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{BOX_STATUS_CONFIG[box.status]?.subLabel || 'Processing'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-12 text-center opacity-60">
                                            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
                                                <Clock className="size-6" />
                                            </div>
                                            <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Awaiting Confirmation</h4>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                                                Labels will be available once the booking is confirmed.
                                            </p>
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-12 text-center">
                                        <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
                                            <Package className="size-6" />
                                        </div>
                                        <h4 className="text-sm font-bold text-foreground">No Boxes Added</h4>
                                        <Link
                                            href="/admin/boxes/create"
                                            className="mt-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-brand-rust rounded-lg shadow-sm"
                                        >
                                            Add Box
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Booking Notes Footer (Optional) */}
                        {booking.notes && (
                            <div className="bg-brand-rust/5 border border-brand-rust/10 rounded-xl p-8">
                                <div className="flex items-start gap-4">
                                    <Info className="size-5 text-brand-rust mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-rust/60 mb-2">Internal Delivery Notes</p>
                                        <p className="text-sm font-serif italic text-brand-rust/90 leading-relaxed">
                                            "{booking.notes}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Accept Modal */}
                <Dialog open={isAcceptModalOpen} onOpenChange={setIsAcceptModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-brand-rust font-serif text-2xl">
                                <CheckCircle className="size-6 text-emerald-600" />
                                Accept Booking
                            </DialogTitle>
                            <DialogDescription className="text-xs uppercase tracking-widest font-bold text-muted-foreground mt-2">
                                Confirming {booking.reference_number}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                You are about to confirm this booking. This will allow the sender to proceed with payment and enable box collection scheduling.
                            </p>

                            {!hasDeclaration && (
                                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 space-y-2">
                                    <div className="flex items-center gap-2 text-amber-800 font-bold uppercase tracking-widest text-[10px]">
                                        <AlertTriangle className="size-4" />
                                        Declaration Missing
                                    </div>
                                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                        Accepting a booking without a declaration form may cause delays in customs clearance or result in compliance issues later. Ensure the sender provides this before the box is loaded for export.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-rust">Internal Admin Notes (Optional)</label>
                                <textarea
                                    placeholder="Add any internal notes about this acceptance..."
                                    value={data.admin_notes}
                                    onChange={e => setData('admin_notes', e.target.value)}
                                    className="flex min-h-32 w-full rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-rust/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                        </div>

                        <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsAcceptModalOpen(false)}
                                className="w-full sm:w-auto uppercase tracking-widest text-[10px] font-bold"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleAccept}
                                disabled={processing}
                                className="w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700 uppercase tracking-widest text-[10px] font-bold gap-2"
                            >
                                {processing ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle className="size-3" />}
                                {processing ? 'Confirming...' : 'Confirm Acceptance'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
