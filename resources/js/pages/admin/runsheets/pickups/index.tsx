import { Head, Link, usePage, router } from '@inertiajs/react';
import { ClipboardList, Plus, Pencil, Phone, Eye, CheckCircle2, UserCircle2, X, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import ActiveFilterChips from '@/components/common/active-filter-chips';
import FilterSelect from '@/components/common/filter-select';
import Heading from '@/components/common/heading';
import Pagination, { type PaginationData } from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
import SortLink from '@/components/common/sort-link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface RunsheetAssigneeProfile {
    mobile: string | null;
}

interface RunsheetAssignee {
    name: string;
    role: string;
    email: string | null;
    picker?: RunsheetAssigneeProfile | null;
    courier?: RunsheetAssigneeProfile | null;
}

interface Runsheet {
    id: number;
    scheduled_date: string;
    area_description: string;
    status: string;
    type: string;
    courier: RunsheetAssignee | null;
    picker: RunsheetAssignee | null;
    bookings: any[];
}

type RunsheetPagination = PaginationData & { data: Runsheet[] };

const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground border border-border',
    assigned: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    in_progress: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    completed: 'bg-green-500/10 text-green-600 border border-green-500/20',
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pickup Runsheets', href: '/admin/runsheets/pickups' },
];

export default function PickupsIndex({
    runsheets,
    filters = { search: '', status: 'all', sort: 'created_at', direction: 'desc' },
    availablePickupsCount = 0,
}: {
    runsheets: RunsheetPagination;
    filters: { search?: string; status?: string; sort?: string; direction?: string };
    availablePickupsCount?: number;
}) {
    const { flash } = usePage<any>().props;
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [createdRunsheet, setCreatedRunsheet] = useState<any>(null);

    useEffect(() => {
        if (flash?.success) {
            setSuccessMessage(flash.success);
            setCreatedRunsheet(flash.runsheet || null);
            setShowSuccessModal(true);
        }
    }, [flash]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pickup Runsheets | Admin" />
            <div className="flex h-full flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-brand-warm/20 pb-6">
                    <Heading
                        eyebrow="Logistics Workflow"
                        title="Pickup Runsheets"
                        description="Manage pickup schedules, picker assignments, and route completion."
                    />
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin/runsheets/create?type=pickup"
                            className="bg-brand-rust text-white hover:bg-brand-rust/90 flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand-rust/10 transition-all font-sans"
                        >
                            <Plus className="size-4" />
                            New Pickup
                        </Link>
                    </div>
                </div>

                {availablePickupsCount > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800">
                        <div className="bg-amber-100 p-2 rounded-lg">
                            <ClipboardList className="size-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold">Available for Pickup</h3>
                            <p className="text-xs text-amber-700/80 mt-0.5">
                                There {availablePickupsCount === 1 ? 'is' : 'are'} {availablePickupsCount} {availablePickupsCount === 1 ? 'booking' : 'bookings'} available for pickup ready to be assigned.
                            </p>
                        </div>
                        <Link
                            href="/admin/runsheets/create?type=pickup"
                            className="text-xs font-bold bg-brand-rust text-white hover:bg-brand-rust/90 px-4 py-2 rounded-lg transition-colors"
                        >
                            Create Runsheet
                        </Link>
                    </div>
                )}

                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4 p-2 md:flex-row md:items-end md:justify-between">
                        <div className="flex flex-1 flex-wrap items-end gap-3">
                            <div className="flex flex-col gap-1.5 flex-1 max-w-sm">
                                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-brand-rust/70 px-1">
                                    <span className="h-px w-2 bg-brand-rust/20"></span>
                                    Picker Search
                                </span>
                                <SearchFilter
                                    routeName="/admin/runsheets/pickups"
                                    queryParams={filters}
                                    placeholder="Search area or picker..."
                                />
                            </div>
                            <FilterSelect
                                label="Status"
                                routeName="/admin/runsheets/pickups"
                                paramName="status"
                                queryParams={filters}
                                placeholder="All Status"
                                options={[
                                    { label: 'Draft', value: 'draft' },
                                    { label: 'Assigned', value: 'assigned' },
                                    { label: 'In Progress', value: 'in_progress' },
                                    { label: 'Completed', value: 'completed' },
                                ]}
                            />
                        </div>
                    </div>
                    <ActiveFilterChips
                        routeName="/admin/runsheets/pickups"
                        queryParams={filters}
                        className="px-3"
                    />
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                    {runsheets.data.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                                        <th className="px-4 py-3 font-semibold">Scheduled Date</th>
                                        <th className="px-4 py-3 font-semibold">Area</th>
                                        <th className="px-4 py-3 font-semibold">Boxes</th>
                                        <th className="px-4 py-3 font-semibold">Picker</th>
                                        <th className="px-4 py-3 font-semibold">Contact Number</th>
                                        <th className="px-4 py-3 font-semibold">
                                            <SortLink
                                                label="Status"
                                                sortField="status"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName="/admin/runsheets/pickups"
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 text-xs font-normal">
                                    {runsheets.data.map((rs) => {
                                        const assignee = rs.picker;
                                        const assigneeMobile = rs.picker?.picker?.mobile;
                                        const displayMobile = assigneeMobile?.trim() || null;
                                        const normalizedMobile = displayMobile?.replace(/[^\d+]/g, '');
                                        const contactHref = normalizedMobile ? `tel:${normalizedMobile}` : null;

                                        return (
                                            <tr key={rs.id} className="hover:bg-zinc-50/60 transition-colors">
                                                <td className="px-4 py-3.5 font-semibold text-zinc-900">
                                                    {new Date(rs.scheduled_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3.5 text-zinc-600">
                                                    {rs.area_description}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                                        {(() => {
                                                            const allBoxes = rs.bookings?.flatMap((b: any) => b.boxes || []) || [];
                                                            return (
                                                                <>
                                                                    {allBoxes.slice(0, 3).map((box: any) => (
                                                                        <Link
                                                                            key={box.id}
                                                                            href={`/admin/boxes/${box.id}`}
                                                                            className="text-[11px] font-mono text-zinc-700 hover:text-brand-rust transition-colors"
                                                                        >
                                                                            {box.tracking_number}
                                                                        </Link>
                                                                    ))}
                                                                    {allBoxes.length > 3 && (
                                                                        <span className="text-[11px] text-zinc-400">
                                                                            +{allBoxes.length - 3} more
                                                                        </span>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-zinc-900 font-medium">
                                                    {assignee?.name ?? <span className="text-zinc-400 italic">Unassigned</span>}
                                                </td>
                                                <td className="px-4 py-3.5 font-mono text-xs text-zinc-500">
                                                    {displayMobile || '—'}
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[rs.status] ?? 'bg-zinc-100 text-zinc-700'}`}>
                                                        {humanize(rs.status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                    <div className="flex justify-end items-center gap-1.5">
                                                        <Link
                                                            href={`/admin/runsheets/${rs.id}`}
                                                            title="View Runsheet"
                                                            className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                        >
                                                            <Eye className="size-3.5" />
                                                        </Link>
                                                        <Link
                                                            href={`/admin/runsheets/${rs.id}/edit`}
                                                            title="Edit Runsheet"
                                                            className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-brand-rust hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                        >
                                                            <Pencil className="size-3.5" />
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <Pagination data={runsheets} />
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-12">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-warm/20">
                                <ClipboardList className="size-10 text-brand-rust" />
                            </div>
                            <h3 className="mb-2 font-serif text-xl font-medium text-brand-text">
                                No pickup runsheets yet
                            </h3>
                            <p className="mb-6 max-w-sm text-center text-brand-text-mid">
                                Create a runsheet to assign a picker to a
                                collection route.
                            </p>
                            <Link
                                href="/admin/runsheets/create?type=pickup"
                                className="bg-brand-rust text-white hover:bg-brand-rust/90 flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand-rust/10 transition-all font-sans"
                            >
                                <Plus className="size-4" />
                                Create Pickup Runsheet
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
                <DialogContent className="sm:max-w-md border border-border bg-white p-6 overflow-hidden rounded-2xl shadow-xl">
                    <div className="flex flex-col items-center pt-2 pb-4 space-y-4">
                        <div className="bg-green-100 p-4 rounded-full flex items-center justify-center mb-2">
                            <Check className="size-8 text-green-600" strokeWidth={3} />
                        </div>

                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-brand-text text-center font-sans">
                                Runsheet created
                            </DialogTitle>
                            {createdRunsheet && (
                                <DialogDescription className="text-brand-text-mid font-medium text-center text-sm">
                                    Assigned and ready for pickup on {new Date(createdRunsheet.scheduled_date).toLocaleDateString()}
                                </DialogDescription>
                            )}
                        </DialogHeader>

                        {createdRunsheet && (
                            <div className="w-full bg-brand-warm/10 rounded-xl p-4 grid grid-cols-2 gap-y-4 gap-x-2 text-left mb-2">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid/70 mb-1">Boxes</p>
                                    <p className="font-bold text-brand-text text-sm">
                                        {(() => {
                                            const allBoxes = createdRunsheet.bookings?.flatMap((b: any) => b.boxes || []) || [];
                                            if (allBoxes.length > 0) {
                                                return (
                                                    <>
                                                        {allBoxes[0].tracking_number}
                                                        {allBoxes.length > 1 && ` (+${allBoxes.length - 1})`}
                                                    </>
                                                );
                                            }
                                            return 'No boxes';
                                        })()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid/70 mb-1">Area</p>
                                    <p className="font-bold text-brand-text text-sm truncate" title={createdRunsheet.area_description}>
                                        {createdRunsheet.area_description}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid/70 mb-1">Status</p>
                                    <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 capitalize border border-green-500/20">
                                        {humanize(createdRunsheet.status)}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid/70 mb-1">Contact</p>
                                    <p className="font-mono font-bold text-brand-text text-sm">
                                        {createdRunsheet.contact_mobile || 'No number'}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="w-full flex flex-col gap-3 pt-2">
                            {createdRunsheet && (
                                <Button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        router.visit(`/admin/runsheets/${createdRunsheet.id}`);
                                    }}
                                    className="w-full bg-brand-text text-white hover:bg-brand-text/90 h-11 rounded-xl text-sm font-semibold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Eye className="size-4" />
                                    View runsheet
                                </Button>
                            )}
                            <Button
                                onClick={() => setShowSuccessModal(false)}
                                variant="outline"
                                className="w-full border-border text-brand-text hover:bg-brand-warm/10 h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                            >
                                Back to pickups
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
