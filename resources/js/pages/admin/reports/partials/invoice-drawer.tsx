import { router } from '@inertiajs/react';
import currency from 'currency.js';
import { format, differenceInDays } from 'date-fns';
import {
    Calendar,
    CheckCircle2,
    Clock,
    Copy,
    CreditCard,
    DollarSign,
    Download,
    ExternalLink,
    FileText,
    Mail,
    MapPin,
    Phone,
    ShieldAlert,
    User,
    X,
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

interface InvoiceDrawerProps {
    invoice: any | null;
    isOpen: boolean;
    onClose: () => void;
    currencySymbol?: string;
    referenceDate?: string;
}

export default function InvoiceDrawer({
    invoice,
    isOpen,
    onClose,
    currencySymbol = '$',
    referenceDate,
}: InvoiceDrawerProps) {
    const [confirmingPaymentId, setConfirmingPaymentId] = useState<number | null>(null);

    if (!invoice) return null;

    const formatCurrency = (val: any) =>
        currency(val || 0, { symbol: currencySymbol }).format();

    const isPaymentSettled = (payment: any) => {
        if (!payment) return false;
        if (payment.is_cash_payment) {
            return Boolean(payment.confirmed_at);
        }
        return Boolean(payment.paid_at);
    };

    const settledAmount = (invoice.payments || [])
        .filter(isPaymentSettled)
        .reduce((sum: number, p: any) => sum + Number.parseFloat(p.amount || 0), 0);

    const unconfirmedCashAmount = (invoice.payments || [])
        .filter((p: any) => p.is_cash_payment && !p.confirmed_at)
        .reduce((sum: number, p: any) => sum + Number.parseFloat(p.amount || 0), 0);

    const invoiceTotal = Number.parseFloat(invoice.amount || 0);
    const balance = Math.max(0, invoiceTotal - settledAmount);

    const refDate = referenceDate ? new Date(referenceDate) : new Date();
    const daysOverdue = invoice.due_date
        ? differenceInDays(refDate, new Date(invoice.due_date))
        : 0;

    const sender = invoice.booking?.sender;
    const senderName = sender
        ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'N/A'
        : 'N/A';

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    const handleConfirmCashPayment = (paymentId: number) => {
        setConfirmingPaymentId(paymentId);
        router.post(
            `/admin/payments/${paymentId}/confirm`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Cash payment confirmed and settled.');
                    setConfirmingPaymentId(null);
                },
                onError: (errors) => {
                    toast.error(errors?.error || 'Failed to confirm payment.');
                    setConfirmingPaymentId(null);
                },
            },
        );
    };

    const getStatusBadge = (status: string) => {
        const val = typeof status === 'string' ? status.toLowerCase() : '';
        if (val === 'paid') {
            return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold">Paid</Badge>;
        }
        if (val === 'partial') {
            return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold">Partial</Badge>;
        }
        if (val === 'voided') {
            return <Badge className="bg-gray-500/10 text-gray-600 border border-gray-500/20 font-bold">Voided</Badge>;
        }
        return <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold">Unpaid</Badge>;
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl overflow-y-auto p-0 bg-background border-l border-border"
            >
                {/* Header */}
                <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-md px-6 py-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Invoice Details
                                </span>
                                {getStatusBadge(invoice.status?.value || invoice.status)}
                            </div>
                            <SheetTitle className="text-xl font-black text-foreground mt-1 flex items-center gap-2">
                                {invoice.invoice_number}
                                <button
                                    onClick={() => copyToClipboard(invoice.invoice_number, 'Invoice number')}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    title="Copy invoice number"
                                >
                                    <Copy className="size-4" />
                                </button>
                            </SheetTitle>
                            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                                {invoice.created_at
                                    ? `Issued on ${format(new Date(invoice.created_at), 'MMMM d, yyyy')}`
                                    : 'Invoice record'}
                                {invoice.or_number && ` • Official Receipt: ${invoice.or_number}`}
                            </SheetDescription>
                        </div>
                    </div>

                    {/* Aging Status Banner */}
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/40 px-3.5 py-2.5 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="size-4 text-brand-rust" />
                            <span>Due Date:</span>
                            <span className="font-semibold text-foreground">
                                {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : 'No due date'}
                            </span>
                        </div>
                        {balance > 0 ? (
                            daysOverdue > 0 ? (
                                <span className="font-bold text-rose-600 dark:text-rose-400">
                                    {daysOverdue} days overdue
                                </span>
                            ) : (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    Current (Not yet due)
                                </span>
                            )
                        ) : (
                            <span className="font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="size-3.5" /> Fully Settled
                            </span>
                        )}
                    </div>
                </div>

                <div className="space-y-6 p-6">
                    {/* Financial Balance Summary Card */}
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                            Balance & Settlement Breakdown
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-b border-border/60 pb-4 mb-4">
                            <div>
                                <span className="text-[11px] font-medium text-muted-foreground">Total Invoiced</span>
                                <div className="text-lg font-bold text-foreground">{formatCurrency(invoiceTotal)}</div>
                            </div>
                            <div>
                                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Settled Collections</span>
                                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(settledAmount)}</div>
                            </div>
                        </div>

                        {unconfirmedCashAmount > 0 && (
                            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <div>
                                        <span className="font-bold text-amber-900 dark:text-amber-200">
                                            {formatCurrency(unconfirmedCashAmount)}
                                        </span>{' '}
                                        <span className="text-amber-800/80 dark:text-amber-300/80">
                                            cash in-transit (pending deposit verification)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-baseline justify-between pt-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Open Balance:
                            </span>
                            <span className={`text-2xl font-black ${balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {formatCurrency(balance)}
                            </span>
                        </div>
                    </div>

                    {/* Customer Info Card */}
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Customer Details
                            </span>
                            {sender?.id && (
                                <a
                                    href={`/admin/senders/${sender.id}`}
                                    className="text-xs font-semibold text-brand-rust hover:underline inline-flex items-center gap-1"
                                >
                                    Sender Profile <ExternalLink className="size-3" />
                                </a>
                            )}
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="size-9 rounded-xl bg-brand-warm/20 text-brand-text flex items-center justify-center shrink-0 border border-border">
                                <User className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-foreground text-sm truncate">{senderName}</div>
                                {sender?.email && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                                        <Mail className="size-3 shrink-0" /> {sender.email}
                                    </div>
                                )}
                                {sender?.phone && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                        <Phone className="size-3 shrink-0" /> {sender.phone}
                                    </div>
                                )}
                                {sender?.address && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                        <MapPin className="size-3 shrink-0" /> {sender.address}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Booking Context Card */}
                    {invoice.booking && (
                        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Linked Booking
                                </span>
                                <a
                                    href={`/admin/bookings/${invoice.booking.id}`}
                                    className="text-xs font-semibold text-brand-rust hover:underline inline-flex items-center gap-1"
                                >
                                    View Booking <ExternalLink className="size-3" />
                                </a>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1">
                                <span className="text-muted-foreground">Reference:</span>
                                <span className="font-bold text-foreground font-mono">
                                    {invoice.booking.reference_number || `BK-${invoice.booking.id}`}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Service Type:</span>
                                <span className="font-semibold text-foreground capitalize">
                                    {invoice.booking.service_type || 'Standard Balikbayan'}
                                </span>
                            </div>
                            {invoice.booking.status && (
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Booking Status:</span>
                                    <span className="font-medium text-foreground capitalize">
                                        {invoice.booking.status}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Payment History & In-Transit Actions */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Payment Ledger ({invoice.payments?.length || 0})
                            </span>
                        </div>

                        {(!invoice.payments || invoice.payments.length === 0) ? (
                            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                                No payments recorded on this invoice yet.
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {invoice.payments.map((p: any) => {
                                    const settled = isPaymentSettled(p);
                                    const isPendingCash = p.is_cash_payment && !p.confirmed_at;

                                    return (
                                        <div
                                            key={p.id}
                                            className={`rounded-xl border p-4 text-xs transition-all ${isPendingCash ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card'}`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg ${isPendingCash ? 'bg-amber-500/20 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                                        <CreditCard className="size-3.5" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-foreground">
                                                            {formatCurrency(p.amount)}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground capitalize">
                                                            {p.payment_method?.replace(/_/g, ' ') || 'Manual'}
                                                            {p.reference_number ? ` • Ref: ${p.reference_number}` : ''}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    {settled ? (
                                                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                                                            Settled
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px] font-bold">
                                                            In-Transit Cash
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
                                                <div>
                                                    Paid: {p.paid_at ? format(new Date(p.paid_at), 'MMM d, yyyy h:mm a') : 'N/A'}
                                                </div>
                                                {p.collected_by && (
                                                    <div>
                                                        Collector ID: #{p.collected_by}
                                                    </div>
                                                )}
                                            </div>

                                            {isPendingCash && (
                                                <div className="mt-3 flex items-center justify-end gap-2 border-t border-amber-500/20 pt-2.5">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleConfirmCashPayment(p.id)}
                                                        disabled={confirmingPaymentId === p.id}
                                                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
                                                    >
                                                        {confirmingPaymentId === p.id ? 'Confirming...' : 'Confirm Deposit'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Quick Actions */}
                <div className="sticky bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur-md px-6 py-4 flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Close
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => window.open(`/invoices/${invoice.id}/pdf`, '_blank')}
                        >
                            <Download className="size-3.5" /> PDF
                        </Button>
                        <Button
                            size="sm"
                            className="gap-1.5 bg-brand-rust hover:bg-brand-rust/90 text-white"
                            onClick={() => {
                                if (invoice.booking_id) {
                                    router.visit(`/admin/bookings/${invoice.booking_id}`);
                                }
                            }}
                        >
                            <ExternalLink className="size-3.5" /> Booking
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
