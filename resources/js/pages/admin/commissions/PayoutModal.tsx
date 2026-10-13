import { useState, useEffect } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { 
    Banknote, 
    CreditCard, 
    Wallet, 
    Coins, 
    ShieldCheck, 
    AlertCircle, 
    User, 
    FileText,
    CheckCircle2,
    RefreshCw
} from 'lucide-react';

export type PayoutMethod = 'stripe' | 'cash' | 'ewallet';

export type PayoutPayload = {
    payout_method: PayoutMethod;
    payout_provider?: string;
    reference_number?: string;
    notes?: string;
};

export default function PayoutModal({
    picker,
    isOpen,
    onClose,
    onConfirm,
    isProcessing
}: {
    picker: any;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payload: PayoutPayload) => void;
    isProcessing: boolean;
}) {
    const hasStripe = Boolean(picker?.stripe_account_id && picker?.stripe_onboarding_completed);
    const defaultMethod = (picker?.preferred_payout_method as PayoutMethod) || (hasStripe ? 'stripe' : 'cash');
    
    const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>(defaultMethod);
    const [payoutProvider, setPayoutProvider] = useState(picker?.ewallet_details?.provider || '');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen && picker) {
            const method = (picker.preferred_payout_method as PayoutMethod) || (hasStripe ? 'stripe' : 'cash');
            setPayoutMethod(method);
            setPayoutProvider(picker.ewallet_details?.provider || '');
            setReferenceNumber('');
            setNotes('');
        }
    }, [isOpen, picker, hasStripe]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        onConfirm({
            payout_method: payoutMethod,
            payout_provider: payoutMethod === 'ewallet' ? payoutProvider.trim() : undefined,
            reference_number: referenceNumber.trim() || undefined,
            notes: notes.trim() || undefined,
        });
    };

    const ewalletAccount = picker?.ewallet_details?.account;
    const ewalletProvider = picker?.ewallet_details?.provider;
    const pendingAmount = parseFloat(picker?.pending_amount || 0);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg p-0 gap-0 rounded-2xl border-border/80 shadow-xl overflow-hidden">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="p-6 border-b border-border/60 bg-muted/20">
                        <DialogHeader className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                        <Banknote className="size-5" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                                            Process Commission Payout
                                        </DialogTitle>
                                        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                            Disburse unsettled earnings for {picker?.name}.
                                        </DialogDescription>
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        {/* Amount Overview Card */}
                        <div className="mt-4 p-4 rounded-xl bg-card border border-border/70 flex items-center justify-between shadow-2xs">
                            <div className="space-y-0.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Payable Balance
                                </span>
                                <p className="text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                                    ${pendingAmount.toFixed(2)}
                                </p>
                            </div>
                            <div className="text-right space-y-1">
                                <Badge variant="outline" className="text-xs font-semibold">
                                    {picker?.pending_count || 0} {(picker?.pending_count || 0) === 1 ? 'Box' : 'Boxes'} Unsettled
                                </Badge>
                                <p className="text-[10px] text-muted-foreground">{picker?.email}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Saved info pill */}
                        {(ewalletAccount || hasStripe) && (
                            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs space-y-1">
                                <div className="flex items-center gap-2 font-bold text-blue-600 dark:text-blue-400">
                                    <Wallet className="size-3.5" />
                                    <span>Registered Payout Details</span>
                                </div>
                                {hasStripe && (
                                    <p className="text-muted-foreground text-[11px] pl-5">
                                        • Stripe Connect account active & ready for instant transfer.
                                    </p>
                                )}
                                {ewalletAccount && (
                                    <p className="text-muted-foreground text-[11px] pl-5">
                                        • {ewalletProvider?.toUpperCase()}: <span className="font-semibold text-foreground">{ewalletAccount}</span>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Method Selection */}
                        <div className="space-y-2.5">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Disbursement Channel
                            </Label>
                            
                            <div className="grid grid-cols-3 gap-2.5">
                                {hasStripe && (
                                    <button
                                        type="button"
                                        onClick={() => setPayoutMethod('stripe')}
                                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                                            payoutMethod === 'stripe'
                                                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500'
                                                : 'border-border/70 hover:border-border text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <CreditCard className="size-4" />
                                        <span className="text-xs font-bold">Stripe</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setPayoutMethod('cash')}
                                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                                        payoutMethod === 'cash'
                                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                                            : 'border-border/70 hover:border-border text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Coins className="size-4" />
                                    <span className="text-xs font-bold">Cash</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPayoutMethod('ewallet')}
                                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                                        payoutMethod === 'ewallet'
                                            ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500'
                                            : 'border-border/70 hover:border-border text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Wallet className="size-4" />
                                    <span className="text-xs font-bold">E-Wallet</span>
                                </button>
                            </div>
                        </div>

                        {payoutMethod === 'ewallet' && (
                            <div className="space-y-2">
                                <Label htmlFor="payout-provider" className="text-xs font-bold text-foreground">
                                    E-Wallet Provider
                                </Label>
                                <Select value={payoutProvider} onValueChange={setPayoutProvider} disabled={isProcessing}>
                                    <SelectTrigger id="payout-provider" className="h-10 rounded-xl">
                                        <SelectValue placeholder="Select e-wallet service" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="paypal">PayPal</SelectItem>
                                        <SelectItem value="payid">PayID (Australia)</SelectItem>
                                        <SelectItem value="wise">Wise</SelectItem>
                                        <SelectItem value="gcash">GCash</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Reference Number */}
                        <div className="space-y-2">
                            <Label htmlFor="reference-number" className="text-xs font-bold text-foreground">
                                Transaction / Receipt Reference <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                id="reference-number"
                                type="text"
                                placeholder={
                                    payoutMethod === 'cash' 
                                        ? 'e.g. CASH-REC-2026-001' 
                                        : payoutMethod === 'ewallet' 
                                            ? 'e.g. PP-TRANS-98231' 
                                            : 'e.g. ch_3MtwL24xYD3'
                                }
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                disabled={isProcessing}
                                required
                                className="h-10 text-xs rounded-xl"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                External payment confirmation or voucher ID for reconciliation audit logs.
                            </p>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes" className="text-xs font-semibold text-foreground">
                                Audit Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                            </Label>
                            <textarea
                                id="notes"
                                rows={2}
                                className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                                placeholder="Add notes for this payout (e.g. Includes distance bonus adjustment)..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={isProcessing}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-3">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={onClose} 
                            disabled={isProcessing}
                            className="h-10 px-5 rounded-xl text-sm font-semibold border-border/80 hover:bg-muted/60 transition-all"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit"
                            disabled={isProcessing || !referenceNumber.trim()}
                            className="h-10 px-6 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <RefreshCw className="size-4 animate-spin" />
                                    <span>Processing Disbursal...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="size-4" />
                                    <span>Confirm & Disburse ${pendingAmount.toFixed(2)}</span>
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}