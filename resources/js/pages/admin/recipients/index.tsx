import { Head, Link } from '@inertiajs/react';
import { Eye, Pencil, Users } from 'lucide-react';

import Heading from '@/components/common/heading';
import Pagination from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
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

interface PaginationProps {
    data: Recipient[];
    links: { url: string | null; label: string; active: boolean }[];
    current_page: number;
    total: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Recipients', href: '/admin/recipients' },
];

export default function RecipientsIndex({
    recipients,
    filters = { search: '' },
}: {
    recipients: PaginationProps;
    filters?: { search?: string };
}) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Recipients Directory | Admin" />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-zinc-200/80 pb-5">
                    <Heading
                        eyebrow="Recipient Directory"
                        title="Delivery Recipients"
                        description="Manage recipient addresses and contact profiles."
                    />
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

                <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                    {recipients.data.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                                        <th className="px-4 py-3 font-semibold">Name</th>
                                        <th className="px-4 py-3 font-semibold">Sender</th>
                                        <th className="px-4 py-3 font-semibold">Area</th>
                                        <th className="px-4 py-3 font-semibold">City / Province</th>
                                        <th className="px-4 py-3 font-semibold">Phone</th>
                                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 text-xs font-normal">
                                    {recipients.data.map((r) => (
                                        <tr key={r.id} className="hover:bg-zinc-50/60 transition-colors">
                                            <td className="px-4 py-3.5 font-semibold text-zinc-900">{r.name}</td>
                                            <td className="px-4 py-3.5 text-zinc-600">{r.sender ? `${r.sender.first_name} ${r.sender.last_name}` : '—'}</td>
                                            <td className="px-4 py-3.5 text-zinc-600">{r.area?.name || '—'}</td>
                                            <td className="px-4 py-3.5 text-zinc-500">{r.city}, {r.province}</td>
                                            <td className="px-4 py-3.5 font-mono text-xs text-zinc-500">{r.phone_number || '—'}</td>
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex justify-end items-center gap-1.5">
                                                    <Link
                                                        href={`/admin/recipients/${r.id}`}
                                                        title="View recipient details"
                                                        className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-brand-rust hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                    >
                                                        <Eye className="size-3.5" />
                                                    </Link>
                                                    <Link
                                                        href={`/admin/recipients/${r.id}/edit`}
                                                        title="Edit recipient"
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
                            No recipients found.
                        </div>
                    )}

                    <Pagination data={recipients} />
                </div>
            </div>
        </AppLayout>
    );
}
