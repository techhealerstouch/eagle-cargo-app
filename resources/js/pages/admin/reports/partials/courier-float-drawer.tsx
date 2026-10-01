import { router } from '@inertiajs/react';
import currency from 'currency.js';
import { format } from 'date-fns';
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    DollarSign,
    ExternalLink,
    ShieldCheck,
    Truck,
    User,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';

interface CourierFloatDrawerProps {
    courier: any | null;
    payments: any[];
    isOpen: boolean;
    onClose: () => void;
    currencySymbol?: string;
    onSelectInvoice?: (invoice: any) => void;
}

export default function CourierFloatDrawer({
    courier,
    payments = [],
    isOpen,
    onClose,
    currencySymbol = '$',
    onSelectInvoice,
}: CourierFloatDrawerProps) {
    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    const [isBatchConfirming, setIsBatchConfirming] = useState(false);

    if (!courier) return null;

    const formatCurrency = (val: any) =>
        currency(val || 0, { symbol: currencySymbol }).format();

    // Filter payments for this courier
    const courierPayments = payments.filter((p) => {
        if (!courier.collector_id) {
            return !p.collected_by;
        }
        return p.collected_by === courier.collector_id;
    });

    const unconfirmedPayments = courierPayments.filter((p) => !p.confirmed_at);

    const handleConfirmPayment = (paymentId: number) => {
        setConfirmingId(paymentId);
        router.post(
            `/admin/payments/${paymentId}/confirm`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Cash payment confirmed and settled.');
                    setConfirmingId(null);
                },
                onError: (errors) => {
                    toast.error(errors?.error || 'Failed to confirm payment.');
                    setConfirmingId(null);
                },
            },
        );
    };

    const handleBatchConfirmAll = async () => {
        if (unconfirmedPayments.length === 0) return;
        setIsBatchConfirming(true);

        try {
            // Confirm sequentially
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
            toast.success(`Successfully confirmed all ${unconfirmedPayments.length} pending cash payments for ${courier.collector_name}!`);
        } catch (err: any) {
            toast.error('Failed while batch confirming some payments.');
        } finally {
            setIsBatchConfirming(false);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl overflow-y-auto p-0 bg-background border-l border-border"
            >
                {/* Header */}
                <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-md px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20 shrink-0">
                            <Truck className="size-5" />
                        </div>
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Courier Cash Custody & Float
                            </span>
                            <SheetTitle className="text-xl font-black text-foreground mt-0.5">
                                {courier.collector_name}
                            </SheetTitle>
                            <SheetDescription className="text-xs text-muted-foreground">
                                {courier.collector_id ? `Collector ID: #${courier.collector_id}` : 'Unassigned / System Admin'}{' '}
                                • {courier.count} total cash collections
                            </SheetDescription>
                        </div>
                    </div>

                    {/* Summary KPI Cards */}
                    <div className="mt-5 grid grid-cols-3 gap-2.5">
                        <div className="rounded-xl border border-border bg-muted/30 p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Total Handled
                            </span>
                            <div className="text-base font-black text-foreground mt-0.5">
                                {formatCurrency(courier.total)}
                            </div>
                        </div>
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                Banked
                            </span>
                            <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                                {formatCurrency(courier.confirmed_total)}
                            </div>
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                In-Transit
                            </span>
                            <div className="text-base font-black text-amber-700 dark:text-amber-300 mt-0.5">
                                {formatCurrency(courier.unconfirmed_total)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Batch Action Banner */}
                    {unconfirmedPayments.length > 0 && (
                        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                                <Clock className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    <div className="font-bold text-amber-900 dark:text-amber-200">
                                        {unconfirmedPayments.length} Pending Cash Envelopes
                                    </div>
                                    <div className="text-amber-800/80 dark:text-amber-300/80">
                                        Total of {formatCurrency(courier.unconfirmed_total)} awaiting physical office check-in.
                                    </div>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                onClick={handleBatchConfirmAll}
                                disabled={isBatchConfirming}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 text-xs shadow-2xs"
                            >
                                {isBatchConfirming ? 'Processing...' : 'Confirm All'}
                            </Button>
                        </div>
                    )}

                    {/* Cash Payments Ledger */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Collection History ({courierPayments.length})
                            </span>
                        </div>

                        {courierPayments.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                                No individual cash records found in this reporting window.
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {courierPayments.map((p) => {
                                    const isPending = !p.confirmed_at;
                                    const sender = p.invoice?.booking?.sender;
                                    const senderName = sender
                                        ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()
                                        : 'Sender';

                                    return (
                                        <div
                                            key={p.id}
                                            className={`rounded-xl border p-4 text-xs transition-all ${isPending ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card'}`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-foreground text-sm">
                                                            {formatCurrency(p.amount)}
                                                        </span>
                                                        {isPending ? (
                                                            <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px] font-bold">
                                                                In-Transit Float
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                                                                Confirmed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-muted-foreground mt-1">
                                                        Customer:{' '}
                                                        <span className="font-semibold text-foreground">
                                                            {senderName}
                                                        </span>
                                                    </div>
                                                </div>

                                                {p.invoice && (
                                                    <button
                                                        onClick={() => onSelectInvoice?.(p.invoice)}
                                                        className="text-xs font-semibold text-brand-rust hover:underline inline-flex items-center gap-1"
                                                    >
                                                        {p.invoice.invoice_number} <ExternalLink className="size-3" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
                                                <div>
                                                    Collected: {p.paid_at ? format(new Date(p.paid_at), 'MMM d, yyyy h:mm a') : 'N/A'}
                                                </div>
                                                {p.confirmed_at ? (
                                                    <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                                                        Settled: {format(new Date(p.confirmed_at), 'MMM d, yyyy')}
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleConfirmPayment(p.id)}
                                                        disabled={confirmingId === p.id}
                                                        className="h-6 px-2.5 text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-bold"
                                                    >
                                                        {confirmingId === p.id ? 'Confirming...' : 'Confirm'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur-md px-6 py-4 flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Close
                    </Button>
                    {courier.collector_id && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => router.visit(`/admin/users/${courier.collector_id}`)}
                        >
                            <User className="size-3.5" /> Courier Profile
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
