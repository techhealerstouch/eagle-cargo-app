import { Head, Link } from '@inertiajs/react';
import { Filter, Pencil, Plus, Radio } from 'lucide-react';
import ActiveFilterChips from '@/components/common/active-filter-chips';
import ClearFiltersButton from '@/components/common/clear-filters-button';
import FilterSelect from '@/components/common/filter-select';
import Heading from '@/components/common/heading';
import SearchFilter from '@/components/common/search-filter';
import SortLink from '@/components/common/sort-link';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface ShippingUpdate {
    id: number;
    type: 'info' | 'alert' | 'success';
    title: string;
    body: string;
    is_published: boolean;
    published_at: string | null;
    created_at: string;
}

interface PaginationProps {
    data: ShippingUpdate[];
    links: { url: string | null; label: string; active: boolean }[];
}

const TYPE_COLORS: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800',
    alert: 'bg-red-100 text-red-700',
    success: 'bg-green-100 text-green-800',
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Shipping Updates', href: '/admin/shipping-updates' },
];

export default function ShippingUpdatesIndex({
    updates,
    filters = { search: '', type: 'all', is_published: 'all', sort: 'created_at', direction: 'desc' },
}: {
    updates: PaginationProps;
    filters?: {
        search?: string;
        type?: string;
        is_published?: string;
        sort?: string;
        direction?: string;
    };
}) {
    const listingRoute = '/admin/shipping-updates';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Shipping Updates | Admin" />
            <div className="flex h-full flex-1 flex-col gap-6 p-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-brand-warm/20 pb-6">
                    <Heading
                        eyebrow="Public Relations"
                        title="Shipping Updates"
                        description="Manage public announcements and shipping status notifications for your customers."
                    />
                    <Link
                        href="/admin/shipping-updates/create"
                        className="bg-brand-rust text-white hover:bg-brand-rust/90 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-brand-rust/10 transition-all font-sans"
                    >
                        <Plus className="size-4" />
                        New Update
                    </Link>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 p-2 md:flex-row md:items-end md:justify-between">
                        <div className="flex flex-1 flex-wrap items-end gap-3">
                            <div className="flex flex-col gap-1.5 flex-1 max-w-sm">
                                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-brand-text-mid/70 px-1">
                                    <span className="h-px w-2 bg-brand-rust/20"></span>
                                    Broadcast Search
                                </span>
                                <SearchFilter
                                    routeName={listingRoute}
                                    queryParams={filters}
                                    placeholder="Search update title or body..."
                                    ariaLabel="Search shipping updates"
                                />
                            </div>
                            <FilterSelect
                                label="Update Type"
                                routeName={listingRoute}
                                paramName="type"
                                queryParams={filters}
                                placeholder="All Types"
                                ariaLabel="Filter shipping updates by type"
                                options={[
                                    { label: 'Info', value: 'info' },
                                    { label: 'Alert', value: 'alert' },
                                    { label: 'Success', value: 'success' },
                                ]}
                            />
                            <FilterSelect
                                label="Visibility"
                                routeName={listingRoute}
                                paramName="is_published"
                                queryParams={filters}
                                placeholder="All Visibility"
                                ariaLabel="Filter shipping updates by publication state"
                                options={[
                                    { label: 'Published', value: 'published' },
                                    { label: 'Draft', value: 'draft' },
                                ]}
                            />
                        </div>
                    </div>
                    <ActiveFilterChips
                        routeName={listingRoute}
                        queryParams={filters}
                        labels={{
                            search: 'Search',
                            type: 'Type',
                            is_published: 'Visibility',
                        }}
                        className="px-3"
                    />
                </div>

                <div className="card flex-1 overflow-hidden border-brand-warm/20 shadow-sm rounded-2xl">
                    {updates.data.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-brand-warm/20 bg-brand-warm/5 font-serif text-brand-rust">
                                    <tr>
                                        <th className="px-6 py-5">
                                            <SortLink
                                                label="Type"
                                                sortField="type"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName={listingRoute}
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th className="px-6 py-5">
                                            <SortLink
                                                label="Title"
                                                sortField="title"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName={listingRoute}
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th className="px-6 py-5">
                                            <SortLink
                                                label="Published"
                                                sortField="is_published"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName={listingRoute}
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th className="px-6 py-5">
                                            <SortLink
                                                label="Date"
                                                sortField="created_at"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName={listingRoute}
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th className="px-6 py-5 uppercase tracking-wider text-xs font-bold text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-sand">
                                    {updates.data.map((upd) => (
                                        <tr
                                            key={upd.id}
                                            className="transition-colors hover:bg-brand-sand/20"
                                        >
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TYPE_COLORS[upd.type]}`}
                                                >
                                                    {upd.type}
                                                </span>
                                            </td>
                                            <td className="max-w-70 truncate px-6 py-4 font-medium">
                                                {upd.title}
                                            </td>
                                            <td className="px-6 py-4">
                                                {upd.is_published ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
                                                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-600"></span>{' '}
                                                        Live
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-brand-text-mid">
                                                        Draft
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-brand-text-mid">
                                                {new Date(
                                                    upd.created_at,
                                                ).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link
                                                        href={`/admin/shipping-updates/${upd.id}/edit`}
                                                        className="rounded-lg p-2 text-brand-text-mid transition-colors hover:bg-brand-sand/50 hover:text-brand-rust"
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="flex items-center justify-center gap-2 border-t border-brand-sand px-6 py-4">
                                {((Array.isArray(updates.links) ? updates.links : (updates.links ? Object.values(updates.links) : [])) as Array<{ url: string | null; label: string; active: boolean }>).map((link, i) =>
                                    link.url ? (
                                        <Link
                                            key={i}
                                            href={link.url}
                                            className={`rounded-md px-3 py-1 text-sm transition-colors ${link.active ? 'bg-brand-rust text-white' : 'hover:bg-brand-sand/50'}`}
                                            dangerouslySetInnerHTML={{
                                                __html: link.label,
                                            }}
                                        />
                                    ) : (
                                        <span
                                            key={i}
                                            className="rounded-md px-3 py-1 text-sm text-brand-text-mid"
                                            dangerouslySetInnerHTML={{
                                                __html: link.label,
                                            }}
                                        />
                                    ),
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-12">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-warm">
                                <Radio className="size-10 text-brand-rust" />
                            </div>
                            <h3 className="mb-2 font-serif text-xl font-medium text-brand-text">
                                No shipping updates
                            </h3>
                            <p className="mb-6 max-w-sm text-center text-brand-text-mid">
                                Publish updates to keep senders informed about
                                their shipments.
                            </p>
                            <Link
                                href="/admin/shipping-updates/create"
                                className="btn-outline"
                            >
                                Create First Update
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}





