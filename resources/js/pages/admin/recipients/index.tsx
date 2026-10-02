import { Head, Link } from '@inertiajs/react';
import { Eye, Pencil, Users, Upload } from 'lucide-react';
import { useState } from 'react';

import ExcelExportButton from '@/components/common/excel-export-button';
import ExcelImportModal from '@/components/common/excel-import-modal';
import Heading from '@/components/common/heading';
import Pagination, { type PaginationData } from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Recipient {
    id: number;
    name: string;
    phone_number: string;
    address: string;
    city: string;
    province: string;
    sender?: { first_name: string; last_name: string } | null;
    area?: { name: string } | null;
}

type RecipientPagination = PaginationData & { data: Recipient[] };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Recipients', href: '/admin/recipients' },
];

export default function RecipientsIndex({
    recipients,
    filters = { search: '' },
}: {
    recipients: RecipientPagination;
    filters?: { search?: string };
}) {
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Recipients Directory | Admin" />

            <ExcelImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Recipients"
                description="Upload an Excel (.xlsx) file to create new or update existing recipients linked to senders."
                importUrl="/admin/recipients/import-excel"
                templateUrl="/admin/recipients/import-template"
                entityName="Recipients"
            />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
                    <Heading
                        eyebrow="Recipient Directory"
                        title="Delivery Recipients"
                        description="Manage recipient addresses and contact profiles."
                    />
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <ExcelExportButton
                            exportUrl="/admin/recipients/export-excel"
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
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                            <SearchFilter
                                routeName="/admin/recipients"
                                queryParams={filters}
                                placeholder="Search by name, city, province..."
                            />
                        </div>
                    </div>
                </div>

                <div className="card overflow-hidden shadow-xs">
                    {recipients.data.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border bg-brand-warm/10 dark:bg-brand-warm/20 text-xs font-semibold text-brand-text-mid">
                                        <th className="px-4 py-3 font-semibold">Name</th>
                                        <th className="px-4 py-3 font-semibold">Sender</th>
                                        <th className="px-4 py-3 font-semibold">Area</th>
                                        <th className="px-4 py-3 font-semibold">City / Province</th>
                                        <th className="px-4 py-3 font-semibold">Phone</th>
                                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-xs font-normal">
                                    {recipients.data.map((r) => (
                                        <tr key={r.id} className="hover:bg-brand-cream/20 dark:hover:bg-brand-warm/20 transition-colors">
                                            <td className="px-4 py-3.5 font-semibold text-brand-text">{r.name}</td>
                                            <td className="px-4 py-3.5 text-brand-text-mid">{r.sender ? `${r.sender.first_name} ${r.sender.last_name}` : '—'}</td>
                                            <td className="px-4 py-3.5 text-brand-text-mid">{r.area?.name || '—'}</td>
                                            <td className="px-4 py-3.5 text-brand-text-mid">{r.city}, {r.province}</td>
                                            <td className="px-4 py-3.5 font-mono text-xs text-brand-text-mid">{r.phone_number || '—'}</td>
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex justify-end items-center gap-1.5">
                                                    <Link
                                                        href={`/admin/recipients/${r.id}`}
                                                        title="View recipient details"
                                                        className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-brand-rust hover:bg-brand-warm/50 hover:border-brand-sand dark:hover:border-border transition-all flex items-center justify-center shadow-2xs"
                                                    >
                                                        <Eye className="size-3.5" />
                                                    </Link>
                                                    <Link
                                                        href={`/admin/recipients/${r.id}/edit`}
                                                        title="Edit recipient"
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
                            No recipients found.
                        </div>
                    )}

                    <Pagination data={recipients} />
                </div>
            </div>
        </AppLayout>
    );
}
