import { Head, Link, useForm } from '@inertiajs/react';
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
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import MarketingLayout from '@/layouts/marketing-layout';

interface BankDetails {
    bankName: string;
    accountName: string;
    bankBsb: string;
    bankAccount: string;
}

interface BookingConfirmedProps {
    booking: {
        id: number;
        reference_number: string;
        guest_token?: string;
        declaration_form_status?: string;
        declaration_form_path?: string | null;
        needs_declaration?: boolean;
        has_proof_of_payment?: boolean;
        preferred_date: string;
        payment_method: string;
        payment_status: string;
        status: string;
        created_at: string;
        boxes_count: number;
        total_amount: number | null;
        sender: {
            first_name: string;
            last_name: string;
            name: string;
            email: string;
            mobile: string;
            address: string;
            suburb: string;
            state: string;
            postcode: string;
        };
        boxes: Array<{
            box_type: string;
            recipient_name: string;
            destination: string;
            tracking_number: string | null;
            price_charged: number;
        }>;
    };
    bankDetails?: BankDetails;
}

export default function BookingConfirmed({ booking, bankDetails }: BookingConfirmedProps) {
    const [copied, setCopied] = useState(false);
    const [bankCopied, setBankCopied] = useState(false);
    const [proofPreview, setProofPreview] = useState<string | null>(null);

    const {
        data: proofData,
        setData: setProofData,
        post: postProof,
        processing: uploadingProof,
        reset: resetProof,
    } = useForm<{
        booking_id: number;
        token: string;
        proof_of_payment: File | null;
    }>({
        booking_id: booking.id,
        token: booking.guest_token || '',
        proof_of_payment: null,
    });

    const handleCopy = () => {
        if (!booking.reference_number) return;
        navigator.clipboard.writeText(booking.reference_number);
        setCopied(true);
        toast.success(`Copied ${booking.reference_number} to clipboard!`);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleCopyBankDetails = () => {
        if (!bankDetails) return;
        const text = `Account Name: ${bankDetails.accountName}\nBank: ${bankDetails.bankName}\nBSB: ${bankDetails.bankBsb}\nAccount Number: ${bankDetails.bankAccount}\nReference: ${booking.reference_number}${booking.total_amount !== null ? `\nAmount: $${booking.total_amount.toFixed(2)} AUD` : ''}`;
        navigator.clipboard.writeText(text);
        setBankCopied(true);
        toast.success('Bank details copied to clipboard!');
        setTimeout(() => setBankCopied(false), 2500);
    };

    const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setProofData('proof_of_payment', file);

        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = ev => setProofPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setProofPreview(null);
        }
    };

    const handleUploadProof = (e: React.FormEvent) => {
        e.preventDefault();
        if (!proofData.proof_of_payment || uploadingProof) return;

        postProof('/guest/booking/upload-proof', {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                toast.success('Proof of payment uploaded successfully! Our team will verify it shortly.');
                resetProof();
                setProofPreview(null);
            },
            onError: () => {
                toast.error('Failed to upload proof of payment. Please ensure file is valid (JPG, PNG, PDF up to 5MB).');
            },
        });
    };

    const registerUrl = `/register?email=${encodeURIComponent(booking.sender.email)}&name=${encodeURIComponent(booking.sender.name)}`;
    const trackingUrl = `/track?tracking_number=${encodeURIComponent(booking.reference_number)}`;

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
                            Thank you, {booking.sender.first_name}!
                        </h1>
                        <p className="mx-auto max-w-xl text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            Your pickup request has been recorded in our system. A confirmation email has been dispatched to{' '}
                            <strong className="text-zinc-900 dark:text-zinc-200">{booking.sender.email}</strong>.
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
                            {booking.reference_number}
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
                {booking.needs_declaration || booking.declaration_form_status === 'missing' ? (
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
                                        Philippine Customs requires an itemized packing list for every Balikbayan box. Complete it now online, or open the link we sent to your email (<strong>{booking.sender.email}</strong>) when packing.
                                    </p>
                                </div>
                            </div>

                            <a
                                href={`/track/declaration/${booking.id}?token=${encodeURIComponent(booking.guest_token || '')}`}
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

                {/* Bank Transfer Instructions Card */}
                {booking.payment_method === 'bank_transfer' && booking.payment_status !== 'paid' && bankDetails && (
                    <div className="my-8 overflow-hidden rounded-3xl border-2 border-blue-200 bg-linear-to-br from-blue-50/90 via-white to-blue-50/40 p-6 md:p-8 shadow-xs">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-blue-100">
                            <div className="flex items-start gap-4">
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                                    <Building2 className="size-6 stroke-[2.2]" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-900">
                                            Payment Instructions
                                        </span>
                                        <span className="text-[11px] font-semibold text-blue-800">
                                            Bank Transfer (Direct Deposit)
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-zinc-900">
                                        Transfer Details for {booking.reference_number}
                                    </h3>
                                    <p className="text-xs text-zinc-600 leading-relaxed max-w-xl">
                                        Please transfer your payment via your online banking app. Always enter your booking reference as the payment description.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleCopyBankDetails}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 shrink-0 w-full md:w-auto text-center cursor-pointer"
                            >
                                {bankCopied ? (
                                    <>
                                        <CheckCircle2 className="size-4 text-white" />
                                        Details Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="size-4" />
                                        Copy Bank Details
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Account Details Grid */}
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                            <div className="p-3.5 rounded-2xl bg-white border border-blue-100/80 shadow-2xs">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Account Name</p>
                                <p className="text-sm font-bold text-zinc-900 mt-0.5">{bankDetails.accountName}</p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-white border border-blue-100/80 shadow-2xs">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Bank / BSB</p>
                                <p className="text-sm font-bold text-zinc-900 mt-0.5 font-mono">{bankDetails.bankBsb}</p>
                                <p className="text-[10px] text-zinc-500">{bankDetails.bankName}</p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-white border border-blue-100/80 shadow-2xs">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Account Number</p>
                                <p className="text-sm font-bold text-zinc-900 mt-0.5 font-mono">{bankDetails.bankAccount}</p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-2xs">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Required Reference</p>
                                <p className="text-sm font-black text-amber-950 mt-0.5 font-mono">{booking.reference_number}</p>
                                {booking.total_amount !== null && (
                                    <p className="text-[11px] font-bold text-amber-900 mt-0.5">Amount: ${booking.total_amount.toFixed(2)} AUD</p>
                                )}
                            </div>
                        </div>

                        {/* Receipt Upload Section */}
                        <div className="mt-6 pt-6 border-t border-blue-100/80">
                            {booking.has_proof_of_payment ? (
                                <div className="rounded-2xl bg-emerald-50 border border-emerald-200/80 p-4 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="size-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                                            <CheckCircle2 className="size-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-emerald-900">Payment Receipt Submitted</p>
                                            <p className="text-[11px] text-emerald-700">Thank you! Our accounts team will verify your transfer and update your booking status.</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div>
                                        <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Upload Transfer Receipt / Screenshot</h4>
                                        <p className="text-[11px] text-zinc-500">Already transferred? Upload a screenshot of your bank receipt so we can verify your payment faster.</p>
                                    </div>

                                    <form onSubmit={handleUploadProof} className="space-y-3">
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                            <div className="relative flex-1">
                                                <input
                                                    type="file"
                                                    id="proof_upload_input"
                                                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                                                    onChange={handleProofFileChange}
                                                    className="sr-only"
                                                />
                                                <label
                                                    htmlFor="proof_upload_input"
                                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 cursor-pointer shadow-2xs transition-all w-full"
                                                >
                                                    <Upload className="size-4 text-zinc-400 shrink-0" />
                                                    <span className="truncate">
                                                        {proofData.proof_of_payment ? proofData.proof_of_payment.name : 'Choose receipt image or PDF (max 5MB)...'}
                                                    </span>
                                                </label>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={uploadingProof || !proofData.proof_of_payment}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-black disabled:bg-zinc-300 disabled:cursor-not-allowed text-white px-5 py-2.5 text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
                                            >
                                                {uploadingProof ? (
                                                    <>
                                                        <Loader2 className="size-3.5 animate-spin" />
                                                        Uploading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="size-3.5" />
                                                        Submit Receipt
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {proofPreview && (
                                            <div className="relative inline-block mt-2">
                                                <img src={proofPreview} alt="Receipt Preview" className="h-24 w-auto rounded-xl border border-zinc-200 object-cover shadow-2xs" />
                                            </div>
                                        )}
                                    </form>
                                </div>
                            )}
                        </div>

                        <p className="mt-4 text-[11px] text-zinc-500 italic">
                            * Note: Direct bank transfers usually clear within 1–2 hours (or instantly via Osko/PayID). You can also reply to your confirmation email with the transfer receipt or present it to the driver upon box pickup.
                        </p>
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
                                    {booking.preferred_date || 'To be scheduled'}
                                </span>
                            </p>
                            <p>
                                <strong className="text-zinc-900">Pickup Address:</strong>{' '}
                                {booking.sender?.address}, {booking.sender?.suburb} {booking.sender?.state}{' '}
                                {booking.sender?.postcode}
                            </p>
                            <p>
                                <strong className="text-zinc-900">Contact:</strong> {booking.sender?.mobile}
                            </p>
                            <p>
                                <strong className="text-zinc-900">Email:</strong> {booking.sender?.email}
                            </p>
                            <p>
                                <strong className="text-zinc-900">Payment:</strong>{' '}
                                {formatPaymentMethod(booking.payment_method)} (
                                <span className="capitalize">{booking.payment_status}</span>)
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
                                <span className="font-bold text-zinc-900">{booking.boxes_count}</span>
                            </p>
                            {(booking.boxes || []).map((b, idx) => (
                                <div key={idx} className="rounded-xl bg-zinc-50 p-2.5 space-y-1">
                                    <p className="font-bold text-zinc-900">
                                        Box #{idx + 1}: {b.box_type}
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
                            {booking.total_amount !== null && (
                                <p className="pt-2 text-right text-sm font-black text-brand-rust">
                                    Total: ${booking.total_amount.toFixed(2)} AUD
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
                                Register now using <strong className="text-zinc-900">{booking.sender.email}</strong> and this booking will automatically link to your new account! You'll be able to:
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
