import { Head, Link, router } from '@inertiajs/react';
import { Building, CircleDollarSign, CreditCard, ListFilter } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import ActiveFilterChips from '@/components/common/active-filter-chips';
import Heading from '@/components/common/heading';
import Pagination from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
import SortLink from '@/components/common/sort-link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Payment {
    id: number;
    invoice: {
        id: number;
        invoice_number: string;
        booking: {
            id: number;
            reference_number: string;
            sender: {
                first_name: string;
                last_name: string;
            };
        };
    };
    amount: number | string;
    payment_method: string;
    reference_number: string | null;
    paid_at: string;
    is_pending_confirmation?: boolean;
    payment_overridden_at?: string | null;
    payment_overridden_by_name?: string | null;
    collected_by?: {
        name: string;
    } | null;
}

interface PaginationProps {
    data: Payment[];
    links: { url: string | null; label: string; active: boolean }[];
    current_page: number;
    total: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Payments', href: '/admin/payments' },
];

export default function PaymentsIndex({
    payments,
    filters = { search: '', method: 'all', sort: 'paid_at', direction: 'desc' },
}: {
    payments: PaginationProps;
    filters?: {
        search?: string;
        method?: string;
        sort?: string;
        direction?: string;
    };
}) {
    const handleMethodChange = (method: string) => {
        router.get(
            '/admin/payments',
            { ...filters, method: method === 'all' ? '' : method },
            { preserveState: true }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Payments Ledger | Admin" />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-zinc-200/80 pb-5">
                    <Heading
                        eyebrow="Financial Operations"
                        title="Payment Records"
                        description="Audit and record received customer payments."
                    />
                </div>

                <div className="flex flex-col gap-4">
                    <Tabs
                        value={filters.method || 'all'}
                        onValueChange={handleMethodChange}
                        className="w-full"
                    >
                        <TabsList className="h-10 inline-flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-1 w-auto overflow-x-auto">
                            <TabsTrigger value="all" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <ListFilter className="size-3.5" />
                                All Methods
                            </TabsTrigger>
                            <TabsTrigger value="cash" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <CircleDollarSign className="size-3.5" />
                                Cash
                            </TabsTrigger>
                            <TabsTrigger value="bank_transfer" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <Building className="size-3.5" />
                                Bank Transfer
                            </TabsTrigger>
                            <TabsTrigger value="stripe_card" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <CreditCard className="size-3.5" />
                                Stripe Card
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                            <SearchFilter
                                routeName="/admin/payments"
                                queryParams={filters}
                                placeholder="Search reference number..."
                            />
                        </div>
                    </div>

                    <ActiveFilterChips
                        routeName="/admin/payments"
                        queryParams={filters}
                    />
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                    {payments.data.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                                        <th className="px-4 py-3 font-semibold">Invoice</th>
                                        <th className="px-4 py-3 font-semibold">Booking Ref</th>
                                        <th className="px-4 py-3 font-semibold">Sender</th>
                                        <th className="px-4 py-3 font-semibold">Amount</th>
                                        <th className="px-4 py-3 font-semibold">Method</th>
                                        <th className="px-4 py-3 font-semibold">Collected By</th>
                                        <th className="px-4 py-3 font-semibold">Reference</th>
                                        <th className="px-4 py-3 font-semibold">Paid At</th>
                                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 text-xs font-normal">
                                    {payments.data.map((p) => (
                                        <tr key={p.id} className="hover:bg-zinc-50/60 transition-colors">
                                            <td className="px-4 py-3.5 font-mono text-xs font-semibold text-zinc-900">
                                                {p.invoice?.invoice_number || '—'}
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-xs text-zinc-500">
                                                {p.invoice?.booking?.reference_number || '—'}
                                            </td>
                                            <td className="px-4 py-3.5 font-semibold text-zinc-900">
                                                {p.invoice?.booking?.sender 
                                                    ? `${p.invoice.booking.sender.first_name} ${p.invoice.booking.sender.last_name}`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3.5 font-semibold text-zinc-900">
                                                ${Number(p.amount).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                {p.payment_method ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 capitalize">
                                                        {p.payment_method.replace('_', ' ')}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-400 italic">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-600">
                                                {p.collected_by?.name || '—'}
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-xs text-zinc-500">
                                                {p.reference_number || '—'}
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-600 whitespace-nowrap">
                                                {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}
                                            </td>
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <span className="text-zinc-400">—</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-4 py-8 text-center text-xs text-zinc-400 italic">
                            No payments recorded yet.
                        </div>
                    )}

                    <Pagination data={payments} />
                </div>
            </div>
        </AppLayout>
    );
}
