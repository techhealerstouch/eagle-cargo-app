import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Banknote, ShieldAlert, User, Wallet } from 'lucide-react';

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
    const defaultMethod = picker?.preferred_payout_method as PayoutMethod || (hasStripe ? 'stripe' : 'cash');
    
    const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>(defaultMethod);
    const [payoutProvider, setPayoutProvider] = useState(picker?.ewallet_details?.provider || '');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen && picker) {
            const method = picker.preferred_payout_method as PayoutMethod || (hasStripe ? 'stripe' : 'cash');
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-brand-rust">
                            <Banknote className="size-5 text-brand-secondary" />
                            Process Commission Payout
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            You are about to process a payout of <strong className="text-foreground">${parseFloat(picker?.pending_amount || 0).toFixed(2)}</strong> for <strong>{picker?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="flex gap-3 bg-amber-50 border border-amber-200/50 p-3 rounded-xl text-amber-800 text-xs">
                            <ShieldAlert className="size-5 shrink-0 text-amber-600 mt-0.5" />
                            <div>
                                <p className="font-bold">Confirm Action</p>
                                <p className="text-amber-700/90 mt-0.5">
                                    This will mark all {picker?.pending_count || 0} pending commissions as paid using the selected payout method.
                                </p>
                            </div>
                        </div>

                        {/* Picker's saved payout info (read-only) */}
                        {(ewalletAccount || hasStripe) && (
                            <div className="flex gap-3 bg-blue-50 border border-blue-200/50 p-3 rounded-xl text-blue-800 text-xs">
                                <Wallet className="size-5 shrink-0 text-blue-600 mt-0.5" />
                                <div className="min-w-0">
                                    <p className="font-bold">Picker's Saved Payout Info</p>
                                    {ewalletAccount && (
                                        <p className="text-blue-700/90 mt-0.5">
                                            E-wallet: <strong className="capitalize">{ewalletProvider || 'N/A'}</strong> — <strong>{ewalletAccount}</strong>
                                        </p>
                                    )}
                                    {hasStripe && (
                                        <p className="text-blue-700/90 mt-0.5">
                                            Stripe: <strong>Connected ✓</strong>
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="payout-method" className="text-xs font-black uppercase text-muted-foreground">
                                Payout Method
                            </Label>
                            <Select value={payoutMethod} onValueChange={(value) => setPayoutMethod(value as PayoutMethod)} disabled={isProcessing}>
                                <SelectTrigger id="payout-method" className="h-11 w-full rounded-xl border-brand-warm/30 bg-white">
                                    <SelectValue placeholder="Choose payout method" />
                                </SelectTrigger>
                                <SelectContent>
                                    {hasStripe && <SelectItem value="stripe">Stripe transfer</SelectItem>}
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="ewallet">E-wallet</SelectItem>
                                </SelectContent>
                            </Select>
                            {!hasStripe && (
                                <p className="text-[11px] text-muted-foreground">
                                    Stripe is not connected for this picker. Use cash or e-wallet for a manual payout.
                                </p>
                            )}
                        </div>

                        {payoutMethod === 'ewallet' && (
                            <div className="grid gap-2">
                                <Label htmlFor="payout-provider" className="text-xs font-black uppercase text-muted-foreground">
                                    E-wallet Provider
                                </Label>
                                <Select value={payoutProvider} onValueChange={setPayoutProvider} disabled={isProcessing}>
                                    <SelectTrigger id="payout-provider" className="h-11 w-full rounded-xl border-brand-warm/30 bg-white">
                                        <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="paypal">PayPal</SelectItem>
                                        <SelectItem value="payid">PayID</SelectItem>
                                        <SelectItem value="wise">Wise</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid gap-2 mt-2">
                            <Label htmlFor="reference-number" className="text-xs font-black uppercase text-muted-foreground">
                                Admin Reference Number
                            </Label>
                            <Input
                                id="reference-number"
                                type="text"
                                placeholder={
                                    payoutMethod === 'cash' 
                                        ? 'e.g. Cash receipt #, voucher #' 
                                        : payoutMethod === 'ewallet' 
                                            ? 'e.g. PayPal transaction ID' 
                                            : 'e.g. Stripe transfer ID'
                                }
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                disabled={isProcessing}
                                required={true}
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Enter the transaction/receipt ID after sending the payment externally. This is crucial for record keeping.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="notes" className="text-xs font-black uppercase text-muted-foreground">
                                Notes <span className="font-normal normal-case">(Optional)</span>
                            </Label>
                            <textarea
                                id="notes"
                                className="flex min-h-[60px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                                placeholder="e.g. Includes holiday bonus, partial payout, etc."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={isProcessing}
                                maxLength={1000}
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="success" disabled={isProcessing}>
                            {isProcessing ? 'Processing...' : 'Confirm Payout'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}