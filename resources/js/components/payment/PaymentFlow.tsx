import { Link } from '@inertiajs/react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import {
    RefreshCw,
    Zap,
    Coins,
    Wallet,
    Check,
    Building2,
    Smartphone
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import DeclarationPromptModal from '@/components/common/declaration-prompt-modal';
import { Button } from '@/components/ui/button';
import { ManualPaymentEntry } from './ManualPaymentEntry';
import { PaymentInitiatedState } from './PaymentInitiatedState';
import type { PaymentMethodId, PaymentMethodDefinition } from './PaymentMethodSelector';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { ProofUploadForm } from './ProofUploadForm';
import { StripeCheckoutForm } from './StripeCheckoutForm';
import { SuccessState } from './SuccessState';
import type { PaymentFlowProps } from './types';

let stripePromiseInstance: ReturnType<typeof loadStripe> | null = null;
const getStripe = (key: string) => {
    if (!stripePromiseInstance && key) {
        stripePromiseInstance = loadStripe(key);
    }

    return stripePromiseInstance;
};

const PaymentSkeleton = () => (
    <div className="animate-pulse space-y-8">
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="h-4 w-32 bg-zinc-100 rounded-md" />
                <div className="h-8 w-8 bg-zinc-100 rounded-lg" />
            </div>
            <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-16 bg-zinc-50 rounded-xl border border-zinc-100" />
                ))}
            </div>
        </div>
        <div className="space-y-6">
            <div className="h-48 bg-zinc-50 rounded-[24px] border border-zinc-100" />
            <div className="h-12 bg-zinc-100 rounded-xl w-full" />
        </div>
    </div>
);

