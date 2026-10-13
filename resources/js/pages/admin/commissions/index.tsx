import { Head, Link, router } from '@inertiajs/react';
import CommissionSettingsModal from './CommissionSettingsModal';
import PayoutModal, { type PayoutPayload } from './PayoutModal';
import { 
    Banknote, 
    ArrowLeft, 
    History, 
    CheckCircle2, 
    Sliders, 
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
    RefreshCw,
    LayoutGrid,
    List,
    DollarSign,
    Package,
    MapPin,
    Ban,
    Sparkles,
    Coins,
    ChevronRight,
    X
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
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

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
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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

    const getInitials = (name?: string) => {
        if (!name) return 'PK';
        return name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Commissions Ledger | Admin" />
            
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-w-0 w-full">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard"
                            className="rounded-xl p-2.5 bg-card border border-border/80 text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-xs shrink-0"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                        <div>
                            <Heading
                                eyebrow="Financial Operations"
                                title="Commissions Ledger"
                                description="Monitor picker earnings, audit runsheet completions, and process batch payouts."
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <Button 
                            onClick={() => setIsSettingsOpen(true)}
                            className="bg-brand-rust hover:bg-brand-rust/90 text-white font-semibold shadow-md shadow-brand-rust/20 flex items-center gap-2 h-10 px-5 rounded-xl text-sm transition-all"
                        >
                            <Sliders className="size-4" />
                            <span>Commission Settings</span>
                        </Button>

                        <Link href="/admin/commissions/payouts">
                            <Button 
                                variant="outline"
                                className="h-10 px-5 rounded-xl border-border/80 bg-card hover:bg-muted/60 text-foreground font-semibold gap-2 shadow-2xs text-sm transition-all"
                            >
                                <History className="size-4 text-muted-foreground" />
                                <span>Payout History</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Global Settings Summary Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3.5 px-4 shadow-2xs">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Active System Rules</span>
                        </div>

                        <div className="h-4 w-px bg-border/80 hidden sm:block" />

                        <div className="flex items-center gap-1.5">
                            <Coins className="size-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Default Rate:</span>
                            <span className="font-semibold text-foreground">
                                {default_type === 'flat' ? `$${parseFloat(String(default_rates?.amount || 0)).toFixed(2)} Flat / Box` : default_type}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <MapPin className="size-3.5 text-blue-500" />
                            <span className="text-muted-foreground">Distance:</span>
                            <span className="font-semibold text-foreground">
                                ${parseFloat(String(distance_rate_per_km || 0)).toFixed(2)} / km
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <Ban className="size-3.5 text-amber-500" />
                            <span className="text-muted-foreground">Cancellation:</span>
                            <span className="font-semibold text-foreground">
                                ${parseFloat(String(cancellation_flat_fee || 0)).toFixed(2)}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <CircleDollarSign className="size-3.5 text-purple-500" />
                            <span className="text-muted-foreground">Min. Payout:</span>
                            <span className="font-semibold text-foreground">
                                ${minThreshold.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsSettingsOpen(true)}
                        className="h-7 px-2.5 rounded-lg text-xs font-semibold text-brand-rust hover:text-brand-rust hover:bg-brand-rust/10 flex items-center gap-1 self-start lg:self-center transition-all"
                    >
                        <span>Adjust Parameters</span>
                        <ChevronRight className="size-3.5" />
                    </Button>
                </div>

                {/* KPI Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-border/60 shadow-xs hover:border-amber-500/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Total Pending Payouts
                                </p>
                                <p className="text-2xl font-extrabold text-foreground tracking-tight">
                                    ${totalPendingAmount.toFixed(2)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Awaiting disbursement approval
                                </p>
                            </div>
                            <div className="size-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <Wallet className="size-6" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-xs hover:border-blue-500/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Unsettled Boxes
                                </p>
                                <div className="flex items-baseline gap-1.5">
                                    <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">
                                        {totalPendingCount}
                                    </p>
                                    <span className="text-xs font-semibold text-muted-foreground">Units</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Collected boxes in open balance
                                </p>
                            </div>
                            <div className="size-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <Package className="size-6" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-xs hover:border-emerald-500/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Active Pickers
                                </p>
                                <div className="flex items-baseline gap-1.5">
                                    <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                                        {pickers.length}
                                    </p>
                                    <span className="text-xs font-semibold text-muted-foreground">Total</span>
                                </div>
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                    {eligiblePayeesCount} eligible for payout
                                </p>
                            </div>
                            <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <Users className="size-6" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-xs hover:border-purple-500/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Minimum Threshold
                                </p>
                                <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 tracking-tight">
                                    ${minThreshold.toFixed(2)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Qualifying limit per disbursement
                                </p>
                            </div>
                            <div className="size-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                <CircleDollarSign className="size-6" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-3">
                    <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                        {/* Search Bar */}
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by picker name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-8 h-9 text-xs rounded-lg"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filter Status Pills & View Mode */}
                        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 w-full md:w-auto">
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                                <button
                                    type="button"
                                    onClick={() => setFilterStatus('all')}
                                    className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                                        filterStatus === 'all'
                                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs'
                                            : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border/60'
                                    }`}
                                >
                                    All ({pickers.length})
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFilterStatus('ready')}
                                    className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                                        filterStatus === 'ready'
                                            ? 'bg-emerald-600 text-white shadow-2xs'
                                            : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border/60'
                                    }`}
                                >
                                    Ready for Payout ({eligiblePayeesCount})
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFilterStatus('stripe')}
                                    className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                                        filterStatus === 'stripe'
                                            ? 'bg-indigo-600 text-white shadow-2xs'
                                            : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border/60'
                                    }`}
                                >
                                    Stripe Connected
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFilterStatus('manual')}
                                    className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                                        filterStatus === 'manual'
                                            ? 'bg-amber-600 text-white shadow-2xs'
                                            : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border/60'
                                    }`}
                                >
                                    Manual Payout
                                </button>
                            </div>

                            {/* View Toggle */}
                            <div className="flex items-center rounded-lg border border-border/80 bg-muted/30 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('grid')}
                                    className={`size-7.5 rounded-md flex items-center justify-center transition-all ${
                                        viewMode === 'grid'
                                            ? 'bg-card text-foreground shadow-2xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title="Grid View"
                                >
                                    <LayoutGrid className="size-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('table')}
                                    className={`size-7.5 rounded-md flex items-center justify-center transition-all ${
                                        viewMode === 'table'
                                            ? 'bg-card text-foreground shadow-2xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title="Table View"
                                >
                                    <List className="size-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Presentation */}
                {filteredPickers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card">
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                            <Users className="size-7" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground">No Pickers Found</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                            {searchQuery 
                                ? `No picker accounts match your search query "${searchQuery}".`
                                : 'There are currently no pickers matching the chosen filter status.'}
                        </p>
                        {searchQuery && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setSearchQuery('')}
                                className="mt-4 rounded-xl text-xs h-8"
                            >
                                Clear Search Filter
                            </Button>
                        )}
                    </div>
                ) : viewMode === 'grid' ? (
                    /* Grid Cards View */
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
                                    className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:border-brand-rust/30 hover:shadow-md duration-200"
                                >
                                    <div>
                                        {/* Header Info */}
                                        <div className="flex items-start justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-11 rounded-xl bg-gradient-to-br from-brand-rust/10 to-brand-rust/20 border border-brand-rust/20 text-brand-rust font-bold flex items-center justify-center text-xs shrink-0">
                                                    {getInitials(picker.name)}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-sm text-foreground truncate">
                                                        {picker.name}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {picker.email}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold py-0.5 px-2 bg-muted/40 border-border/80">
                                                    {picker.commission_type || default_type}
                                                </Badge>
                                                {hasStripe ? (
                                                    <Badge className="text-[10px] uppercase font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 gap-1 hover:bg-indigo-500/15 py-0.5 px-2">
                                                        <CreditCard className="size-3" />
                                                        Stripe
                                                    </Badge>
                                                ) : (
                                                    <Badge className="text-[10px] uppercase font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 gap-1 hover:bg-amber-500/15 py-0.5 px-2">
                                                        <Info className="size-3" />
                                                        Manual
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Financial Metrics Container */}
                                        <div className="p-4 rounded-xl bg-muted/30 border border-border/70 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                    Unsettled Earnings
                                                </span>
                                                <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                                                    <Package className="size-3 text-muted-foreground" />
                                                    {pendingBoxes} {pendingBoxes === 1 ? 'Box' : 'Boxes'}
                                                </span>
                                            </div>

                                            <div className="text-2xl font-extrabold tracking-tight text-foreground">
                                                ${pendingAmt.toFixed(2)}
                                            </div>

                                            {/* Threshold Progress Bar */}
                                            {minThreshold > 0 && (
                                                <div className="pt-2 border-t border-border/60 space-y-1.5">
                                                    <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                                        <span>Progress to Threshold</span>
                                                        <span className="font-semibold text-foreground">
                                                            ${pendingAmt.toFixed(2)} / ${minThreshold.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all duration-300 rounded-full ${
                                                                progressPct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'
                                                            }`} 
                                                            style={{ width: `${progressPct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {isClawbackDeficit && (
                                                <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                                                    <AlertCircle className="size-3.5 shrink-0" />
                                                    <span>Reflects refund clawback deficit</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Action Button */}
                                    <div className="mt-5 pt-4 border-t border-border/60">
                                        <Button 
                                            className={`w-full rounded-xl font-semibold gap-2 h-10 text-sm transition-all flex items-center justify-center ${
                                                isEligible 
                                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-[0.99]' 
                                                    : 'bg-muted/50 text-muted-foreground border border-border/70 hover:bg-muted/50 cursor-not-allowed'
                                            }`}
                                            disabled={!isEligible || processingId === picker.id}
                                            onClick={() => setPayoutPicker(picker)}
                                        >
                                            {processingId === picker.id ? (
                                                <>
                                                    <RefreshCw className="size-4 animate-spin" />
                                                    <span>Processing Disbursal...</span>
                                                </>
                                            ) : isEligible ? (
                                                <>
                                                    <CheckCircle2 className="size-4" />
                                                    <span>Process Payout (${pendingAmt.toFixed(2)})</span>
                                                </>
                                            ) : pendingAmt < 0 ? (
                                                <span>Negative Balance (Clawback)</span>
                                            ) : pendingAmt === 0 ? (
                                                <span>No Pending Earnings</span>
                                            ) : (
                                                <span>Below ${minThreshold.toFixed(2)} Minimum Limit</span>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Dense Ledger Table View */
                    <div className="border border-border/80 rounded-xl overflow-hidden shadow-xs bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Picker</TableHead>
                                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Disbursement Channel</TableHead>
                                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Earning Model</TableHead>
                                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Unsettled Boxes</TableHead>
                                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Ledger Balance</TableHead>
                                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Payout Status</TableHead>
                                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPickers.map((picker) => {
                                    const pendingAmt = parseFloat(picker.pending_amount || 0);
                                    const pendingBoxes = picker.pending_count || 0;
                                    const hasStripe = picker.stripe_account_id && picker.stripe_onboarding_completed;
                                    const isEligible = pendingAmt > 0 && (minThreshold === 0 || pendingAmt >= minThreshold);

                                    return (
                                        <TableRow key={picker.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-lg bg-brand-rust/10 text-brand-rust font-bold flex items-center justify-center text-[11px] shrink-0">
                                                        {getInitials(picker.name)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-xs text-foreground">{picker.name}</p>
                                                        <p className="text-[11px] text-muted-foreground">{picker.email}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {hasStripe ? (
                                                    <Badge className="text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 gap-1 hover:bg-indigo-500/15">
                                                        <CreditCard className="size-3" />
                                                        Stripe Connect
                                                    </Badge>
                                                ) : (
                                                    <Badge className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 gap-1 hover:bg-amber-500/15">
                                                        <Info className="size-3" />
                                                        Manual Payout
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                                    {picker.commission_type || default_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-semibold text-xs text-foreground">
                                                {pendingBoxes}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className={`font-extrabold text-sm ${pendingAmt < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                                                    ${pendingAmt.toFixed(2)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {isEligible ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
                                                        Ready for Payout
                                                    </Badge>
                                                ) : pendingAmt < 0 ? (
                                                    <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] font-bold">
                                                        Clawback Deficit
                                                    </Badge>
                                                ) : pendingAmt === 0 ? (
                                                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                                        Settled
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/20 bg-amber-500/5 font-semibold">
                                                        Below Threshold
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    disabled={!isEligible || processingId === picker.id}
                                                    onClick={() => setPayoutPicker(picker)}
                                                    className={`h-8 px-3.5 rounded-lg text-xs font-semibold gap-1.5 transition-all inline-flex items-center ${
                                                        isEligible
                                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs hover:shadow-xs active:scale-[0.98]'
                                                            : 'bg-muted/40 text-muted-foreground border border-border/60 cursor-not-allowed hover:bg-muted/40'
                                                    }`}
                                                >
                                                    {processingId === picker.id ? (
                                                        <>
                                                            <RefreshCw className="size-3.5 animate-spin" />
                                                            <span>Processing...</span>
                                                        </>
                                                    ) : isEligible ? (
                                                        <>
                                                            <CheckCircle2 className="size-3.5" />
                                                            <span>Process Payout</span>
                                                        </>
                                                    ) : (
                                                        <span>Unavailable</span>
                                                    )}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
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


