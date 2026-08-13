import { Head, Link } from '@inertiajs/react';
import { Eye, Filter, MessageSquare } from 'lucide-react';
import ActiveFilterChips from '@/components/common/active-filter-chips';
import ClearFiltersButton from '@/components/common/clear-filters-button';
import FilterSelect from '@/components/common/filter-select';
import Heading from '@/components/common/heading';
import Pagination from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Enquiry {
    id: number;
    name: string;
    email: string;
    mobile: string | null;
    message: string;
    is_read: boolean;
    created_at: string;
}

interface PaginationProps {
    data: Enquiry[];
    links: { url: string | null; label: string; active: boolean }[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Enquiries', href: '/admin/enquiries' },
];

export default function EnquiriesIndex({
    enquiries,
    filters = {},
}: {
    enquiries: PaginationProps;
    filters?: {
        search?: string;
        is_read?: string;
    };
}) {
    const listingRoute = '/admin/enquiries';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Enquiries | Admin" />
            <div className="flex h-full flex-1 flex-col gap-6 p-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-brand-warm/20 pb-6">
                    <Heading
                        eyebrow="Customer Communication"
                        title="Inquiry Inbox"
                        description="Review and respond to sender messages and contact form submissions."
                    />
                    <div className="flex items-center gap-2 rounded-xl bg-brand-warm/20 px-6 py-3 text-sm font-bold text-brand-rust uppercase tracking-widest font-sans border border-brand-rust/10 shadow-sm">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-rust animate-pulse"></span>
                        {enquiries.data.filter((e) => !e.is_read).length} unread
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 p-2 md:flex-row md:items-end md:justify-between">
                        <div className="flex flex-1 flex-wrap items-end gap-3">
                            <div className="flex flex-col gap-1.5 flex-1 max-w-sm">
                                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-brand-text-mid/70 px-1">
                                    <span className="h-px w-2 bg-brand-rust/20"></span>
                                    Inquiry Search
                                </span>
                                <SearchFilter
                                    routeName={listingRoute}
                                    queryParams={filters}
                                    placeholder="Search name, email, message..."
                                    ariaLabel="Search enquiries"
                                />
                            </div>
                            <FilterSelect
                                label="Message State"
                                routeName={listingRoute}
                                paramName="is_read"
                                queryParams={filters}
                                placeholder="All Messages"
                                ariaLabel="Filter enquiries by read state"
                                options={[
                                    { label: 'Unread', value: 'unread' },
                                    { label: 'Read', value: 'read' },
                                ]}
                            />
                        </div>
                    </div>
                    <ActiveFilterChips
                        routeName={listingRoute}
                        queryParams={filters}
                        labels={{ search: 'Search', is_read: 'Read State' }}
                        className="px-3"
                    />
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                    {enquiries.data.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                                        <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Message Preview</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Received</th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 text-xs font-normal">
                                    {enquiries.data.map((enq) => (
                                        <tr key={enq.id} className="hover:bg-zinc-50/60 transition-colors">
                                            <td className="px-4 py-3.5 font-semibold text-zinc-900">
                                                <div className="flex items-center gap-2">
                                                    {!enq.is_read && (
                                                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-rust"></span>
                                                    )}
                                                    {enq.name}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-600">
                                                {enq.email}
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-500 max-w-xs truncate">
                                                {enq.message}
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-600 whitespace-nowrap">
                                                {new Date(enq.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex justify-end items-center gap-1.5">
                                                    <Link
                                                        href={`/enquiries/${enq.id}`}
                                                        title="View enquiry"
                                                        className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                    >
                                                        <Eye className="size-3.5" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <Pagination data={enquiries} />
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-12">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-warm">
                                <MessageSquare className="size-10 text-brand-rust" />
                            </div>
                            <h3 className="mb-2 font-serif text-xl font-medium text-brand-text">
                                No enquiries yet
                            </h3>
                            <p className="max-w-sm text-center text-brand-text-mid">
                                Sender messages will appear here once they use
                                the contact form.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}





