import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Loader2, AlertCircle, Lock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function StripeCheckoutForm({
    bookingId,
    onSuccess,
    onLoadError,
}: {
    bookingId: number;
    onSuccess?: () => void;
    onLoadError?: (message?: string) => void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isElementLoading, setIsElementLoading] = useState(true);
    const [isElementReady, setIsElementReady] = useState(false);
    const submittedRef = useRef(false);

    useEffect(() => {
        if (isElementReady || errorMessage) {
            return;
        }

        const timeout = window.setTimeout(() => {
            const message = 'Payment fields are taking longer than expected to load.';
            setErrorMessage(message);
            setIsElementLoading(false);

            if (onLoadError) {
                onLoadError(message);
            }
        }, 10000);

        return () => window.clearTimeout(timeout);
    }, [errorMessage, isElementReady, onLoadError]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements || submittedRef.current) {
            return;
        }

        submittedRef.current = true;
        setIsProcessing(true);
        setErrorMessage(null);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: `${window.location.origin}/bookings?payment=success` },
            redirect: 'if_required',
        });

        if (error) {
            setErrorMessage(error.message ?? 'An unexpected error occurred.');
            submittedRef.current = false;
            setIsProcessing(false);
        } else {
            // Notify backend wrapper to immediately sync
            if (paymentIntent && paymentIntent.status === 'succeeded') {
                try {
                    const getXsrfToken = () => {
                        const match = document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'));

                        return match ? decodeURIComponent(match[3]) : '';
                    };
                    await fetch(`/bookings/${bookingId}/stripe-verify`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-XSRF-TOKEN': getXsrfToken(),
                            'Accept': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        body: JSON.stringify({ payment_intent: paymentIntent.id }),
                    });
                } catch (e) {
                    console.error('Verification call failed', e);
                }
            }

            if (onSuccess) {
                onSuccess();
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
            {isElementLoading && !errorMessage && (
                <div className="flex min-h-24 items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50 text-xs font-bold uppercase tracking-widest text-zinc-500">
                    <Loader2 className="mr-2 size-4 animate-spin" /> Loading payment fields
                </div>
            )}
            <PaymentElement
                onLoaderStart={() => setIsElementLoading(true)}
                onReady={() => {
                    setIsElementLoading(false);
                    setIsElementReady(true);
                    setErrorMessage(null);
                }}
                onLoadError={(event: any) => {
                    const message = event?.error?.message || 'Unable to load Stripe payment fields.';
                    setIsElementLoading(false);
                    setIsElementReady(false);
                    setErrorMessage(message);

                    if (onLoadError) {
onLoadError(message);
}
                }}
            />
            {errorMessage && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                    <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-500" />
                    <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
            )}
            <Button type="submit" disabled={!stripe || !isElementReady || isProcessing}
                className="w-full h-14 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 bg-zinc-900 text-white">
                {isProcessing ? <><Loader2 className="size-4 animate-spin" /> Processing...</> : <><Lock className="size-4" /> Pay Now</>}
            </Button>
        </form>
    );
}
