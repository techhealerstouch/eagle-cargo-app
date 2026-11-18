import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    CheckCircle2,
    Copy,
    Check,
    FileText,
    ArrowRight,
    Package,
    Calendar,
    MapPin,
    User,
    CreditCard,
    Sparkles,
    ShieldCheck,
    Search,
    UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import MarketingLayout from '@/layouts/marketing-layout';
import { toast } from 'sonner';

interface BookingBox {
    id: number;
    box_type?: { name: string } | null;
    is_custom_size?: boolean;
    recipient?: {
        name?: string;
        first_name?: string;
        last_name?: string;
        city?: string;
        province?: string;
        area?: { name: string } | null;
    } | null;
    price_charged?: number | string | null;
}

interface Booking {
    id: number;
    reference_number: string;
    status?: string;
    empty_box_count?: number;
    empty_box_fee?: number | string;
    empty_box_items?: Array<{ box_type_id?: number | string; quantity: number; name?: string; dimensions?: string }> | null;
    is_ready_for_pickup?: boolean;
    source_empty_box_booking_id?: number | null;
    empty_box_deposit_credit?: number | string | null;
    preferred_date?: string | null;
    payment_method: string;
    payment_status: string;
    notes?: string | null;
    sender?: {
        first_name: string;
        last_name: string;
        email: string;
        mobile: string;
        address: string;
        suburb?: string | null;
        state?: string | null;
        postcode?: string | null;
    } | null;
    boxes: BookingBox[];
    invoice?: {
        amount: number | string;
        status: string;
    } | null;
}

interface Props {
    booking: Booking;
    declarationUrl: string;
    paymentUrl: string;
    convertEmptyBoxUrl?: string;
}

