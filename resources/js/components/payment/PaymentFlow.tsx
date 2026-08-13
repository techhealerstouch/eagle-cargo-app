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
import type { PaymentMethodId, PaymentMethodDefinition } from './PaymentMethodSelector';
import { PaymentMethodSelector } from './PaymentMethodSelector';
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    bankDetails,
    onSuccess,
    onStripeLoadError,
    isLoading = false,
    role = 'sender',
    endpoint,
    invoiceId,
    manualAmount,
    manualAmountCap: manualAmountCapProp,
    backUrl,
    backLabel,
}: PaymentFlowProps) {
    const [paymentJustSucceeded, setPaymentJustSucceeded] = useState(false);
    const isPaid = booking.payment_status === 'paid' || paymentJustSucceeded;
    
    const [showDeclarationModal, setShowDeclarationModal] = useState(false);
    const modalHasBeenShown = useRef(false);

    const triggerDeclarationModal = () => {
        const needsDec = !booking.declaration_data && !booking.declaration_form_path;
        if (role === 'sender' && needsDec && !modalHasBeenShown.current) {
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

        return role === 'sender' ? 'stripe' : 'cash';
    });

    const [isChangingMethod, setIsChangingMethod] = useState(false);

    useEffect(() => {
        const isNonStripe = activeMethod && activeMethod !== 'stripe';
        if (isNonStripe) {
            triggerDeclarationModal();
        }
    }, []);

    const totalAmount = booking.boxes.reduce((acc, box) => acc + parseFloat(box.price_charged || '0'), 0);
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

    const currentMethods = role === 'sender' ? senderMethods : pickerMethods;

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
                    role={role}
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
<StripeCheckoutForm bookingId={booking.id} onSuccess={() => {
                        setPaymentJustSucceeded(true);

                        if (onSuccess) {
                            onSuccess();
                        }
                        triggerDeclarationModal();
                    }} onLoadError={onStripeLoadError} />
                </Elements>
            )}

            {activeMethod === 'cash_on_pickup' && (
                <div className="p-6 sm:p-8 text-center space-y-6 bg-emerald-50/30 rounded-3xl border border-emerald-100/50 animate-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <Coins className="size-10 text-emerald-600" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-2xl font-bold text-emerald-900 tracking-tight">Ready for Pickup</h4>
                        <p className="text-sm text-emerald-700/80 max-w-xs mx-auto leading-relaxed">
                            Our driver will collect <span className="font-black text-emerald-900 underline underline-offset-4">${totalAmount.toFixed(2)}</span> in cash during pickup.
                        </p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-emerald-100/50 text-left space-y-3">
                         <div className="flex items-start gap-3">
                             <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-emerald-600" /></div>
                             <p className="text-[11px] font-medium text-emerald-800">You will receive a physical receipt on-site.</p>
                         </div>
                         <div className="flex items-start gap-3">
                             <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-emerald-600" /></div>
                             <p className="text-[11px] font-medium text-emerald-800">No advance payment required.</p>
                         </div>
                         <div className="flex items-start gap-3">
                             <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-emerald-600" /></div>
                             <p className="text-[11px] font-medium text-emerald-800">Pickup Date: <span className="font-bold">{booking.preferred_date ? new Date(booking.preferred_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'TBA'}</span></p>
                         </div>
                    </div>
                    <Link href="/dashboard" className="block pt-2">
                        <Button className="w-full h-12 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                           Go to My Bookings
                        </Button>
                    </Link>
                </div>
            )}

            {activeMethod === 'bank_transfer' && (
                <div className="p-6 sm:p-8 text-center space-y-6 bg-blue-50/30 rounded-3xl border border-blue-100/50 animate-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <Building2 className="size-10 text-blue-600" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-2xl font-bold text-blue-900 tracking-tight">Bank Transfer</h4>
                        <p className="text-sm text-blue-700/80 max-w-xs mx-auto leading-relaxed">
                            Please transfer <span className="font-black text-blue-900 underline underline-offset-4">${totalAmount.toFixed(2)}</span> to our bank account.
                        </p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-blue-100/50 text-left space-y-3">
                         <div className="flex items-start gap-3">
                             <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-blue-600" /></div>
                             <p className="text-[11px] font-medium text-blue-800">Your booking is secured and will be confirmed once payment clears.</p>
                         </div>
                         <div className="flex items-start gap-3">
                             <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-blue-600" /></div>
                             <p className="text-[11px] font-medium text-blue-800">You can upload your proof of payment in your dashboard.</p>
                         </div>
                    </div>
                    <Link href="/dashboard" className="block pt-2">
                        <Button className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                           Go to My Bookings
                        </Button>
                    </Link>
                </div>
            )}

            {activeMethod === 'pay_id' && (
                <div className="p-6 sm:p-8 text-center space-y-6 bg-purple-50/30 rounded-3xl border border-purple-100/50 animate-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <Smartphone className="size-10 text-purple-600" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-2xl font-bold text-purple-900 tracking-tight">PayID</h4>
                        <p className="text-sm text-purple-700/80 max-w-xs mx-auto leading-relaxed">
                            Please send <span className="font-black text-purple-900 underline underline-offset-4">${totalAmount.toFixed(2)}</span> via PayID.
                        </p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-purple-100/50 text-left space-y-3">
                         <div className="flex items-start gap-3">
                             <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-purple-600" /></div>
                             <p className="text-[11px] font-medium text-purple-800">Your booking is secured and will be confirmed once payment clears.</p>
                         </div>
                         <div className="flex items-start gap-3">
                             <div className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5"><Check className="size-3 text-purple-600" /></div>
                             <p className="text-[11px] font-medium text-purple-800">You can upload your proof of payment in your dashboard.</p>
                         </div>
                    </div>
                    <Link href="/dashboard" className="block pt-2">
                        <Button className="w-full h-12 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200">
                           Go to My Bookings
                        </Button>
                    </Link>
                </div>
            )}

            {role !== 'sender' && activeMethod !== 'stripe' && endpoint && (
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
            />
        </div>
    );
}
