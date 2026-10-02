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
}

export default function BookingConfirmed({ booking, declarationUrl, paymentUrl }: Props) {
    const [copied, setCopied] = useState(false);

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

    const totalAmount = booking.invoice?.amount
        ? Number(booking.invoice.amount).toFixed(2)
        : booking.boxes.reduce((sum, b) => sum + Number(b.price_charged || 0), 0).toFixed(2);

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

    return (
        <MarketingLayout>
            <Head title={`Booking Confirmed #${booking.reference_number} | Eagle Express Cargo`} />

            <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Hero Confirmation Banner */}
                    <div className="bg-card rounded-3xl border border-border p-6 sm:p-10 shadow-xl text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

                        <div className="relative z-10">
                            <div className="inline-flex size-16 sm:size-20 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 items-center justify-center mb-6 shadow-xs border border-emerald-500/20">
                                <CheckCircle2 className="size-10 sm:size-12" />
                            </div>

                            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-3">
                                Booking Confirmed
                            </span>

                            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-brand-text tracking-tight mb-3">
                                Salamat po, {booking.sender?.first_name || 'Customer'}!
                            </h1>
                            <p className="text-sm sm:text-base text-brand-text-mid max-w-xl mx-auto mb-6">
                                We have received your pickup booking. Our team will coordinate your collection, and a confirmation email has been dispatched to{' '}
                                <strong className="text-brand-text">{booking.sender?.email}</strong>.
                            </p>

                            {/* Reference Number Badge with Copy */}
                            <div className="inline-flex flex-col sm:flex-row items-center gap-3 bg-brand-cream/60 dark:bg-zinc-800/80 border border-border rounded-2xl p-2.5 sm:px-5 sm:py-3 shadow-xs">
                                <span className="text-xs font-bold uppercase tracking-widest text-brand-text-mid">
                                    Booking Reference:
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xl sm:text-2xl font-bold text-brand-primary dark:text-sky-400 tracking-wider">
                                        {booking.reference_number}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={copyReference}
                                        aria-label="Copy booking reference"
                                        className="p-1.5 rounded-lg bg-card hover:bg-brand-warm/30 border border-border text-brand-text-mid hover:text-brand-text transition-colors cursor-pointer"
                                        title="Copy reference number"
                                    >
                                        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 2 Alert: Customs Declaration Required */}
                    <div className="rounded-3xl border border-amber-500/40 bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 sm:p-8 shadow-lg relative overflow-hidden">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="size-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                                    <FileText className="size-6" />
                                </div>
                                <div>
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                                        <span>Philippine Customs Requirement</span>
                                    </div>
                                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-brand-text tracking-tight">
                                        Complete Your Customs Declaration (Packing List)
                                    </h3>
                                    <p className="text-xs sm:text-sm text-brand-text-mid mt-1 max-w-xl leading-relaxed">
                                        Philippine Customs requires an itemized packing declaration for every box prior to vessel departure. You can complete your declaration now or use the secure link in your confirmation email before your driver arrives.
                                    </p>
                                </div>
                            </div>

                            <Button asChild size="lg" className="rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold tracking-wide shadow-md shrink-0 w-full md:w-auto h-12 px-6 cursor-pointer">
                                <Link href={declarationUrl}>
                                    Fill Out Declaration <ArrowRight className="size-4 ml-1.5" />
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Pickup & Sender Information */}
                        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-border">
                                <div className="size-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                                    <MapPin className="size-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-brand-text">Pickup & Sender Details</h3>
                                    <p className="text-xs text-brand-text-light">Collection address in Australia</p>
                                </div>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div>
                                    <span className="font-semibold text-brand-text-light uppercase tracking-wider text-[10px] block">Sender Name</span>
                                    <span className="font-medium text-brand-text text-sm">{senderName}</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-brand-text-light uppercase tracking-wider text-[10px] block">Contact Phone</span>
                                    <span className="font-medium text-brand-text">{booking.sender?.mobile}</span>
                                </div>
                                <div>
                                    <span className="font-semibold text-brand-text-light uppercase tracking-wider text-[10px] block">Collection Address</span>
                                    <span className="font-medium text-brand-text leading-relaxed">{senderAddress}</span>
                                </div>
                                <div className="pt-2 border-t border-border flex items-center gap-2">
                                    <Calendar className="size-4 text-brand-primary" />
                                    <span className="text-xs text-brand-text-mid font-medium">
                                        Preferred Date: <strong className="text-brand-text">{formattedPickupDate}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Boxes & Payment Overview */}
                        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-border">
                                <div className="size-9 rounded-xl bg-brand-secondary/10 text-brand-secondary flex items-center justify-center">
                                    <Package className="size-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-brand-text">Boxes & Total Cost</h3>
                                    <p className="text-xs text-brand-text-light">{booking.boxes.length} box(es) booked</p>
                                </div>
                            </div>

                            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                                {booking.boxes.map((box, idx) => {
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
                                })}
                            </div>

                            <div className="pt-3 border-t border-border flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-brand-text-mid">
                                    <CreditCard className="size-4 text-emerald-600" />
                                    <span>
                                        {booking.payment_method === 'cash_on_pickup'
                                            ? 'Cash on Pickup'
                                            : booking.payment_method === 'bank_transfer'
                                            ? 'Bank Transfer / PayID'
                                            : booking.payment_method === 'stripe'
                                            ? 'Credit / Debit Card (Stripe)'
                                            : (booking.payment_method || 'Pending')}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase font-bold text-brand-text-light block">Total Due</span>
                                    <span className="font-mono text-base font-bold text-brand-text">
                                        AUD ${totalAmount}
                                    </span>
                                </div>
                            </div>
                            {booking.payment_status !== 'paid' && booking.payment_method === 'stripe' && (
                                <Button asChild className="w-full rounded-xl bg-brand-primary text-white font-bold">
                                    <Link href={paymentUrl}>
                                        <CreditCard className="size-4 mr-1.5" /> Pay Securely
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Account Conversion CTA */}
                    <div className="rounded-3xl border border-sky-500/30 bg-linear-to-br from-sky-500/10 via-brand-cream to-transparent dark:from-sky-950/20 dark:via-zinc-900 p-6 sm:p-8 shadow-sm">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300 uppercase tracking-wider">
                                    <UserPlus className="size-3.5" />
                                    <span>Save Time On Your Next Shipment</span>
                                </div>
                                <h3 className="font-serif text-xl sm:text-2xl font-bold text-brand-text">
                                    Create a free member account
                                </h3>
                                <p className="text-xs sm:text-sm text-brand-text-mid max-w-xl leading-relaxed">
                                    Register with <strong className="text-brand-text">{booking.sender?.email}</strong> and this booking will automatically link to your profile. You'll enjoy saved Philippine address books, 1-click rebooking, and detailed transit history!
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
                                <Button asChild size="lg" className="rounded-2xl bg-brand-primary hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider h-11 px-6 shadow-sm w-full sm:w-auto cursor-pointer">
                                    <Link href={registerUrl}>Create Account</Link>
                                </Button>
                                <Button asChild variant="outline" size="lg" className="rounded-2xl border-border bg-card text-brand-text font-bold text-xs uppercase tracking-wider h-11 px-6 w-full sm:w-auto cursor-pointer">
                                    <Link href={trackingUrl}>
                                        <Search className="size-3.5 mr-1.5" /> Track Box
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Back Links */}
                    <div className="flex items-center justify-center gap-4 text-xs font-bold text-brand-text-mid pt-4">
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
