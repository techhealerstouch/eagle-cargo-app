import { Link } from '@inertiajs/react';
import {
    Clock,
    CheckCircle2,
    ClipboardList,
    ArrowRight,
    Building2,
    Smartphone,
    FileText,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    ShieldAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProofUploadForm } from './ProofUploadForm';
import type { Booking } from './types';

interface PaymentInitiatedStateProps {
    booking: Booking;
    backUrl?: string;
    backLabel?: string;
    uploadUrl?: string;
    token?: string;
    onProofSuccess?: () => void;
}

export function PaymentInitiatedState({
    booking,
    backUrl = '/dashboard',
    backLabel = 'Return to My Bookings',
    uploadUrl,
    token,
    onProofSuccess,
}: PaymentInitiatedStateProps) {
    const [isUpdatingProof, setIsUpdatingProof] = useState(false);

    const totalAmount = (booking.boxes || []).reduce(
        (acc, box) => acc + parseFloat(box.price_charged || '0'),
        0
    );

    const isDeclarationSubmitted =
        booking.declaration_form_status === 'submitted_online' ||
        booking.declaration_form_status === 'physical_copy_received';

    const isPayId = booking.payment_method === 'pay_id';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Main Status Card */}
            <div className="p-6 sm:p-8 text-center space-y-6 bg-amber-50/40 dark:bg-amber-950/20 rounded-3xl border border-amber-200/60 dark:border-amber-800/40">
                <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center mx-auto shadow-inner text-amber-600 dark:text-amber-400">
                    <Clock className="size-10 animate-pulse" />
                </div>

                <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                        Payment Under Verification
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                        Proof of Payment Submitted
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                        We have received your payment submission for booking{' '}
                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {booking.reference_number}
                        </span>
                        . Our finance team verifies offline transfers within 1–2 business days.
                    </p>
                </div>

                {/* Summary Badges */}
                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 space-y-3.5 text-left text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                        <span className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                            Amount Payable
                        </span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-50 text-sm">
                            ${totalAmount.toFixed(2)} AUD
                        </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                        <span className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                            Payment Method
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
                            {isPayId ? (
                                <>
                                    <Smartphone className="size-3.5 text-purple-600" />
                                    <span>PayID</span>
                                </>
                            ) : (
                                <>
                                    <Building2 className="size-3.5 text-blue-600" />
                                    <span>Bank Transfer</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                            Proof Status
                        </span>
                        {booking.proof_of_payment ? (
                            <a
                                href={`/storage/${booking.proof_of_payment}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
                            >
                                <FileText className="size-3.5" />
                                <span>Receipt Uploaded</span>
                                <ExternalLink className="size-3" />
                            </a>
                        ) : booking.payment_reference ? (
                            <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                                Ref: {booking.payment_reference}
                            </span>
                        ) : (
                            <span className="font-semibold text-amber-600">Proof attached</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Customs Declaration Status / Prompt */}
            {isDeclarationSubmitted ? (
                <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                Customs Declaration Submitted
                            </p>
                            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                                Your declaration details are ready for customs inspection.
                            </p>
                        </div>
                    </div>
                    <Link
                        href={`/track/declaration/${booking.id}`}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 underline underline-offset-2 shrink-0"
                    >
                        View / Print
                    </Link>
                </div>
            ) : (
                <div className="p-6 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 space-y-4">
                    <div className="flex items-start gap-3.5">
                        <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 mt-0.5">
                            <ClipboardList className="size-5" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                                Would you like to fill up your declaration form now?
                            </h4>
                            <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                                Customs declaration is required for every balikbayan box before shipment overseas. Completing it now prevents processing delays.
                            </p>
                        </div>
                    </div>
                    <Link href={`/track/declaration/${booking.id}`} className="block">
                        <Button
                            type="button"
                            className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm"
                        >
                            <span>Fill Up Declaration Form</span>
                            <ArrowRight className="size-4" />
                        </Button>
                    </Link>
                </div>
            )}

            {/* Update / Re-upload Receipt Accordion */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-card overflow-hidden">
                <button
                    type="button"
                    onClick={() => setIsUpdatingProof((prev) => !prev)}
                    className="w-full p-4 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <FileText className="size-4 text-zinc-400" />
                        Need to update or re-upload your payment receipt?
                    </span>
                    {isUpdatingProof ? (
                        <ChevronUp className="size-4 text-zinc-400" />
                    ) : (
                        <ChevronDown className="size-4 text-zinc-400" />
                    )}
                </button>

                {isUpdatingProof && (
                    <div className="p-6 pt-0 border-t border-zinc-100 dark:border-zinc-800 animate-in fade-in duration-300">
                        <ProofUploadForm
                            bookingId={booking.id}
                            uploadUrl={uploadUrl}
                            token={token}
                            onSuccess={() => {
                                setIsUpdatingProof(false);
                                if (onProofSuccess) {
                                    onProofSuccess();
                                }
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Primary Action Button */}
            <Link href={backUrl} className="block pt-2">
                <Button className="w-full h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-bold text-sm shadow-md transition-all">
                    {backLabel}
                </Button>
            </Link>
        </div>
    );
}
export default PaymentInitiatedState;
