import { Head, Link, router } from '@inertiajs/react';
import CommissionSettingsModal from './CommissionSettingsModal';
import PayoutModal, { type PayoutPayload } from './PayoutModal';
import { 
    Banknote, 
    ArrowLeft, 
    History, 
    CheckCircle2, 
    Settings2, 
    Users, 
    Wallet, 
    Info, 
    CreditCard, 
    Search,
    SlidersHorizontal,
    AlertCircle,
    ShieldCheck,
    CircleDollarSign,
    Box,
    CheckCircle,
    RefreshCw
} from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { useState, useMemo } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

export default function AdminCommissionsIndex({ 
    pickers = [],
    default_type = 'flat',
    default_rates = { amount: 5.0 },
    distance_rate_per_km = 0,
    cancellation_flat_fee = 0,
    payout_minimum_threshold = 0
}: { 
    pickers?: any[];
    default_type?: string;
    default_rates?: any;
    distance_rate_per_km?: number | string;
    cancellation_flat_fee?: number | string;
    payout_minimum_threshold?: number | string;
}) {
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [payoutPicker, setPayoutPicker] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'stripe' | 'manual'>('all');

    const minThreshold = Number(payout_minimum_threshold) || 0;

    const totalPendingAmount = useMemo(() => {
        return pickers.reduce((sum: number, p: any) => sum + parseFloat(p.pending_amount || 0), 0);
    }, [pickers]);

    const totalPendingCount = useMemo(() => {
        return pickers.reduce((sum: number, p: any) => sum + (p.pending_count || 0), 0);
    }, [pickers]);

    const eligiblePayeesCount = useMemo(() => {
        return pickers.filter((p: any) => {
            const amt = parseFloat(p.pending_amount || 0);
            return amt > 0 && amt >= minThreshold;
        }).length;
    }, [pickers, minThreshold]);

    const filteredPickers = useMemo(() => {
        return pickers.filter((picker: any) => {
            const matchesSearch = 
                picker.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                picker.email?.toLowerCase().includes(searchQuery.toLowerCase());
            
            const amt = parseFloat(picker.pending_amount || 0);
            const isReady = amt > 0 && amt >= minThreshold;
            const hasStripe = picker.stripe_account_id && picker.stripe_onboarding_completed;

            if (filterStatus === 'ready') return matchesSearch && isReady;
            if (filterStatus === 'stripe') return matchesSearch && hasStripe;
            if (filterStatus === 'manual') return matchesSearch && !hasStripe;

            return matchesSearch;
        });
    }, [pickers, searchQuery, filterStatus, minThreshold]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Commissions Ledger', href: '#' },
    ];

    const handlePayoutConfirm = (payload: PayoutPayload) => {
        if (!payoutPicker) return;

        setProcessingId(payoutPicker.id);
        router.post(`/admin/commissions/users/${payoutPicker.id}/payout`, payload, {
            onFinish: () => {
                setProcessingId(null);
                setPayoutPicker(null);
            }
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Commissions Ledger | Admin" />
            
            <div className="flex h-full flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard"
                            className="rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <Heading
                            eyebrow="Financial Operations"
                            title="Commissions Ledger"
                            description="Manage picker earnings, rates, and process commission payouts."
                        />
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Button 
                            variant="outline" 
                            className="gap-2 rounded-xl border-zinc-200 bg-white hover:bg-zinc-50"
                            onClick={() => setIsSettingsOpen(true)}
                        >
                            <Settings2 className="size-4 text-zinc-600" />
                            <span>Commission Settings</span>
                        </Button>

                        <Link href="/admin/commissions/payouts">
                            <Button 
                                variant="outline"
                                className="gap-2 rounded-xl border-zinc-200 bg-white hover:bg-zinc-50"
                            >
                                <History className="size-4 text-zinc-600" />
                                <span>Payout History</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Global Settings Summary Bar */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-zinc-200/80 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
                    <div className="flex items-center gap-1.5 font-bold text-zinc-800 uppercase text-[10px] tracking-wider">
                        <ShieldCheck className="size-3.5 text-emerald-600" />
                        Global Payout Rules:
                    </div>

                    <div className="flex items-center gap-1">
                        <span className="text-zinc-500">Default Model:</span>
                        <span className="font-semibold text-zinc-900">
                            {default_type === 'flat' ? `$${parseFloat(String(default_rates?.amount || 0)).toFixed(2)} Flat` : default_type}
                        </span>
                    </div>

                    <span className="text-zinc-300 hidden sm:inline">•</span>

                    <div className="flex items-center gap-1">
                        <span className="text-zinc-500">Distance Rate:</span>
                        <span className="font-semibold text-zinc-900">${parseFloat(String(distance_rate_per_km || 0)).toFixed(2)}/km</span>
                    </div>

                    <span className="text-zinc-300 hidden sm:inline">•</span>

                    <div className="flex items-center gap-1">
                        <span className="text-zinc-500">Cancellation Fee:</span>
                        <span className="font-semibold text-zinc-900">${parseFloat(String(cancellation_flat_fee || 0)).toFixed(2)}</span>
                    </div>

                    <span className="text-zinc-300 hidden sm:inline">•</span>

                    <div className="flex items-center gap-1">
                        <span className="text-zinc-500">Min. Payout Limit:</span>
                        <span className="font-semibold text-zinc-900">${minThreshold.toFixed(2)}</span>
                    </div>
                </div>

                {/* KPI Overview Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Total Pending Payouts</span>
                            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                                <Wallet className="size-4" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <span className="text-2xl font-bold tracking-tight text-zinc-900">
                                ${totalPendingAmount.toFixed(2)}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                            Across all active pickers
                        </p>
                    </Card>

                    <Card className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Unsettled Boxes</span>
                            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                                <Box className="size-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-bold tracking-tight text-zinc-900">
                                {totalPendingCount}
                            </span>
                            <span className="text-xs font-medium text-zinc-500">Boxes</span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                            Awaiting payout completion
                        </p>
                    </Card>

                    <Card className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Active Pickers</span>
                            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                                <Users className="size-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-2xl font-bold tracking-tight text-zinc-900">
                                {pickers.length}
                            </span>
                            <span className="text-xs font-medium text-zinc-500">Earners</span>
                        </div>
                        <p className="mt-1 text-xs text-emerald-600 font-medium">
                            {eligiblePayeesCount} eligible for payout
                        </p>
                    </Card>

                    <Card className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Minimum Limit</span>
                            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                                <CircleDollarSign className="size-4" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <span className="text-2xl font-bold tracking-tight text-zinc-900">
                                ${minThreshold.toFixed(2)}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                            Required balance to pay out
                        </p>
                    </Card>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                            placeholder="Search by picker name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 pl-9 rounded-lg border-zinc-200 text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                        <span className="text-xs font-semibold text-zinc-400 mr-1 flex items-center gap-1">
                            <SlidersHorizontal className="size-3.5" />
                            Filter:
                        </span>
                        
                        <button
                            onClick={() => setFilterStatus('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                filterStatus === 'all'
                                    ? 'bg-zinc-900 text-white'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                            All ({pickers.length})
                        </button>
                        
                        <button
                            onClick={() => setFilterStatus('ready')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                filterStatus === 'ready'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                            Ready for Payout ({eligiblePayeesCount})
                        </button>

                        <button
                            onClick={() => setFilterStatus('stripe')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                filterStatus === 'stripe'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                            Stripe Connected
                        </button>

                        <button
                            onClick={() => setFilterStatus('manual')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                filterStatus === 'manual'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                            Manual Payout
                        </button>
                    </div>
                </div>

                {/* Pickers Grid */}
                <div>
                    {filteredPickers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-zinc-200 bg-white">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 mb-3">
                                <Users className="size-6" />
                            </div>
                            <h3 className="text-sm font-semibold text-zinc-900">No Pickers Found</h3>
                            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                                {searchQuery 
                                    ? `No pickers match your search "${searchQuery}".`
                                    : 'There are currently no pickers matching the selected filter.'}
                            </p>
                            {searchQuery && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setSearchQuery('')}
                                    className="mt-3 rounded-lg text-xs"
                                >
                                    Clear Search
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredPickers.map((picker) => {
                                const pendingAmt = parseFloat(picker.pending_amount || 0);
                                const pendingBoxes = picker.pending_count || 0;
                                const hasStripe = picker.stripe_account_id && picker.stripe_onboarding_completed;
                                const isEligible = pendingAmt > 0 && (minThreshold === 0 || pendingAmt >= minThreshold);
                                const progressPct = minThreshold > 0 ? Math.min(100, (pendingAmt / minThreshold) * 100) : 100;
                                const isClawbackDeficit = pendingAmt < 0;

                                return (
                                    <div 
                                        key={picker.id} 
                                        className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-all hover:border-zinc-300"
                                    >
                                        <div>
                                            {/* Header Info */}
                                            <div className="flex items-start justify-between gap-3 mb-4">
                                                <div>
                                                    <h3 className="font-bold text-base text-zinc-900">
                                                        {picker.name}
                                                    </h3>
                                                    <p className="text-xs text-zinc-500 mt-0.5">{picker.email}</p>
                                                </div>

                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <Badge variant="outline" className="rounded-md text-[10px] uppercase font-bold text-zinc-600 bg-zinc-50 border-zinc-200">
                                                        {picker.commission_type || default_type}
                                                    </Badge>
                                                    {hasStripe ? (
                                                        <Badge className="rounded-md text-[10px] uppercase font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 gap-1 hover:bg-indigo-50">
                                                            <CreditCard className="size-3 text-indigo-500" />
                                                            Stripe
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="rounded-md text-[10px] uppercase font-bold bg-amber-50 text-amber-700 border border-amber-100 gap-1 hover:bg-amber-50">
                                                            <Info className="size-3 text-amber-500" />
                                                            Manual
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Financial Metrics Container */}
                                            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/60">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pending Earnings</span>
                                                    <span className="text-xs font-semibold text-zinc-700">
                                                        {pendingBoxes} {pendingBoxes === 1 ? 'Box' : 'Boxes'}
                                                    </span>
                                                </div>

                                                <div className="text-2xl font-black tracking-tight text-zinc-900 mt-1">
                                                    ${pendingAmt.toFixed(2)}
                                                </div>

                                                {/* Threshold Progress Bar */}
                                                {minThreshold > 0 && (
                                                    <div className="mt-3 pt-2.5 border-t border-zinc-200/60">
                                                        <div className="flex justify-between items-center text-[10px] text-zinc-500 mb-1">
                                                            <span>Progress to Min. Payout</span>
                                                            <span className="font-semibold">${pendingAmt.toFixed(2)} / ${minThreshold.toFixed(2)}</span>
                                                        </div>
                                                        <div className="h-1.5 w-full rounded-full bg-zinc-200 overflow-hidden">
                                                            <div 
                                                                className={`h-full transition-all rounded-full ${
                                                                    progressPct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'
                                                                }`} 
                                                                style={{ width: `${progressPct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {isClawbackDeficit && (
                                                    <div className="mt-2.5 flex items-center gap-1 text-[11px] text-rose-600 font-semibold bg-rose-50 px-2 py-1 rounded border border-rose-100">
                                                        <AlertCircle className="size-3.5 shrink-0" />
                                                        <span>Includes refund clawback adjustment</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Action Button */}
                                        <div className="mt-5 pt-4 border-t border-zinc-100">
                                            <Button 
                                                className={`w-full rounded-xl font-semibold gap-2 ${
                                                    isEligible 
                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                                        : 'bg-zinc-100 text-zinc-400 border border-zinc-200 hover:bg-zinc-100'
                                                }`}
                                                disabled={!isEligible || processingId === picker.id}
                                                onClick={() => setPayoutPicker(picker)}
                                            >
                                                {processingId === picker.id ? (
                                                    <span>Processing...</span>
                                                ) : isEligible ? (
                                                    <>
                                                        <CheckCircle className="size-4" />
                                                        <span>Process Payout</span>
                                                    </>
                                                ) : pendingAmt < 0 ? (
                                                    <span>Negative Balance (Clawback)</span>
                                                ) : pendingAmt === 0 ? (
                                                    <span>No Pending Earnings</span>
                                                ) : (
                                                    <span>Below ${minThreshold.toFixed(2)} Limit</span>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <CommissionSettingsModal 
                defaultType={default_type} 
                defaultRates={default_rates} 
                distanceRate={distance_rate_per_km}
                cancellationFee={cancellation_flat_fee}
                payoutMinimumThreshold={payout_minimum_threshold}
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
            />

            {payoutPicker && (
                <PayoutModal
                    picker={payoutPicker}
                    isOpen={!!payoutPicker}
                    onClose={() => setPayoutPicker(null)}
                    onConfirm={handlePayoutConfirm}
                    isProcessing={processingId === payoutPicker.id}
                />
            )}
        </AppLayout>
    );
}


