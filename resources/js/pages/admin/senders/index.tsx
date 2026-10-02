import { Head, Link, router, usePage } from '@inertiajs/react';
import { Eye, Pencil, Plus, Search, Trash2, Users, Sparkles, Upload, KeyRound, Loader2 } from 'lucide-react';
import { useState } from 'react';

import ActiveFilterChips from '@/components/common/active-filter-chips';
import ExcelExportButton from '@/components/common/excel-export-button';
import ExcelImportModal from '@/components/common/excel-import-modal';
import Heading from '@/components/common/heading';
import Pagination, { type PaginationData } from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
import SortLink from '@/components/common/sort-link';
import TableSelectionBar from '@/components/common/table-selection-bar';
import SenderBulkUpdateModal from '@/components/admin/sender-bulk-update-modal';
import SenderCredentialsModal from '@/components/admin/sender-credentials-modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Sender {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    mobile: string;
    address: string;
}

type SenderPagination = PaginationData & { data: Sender[] };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Senders', href: '/admin/senders' },
];

export default function SendersIndex({
    senders,
    filters = { search: '', sort: 'first_name', direction: 'asc' },
}: {
    senders: SenderPagination;
    filters?: {
        search?: string;
        sort?: string;
        direction?: string;
    };
}) {
    const { auth } = usePage<any>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isGlobalSelection, setIsGlobalSelection] = useState(false);
    const [isSenderBulkUpdateModalOpen, setIsSenderBulkUpdateModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedSenderForCredentials, setSelectedSenderForCredentials] = useState<Sender | null>(null);

    const toggleSelect = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(item => item !== id));
            setIsGlobalSelection(false);
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === senders.data.length) {
            setSelectedIds([]);
            setIsGlobalSelection(false);
        } else {
            setSelectedIds(senders.data.map(s => s.id));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Senders Directory | Admin" />

            <ExcelImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Senders"
                description="Upload an Excel (.xlsx) file to create new senders or update existing profiles by email."
                importUrl="/admin/senders/import-excel"
                templateUrl="/admin/senders/import-template"
                entityName="Senders"
            />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
                    <Heading
                        eyebrow="Customer Directory"
                        title="Registered Senders"
                        description="Manage primary sender profiles and contact information."
                    />
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <ExcelExportButton
                            exportUrl="/admin/senders/export-excel"
                            selectedIds={selectedIds}
                            filters={filters}
                            label="Export"
                            size="sm"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsImportModalOpen(true)}
                            className="gap-1.5"
                        >
                            <Upload className="size-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Import</span>
                        </Button>
                        <Link
                            href="/admin/senders/create"
                            className="h-8 px-3 rounded-lg bg-brand-rust text-white dark:text-zinc-950 text-xs font-medium hover:bg-brand-rust/90 flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
                        >
                            <Plus className="size-3.5" />
                            Add Sender
                        </Link>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                            <SearchFilter
                                routeName="/admin/senders"
                                queryParams={filters}
                                placeholder="Search by name or email..."
                            />
                        </div>
                    </div>
                    <ActiveFilterChips
                        routeName="/admin/senders"
                        queryParams={filters}
                    />
                </div>

                <div className="card overflow-hidden shadow-xs">
                    {senders.data.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border bg-brand-warm/10 dark:bg-brand-warm/20 text-xs font-semibold text-brand-text-mid">
                                        <th scope="col" className="px-4 py-3 w-10">
                                            <Checkbox
                                                checked={selectedIds.length === senders.data.length && senders.data.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                                aria-label="Select all"
                                                className="size-4 rounded border-border"
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Mobile</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Address</th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-xs font-normal">
                                    {senders.data.map((sender) => (
                                        <tr key={sender.id} className="hover:bg-brand-cream/20 dark:hover:bg-brand-warm/20 transition-colors">
                                            <td className="px-4 py-3.5">
                                                <Checkbox
                                                    checked={selectedIds.includes(sender.id)}
                                                    onCheckedChange={() => toggleSelect(sender.id)}
                                                    aria-label={`Select ${sender.first_name}`}
                                                    className="size-4 rounded border-border"
                                                />
                                            </td>
                                            <td className="px-4 py-3.5 font-semibold text-brand-text">
                                                {sender.first_name} {sender.last_name}
                                            </td>
                                            <td className="px-4 py-3.5 text-brand-text-mid">
                                                {sender.email}
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-xs text-brand-text-mid">
                                                {sender.mobile}
                                            </td>
                                            <td className="px-4 py-3.5 text-brand-text-mid max-w-xs truncate">
                                                {sender.address}
                                            </td>
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex justify-end items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedSenderForCredentials(sender)}
                                                        title="Account Credentials"
                                                        className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-brand-rust hover:bg-brand-warm/50 hover:border-brand-sand dark:hover:border-border transition-all flex items-center justify-center shadow-2xs"
                                                    >
                                                        <KeyRound className="size-3.5" />
                                                    </button>
                                                    <Link
                                                        href={`/admin/senders/${sender.id}`}
                                                        title="View sender details"
                                                        className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-brand-rust hover:bg-brand-warm/50 hover:border-brand-sand dark:hover:border-border transition-all flex items-center justify-center shadow-2xs"
                                                    >
                                                        <Eye className="size-3.5" />
                                                    </Link>
                                                    <Link
                                                        href={`/admin/senders/${sender.id}/edit`}
                                                        title="Edit sender"
                                                        className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-brand-rust hover:bg-brand-warm/50 hover:border-brand-sand dark:hover:border-border transition-all flex items-center justify-center shadow-2xs"
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
                        <div className="px-4 py-8 text-center text-xs text-brand-text-light/60 italic">
                            No senders found.
                        </div>
                    )}

                    <Pagination data={senders} />
                </div>
            </div>

            <TableSelectionBar
                selectedCount={selectedIds.length}
                totalCount={senders.total}
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
                        onClick: () => setIsSenderBulkUpdateModalOpen(true),
                    }
                ]}
            />

            <SenderBulkUpdateModal
                isOpen={isSenderBulkUpdateModalOpen}
                onClose={() => setIsSenderBulkUpdateModalOpen(false)}
                selectedIds={selectedIds}
                isGlobalSelection={isGlobalSelection}
                filters={filters}
                onSuccessCallback={() => {
                    setSelectedIds([]);
                    setIsGlobalSelection(false);
                }}
            />

            <SenderCredentialsModal
                isOpen={Boolean(selectedSenderForCredentials)}
                onClose={() => setSelectedSenderForCredentials(null)}
                sender={selectedSenderForCredentials}
            />
        </AppLayout>
    );
}
