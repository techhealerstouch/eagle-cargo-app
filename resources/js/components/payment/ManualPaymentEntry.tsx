import { useForm } from '@inertiajs/react';
import { Check, Loader2 } from 'lucide-react';
import React, { useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ManualPaymentEntryProps {
    bookingId: number;
    invoiceId: number | null | undefined;
    manualAmountCap: number;
    manualAmount: number;
    activeMethod: string;
    endpoint: string;
    onSuccess?: () => void;
}

const createIdempotencyKey = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export function ManualPaymentEntry({
    bookingId,
    invoiceId,
    manualAmountCap,
    manualAmount,
    activeMethod,
    endpoint,
    onSuccess,
}: ManualPaymentEntryProps) {
    const initialIdempotencyKey = useRef<string>(createIdempotencyKey());

    const { data, setData, post, processing, errors } = useForm({
        amount: manualAmount.toFixed(2),
        payment_method: activeMethod,
        reference_number: '',
        booking_id: bookingId,
        invoice_id: invoiceId ?? null,
        idempotency_key: initialIdempotencyKey.current,
    });

    const rotateManualIdempotencyKey = () => {
        setData('idempotency_key', createIdempotencyKey());
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!endpoint || processing) {
return;
}

        post(endpoint, {
            onSuccess: () => {
                rotateManualIdempotencyKey();
                toast.success(activeMethod === 'cash' ? 'Cash collected, redirecting to runsheet…' : 'Payment recorded, redirecting…');

                if (onSuccess) {
onSuccess();
}
            },
        });
    };

    return (
        <form onSubmit={handleManualSubmit} className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Amount Collected</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm">$</span>
                        <input type="number" step="0.01" value={data.amount}
                            onChange={e => setData('amount', e.target.value)}
                            aria-label="Amount Collected"
                            max={manualAmountCap.toFixed(2)}
                            className="w-full h-12 rounded-xl border border-zinc-200 bg-white font-mono text-lg font-semibold pl-7 focus:border-zinc-900 focus:ring-0 transition-all" />
                    </div>
                    <p className="text-[10px] text-zinc-500">Remaining balance: ${manualAmountCap.toFixed(2)}</p>
                    {errors.amount && <p className="text-red-500 text-[10px]">{errors.amount}</p>}
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Reference / Receipt ID</Label>
                    <input value={data.reference_number}
                        onChange={e => setData('reference_number', e.target.value)}
                        aria-label="Reference Number"
                        className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-4 text-sm focus:border-zinc-900 focus:ring-0 transition-all" placeholder={activeMethod === 'cash' ? 'Optional' : 'Required'} />
                    {errors.reference_number && <p className="text-red-500 text-[10px]">{errors.reference_number}</p>}
                </div>
            </div>
            <Button type="submit" disabled={processing}
                className="w-full h-14 rounded-xl font-bold text-sm bg-zinc-900 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
                {processing ? <><Loader2 className="animate-spin size-4" /> Redirecting…</> : <><Check className="size-4" /> {activeMethod === 'cash' ? 'Cash Collected' : 'Record Payment'}</>}
            </Button>
        </form>
    );
}
