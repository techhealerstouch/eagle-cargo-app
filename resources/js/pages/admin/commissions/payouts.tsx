import { Head, Link } from '@inertiajs/react';
import { 
    History, 
    ArrowLeft, 
    CreditCard, 
    Coins, 
    Wallet, 
    Calendar, 
    Sliders,
    CheckCircle2, 
    DollarSign,
    User,
    Check,
    Copy,
    Building2
} from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import Pagination from '@/components/common/pagination';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface PayoutRecord {
    id: number;
    picker_id: number;
    total_amount: string | number;
    payout_method: 'stripe' | 'cash' | 'ewallet' | string;
    payout_provider?: string | null;
    reference_number?: string | null;
    notes?: string | null;
    paid_at: string;
    created_at: string;
    picker?: {
        id: number;
        name: string;
        email: string;
    };
    processed_by_user?: {
        id: number;
        name: string;
    };
}

interface Props {
    payouts: {
        data: PayoutRecord[];
        current_page: number;
        from: number | null;
        last_page: number;
        per_page: number;
        to: number | null;
        total: number;
        links: any[];
    };
}

export default function AdminPayoutsHistory({ payouts }: Props) {
    const [copiedRef, setCopiedRef] = useState<string | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Commissions', href: '/admin/commissions' },
        { title: 'Payout History', href: '#' },
    ];

    const handleCopyRef = (ref: string) => {
        navigator.clipboard.writeText(ref);
        setCopiedRef(ref);
        setTimeout(() => setCopiedRef(null), 2000);
    };

    const totalDisbursedThisPage = payouts.data.reduce(
        (sum, p) => sum + parseFloat(String(p.total_amount || 0)), 
        0
    );

    const stripeCount = payouts.data.filter(p => p.payout_method === 'stripe').length;
    const manualCount = payouts.data.filter(p => p.payout_method === 'cash' || p.payout_method === 'ewallet').length;

    const renderMethodBadge = (payout: PayoutRecord) => {
        switch (payout.payout_method) {
            case 'stripe':
                return (
                    <Badge className="text-[10px] uppercase font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 gap-1 hover:bg-indigo-500/15">
                        <CreditCard className="size-3" />
                        Stripe
                    </Badge>
                );
            case 'cash':
                return (
                    <Badge className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 gap-1 hover:bg-emerald-500/15">
                        <Coins className="size-3" />
                        Cash
                    </Badge>
                );
            case 'ewallet':
                return (
                    <Badge className="text-[10px] uppercase font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 gap-1 hover:bg-sky-500/15">
                        <Wallet className="size-3" />
                        {payout.payout_provider ? `E-Wallet (${payout.payout_provider})` : 'E-Wallet'}
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                        {payout.payout_method || 'Standard'}
                    </Badge>
                );
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Payout History | Admin" />

            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin/commissions"
                            className="rounded-xl p-2.5 bg-card border border-border/80 text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground shadow-2xs shrink-0"
                            title="Back to Commissions Ledger"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                        <div>
                            <Heading
                                eyebrow="Financial Operations"
                                title="Payout History"
                                description="Audit trail and disbursement confirmations for all picker commission payouts."
                            />
                        </div>
                    </div>

                    <Link href="/admin/commissions">
                        <Button 
                            variant="outline"
                            className="h-10 px-5 rounded-xl border-border/80 bg-card hover:bg-muted/60 text-foreground font-semibold gap-2 shadow-2xs text-sm transition-all"
                        >
                            <Sliders className="size-4 text-muted-foreground" />
                            <span>Commission Ledger</span>
                        </Button>
                    </Link>
                </div>

                {/* KPI Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-border/60 shadow-xs hover:border-emerald-500/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Page Disbursal Total
                                </p>
                                <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                                    ${totalDisbursedThisPage.toFixed(2)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Across {payouts.data.length} transactions
                                </p>
                            </div>
                            <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <DollarSign className="size-6" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-xs hover:border-brand-rust/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Lifetime Transactions
                                </p>
                                <p className="text-2xl font-extrabold text-foreground tracking-tight">
                                    {payouts.total || payouts.data.length}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Disbursements completed
                                </p>
                            </div>
                            <div className="size-12 rounded-xl bg-brand-rust/10 text-brand-rust flex items-center justify-center shrink-0">
                                <History className="size-6" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-xs hover:border-indigo-500/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Stripe Connect
                                </p>
                                <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">
                                    {stripeCount}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Automated bank transfers
                                </p>
                            </div>
                            <div className="size-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                <CreditCard className="size-6" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-xs hover:border-amber-500/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Manual Payouts
                                </p>
                                <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
                                    {manualCount}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Cash & external wallets
                                </p>
                            </div>
                            <div className="size-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <Building2 className="size-6" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Dense Table View */}
                <div className="border border-border/80 rounded-xl overflow-hidden shadow-xs bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Disbursal Date</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recipient Picker</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Channel</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reference / Voucher</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Processed By</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Audit Notes</TableHead>
                                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Amount Disbursed</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payouts.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-44 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2.5">
                                            <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center">
                                                <History className="size-6" />
                                            </div>
                                            <h4 className="text-sm font-bold text-foreground">No Payout Records Found</h4>
                                            <p className="text-xs text-muted-foreground max-w-sm">
                                                There are currently no recorded commission disbursements. Process payouts from the Commissions Ledger.
                                            </p>
                                            <Link href="/admin/commissions" className="mt-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-4 rounded-xl text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted/60 transition-all"
                                                >
                                                    <Sliders className="size-3.5" />
                                                    <span>Go to Commissions Ledger</span>
                                                </Button>
                                            </Link>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                payouts.data.map((payout) => {
                                    const amount = parseFloat(String(payout.total_amount || 0));
                                    const dateObj = new Date(payout.paid_at || payout.created_at);

                                    return (
                                        <TableRow key={payout.id} className="hover:bg-muted/30 transition-colors">
                                            {/* Date */}
                                            <TableCell>
                                                <div className="space-y-0.5">
                                                    <p className="font-bold text-xs text-foreground">
                                                        {dateObj.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground font-mono">
                                                        {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </TableCell>

                                            {/* Recipient */}
                                            <TableCell>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="size-8 rounded-lg bg-brand-rust/10 text-brand-rust font-bold flex items-center justify-center text-xs shrink-0">
                                                        {payout.picker?.name?.charAt(0) || 'P'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-xs text-foreground truncate">
                                                            {payout.picker?.name || 'Unknown Picker'}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground truncate">
                                                            {payout.picker?.email || 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Channel */}
                                            <TableCell>
                                                {renderMethodBadge(payout)}
                                            </TableCell>

                                            {/* Reference */}
                                            <TableCell>
                                                {payout.reference_number ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 border border-border/70 font-mono text-xs text-foreground">
                                                        <span>{payout.reference_number}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyRef(payout.reference_number!)}
                                                            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                                                            title="Copy Reference"
                                                        >
                                                            {copiedRef === payout.reference_number ? (
                                                                <Check className="size-3 text-emerald-500" />
                                                            ) : (
                                                                <Copy className="size-3" />
                                                            )}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">None</span>
                                                )}
                                            </TableCell>

                                            {/* Processed By */}
                                            <TableCell>
                                                <div className="text-xs text-foreground font-medium">
                                                    {payout.processed_by_user?.name || (
                                                        <span className="text-muted-foreground italic">System Automation</span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Audit Notes */}
                                            <TableCell className="max-w-[220px]">
                                                {payout.notes ? (
                                                    <p className="text-xs text-muted-foreground truncate" title={payout.notes}>
                                                        {payout.notes}
                                                    </p>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">-</span>
                                                )}
                                            </TableCell>

                                            {/* Amount */}
                                            <TableCell className="text-right">
                                                <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                                                    ${amount.toFixed(2)}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    {payouts && payouts.links && payouts.links.length > 3 && (
                        <div className="p-4 border-t border-border/80 bg-muted/10">
                            <Pagination data={payouts} />
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}