export default function BookingConfirmed({ booking, declarationUrl, paymentUrl, convertEmptyBoxUrl }: Props) {
    const [copied, setCopied] = useState(false);

    const isEmptyBoxOrder = Number(booking.empty_box_count || 0) > 0 && (booking.boxes || []).length === 0;
    const isAdminConfirmed = Boolean(booking.status && !['pending', 'draft', 'cancelled'].includes(booking.status.toLowerCase()));

    const copyReference = () => {
        if (!booking?.reference_number) return;
        navigator.clipboard.writeText(booking.reference_number);
        setCopied(true);
        toast.success('Booking reference copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    const senderName = booking.sender
        ? `${booking.sender.first_name} ${booking.sender.last_name}`.trim()
        : 'Customer';

    const senderAddress = [
        booking.sender?.address,
        booking.sender?.suburb,
        booking.sender?.state,
        booking.sender?.postcode,
    ].filter(Boolean).join(', ');

    const emptyBoxFallback = Number(booking.empty_box_count || 0) * Number(booking.empty_box_fee || 10);
    const boxesSum = (booking.boxes || []).reduce((sum, b) => sum + Number(b.price_charged || 0), 0);
    const totalAmount = booking.invoice?.amount
        ? Number(booking.invoice.amount).toFixed(2)
        : (boxesSum > 0 ? boxesSum : emptyBoxFallback).toFixed(2);

    const formattedPickupDate = booking.preferred_date
        ? new Date(booking.preferred_date).toLocaleDateString('en-AU', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : 'Scheduled by courier';

    const trackingUrl = `/track?tracking_number=${encodeURIComponent(booking.reference_number)}`;
    const registerUrl = `/register?email=${encodeURIComponent(booking.sender?.email || '')}`;

    const statusBadgeText = isAdminConfirmed
        ? isEmptyBoxOrder
            ? 'Box Order Confirmed'
            : 'Booking Confirmed'
        : isEmptyBoxOrder
          ? 'Order Submitted • Pending Confirmation'
          : 'Booking Received • Pending Confirmation';

    return (
        <MarketingLayout>
            <Head title={`${statusBadgeText} #${booking.reference_number} | Eagle Express Cargo`} />

            <div className="min-h-screen py-6 sm:py-8 px-4 sm:px-6">
                <div className="max-w-3xl mx-auto space-y-5">
                    {/* Hero Confirmation Banner */}
                    <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-xs text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-brand-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

                        <div className="relative z-10">
                            <div className="inline-flex items-center justify-center gap-2.5 mb-3">
                                <div
                                    className={`inline-flex size-11 rounded-2xl items-center justify-center shadow-2xs border ${
                                        isAdminConfirmed
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                    }`}
                                >
                                    <CheckCircle2 className="size-6" />
                                </div>

                                <span
                                    className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                                        isAdminConfirmed
                                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
                                    }`}
                                >
                                    {statusBadgeText}
                                </span>
                            </div>

                            <h1 className="font-serif text-xl sm:text-2xl font-bold text-brand-text tracking-tight mb-2">
                                Salamat po, {booking.sender?.first_name || 'Customer'}!
                            </h1>
                            <p className="text-xs sm:text-sm text-brand-text-mid max-w-lg mx-auto mb-4 leading-relaxed">
                                {isEmptyBoxOrder ? (
                                    isAdminConfirmed ? (
                                        <>
                                            Your empty box delivery order has been confirmed. Schedule details have been sent to{' '}
                                            <strong className="text-brand-text">{booking.sender?.email}</strong>.
                                        </>
                                    ) : (
                                        <>
                                            We have received your empty box delivery order. Our team will review and confirm your drop-off schedule shortly, and a copy of your order has been sent to{' '}
                                            <strong className="text-brand-text">{booking.sender?.email}</strong>.
                                        </>
                                    )
                                ) : isAdminConfirmed ? (
                                    <>
                                        Your pickup booking is confirmed. Our team will coordinate your collection, and a confirmation email has been dispatched to{' '}
                                        <strong className="text-brand-text">{booking.sender?.email}</strong>.
                                    </>
                                ) : (
                                    <>
                                        We have received your pickup booking request. Our team will review and confirm your collection schedule shortly, and an email has been dispatched to{' '}
                                        <strong className="text-brand-text">{booking.sender?.email}</strong>.
                                    </>
                                )}
                            </p>

                            {/* Reference Number Badge with Copy */}
                            <div className="inline-flex items-center gap-2.5 bg-brand-cream/60 dark:bg-zinc-800/80 border border-border rounded-xl px-3.5 py-2 shadow-2xs">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-text-mid">
                                    Booking Reference:
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-sm sm:text-base font-bold text-brand-primary dark:text-sky-400 tracking-wider">
                                        {booking.reference_number}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={copyReference}
                                        aria-label="Copy booking reference"
                                        className="p-1 rounded-lg bg-card hover:bg-brand-warm/30 border border-border text-brand-text-mid hover:text-brand-text transition-colors cursor-pointer"
                                        title="Copy reference number"
                                    >
                                        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Banners */}
                    {isEmptyBoxOrder ? (
                        <div className="rounded-2xl border border-emerald-500/40 bg-linear-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5 shadow-xs relative overflow-hidden">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3.5">
                                    <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                        <Package className="size-5" />
                                    </div>
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                                            <span>Pack Over Time • No Rush</span>
                                        </div>
                                        <h3 className="font-serif text-base sm:text-lg font-bold text-brand-text tracking-tight">
                                            Take Your Time Packing Your Balikbayan Box
                                        </h3>
                                        <p className="text-xs text-brand-text-mid mt-1 max-w-xl leading-relaxed">
                                            Collect pasalubong and pack gradually at your own pace. Once full, schedule your shipping pickup to get your <strong>${emptyBoxFallback.toFixed(2)} deposit credited</strong> toward your shipping invoice!
                                        </p>
                                    </div>
                                </div>

                                <Button asChild size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold tracking-wide shadow-xs shrink-0 w-full md:w-auto h-10 px-4 text-xs cursor-pointer">
                                    <Link href={convertEmptyBoxUrl || `/guest/book?from_empty_box=${booking.id}`}>
                                        Schedule Pickup When Packed <ArrowRight className="size-3.5 ml-1.5" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ) : booking.is_ready_for_pickup === false ? (
                        <div className="rounded-2xl border border-sky-500/40 bg-linear-to-r from-sky-500/10 via-sky-500/5 to-transparent p-4 sm:p-5 shadow-xs relative overflow-hidden">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3.5">
                                    <div className="size-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                        <Package className="size-5" />
                                    </div>
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-800 dark:text-sky-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                                            <span>Pack First • Schedule Later</span>
                                        </div>
                                        <h3 className="font-serif text-base sm:text-lg font-bold text-brand-text tracking-tight">
                                            Your Shipment is Reserved!
                                        </h3>
                                        <p className="text-xs text-brand-text-mid mt-1 max-w-xl leading-relaxed">
                                            Your shipping rates and details are locked in. When you finish packing your boxes, use the link sent to your email to schedule driver pickup.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-amber-500/40 bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 shadow-xs relative overflow-hidden">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3.5">
                                    <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                                        <FileText className="size-5" />
                                    </div>
                                    <div>
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                                            <span>Philippine Customs Requirement</span>
                                        </div>
                                        <h3 className="font-serif text-base sm:text-lg font-bold text-brand-text tracking-tight">
                                            Complete Your Customs Declaration (Packing List)
                                        </h3>
                                        <p className="text-xs text-brand-text-mid mt-1 max-w-xl leading-relaxed">
                                            Philippine Customs requires an itemized packing declaration for every box prior to vessel departure. You can complete your declaration now or use the secure link in your email before collection.
                                        </p>
                                    </div>
                                </div>

                                <Button asChild size="sm" className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold tracking-wide shadow-xs shrink-0 w-full md:w-auto h-10 px-4 text-xs cursor-pointer">
                                    <Link href={declarationUrl}>
                                        Fill Out Declaration <ArrowRight className="size-3.5 ml-1.5" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                        {/* Pickup & Sender Information */}
                        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-3.5">
                            <div className="flex items-center gap-3 pb-3 border-b border-border">
                                <div className="size-8 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                                    <MapPin className="size-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-brand-text">
                                        {isEmptyBoxOrder ? 'Delivery & Customer Details' : 'Pickup & Sender Details'}
                                    </h3>
                                    <p className="text-xs text-brand-text-light">
                                        {isEmptyBoxOrder ? 'Drop-off address in Australia' : 'Collection address in Australia'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2.5 text-xs">
                                <div>
                                    <span className="font-semibold text-brand-text-light uppercase tracking-wider text-[10px] block">Sender Name</span>
                                    <span className="font-medium text-brand-text text-sm">{senderName}</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-brand-text-light uppercase tracking-wider text-[10px] block">Contact Phone</span>
                                    <span className="font-medium text-brand-text">{booking.sender?.mobile}</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-brand-text-light uppercase tracking-wider text-[10px] block">
                                        {isEmptyBoxOrder ? 'Delivery Address' : 'Collection Address'}
                                    </span>
                                    <span className="font-medium text-brand-text leading-relaxed">{senderAddress}</span>
                                </div>
                                <div className="pt-2 border-t border-border flex items-center gap-2">
                                    <Calendar className="size-4 text-brand-primary shrink-0" />
                                    <span className="text-xs text-brand-text-mid font-medium">
                                        Preferred Date: <strong className="text-brand-text">{formattedPickupDate}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Boxes & Payment Overview */}
                        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-3.5">
                            <div className="flex items-center gap-3 pb-3 border-b border-border">
                                <div className="size-8 rounded-xl bg-brand-secondary/10 text-brand-secondary flex items-center justify-center">
                                    <Package className="size-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-brand-text">
                                        {isEmptyBoxOrder ? 'Empty Box Supply & Deposit' : 'Boxes & Total Cost'}
                                    </h3>
                                    <p className="text-xs text-brand-text-light">
                                        {isEmptyBoxOrder ? `${booking.empty_box_count} empty box(es) ordered` : `${booking.boxes.length} box(es) booked`}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {isEmptyBoxOrder ? (
                                    booking.empty_box_items && Array.isArray(booking.empty_box_items) && booking.empty_box_items.length > 0 ? (
                                        booking.empty_box_items.map((item, idx) => (
                                            <div key={idx} className="p-2.5 rounded-xl bg-brand-cream/30 dark:bg-zinc-800/50 border border-border/60 flex items-center justify-between text-xs">
                                                <div>
                                                    <span className="font-bold text-brand-text block">
                                                        {item.quantity}x {item.name || 'Empty Balikbayan Box'}
                                                    </span>
                                                    <span className="text-brand-text-light text-[11px]">
                                                        {item.dimensions ? `${item.dimensions} • ` : ''}${(Number(booking.empty_box_fee) || 10).toFixed(2)} deposit credited on shipping
                                                    </span>
                                                </div>
                                                <span className="font-mono font-bold text-brand-text text-xs">
                                                    ${(Number(item.quantity || 1) * Number(booking.empty_box_fee || 10)).toFixed(2)}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-2.5 rounded-xl bg-brand-cream/30 dark:bg-zinc-800/50 border border-border/60 flex items-center justify-between text-xs">
                                            <div>
                                                <span className="font-bold text-brand-text block">
                                                    {booking.empty_box_count}x Empty Balikbayan Box{Number(booking.empty_box_count || 0) > 1 ? 'es' : ''}
                                                </span>
                                                <span className="text-brand-text-light text-[11px]">
                                                    Doorstep Delivery • Deposit credited on shipment
                                                </span>
                                            </div>
                                            <span className="font-mono font-bold text-brand-text text-xs">
                                                ${totalAmount}
                                            </span>
                                        </div>
                                    )
                                ) : (
                                    booking.boxes.map((box, idx) => {
                                        const recipientName = box.recipient?.name || `${box.recipient?.first_name || ''} ${box.recipient?.last_name || ''}`.trim() || 'Pending';
                                        const dest = [box.recipient?.city, box.recipient?.province, box.recipient?.area?.name].filter(Boolean).join(', ');

                                        return (
                                            <div key={box.id || idx} className="p-2.5 rounded-xl bg-brand-cream/30 dark:bg-zinc-800/50 border border-border/60 flex items-center justify-between text-xs">
                                                <div>
                                                    <span className="font-bold text-brand-text block">
                                                        Box #{idx + 1}: {box.box_type?.name || (box.is_custom_size ? 'Custom CBM' : 'Balikbayan Box')}
                                                    </span>
                                                    <span className="text-brand-text-light text-[11px]">
                                                        To: {recipientName} {dest ? `(${dest})` : ''}
                                                    </span>
                                                </div>
                                                <span className="font-mono font-bold text-brand-text text-xs">
                                                    ${Number(box.price_charged || 0).toFixed(2)}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="pt-3 border-t border-border flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-brand-text-mid">
                                    <CreditCard className="size-4 text-emerald-600" />
                                    <span>
                                        {booking.payment_method === 'cash_on_pickup'
                                            ? isEmptyBoxOrder ? 'Cash on Delivery' : 'Cash on Pickup'
                                            : booking.payment_method === 'bank_transfer'
                                            ? 'Bank Transfer / PayID'
                                            : booking.payment_method === 'stripe'
                                            ? 'Credit / Debit Card (Stripe)'
                                            : (booking.payment_method || 'Pending')}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase font-bold text-brand-text-light block">
                                        {booking.payment_status === 'paid' ? 'Total Paid' : 'Total Due'}
                                    </span>
                                    <span className="font-mono text-sm font-bold text-brand-text">
                                        AUD ${totalAmount}
                                    </span>
                                </div>
                            </div>
                            {booking.payment_status !== 'paid' && booking.payment_method === 'stripe' && (
                                <Button asChild size="sm" className="w-full rounded-xl bg-brand-primary text-white font-bold h-10 text-xs">
                                    <Link href={paymentUrl}>
                                        <CreditCard className="size-3.5 mr-1.5" /> Pay Securely
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Account Conversion CTA */}
                    <div className="rounded-2xl border border-sky-500/30 bg-linear-to-br from-sky-500/10 via-brand-cream to-transparent dark:from-sky-950/20 dark:via-zinc-900 p-5 shadow-xs">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider">
                                    <UserPlus className="size-3.5" />
                                    <span>Save Time On Your Next Shipment</span>
                                </div>
                                <h3 className="font-serif text-base sm:text-lg font-bold text-brand-text">
                                    Create a free member account
                                </h3>
                                <p className="text-xs text-brand-text-mid max-w-xl leading-relaxed">
                                    Register with <strong className="text-brand-text">{booking.sender?.email}</strong> and this booking will automatically link to your profile for 1-click rebooking and transit history.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0 w-full md:w-auto">
                                <Button asChild size="sm" className="rounded-xl bg-brand-primary hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider h-10 px-5 shadow-2xs w-full sm:w-auto cursor-pointer">
                                    <Link href={registerUrl}>Create Account</Link>
                                </Button>
                                <Button asChild variant="outline" size="sm" className="rounded-xl border-border bg-card text-brand-text font-bold text-xs uppercase tracking-wider h-10 px-5 w-full sm:w-auto cursor-pointer">
                                    <Link href={trackingUrl}>
                                        <Search className="size-3.5 mr-1.5" /> Track Order
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Back Links */}
                    <div className="flex items-center justify-center gap-4 text-xs font-bold text-brand-text-mid pt-2">
                        <Link href="/" className="hover:text-brand-text transition-colors">
                            Return to Home
                        </Link>
                        <span>•</span>
                        <Link href={trackingUrl} className="hover:text-brand-text transition-colors">
                            Live Tracking
                        </Link>
                        <span>•</span>
                        <Link href="/contact" className="hover:text-brand-text transition-colors">
                            Contact Customer Care
                        </Link>
                    </div>
                </div>
            </div>
        </MarketingLayout>
    );
}
