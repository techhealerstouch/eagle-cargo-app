import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCircle, CircleAlert, CircleDollarSign, Eye, ListFilter, Pencil, Plus, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import ActiveFilterChips from '@/components/common/active-filter-chips';
import ConfirmModal from '@/components/common/confirm-modal';
import Heading from '@/components/common/heading';
import Pagination, { PaginationData } from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
import SortLink from '@/components/common/sort-link';
import TableSelectionBar from '@/components/common/table-selection-bar';
import InvoiceBulkUpdateModal from '@/components/admin/invoice-bulk-update-modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import admin from '@/routes/admin';
import type { BreadcrumbItem } from '@/types';

interface Invoice {
    id: number;
    invoice_number: string;
    booking: {
        id: number;
        reference_number: string;
        sender: {
            first_name: string;
            last_name: string;
        };
        status: string;
    };
    amount: number | string;
    balance?: number | string;
    status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'voided';
    due_date?: string;
    created_at: string;
    deleted_at?: string | null;
}

type InvoicePagination = PaginationData & { data: Invoice[] };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Invoices', href: '/admin/invoices' },
];

const STATUS_COLORS: Record<string, string> = {
    unpaid: 'bg-amber-50 text-amber-700 border border-amber-200',
    partial: 'bg-sky-50 text-sky-700 border border-sky-200',
    paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    overdue: 'bg-red-50 text-red-700 border border-red-200',
    voided: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
};

export default function InvoicesIndex({
    invoices,
    filters = { search: '', status: 'all', sort: 'created_at', direction: 'desc', trashed: false },
}: {
    invoices: InvoicePagination;
    filters?: {
        search?: string;
        status?: string;
        sort?: string;
        direction?: string;
        trashed?: boolean | string;
    };
}) {
    const { auth } = usePage<any>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';
    const listingRoute = admin.invoices.index().url;

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isGlobalSelection, setIsGlobalSelection] = useState<boolean>(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [isInvoiceBulkUpdateModalOpen, setIsInvoiceBulkUpdateModalOpen] = useState(false);

    const toggleSelect = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(item => item !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === invoices.data.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(invoices.data.map(i => i.id));
        }
    };

    const handleStatusChange = (status: string) => {
        if (status === 'trashed') {
            router.get(listingRoute, { trashed: true }, { preserveState: true });
        } else {
            router.get(
                listingRoute,
                { ...filters, status: status === 'all' ? '' : status, trashed: undefined },
                { preserveState: true }
            );
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Invoices | Admin" />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-zinc-200/80 pb-5">
                    <Heading
                        eyebrow="Financial Management"
                        title="Invoices Overview"
                        description="Track and manage sender invoices, payment status, and outstanding balances."
                    />
                </div>

                <div className="flex flex-col gap-4">
                    <Tabs
                        value={filters.trashed ? 'trashed' : (filters.status || 'all')}
                        onValueChange={handleStatusChange}
                        className="w-full"
                    >
                        <TabsList className="h-10 inline-flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-1 w-auto overflow-x-auto">
                            <TabsTrigger value="all" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <ListFilter className="size-3.5" />
                                All
                            </TabsTrigger>
                            <TabsTrigger value="unpaid" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <CircleDollarSign className="size-3.5" />
                                Unpaid
                            </TabsTrigger>
                            <TabsTrigger value="partial" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <CircleAlert className="size-3.5" />
                                Partial
                            </TabsTrigger>
                            <TabsTrigger value="paid" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <CheckCircle className="size-3.5" />
                                Paid
                            </TabsTrigger>
                            {isSuperAdmin && (
                                <TabsTrigger value="trashed" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                    <AlertTriangle className="size-3.5" />
                                    Archived
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                            <SearchFilter
                                routeName={listingRoute}
                                queryParams={filters}
                                placeholder="Search invoice, booking, sender..."
                                ariaLabel="Search invoices"
                            />
                        </div>
                    </div>

                    <ActiveFilterChips
                        routeName={listingRoute}
                        queryParams={filters}
                    />
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                    {invoices.data.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                                        <th scope="col" className="px-4 py-3 w-10">
                                            <Checkbox
                                                checked={selectedIds.length === invoices.data.length && invoices.data.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                                aria-label="Select all"
                                                className="size-4 rounded border-zinc-300"
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Invoice #</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Booking Ref</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Sender</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Amount</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 text-xs font-normal">
                                    {invoices.data.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-zinc-50/60 transition-colors">
                                            <td className="px-4 py-3.5">
                                                <Checkbox
                                                    checked={selectedIds.includes(inv.id)}
                                                    onCheckedChange={() => toggleSelect(inv.id)}
                                                    aria-label={`Select invoice ${inv.invoice_number}`}
                                                    className="size-4 rounded border-zinc-300"
                                                />
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-xs font-semibold text-zinc-900">
                                                <Link href={`/admin/invoices/${inv.id}`} className="hover:text-brand-rust transition-colors">
                                                    {inv.invoice_number}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-xs font-medium text-zinc-900">
                                                {inv.booking ? (
                                                    <Link href={`/admin/bookings/${inv.booking.id}`} className="hover:text-brand-rust transition-colors">
                                                        {inv.booking.reference_number}
                                                    </Link>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 font-semibold text-zinc-900">
                                                {inv.booking?.sender ? `${inv.booking.sender.first_name} ${inv.booking.sender.last_name}` : '—'}
                                            </td>
                                            <td className="px-4 py-3.5 font-semibold text-zinc-900">
                                                ${Number(inv.amount).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inv.status] ?? 'bg-zinc-100 text-zinc-700'}`}>
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex justify-end items-center gap-1.5">
                                                    <Link
                                                        href={`/admin/invoices/${inv.id}`}
                                                        title="View invoice"
                                                        className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                    >
                                                        <Eye className="size-3.5" />
                                                    </Link>
                                                    <Link
                                                        href={`/admin/invoices/${inv.id}/edit`}
                                                        title="Edit invoice"
                                                        className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-brand-rust hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                    >
                                                        <Pencil className="size-3.5" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-4 py-8 text-center text-xs text-zinc-400 italic">
                            No invoices found.
                        </div>
                    )}

                    <Pagination data={invoices} />
                </div>
            </div>

            <TableSelectionBar
                selectedCount={selectedIds.length}
                totalCount={invoices.total}
                isGlobalSelection={isGlobalSelection}
                onToggleGlobal={setIsGlobalSelection}
                onClear={() => {
                    setSelectedIds([]);
                    setIsGlobalSelection(false);
                }}
                actions={[
                    {
                        label: 'Update Selected',
                        icon: Sparkles,
                        onClick: () => setIsInvoiceBulkUpdateModalOpen(true),
                    }
                ]}
            />

            <InvoiceBulkUpdateModal
                isOpen={isInvoiceBulkUpdateModalOpen}
                onClose={() => setIsInvoiceBulkUpdateModalOpen(false)}
                selectedIds={selectedIds}
                isGlobalSelection={isGlobalSelection}
                filters={filters}
                onSuccessCallback={() => {
                    setSelectedIds([]);
                    setIsGlobalSelection(false);
                }}
            />
        </AppLayout>
    );
}
