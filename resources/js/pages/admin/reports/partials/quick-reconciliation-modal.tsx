import { router } from '@inertiajs/react';
import currency from 'currency.js';
import { format } from 'date-fns';
import {
    CheckCircle2,
    Clock,
    DollarSign,
    ExternalLink,
    ShieldAlert,
    Truck,
    User,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface QuickReconciliationModalProps {
    isOpen: boolean;
    onClose: () => void;
    unconfirmedPayments: any[];
    currencySymbol?: string;
    onSelectInvoice?: (invoice: any) => void;
}

export default function QuickReconciliationModal({
    isOpen,
    onClose,
    unconfirmedPayments = [],
    currencySymbol = '$',
    onSelectInvoice,
}: QuickReconciliationModalProps) {
    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    const [isBatchConfirming, setIsBatchConfirming] = useState(false);

    const formatCurrency = (val: any) =>
        currency(val || 0, { symbol: currencySymbol }).format();

    const totalPending = unconfirmedPayments.reduce(
        (sum, p) => sum + Number.parseFloat(p.amount || 0),
        0,
    );

    const handleConfirmPayment = (paymentId: number) => {
        setConfirmingId(paymentId);
        router.post(
            `/admin/payments/${paymentId}/confirm`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Cash payment confirmed and deposited into settled collections.');
                    setConfirmingId(null);
                },
                onError: (errors) => {
                    toast.error(errors?.error || 'Failed to confirm payment.');
                    setConfirmingId(null);
                },
            },
        );
    };

    const handleConfirmAll = async () => {
        if (unconfirmedPayments.length === 0) return;
        setIsBatchConfirming(true);

        try {
            for (const p of unconfirmedPayments) {
                await new Promise<void>((resolve, reject) => {
                    router.post(
                        `/admin/payments/${p.id}/confirm`,
                        {},
                        {
                            preserveScroll: true,
                            onSuccess: () => resolve(),
                            onError: (err) => reject(err),
                        },
                    );
                });
            }
            toast.success(`Successfully confirmed and settled all ${unconfirmedPayments.length} payments!`);
            onClose();
        } catch (err: any) {
            toast.error('Failed while processing some confirmations.');
        } finally {
            setIsBatchConfirming(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 bg-background border border-border">
                {/* Header */}
                <DialogHeader className="p-6 border-b border-border bg-card">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20 shrink-0">
                            <Clock className="size-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-black text-foreground">
                                Reconcile In-Transit Courier Cash
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Review physical cash envelopes collected by couriers pending office deposit verification.
                            </DialogDescription>
                        </div>
                    </div>

                    {/* Summary bar */}
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
                        <div className="text-amber-900 dark:text-amber-200">
                            Total Pending Verification:{' '}
                            <span className="font-extrabold text-amber-700 dark:text-amber-300">
                                {formatCurrency(totalPending)}
                            </span>{' '}
                            across {unconfirmedPayments.length} collections
                        </div>

                        {unconfirmedPayments.length > 0 && (
                            <Button
                                size="sm"
                                onClick={handleConfirmAll}
                                disabled={isBatchConfirming}
                                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
                            >
                                {isBatchConfirming ? 'Processing...' : 'Confirm All Deposits'}
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                {/* Body List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {unconfirmedPayments.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                            <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                                <CheckCircle2 className="size-6" />
                            </div>
                            <div className="font-bold text-foreground text-sm">
                                All Cash Deposits Reconciled!
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                There are no outstanding cash payments in transit for this reporting window.
                            </p>
                        </div>
                    ) : (
                        unconfirmedPayments.map((p) => {
                            const collectorName = p.collected_by_user?.name || p.collected_by ? `Courier #${p.collected_by}` : 'Unassigned Driver';
                            const sender = p.invoice?.booking?.sender;
                            const senderName = sender
                                ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()
                                : 'Sender';

                            return (
                                <div
                                    key={p.id}
                                    className="rounded-xl border border-amber-500/25 bg-card p-4 text-xs transition-all hover:border-amber-500/40 shadow-2xs"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base font-black text-foreground">
                                                    {formatCurrency(p.amount)}
                                                </span>
                                                <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px] font-bold">
                                                    In-Transit
                                                </Badge>
                                            </div>

                                            <div className="grid sm:grid-cols-2 gap-1.5 mt-2 text-muted-foreground">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <Truck className="size-3 shrink-0 text-amber-600" />
                                                    <span>Collector:</span>
                                                    <span className="font-semibold text-foreground truncate">
                                                        {collectorName}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <User className="size-3 shrink-0 text-muted-foreground" />
                                                    <span>Sender:</span>
                                                    <span className="font-semibold text-foreground truncate">
                                                        {senderName}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                                                <span>
                                                    Collected:{' '}
                                                    {p.paid_at ? format(new Date(p.paid_at), 'MMM d, yyyy h:mm a') : 'N/A'}
                                                </span>
                                                {p.invoice && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onClose();
                                                            onSelectInvoice?.(p.invoice);
                                                        }}
                                                        className="text-brand-rust hover:underline inline-flex items-center gap-1 font-semibold"
                                                    >
                                                        {p.invoice.invoice_number} <ExternalLink className="size-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            onClick={() => handleConfirmPayment(p.id)}
                                            disabled={confirmingId === p.id}
                                            className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 text-xs shadow-2xs"
                                        >
                                            {confirmingId === p.id ? 'Confirming...' : 'Confirm Deposit'}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 border-t border-border bg-card">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
