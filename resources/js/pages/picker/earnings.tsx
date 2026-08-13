import { Head, Link, useForm } from '@inertiajs/react';
import { Banknote, DollarSign, History, Box as BoxIcon, ChevronLeft, ChevronRight, Eye, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, Commission } from '@/types';

const payoutMethodLabels: Record<string, string> = {
    stripe: 'Stripe transfer',
    cash: 'Cash',
    ewallet: 'E-wallet',
};

function formatPayoutMethod(payout: any) {
    const label = payoutMethodLabels[payout.payout_method] || 'Payout';

    return payout.payout_provider ? `${label} (${payout.payout_provider})` : label;
}

export default function PickerEarnings({
    pendingAmount,
    pendingCommissions,
    payouts,
    lifetimeEarnings,
    externalAccounts = [],
    payoutMinimumThreshold = 0,
    auth
}: {
    pendingAmount: number,
    pendingCommissions: Commission[],
    payouts: any,
    lifetimeEarnings: number,
    externalAccounts?: any[],
    payoutMinimumThreshold?: number,
    auth: { user: any }
}) {
    const [selectedPayout, setSelectedPayout] = useState<any | null>(null);
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [isCashoutModalOpen, setIsCashoutModalOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        destination_account_id: externalAccounts?.[0]?.id || '',
    });

    const submitCashout = (e: React.FormEvent) => {
        e.preventDefault();
        post('/picker/earnings/cashout', {
            onSuccess: () => {
                setIsCashoutModalOpen(false);
                reset();
            }
        });
    };

    const openPayoutDetails = (payout: any) => {
        setSelectedPayout(payout);
        setIsPayoutModalOpen(true);
    };
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/picker/dashboard' },
        { title: 'Earnings', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Earnings | Picker" />
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-brand-warm/20 pb-8">
                    <div className="flex items-center gap-4">
                        <Heading
                            eyebrow="My Account"
                            title="Earnings & Payouts"
                            description="Track your pickup commissions and payout history."
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/picker/payout-settings">
                            <Button variant="outline" className="gap-2">
                                <Banknote className="size-4" />
                                Payout Settings
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Summary & Pending */}
                    <div className="lg:col-span-1 space-y-8">
                        {/* Summary Card */}
                        <div className="card bg-brand-rust text-white rounded-[2.5rem] p-8 shadow-md relative overflow-hidden">
                            <div className="absolute -right-6 -top-6 opacity-10">
                                <DollarSign className="size-48" />
                            </div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Pending Balance</h3>
                                        <div className="text-5xl font-black tracking-tighter">
                                            ${pendingAmount.toFixed(2)}
                                        </div>
                                        <div className="mt-4">
                                            {auth.user?.preferred_payout_method && auth.user.preferred_payout_method !== 'stripe' ? (
                                                <div className="bg-white/10 p-3 rounded-xl flex items-start gap-2">
                                                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                                                    <p className="text-[10px] font-bold">
                                                        Payouts via {auth.user.preferred_payout_method === 'cash' ? 'Cash' : 'E-Wallet'} are processed manually.
                                                    </p>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="secondary"
                                                    className="w-full font-bold"
                                                    disabled={pendingAmount <= 0 || externalAccounts.length === 0 || pendingAmount < (payoutMinimumThreshold || 0)}
                                                    onClick={() => setIsCashoutModalOpen(true)}
                                                >
                                                    {pendingAmount > 0 && pendingAmount < (payoutMinimumThreshold || 0) 
                                                        ? `Min. Cashout $${(payoutMinimumThreshold || 0).toFixed(2)}` 
                                                        : 'Cash Out'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Earnings</h3>
                                        <div className="text-xl font-bold tracking-tighter">
                                            ${lifetimeEarnings.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white/10 rounded-xl p-4 flex justify-between items-center backdrop-blur-sm">
                                    <span className="text-xs font-bold uppercase tracking-widest opacity-90">Pending Pickups</span>
                                    <span className="text-lg font-black">{pendingCommissions.length} Boxes</span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Pending Pickups */}
                        <div className="card bg-white rounded-3xl border border-brand-warm/20 shadow-sm p-6">
                            <div className="flex items-center gap-3 mb-6 border-b border-brand-warm/10 pb-4">
                                <BoxIcon className="size-5 text-brand-secondary" />
                                <h3 className="font-serif text-lg font-bold text-brand-rust uppercase tracking-tight">Recent Unpaid Pickups</h3>
                            </div>

                            {pendingCommissions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">You have no pending unpaid pickups.</p>
                            ) : (
                                <div className="space-y-4">
                                    {pendingCommissions.slice(0, 10).map((commission) => (
                                        <div key={commission.id} className="flex flex-col p-3 rounded-xl bg-brand-warm/5 border border-brand-warm/10">
                                            <div className="flex justify-between items-center w-full">
                                                <div>
                                                    <div className="text-xs font-bold text-foreground">
                                                        Box #{commission.box?.tracking_number || commission.box_id}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                        {new Date(commission.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div className="text-sm font-black text-brand-rust">
                                                    +${parseFloat(commission.amount.toString()).toFixed(2)}
                                                </div>
                                            </div>
                                            
                                            {commission.breakdown && (
                                                <div className="mt-2 pt-2 border-t border-brand-warm/10 w-full text-[10px] text-muted-foreground flex justify-between">
                                                    <span>Base: ${commission.breakdown.base_rate?.toFixed(2)}</span>
                                                    {commission.breakdown.distance_bonus > 0 && (
                                                        <span>Distance Bonus ({commission.breakdown.distance_km}km): ${commission.breakdown.distance_bonus?.toFixed(2)}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {pendingCommissions.length > 10 && (
                                        <div className="text-center pt-2">
                                            <span className="text-xs text-muted-foreground font-bold">+{pendingCommissions.length - 10} more</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Payout History */}
                    <div className="lg:col-span-2">
                        <div className="card bg-white rounded-[2.5rem] border border-brand-warm/20 shadow-sm overflow-hidden h-full">
                            <div className="bg-brand-warm/5 p-8 border-b border-brand-warm/10 flex items-center gap-4">
                                <History className="size-6 text-brand-secondary" />
                                <h2 className="font-serif text-xl font-bold text-brand-rust uppercase tracking-tight">Payout History</h2>
                            </div>

                            <div className="p-6">
                                {payouts.data.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <Banknote className="size-16 text-brand-rust/20 mb-4" />
                                        <h3 className="text-sm font-bold text-brand-rust uppercase tracking-widest">No Payouts Yet</h3>
                                        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                                            Once your commissions are processed and paid out by an administrator, they will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {payouts.data.map((payout: any) => (
                                            <div
                                                key={payout.id}
                                                onClick={() => openPayoutDetails(payout)}
                                                className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-brand-warm/10 hover:border-brand-rust/30 hover:bg-brand-warm/5 transition-all cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className="size-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                                                        <DollarSign className="size-6" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-foreground group-hover:text-brand-rust transition-colors">
                                                            {new Date(payout.paid_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                                            <span className="font-black">{formatPayoutMethod(payout)}</span>
                                                            <span>|</span>
                                                            <span className="font-mono">{payout.reference_number || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 sm:mt-0 text-right flex items-center gap-4 justify-end">
                                                    <div>
                                                        <div className="text-2xl font-black text-brand-rust tracking-tight">
                                                            ${parseFloat(payout.total_amount).toFixed(2)}
                                                        </div>
                                                        <div className="text-[10px] uppercase tracking-widest font-bold text-green-600 mt-1">
                                                            Paid Successfully
                                                        </div>
                                                    </div>
                                                    <div className="hidden sm:flex text-brand-warm/40 group-hover:text-brand-rust transition-colors">
                                                        <Eye className="size-5" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Pagination Controls */}
                                {payouts.last_page > 1 && (
                                    <div className="flex items-center justify-between border-t border-brand-warm/10 mt-6 pt-6">
                                        <div className="text-sm text-muted-foreground font-bold">
                                            Page {payouts.current_page} of {payouts.last_page}
                                        </div>
                                        <div className="flex gap-2">
                                            <Link
                                                href={payouts.prev_page_url || '#'}
                                                className={`p-2 rounded-lg border border-brand-warm/20 ${!payouts.prev_page_url ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-warm/10 text-brand-rust'}`}
                                                preserveScroll
                                            >
                                                <ChevronLeft className="size-5" />
                                            </Link>
                                            <Link
                                                href={payouts.next_page_url || '#'}
                                                className={`p-2 rounded-lg border border-brand-warm/20 ${!payouts.next_page_url ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-warm/10 text-brand-rust'}`}
                                                preserveScroll
                                            >
                                                <ChevronRight className="size-5" />
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payout Details Modal */}
            <Dialog open={isPayoutModalOpen} onOpenChange={setIsPayoutModalOpen}>
                <DialogContent className="sm:max-w-md md:max-w-2xl bg-[#faf9f6] border-brand-warm/20 text-foreground">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-2xl font-bold text-brand-rust uppercase tracking-tight">Payout Details</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-bold">
                            {selectedPayout && new Date(selectedPayout.paid_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedPayout && (
                        <div className="mt-4">
                            <div className="flex justify-between items-center bg-brand-warm/10 p-4 rounded-xl mb-6">
                                <div>
                                    <div className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Total Payout</div>
                                    <div className="text-3xl font-black text-brand-rust">${parseFloat(selectedPayout.total_amount).toFixed(2)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Method</div>
                                    <div className="text-sm font-mono font-bold bg-white px-2 py-1 rounded border border-brand-warm/20">
                                        {formatPayoutMethod(selectedPayout)}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-brand-warm/10 shadow-sm mb-6">
                                <div>
                                    <div className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Reference Number</div>
                                    <div className="text-sm font-mono font-bold text-foreground bg-brand-warm/5 px-2 py-1 rounded inline-block border border-brand-warm/10">
                                        {selectedPayout.reference_number || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Processed By</div>
                                    <div className="text-sm font-bold text-foreground">
                                        {selectedPayout.processed_by_user?.name || 'System'}
                                    </div>
                                </div>
                                {selectedPayout.notes && (
                                    <div className="col-span-2 pt-2 border-t border-brand-warm/10">
                                        <div className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Notes</div>
                                        <p className="text-xs text-muted-foreground bg-brand-warm/5 p-3 rounded-lg border border-brand-warm/10 italic">
                                            "{selectedPayout.notes}"
                                        </p>
                                    </div>
                                )}
                            </div>

                            <h4 className="font-bold text-sm uppercase tracking-widest mb-3 flex items-center gap-2 text-brand-secondary">
                                <BoxIcon className="size-4" />
                                Included Pickups ({selectedPayout.commissions?.length || 0})
                            </h4>

                            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                {selectedPayout.commissions && selectedPayout.commissions.length > 0 ? (
                                    selectedPayout.commissions.map((commission: any) => (
                                        <div key={commission.id} className="flex justify-between items-center p-4 rounded-xl bg-white border border-brand-warm/10 shadow-sm">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-sm font-bold text-foreground">
                                                    Box #{commission.box?.tracking_number || commission.box_id}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                                                    Pickup Date: {new Date(commission.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <div className="text-lg font-black text-green-600">
                                                +${parseFloat(commission.amount.toString()).toFixed(2)}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground text-sm font-bold border border-dashed border-brand-warm/20 rounded-xl">
                                        No detailed commission records found for this payout.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Cash Out Modal */}
            <Dialog open={isCashoutModalOpen} onOpenChange={setIsCashoutModalOpen}>
                <DialogContent className="sm:max-w-md bg-[#faf9f6] border-brand-warm/20 text-foreground">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-2xl font-bold text-brand-rust uppercase tracking-tight">Cash Out Earnings</DialogTitle>
                        <DialogDescription className="text-muted-foreground font-bold">
                            Transfer your pending balance to your bank account.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submitCashout} className="mt-4 space-y-6">
                        <div className="flex justify-between items-center bg-brand-warm/10 p-4 rounded-xl">
                            <div className="text-sm font-black uppercase tracking-widest opacity-80">Available Amount</div>
                            <div className="text-3xl font-black text-brand-rust">${pendingAmount.toFixed(2)}</div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold uppercase tracking-widest text-brand-secondary">Select Destination</label>
                            {externalAccounts.length > 0 ? (
                                <select
                                    value={data.destination_account_id}
                                    onChange={e => setData('destination_account_id', e.target.value)}
                                    className="w-full bg-white border border-brand-warm/20 text-foreground rounded-lg p-3 text-sm font-bold focus:ring-brand-rust focus:border-brand-rust"
                                    required
                                >
                                    {externalAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.bank_name || acc.brand} •••• {acc.last4}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-sm text-red-500 font-bold p-3 bg-red-50 rounded-lg">
                                    No bank accounts found. Please complete your payout settings first.
                                </div>
                            )}
                            {errors.destination_account_id && (
                                <div className="text-xs text-red-500 mt-1">{errors.destination_account_id}</div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-brand-warm/10">
                            <Button type="button" variant="outline" onClick={() => setIsCashoutModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={processing || externalAccounts.length === 0} className="bg-brand-rust hover:bg-brand-rust/90">
                                {processing ? 'Processing...' : 'Confirm Cash Out'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
