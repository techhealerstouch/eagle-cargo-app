import { Head, Link } from '@inertiajs/react';
import {
    CheckCircle2,
    Copy,
    ExternalLink,
    Package,
    Truck,
    Clock,
    UserPlus,
    ArrowRight,
    MapPin,
    CreditCard,
    DollarSign,
    ShieldCheck,
    Boxes,
    Mail,
    Phone,
    FileText,
    Building2,
    Upload,
    Loader2,
    Wallet,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import PaymentFlow from '@/components/payment/PaymentFlow';
import type { BankDetails, Booking as PaymentBooking } from '@/components/payment/types';
import MarketingLayout from '@/layouts/marketing-layout';

interface BookingConfirmedProps {
    booking: PaymentBooking & {
        needs_declaration?: boolean;
        has_proof_of_payment?: boolean;
        status: string;
        created_at: string;
        boxes_count: number;
        total_amount: number | null;
        sender: {
            first_name?: string;
            last_name?: string;
            name: string;
            email: string;
            mobile: string;
            address: string;
            suburb: string;
            state: string;
            postcode: string;
        };
    };
    bankDetails?: BankDetails;
    stripeKey?: string;
    clientSecret?: string | null;
}

export default function BookingConfirmed({ booking, bankDetails, stripeKey, clientSecret }: BookingConfirmedProps) {
    const [currentBooking, setCurrentBooking] = useState(booking);
    const [activeClientSecret, setActiveClientSecret] = useState(clientSecret);
    const [copied, setCopied] = useState(false);
    const isPaid = currentBooking.payment_status === 'paid';

    useEffect(() => {
        if (!activeClientSecret && stripeKey && !isPaid && currentBooking.guest_token) {
            const getXsrfToken = () => {
                const match = document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'));
                return match ? decodeURIComponent(match[3]) : '';
            };
            fetch(`/guest/bookings/${currentBooking.id}/stripe-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getXsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ token: currentBooking.guest_token }),
            })
                .then(res => res.json())
                .then(data => {
                    if (data.clientSecret) {
                        setActiveClientSecret(data.clientSecret);
                    }
                })
                .catch(err => console.error('Failed to fetch stripe intent:', err));
        }
    }, [activeClientSecret, stripeKey, isPaid, currentBooking.id, currentBooking.guest_token]);

    const handleCopy = () => {
        if (!currentBooking.reference_number) return;
        navigator.clipboard.writeText(currentBooking.reference_number);
        setCopied(true);
        toast.success(`Copied ${currentBooking.reference_number} to clipboard!`);
        setTimeout(() => setCopied(false), 2500);
    };

    const registerUrl = `/register?email=${encodeURIComponent(currentBooking.sender.email)}&name=${encodeURIComponent(currentBooking.sender.name)}`;
    const trackingUrl = `/track?tracking_number=${encodeURIComponent(currentBooking.reference_number)}`;

    const formatPaymentMethod = (method?: string) => {
        switch (method) {
            case 'cash_on_pickup':
                return 'Cash on Pickup';
            case 'bank_transfer':
                return 'Direct Bank Transfer';
            case 'pay_id':
                return 'PayID';
            case 'stripe':
                return 'Credit / Debit Card';
            default:
                return method?.replace(/_/g, ' ') || 'Pending';
        }
    };

    return (
        <MarketingLayout>
            <Head title={`Booking Confirmed: ${booking.reference_number} | Eagle Cargo`} />

            <div className="container mx-auto max-w-4xl px-4 py-10 md:px-8 md:py-16">
                {/* Hero Confirmation */}
                <div className="text-center space-y-4">
                    <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shadow-sm animate-fade-in">
                        <CheckCircle2 className="size-10 stroke-[2.5]" />
                    </div>

                    <div className="space-y-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-3.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            Booking Received & Under Review
                        </span>
                        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">
                            Thank you, {currentBooking.sender.first_name || currentBooking.sender.name}!
                        </h1>
                        <p className="mx-auto max-w-xl text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            Your pickup request has been recorded in our system. A confirmation email has been dispatched to{' '}
                            <strong className="text-zinc-900 dark:text-zinc-200">{currentBooking.sender.email}</strong>.
                        </p>
                    </div>
                </div>

                {/* Reference Number Card */}
                <div className="my-8 rounded-3xl border-2 border-brand-rust/30 bg-brand-rust/5 p-6 md:p-8 text-center shadow-xs">
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-rust">
                        Your Booking Reference Number
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-3">
                        <span className="font-mono text-3xl font-black tracking-wider text-zinc-900 dark:text-zinc-100 md:text-4xl">
                            {currentBooking.reference_number}
                        </span>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-rust/30 bg-white px-3 py-1.5 text-xs font-bold text-brand-rust shadow-xs transition-all hover:bg-brand-rust hover:text-white active:scale-95"
                            title="Copy reference number"
                        >
                            <Copy className="size-3.5" />
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>

                    <p className="mt-3 text-xs text-zinc-500">
                        Keep this number safe! You can use it anytime on our public tracking portal without logging in.
                    </p>

                    <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                        <a
                            href={trackingUrl}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-rust px-6 py-3 text-xs font-bold text-white shadow-xs transition-all hover:bg-brand-rust/90 active:scale-98"
                        >
                            Track This Shipment
                            <ExternalLink className="size-3.5" />
                        </a>
                        <Link
                            href="/guest/book"
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3 text-xs font-bold text-zinc-700 transition-all hover:bg-zinc-50"
                        >
                            Book Another Pickup
                        </Link>
                    </div>
                </div>

                {/* Customs Declaration Card */}
                {currentBooking.needs_declaration || currentBooking.declaration_form_status === 'missing' ? (
                    <div className="my-8 overflow-hidden rounded-3xl border-2 border-amber-300 bg-amber-50/80 p-6 md:p-8 shadow-xs">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                                    <FileText className="size-6 stroke-[2.2]" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">
                                            Action Required
                                        </span>
                                        <span className="text-[11px] font-semibold text-amber-800">
                                            Required before box pickup
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-zinc-900">
                                        Customs Declaration (Packing List)
                                    </h3>
                                    <p className="text-xs text-zinc-600 leading-relaxed max-w-xl">
                                        Philippine Customs requires an itemized packing list for every Balikbayan box. Complete it now online, or open the link we sent to your email (<strong>{currentBooking.sender.email}</strong>) when packing.
                                    </p>
                                </div>
                            </div>

                            <a
                                href={`/track/declaration/${currentBooking.id}?token=${encodeURIComponent(currentBooking.guest_token || '')}`}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-black active:scale-95 shrink-0 w-full md:w-auto text-center"
                            >
                                Complete Declaration Form
                                <ArrowRight className="size-4" />
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="my-8 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-xs">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-xs font-bold text-emerald-900">
                                    Customs Declaration Completed
                                </p>
                                <p className="text-xs text-emerald-700">
                                    Your packing list has been submitted and attached to this booking.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Payment Section: Complete Payment or Payment Received */}
                {isPaid ? (
                    <div className="my-8 rounded-3xl border-2 border-emerald-200 bg-emerald-50/70 p-6 md:p-8 shadow-xs">
                        <div className="flex items-center gap-4">
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                                <CheckCircle2 className="size-6 stroke-[2.2]" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-900">
                                        Payment Received
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-zinc-900 mt-1">
                                    Your payment of ${currentBooking.total_amount !== null ? currentBooking.total_amount.toFixed(2) : '0.00'} AUD has been received!
                                </h3>
                                <p className="text-xs text-zinc-600 mt-0.5">
                                    Thank you! Your booking is confirmed and scheduled for pickup.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="my-8 overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-xs">
                        <div className="mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4 flex items-center justify-between">
                            <div>
                                <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                                    Payment Options
                                </span>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                                    Complete Payment for {currentBooking.reference_number}
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Pay online securely via credit/debit card, bank transfer, PayID, or pay on pickup.
                                </p>
                            </div>
                            <Wallet className="size-6 text-zinc-400 shrink-0" />
                        </div>

                        <PaymentFlow
                            booking={currentBooking}
                            stripeKey={stripeKey}
                            clientSecret={activeClientSecret}
                            bankDetails={bankDetails}
                            role="guest"
                            backUrl={trackingUrl}
                            backLabel="Track Shipment"
                            onSuccess={() => {
                                setCurrentBooking(prev => ({
                                    ...prev,
                                    payment_status: 'paid',
                                }));
                                toast.success('Payment completed successfully!');
                            }}
                        />
                    </div>
                )}

                {/* Booking Details Breakdown */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Pickup Details */}
                    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
                        <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                            <Truck className="size-4 text-brand-rust" />
                            <h3 className="text-sm font-bold text-zinc-900">Pickup Details</h3>
                        </div>

                        <div className="space-y-2 text-xs text-zinc-600">
                            <p>
                                <strong className="text-zinc-900">Scheduled Date:</strong>{' '}
                                <span className="rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">
                                    {currentBooking.preferred_date || 'To be scheduled'}
                                </span>
                            </p>
                            <p>
                                <strong className="text-zinc-900">Pickup Address:</strong>{' '}
                                {currentBooking.sender?.address}, {currentBooking.sender?.suburb} {currentBooking.sender?.state}{' '}
                                {currentBooking.sender?.postcode}
                            </p>
                            <p>
                                <strong className="text-zinc-900">Contact:</strong> {currentBooking.sender?.mobile}
                            </p>
                            <p>
                                <strong className="text-zinc-900">Email:</strong> {currentBooking.sender?.email}
                            </p>
                            <p>
                                <strong className="text-zinc-900">Payment:</strong>{' '}
                                {currentBooking.payment_status === 'paid'
                                    ? `${formatPaymentMethod(currentBooking.payment_method)} (Paid)`
                                    : currentBooking.payment_status === 'pending'
                                        ? 'Pending'
                                        : `${formatPaymentMethod(currentBooking.payment_method)} (${currentBooking.payment_status})`}
                            </p>
                        </div>
                    </div>

                    {/* Cargo & Destination */}
                    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
                        <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                            <Package className="size-4 text-emerald-600" />
                            <h3 className="text-sm font-bold text-zinc-900">Destination & Cargo</h3>
                        </div>

                        <div className="space-y-2 text-xs text-zinc-600">
                            <p>
                                <strong className="text-zinc-900">Number of Boxes:</strong>{' '}
                                <span className="font-bold text-zinc-900">{currentBooking.boxes_count}</span>
                            </p>
                            {(currentBooking.boxes || []).map((b, idx) => (
                                <div key={idx} className="rounded-xl bg-zinc-50 p-2.5 space-y-1">
                                    <p className="font-bold text-zinc-900">
                                        Box #{idx + 1}: {typeof b.box_type === 'string' ? b.box_type : b.box_type?.name}
                                    </p>
                                    <p className="text-zinc-500">
                                        Receiver: {b.recipient_name} &bull; {b.destination}
                                    </p>
                                    {b.tracking_number && (
                                        <p className="font-mono text-brand-rust">
                                            Tracking: {b.tracking_number}
                                        </p>
                                    )}
                                </div>
                            ))}
                            {currentBooking.total_amount !== null && (
                                <p className="pt-2 text-right text-sm font-black text-brand-rust">
                                    Total: ${currentBooking.total_amount.toFixed(2)} AUD
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* What Happens Next */}
                <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 md:p-8 shadow-xs">
                    <h3 className="text-base font-bold text-zinc-900">What Happens Next?</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Here is how your booking progresses from here</p>

                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-2 rounded-2xl bg-zinc-50 p-4">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-brand-rust text-xs font-bold text-white">
                                1
                            </div>
                            <h4 className="text-xs font-bold text-zinc-900">Admin Review & Confirmation</h4>
                            <p className="text-[11px] text-zinc-500 leading-relaxed">
                                Our logistics coordinator verifies your address and confirms the exact pickup window with our local driver.
                            </p>
                        </div>

                        <div className="space-y-2 rounded-2xl bg-zinc-50 p-4">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-brand-rust text-xs font-bold text-white">
                                2
                            </div>
                            <h4 className="text-xs font-bold text-zinc-900">Pickup & Tracking Assignment</h4>
                            <p className="text-[11px] text-zinc-500 leading-relaxed">
                                When the driver collects your box, an official barcode tracking number is assigned and emailed directly to you.
                            </p>
                        </div>

                        <div className="space-y-2 rounded-2xl bg-zinc-50 p-4">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-brand-rust text-xs font-bold text-white">
                                3
                            </div>
                            <h4 className="text-xs font-bold text-zinc-900">Ocean Freight to Delivery</h4>
                            <p className="text-[11px] text-zinc-500 leading-relaxed">
                                Track sea container departure, Philippine customs clearance, and local door-to-door delivery on our tracking page.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Account Creation Promotion Banner */}
                <div className="mt-8 rounded-3xl border-2 border-emerald-200 bg-linear-to-br from-emerald-50/80 via-white to-emerald-50/40 p-6 md:p-8 shadow-xs">
                    <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                        <div className="space-y-2 max-w-xl">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-0.5 text-[11px] font-bold text-emerald-800">
                                <UserPlus className="size-3.5" />
                                Recommended for frequent senders
                            </div>
                            <h3 className="text-lg font-black text-zinc-900">
                                Create an account to unlock full features
                            </h3>
                            <p className="text-xs text-zinc-600 leading-relaxed">
                                Register now using <strong className="text-zinc-900">{currentBooking.sender.email}</strong> and this booking will automatically link to your new account! You'll be able to:
                            </p>
                            <ul className="grid grid-cols-1 gap-1.5 text-xs text-zinc-700 sm:grid-cols-2 pt-1">
                                <li className="flex items-center gap-1.5">
                                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                                    <span>Track all past & active shipments</span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                                    <span>Save receiver address book</span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                                    <span>Download PDF receipts & invoices</span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                                    <span>1-click rebooking with saved details</span>
                                </li>
                            </ul>
                        </div>

                        <div className="shrink-0 w-full md:w-auto">
                            <a
                                href={registerUrl}
                                className="inline-flex w-full md:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-98"
                            >
                                Create Free Account
                                <ArrowRight className="size-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </MarketingLayout>
    );
}