export default function PaymentFlow({
    booking,
    stripeKey,
    clientSecret,
    bankDetails,
    onSuccess,
    onStripeLoadError,
    isLoading = false,
    role = 'sender',
    endpoint,
    uploadUrl,
    verifyUrl,
    invoiceId,
    manualAmount,
    manualAmountCap: manualAmountCapProp,
    backUrl = '/dashboard',
    backLabel = 'Return to My Bookings',
}: PaymentFlowProps) {
    const isGuest = role === 'guest';
    const isSenderOrGuest = role === 'sender' || isGuest;
    const defaultUploadUrl = isGuest ? '/guest/booking/upload-proof' : undefined;
    const defaultVerifyUrl = isGuest ? `/guest/bookings/${booking.id}/stripe-verify` : undefined;
    const resolvedUploadUrl = uploadUrl || defaultUploadUrl;
    const resolvedVerifyUrl = verifyUrl || defaultVerifyUrl;
    const guestToken = booking.guest_token;

    const [paymentJustSucceeded, setPaymentJustSucceeded] = useState(false);
    const [proofJustUploaded, setProofJustUploaded] = useState(false);
    const isPaid = booking.payment_status === 'paid' || paymentJustSucceeded;
    const isOfflineInitiated =
        proofJustUploaded ||
        Boolean(booking.proof_of_payment) ||
        Boolean(booking.payment_reference);
    
    const [showDeclarationModal, setShowDeclarationModal] = useState(false);
    const modalHasBeenShown = useRef(false);

    const triggerDeclarationModal = () => {
        const isSubmitted =
            booking.declaration_form_status === 'submitted_online' ||
            booking.declaration_form_status === 'physical_copy_received' ||
            Boolean(booking.declaration_data) ||
            Boolean(booking.declaration_form_path);

        if (isSenderOrGuest && !isSubmitted && !modalHasBeenShown.current) {
            modalHasBeenShown.current = true;
            setShowDeclarationModal(true);
        }
    };

    const [activeMethod, setActiveMethod] = useState<PaymentMethodId>(() => {
        const method = booking.payment_method as PaymentMethodId;
        const isManualRole = role === 'picker' || role === 'admin';
        const senderOnlyMethods: PaymentMethodId[] = ['stripe', 'cash_on_pickup'];

        if (isManualRole && senderOnlyMethods.includes(method)) {
            return 'cash';
        }

        if (method) {
            return method;
        }

        return isSenderOrGuest ? 'stripe' : 'cash';
    });

    const [isChangingMethod, setIsChangingMethod] = useState(false);

    useEffect(() => {
        const isNonStripe = activeMethod && activeMethod !== 'stripe';
        if (isNonStripe) {
            triggerDeclarationModal();
        }
    }, []);

    const totalAmount = (booking.boxes || []).reduce((acc, box) => acc + parseFloat(String(box.price_charged || '0')), 0);
    const resolvedManualAmountCap = Math.max(0, manualAmountCapProp ?? manualAmount ?? totalAmount);
    const resolvedManualAmount = Math.max(0, manualAmount ?? resolvedManualAmountCap);

    const senderMethods: PaymentMethodDefinition[] = [
        { id: 'stripe', label: 'Online Payment', icon: Zap, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
        { id: 'cash_on_pickup', label: 'Payment on Pickup', icon: Wallet, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
        { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2, color: 'bg-blue-50 text-blue-600 border-blue-100' },
        { id: 'pay_id', label: 'PayID', icon: Smartphone, color: 'bg-purple-50 text-purple-600 border-purple-100' },
    ];

    const pickerMethods: PaymentMethodDefinition[] = [
        { id: 'cash', label: 'Cash', icon: Coins, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    ];

    const currentMethods = isSenderOrGuest ? senderMethods : pickerMethods;

    if (isPaid) {
        return <SuccessState booking={booking} backUrl={backUrl} backLabel={backLabel} />;
    }

    if (isLoading) {
        return <PaymentSkeleton />;
    }

    return (
        <div className="animate-in fade-in duration-500">
            {isChangingMethod ? (
                <PaymentMethodSelector
                    methods={currentMethods}
                    activeMethod={activeMethod}
                    onSelect={(m) => {
                        setActiveMethod(m);
                        setIsChangingMethod(false);
                        if (m !== 'stripe') {
                            triggerDeclarationModal();
                        }
                    }}
                    role={role === 'guest' ? 'sender' : role}
                />
            ) : (
                <div className="flex items-center justify-between mb-8 group cursor-pointer" onClick={() => setIsChangingMethod(true)}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${currentMethods.find(m => m.id === activeMethod)?.color || 'bg-zinc-50'}`}>
                            {(() => {
                                const Icon = currentMethods.find(m => m.id === activeMethod)?.icon || Zap;

                                return <Icon className="size-4" />;
                            })()}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-zinc-900 uppercase tracking-widest">{currentMethods.find(m => m.id === activeMethod)?.label || 'Select Method'}</p>
                            <p className="text-[10px] text-zinc-500">Click to change method</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-zinc-400 group-hover:text-zinc-900"><RefreshCw className="size-3 mr-2" /> Change</Button>
                </div>
            )}

            {activeMethod === 'stripe' && stripeKey && clientSecret && (
                <Elements stripe={getStripe(stripeKey)} options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#18181b', borderRadius: '12px' } } }}>
                    <StripeCheckoutForm
                        bookingId={booking.id}
                        verifyUrl={resolvedVerifyUrl}
                        token={guestToken}
                        onSuccess={() => {
                            setPaymentJustSucceeded(true);

                            if (onSuccess) {
                                onSuccess();
                            }
                            triggerDeclarationModal();
                        }}
                        onLoadError={onStripeLoadError}
                    />
                </Elements>
            )}

            {activeMethod === 'cash_on_pickup' && (
                <div className="p-6 sm:p-8 text-center space-y-6 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-3xl border border-emerald-100/50 dark:border-emerald-900/40 animate-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <Coins className="size-10 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 tracking-tight">Ready for Pickup</h4>
                        <p className="text-sm text-emerald-700/80 dark:text-emerald-300 max-w-xs mx-auto leading-relaxed">
                            Our driver will collect <span className="font-black text-emerald-900 dark:text-emerald-50 underline underline-offset-4">${totalAmount.toFixed(2)} AUD</span> in cash during pickup.
                        </p>
                    </div>
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-5 rounded-2xl border border-emerald-100/50 dark:border-zinc-800 text-left space-y-3">
                         <div className="flex items-start gap-3">
                             <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-emerald-600 dark:text-emerald-400" /></div>
                             <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">You will receive a physical receipt on-site.</p>
                         </div>
                         <div className="flex items-start gap-3">
                             <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-emerald-600 dark:text-emerald-400" /></div>
                             <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">No advance payment required.</p>
                         </div>
                         <div className="flex items-start gap-3">
                             <div className="h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-emerald-600 dark:text-emerald-400" /></div>
                             <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Pickup Date: <span className="font-bold">{booking.preferred_date ? new Date(booking.preferred_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'TBA'}</span></p>
                         </div>
                    </div>
                    <Link href={backUrl} className="block pt-2">
                        <Button className="w-full h-12 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none">
                           {backLabel}
                        </Button>
                    </Link>
                </div>
            )}

            {activeMethod === 'bank_transfer' && (
                isOfflineInitiated ? (
                    <PaymentInitiatedState
                        booking={booking}
                        backUrl={backUrl}
                        backLabel={backLabel}
                        uploadUrl={resolvedUploadUrl}
                        token={guestToken}
                        onProofSuccess={() => {
                            setProofJustUploaded(true);
                            triggerDeclarationModal();
                            if (onSuccess) {
                                onSuccess();
                            }
                        }}
                    />
                ) : (
                    <div className="space-y-6 animate-in zoom-in duration-500">
                        <div className="p-6 sm:p-8 text-center space-y-6 bg-blue-50/30 dark:bg-blue-950/20 rounded-3xl border border-blue-100/50 dark:border-blue-900/40">
                            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                <Building2 className="size-10 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-2xl font-bold text-blue-900 dark:text-blue-100 tracking-tight">Bank Transfer</h4>
                                <p className="text-sm text-blue-700/80 dark:text-blue-300 max-w-xs mx-auto leading-relaxed">
                                    Please transfer <span className="font-black text-blue-900 dark:text-blue-50 underline underline-offset-4">${totalAmount.toFixed(2)} AUD</span> using the details below.
                                </p>
                            </div>

                            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-5 rounded-2xl border border-blue-100/60 dark:border-zinc-800 text-left space-y-2.5 text-xs">
                                {bankDetails?.company_name && (
                                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                        <span className="text-zinc-500 dark:text-zinc-400">Account Name</span>
                                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{bankDetails.company_name}</span>
                                    </div>
                                )}
                                {bankDetails?.bank_name && (
                                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                        <span className="text-zinc-500 dark:text-zinc-400">Bank</span>
                                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{bankDetails.bank_name}</span>
                                    </div>
                                )}
                                {bankDetails?.bsb && (
                                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                        <span className="text-zinc-500 dark:text-zinc-400">BSB</span>
                                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{bankDetails.bsb}</span>
                                    </div>
                                )}
                                {bankDetails?.account_number && (
                                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                        <span className="text-zinc-500 dark:text-zinc-400">Account Number</span>
                                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{bankDetails.account_number}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-500 dark:text-zinc-400">Payment Reference</span>
                                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{booking.reference_number}</span>
                                </div>
                            </div>

                            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-5 rounded-2xl border border-blue-100/50 dark:border-zinc-800 text-left space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-blue-600 dark:text-blue-400" /></div>
                                    <p className="text-[11px] font-medium text-blue-800 dark:text-blue-300">Your booking is secured and will be confirmed once payment clears.</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-blue-600 dark:text-blue-400" /></div>
                                    <p className="text-[11px] font-medium text-blue-800 dark:text-blue-300">Upload your receipt below or from your dashboard at any time.</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
                            <div>
                                <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Upload Transfer Receipt</h5>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Attach a screenshot or receipt of your bank transfer to speed up verification.</p>
                            </div>
                            <ProofUploadForm
                                bookingId={booking.id}
                                uploadUrl={resolvedUploadUrl}
                                token={guestToken}
                                onSuccess={() => {
                                    setProofJustUploaded(true);
                                    triggerDeclarationModal();
                                    if (onSuccess) {
                                        onSuccess();
                                    }
                                }}
                            />
                        </div>

                        <Link href={backUrl} className="block pt-2">
                            <Button variant="outline" className="w-full h-12 rounded-xl border-zinc-200 dark:border-zinc-800 font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                {backLabel}
                            </Button>
                        </Link>
                    </div>
                )
            )}

            {activeMethod === 'pay_id' && (
                isOfflineInitiated ? (
                    <PaymentInitiatedState
                        booking={booking}
                        backUrl={backUrl}
                        backLabel={backLabel}
                        uploadUrl={resolvedUploadUrl}
                        token={guestToken}
                        onProofSuccess={() => {
                            setProofJustUploaded(true);
                            triggerDeclarationModal();
                            if (onSuccess) {
                                onSuccess();
                            }
                        }}
                    />
                ) : (
                    <div className="space-y-6 animate-in zoom-in duration-500">
                        <div className="p-6 sm:p-8 text-center space-y-6 bg-purple-50/30 dark:bg-purple-950/20 rounded-3xl border border-purple-100/50 dark:border-purple-900/40">
                            <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                <Smartphone className="size-10 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-2xl font-bold text-purple-900 dark:text-purple-100 tracking-tight">PayID Payment</h4>
                                <p className="text-sm text-purple-700/80 dark:text-purple-300 max-w-xs mx-auto leading-relaxed">
                                    Please send <span className="font-black text-purple-900 dark:text-purple-50 underline underline-offset-4">${totalAmount.toFixed(2)} AUD</span> via PayID.
                                </p>
                            </div>

                            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-5 rounded-2xl border border-purple-100/60 dark:border-zinc-800 text-left space-y-2.5 text-xs">
                                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                    <span className="text-zinc-500 dark:text-zinc-400">Payment Reference / Description</span>
                                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{booking.reference_number}</span>
                                </div>
                                <p className="text-[11px] text-zinc-500">Please make sure to include the booking reference in your transfer description so we can match your payment.</p>
                            </div>

                            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-5 rounded-2xl border border-purple-100/50 dark:border-zinc-800 text-left space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-purple-600 dark:text-purple-400" /></div>
                                    <p className="text-[11px] font-medium text-purple-800 dark:text-purple-300">Your booking is secured and will be confirmed once payment clears.</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-purple-600 dark:text-purple-400" /></div>
                                    <p className="text-[11px] font-medium text-purple-800 dark:text-purple-300">Upload your PayID confirmation receipt below or in your dashboard.</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
                            <div>
                                <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Upload PayID Receipt</h5>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Attach a screenshot of your PayID confirmation to speed up verification.</p>
                            </div>
                            <ProofUploadForm
                                bookingId={booking.id}
                                uploadUrl={resolvedUploadUrl}
                                token={guestToken}
                                onSuccess={() => {
                                    setProofJustUploaded(true);
                                    triggerDeclarationModal();
                                    if (onSuccess) {
                                        onSuccess();
                                    }
                                }}
                            />
                        </div>

                        <Link href={backUrl} className="block pt-2">
                            <Button variant="outline" className="w-full h-12 rounded-xl border-zinc-200 dark:border-zinc-800 font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                {backLabel}
                            </Button>
                        </Link>
                    </div>
                )
            )}

            {role !== 'sender' && role !== 'guest' && activeMethod !== 'stripe' && endpoint && (
                <ManualPaymentEntry
                    bookingId={booking.id}
                    invoiceId={invoiceId}
                    manualAmountCap={resolvedManualAmountCap}
                    manualAmount={resolvedManualAmount}
                    activeMethod={activeMethod}
                    endpoint={endpoint}
                    onSuccess={onSuccess}
                />
            )}

            <DeclarationPromptModal
                isOpen={showDeclarationModal}
                onClose={() => setShowDeclarationModal(false)}
                bookingId={booking.id}
                guestToken={guestToken}
            />
        </div>
    );
}
