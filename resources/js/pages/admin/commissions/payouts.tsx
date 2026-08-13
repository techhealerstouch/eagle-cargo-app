import { Head, Link } from '@inertiajs/react';
import { History, ArrowLeft, FileText } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const payoutMethodLabels: Record<string, string> = {
    stripe: 'Stripe',
    cash: 'Cash',
    ewallet: 'E-wallet',
};

const payoutMethodStyles: Record<string, string> = {
    stripe: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    cash: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ewallet: 'bg-sky-50 text-sky-700 border-sky-200',
};

function payoutMethodLabel(payout: any) {
    return payoutMethodLabels[payout.payout_method] || 'Not recorded';
}

function payoutMethodClass(payout: any) {
    return payoutMethodStyles[payout.payout_method] || 'bg-zinc-50 text-zinc-600 border-zinc-200';
}

export default function AdminPayoutsHistory({ payouts }: { payouts: any }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Commissions', href: '/admin/commissions' },
        { title: 'Payout History', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Payout History | Admin" />
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-brand-warm/20 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/commissions"
                            className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <Heading
                            eyebrow="Financial Operations"
                            title="Payout History"
                            description="Record of all commission payouts processed for pickers."
                        />
                    </div>
                </div>

                <div className="mt-6 flex flex-col gap-6">
                    <div className="card bg-white rounded-[2.5rem] border border-brand-warm/20 shadow-sm overflow-hidden">
                        <div className="bg-brand-warm/5 p-6 border-b border-brand-warm/10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-8 w-1 bg-brand-rust rounded-full"></div>
                                <h2 className="font-serif text-lg font-bold text-brand-rust uppercase tracking-tight">Recent Payouts</h2>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-brand-warm/20 bg-brand-warm/5">
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Date</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Picker</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Amount</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Method</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Reference</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Processed By</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">Notes</th>
                                        <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right whitespace-nowrap">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payouts.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">
                                                <div className="flex flex-col items-center justify-center py-6">
                                                    <History className="size-10 text-brand-rust/20 mb-3" />
                                                    <p>No payout history found.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        payouts.data.map((payout: any) => (
                                            <tr key={payout.id} className="border-b border-brand-warm/10 hover:bg-brand-warm/5 transition-colors group">
                                                <td className="p-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-foreground">
                                                        {new Date(payout.paid_at).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {new Date(payout.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-8 rounded-full bg-brand-warm/20 flex items-center justify-center">
                                                            <span className="text-xs font-bold text-brand-rust">
                                                                {payout.picker?.name?.charAt(0) || '?'}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm font-bold text-foreground">{payout.picker?.name || 'Unknown User'}</div>
                                                    </div>
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    <div className="text-lg font-black text-brand-rust tracking-tight">
                                                        ${parseFloat(payout.total_amount).toFixed(2)}
                                                    </div>
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${payoutMethodClass(payout)}`}>
                                                        {payoutMethodLabel(payout)}
                                                    </span>
                                                    {payout.payout_provider && (
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            {payout.payout_provider}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    {payout.reference_number ? (
                                                        <span className="text-xs font-mono bg-brand-warm/10 px-2 py-1 rounded text-muted-foreground">
                                                            {payout.reference_number}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground opacity-50">-</span>
                                                    )}
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    {payout.processed_by_user ? (
                                                        <div className="text-sm text-foreground">{payout.processed_by_user.name}</div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground opacity-50">System</span>
                                                    )}
                                                </td>
                                                <td className="p-4 max-w-[200px]">
                                                    {payout.notes ? (
                                                        <p className="text-xs text-muted-foreground truncate" title={payout.notes}>
                                                            {payout.notes}
                                                        </p>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground opacity-50">-</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right whitespace-nowrap">
                                                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <FileText className="size-4 mr-2" />
                                                        Details
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {payouts.links && payouts.links.length > 3 && (
                            <div className="p-4 border-t border-brand-warm/10 flex justify-center">
                                <div className="flex gap-1">
                                    {payouts.links.map((link: any, i: number) => (
                                        <Link
                                            key={i}
                                            href={link.url || '#'}
                                            className={`px-3 py-1 text-sm rounded-md border ${link.active ? 'bg-brand-rust text-white border-brand-rust' : 'bg-white text-muted-foreground border-brand-warm/20 hover:bg-brand-warm/10'} ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}