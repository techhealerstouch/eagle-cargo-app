                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           import { Head, Link, useForm, router, usePage } from '@inertiajs/react';
import { RefreshCw, Ban, AlertTriangle, Eye, Pencil, Plus, ListFilter, Clock, CheckCircle, Package, Ship, Truck, MapPin, Sparkles } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

import ActiveFilterChips from '@/components/common/active-filter-chips';
import UpdateBoxStatusModal from '@/components/admin/update-box-status-modal';
import BoxBulkUpdateModal from '@/components/admin/box-bulk-update-modal';
import BulkAssignBatchModal from '@/components/admin/bulk-assign-batch-modal';
import ConfirmModal from '@/components/common/confirm-modal';
import Heading from '@/components/common/heading';
import Pagination, { type PaginationData } from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
import FilterSelect from '@/components/common/filter-select';
import SortLink from '@/components/common/sort-link';
import TableSelectionBar from '@/components/common/table-selection-bar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface Box {
    id: number;
    serial_number: string | null;
    tracking_number: string;
    status: string;
    tracking_step_key?: string | null;
    is_eligible_for_update?: boolean;
    booking: {
        id: number;
        reference_number: string;
        sender: {
            first_name: string;
            last_name: string;
        };
    };
    recipient?: {
        name: string;
        address: string;
        city: string;
        province: string;
    } | null;
    latest_update?: {
        is_admin_override: boolean;
        steps_bypassed: number;
    } | null;
    created_at: string;
    tracking_views_count?: number;
    last_tracked_at?: string | null;
    deleted_at?: string | null;
    batch?: {
        id: number;
        batch_number: string;
    } | null;
}

interface Area {
    id: number;
    name: string;
}

type BoxPagination = PaginationData & { data: Box[] };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Boxes', href: '/admin/boxes' },
];

const BOX_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
    empty_delivered: { label: 'Empty Box Delivered', badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
    collected: { label: 'Collected from Sender', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    loaded: { label: 'Loaded into Container', badge: 'bg-sky-50 text-sky-700 border border-sky-200' },
    in_transit: { label: 'In Transit / Sea Freight', badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
    arrived: { label: 'Arrived Port of Manila', badge: 'bg-purple-50 text-purple-700 border border-purple-200' },
    out_for_delivery: { label: 'Out for Local Delivery', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
    delivered: { label: 'Delivered to Recipient', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    cancelled: { label: 'Cancelled / Returned', badge: 'bg-red-50 text-red-700 border border-red-200' },
};

export default function BoxesIndex({
    boxes,
    areas = [],
    activeBatches = [],
    filters = { search: '', status: 'all', sort: 'created_at', direction: 'desc', trashed: false },
}: {
    boxes: BoxPagination;
    areas?: Area[];
    activeBatches?: any[];
    filters?: {
        search?: string;
        status?: string;
        area_id?: string;
        sort?: string;
        direction?: string;
        trashed?: boolean | string;
    };
}) {
    const { auth } = usePage<any>().props;
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [selectedBox, setSelectedBox] = useState<Box | null>(null);
    const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [isGlobalSelection, setIsGlobalSelection] = useState(false);
    const [isBoxBulkUpdateModalOpen, setIsBoxBulkUpdateModalOpen] = useState(false);
    const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [selectedStatusBox, setSelectedStatusBox] = useState<Box | null>(null);
    const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const toggleSelect = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(item => item !== id));
            setIsGlobalSelection(false);
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === boxes.data.length) {
            setSelectedIds([]);
            setIsGlobalSelection(false);
        } else {
            setSelectedIds(boxes.data.map(b => b.id));
        }
    };

    const handleArchiveConfirm = () => {
        if (!selectedBox) return;
        setIsProcessing(true);
        router.delete(`/admin/boxes/${selectedBox.id}`, {
            onSuccess: () => {
                setSelectedBox(null);
                setIsArchiveModalOpen(false);
                toast.success('Box archived successfully');
            },
            onError: () => {
                toast.error('Failed to archive box');
            },
            onFinish: () => setIsProcessing(false),
        });
    };

    const handleRestoreConfirm = () => {
        if (!selectedBox) return;
        setIsProcessing(true);
        router.post(`/admin/boxes/${selectedBox.id}/restore`, {}, {
            onSuccess: () => {
                setSelectedBox(null);
                setIsRestoreModalOpen(false);
                toast.success('Box restored successfully');
            },
            onError: () => {
                toast.error('Failed to restore box');
            },
            onFinish: () => setIsProcessing(false),
        });
    };

    const handleBulkArchiveConfirm = () => {
        // Now handled inside BoxBulkUpdateModal
    };

    const selectedBoxes = boxes.data.filter(b => selectedIds.includes(b.id));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Boxes Inventory | Admin" />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-zinc-200/80 pb-5">
                    <Heading
                        eyebrow="Inventory Management"
                        title="Box Tracking & Inventory"
                        description="Track individual boxes across sea transit, hub scans, and final delivery."
                    />
                </div>

                <div className="flex flex-col gap-4">
                    <Tabs
                        value={filters.trashed ? 'trashed' : (filters.status || 'all')}
                        onValueChange={(value) => {
                            if (value === 'trashed') {
                                router.get('/admin/boxes', { trashed: true }, { preserveState: true });
                            } else {
                                router.get(
                                    '/admin/boxes',
                                    { ...filters, status: value === 'all' ? '' : value, trashed: undefined },
                                    { preserveState: true }
                                );
                            }
                        }}
                        className="w-full"
                    >
                        <TabsList className="h-10 inline-flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-1 w-auto overflow-x-auto">
                            <TabsTrigger value="all" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <ListFilter className="size-3.5" />
                                All
                            </TabsTrigger>
                            <TabsTrigger value="collected" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <Package className="size-3.5" />
                                Collected
                            </TabsTrigger>
                            <TabsTrigger value="in_transit" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <Ship className="size-3.5" />
                                In Transit
                            </TabsTrigger>
                            <TabsTrigger value="out_for_delivery" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <Truck className="size-3.5" />
                                Delivery
                            </TabsTrigger>
                            <TabsTrigger value="delivered" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                <CheckCircle className="size-3.5" />
                                Delivered
                            </TabsTrigger>
                            {auth?.user?.role === 'super_admin' && (
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
                                routeName="/admin/boxes"
                                queryParams={filters}
                                placeholder="Search serial, tracking, or sender..."
                            />
                            <FilterSelect
                                label="Payment"
                                routeName="/admin/boxes"
                                paramName="payment_status"
                                queryParams={filters}
                                placeholder="All Payments"
                                options={[
                                    { label: 'Paid', value: 'paid' },
                                    { label: 'Unpaid', value: 'unpaid' },
                                    { label: 'Partial', value: 'partial' },
                                ]}
                            />
                            <FilterSelect
                                label="Declaration"
                                routeName="/admin/boxes"
                                paramName="declaration_form_status"
                                queryParams={filters}
                                placeholder="All Forms"
                                options={[
                                    { label: 'Missing', value: 'missing' },
                                    { label: 'Submitted (Any)', value: 'submitted' },
                                    { label: 'Submitted Online', value: 'submitted_online' },
                                    { label: 'Physical Copy', value: 'physical_copy_received' },
                                ]}
                            />
                            <select
                                className="h-9 px-3 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                                value={filters.area_id || ''}
                                onChange={(e) => {
                                    router.get('/admin/boxes', { ...filters, area_id: e.target.value }, { preserveState: true });
                                }}
                            >
                                <option value="">All Areas</option>
                                {areas.map(area => (
                                    <option key={area.id} value={area.id}>{area.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <ActiveFilterChips
                        routeName="/admin/boxes"
                        queryParams={filters}
                    />
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                    {boxes.data.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                                        <th scope="col" className="px-4 py-3 w-10">
                                            <Checkbox
                                                checked={selectedIds.length === boxes.data.length && boxes.data.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                                aria-label="Select all"
                                                className="size-4 rounded border-zinc-300"
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Serial #</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Tracking #</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Booking Ref</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Sender</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Recipient</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Batch</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 text-xs font-normal">
                                    {boxes.data.map((box) => (
                                        <tr key={box.id} className="hover:bg-zinc-50/60 transition-colors">
                                            <td className="px-4 py-3.5">
                                                <Checkbox
                                                    checked={selectedIds.includes(box.id)}
                                                    onCheckedChange={() => toggleSelect(box.id)}
                                                    aria-label={`Select box ${box.tracking_number}`}
                                                    className="size-4 rounded border-zinc-300"
                                                />
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-xs font-semibold text-zinc-900">
                                                <Link href={`/admin/boxes/${box.id}`} className="hover:text-brand-rust transition-colors">
                                                    {box.serial_number || 'Pending'}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-xs text-zinc-500">
                                                {box.tracking_number}
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-xs font-medium text-zinc-900">
                                                {box.booking ? (
                                                    <Link href={`/admin/bookings/${box.booking.id}`} className="hover:text-brand-rust transition-colors">
                                                        {box.booking.reference_number}
                                                    </Link>
                                                ) : (
                                                    <span className="text-zinc-400 font-sans italic font-normal">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 font-semibold text-zinc-900">
                                                {box.booking?.sender ? (
                                                    `${box.booking.sender.first_name} ${box.booking.sender.last_name}`
                                                ) : (
                                                    <span className="text-zinc-400 font-normal italic">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-600">
                                                {box.recipient ? (
                                                    <div>
                                                        <span className="font-semibold text-zinc-900 block">{box.recipient.name}</span>
                                                        <span className="text-[11px] text-zinc-400 block truncate max-w-xs">
                                                            {[box.recipient.address, box.recipient.city, box.recipient.province].filter(Boolean).join(', ')}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-400 italic">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-xs font-medium text-zinc-900">
                                                {box.batch ? (
                                                    <Link href={`/admin/batches/${box.batch.id}`} className="hover:text-brand-rust transition-colors">
                                                        {box.batch.batch_number}
                                                    </Link>
                                                ) : (
                                                    <span className="text-zinc-400 font-sans italic font-normal">Pending</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BOX_STATUS_CONFIG[box.status]?.badge ?? 'bg-zinc-100 text-zinc-700 border border-zinc-200'}`}>
                                                    {humanize(box.status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex justify-end items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        title="Update box status"
                                                        className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center justify-center shadow-2xs"
                                                        onClick={() => {
                                                            setSelectedStatusBox(box);
                                                            setNewStatus(box.status);
                                                            setStatusNotes('');
                                                            setProofFile(null);
                                                            setIsUpdateStatusModalOpen(true);
                                                        }}
                                                    >
                                                        <RefreshCw className="size-3.5" />
                                                    </button>
                                                    <Link
                                                        href={`/admin/boxes/${box.id}`}
                                                        title="View details"
                                                        className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                    >
                                                        <Eye className="size-3.5" />
                                                    </Link>
                                                    <Link
                                                        href={`/admin/boxes/${box.id}/edit`}
                                                        title="Edit box"
                                                        className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-brand-rust hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                    >
                                                        <Pencil className="size-3.5" />
                                                    </Link>
                                                    {auth?.user?.role === 'super_admin' && (
                                                        <button
                                                            type="button"
                                                            title="Archive box"
                                                            className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-all flex items-center justify-center shadow-2xs"
                                                            onClick={() => {
                                                                setSelectedBox(box);
                                                                setIsArchiveModalOpen(true);
                                                            }}
                                                        >
                                                            <AlertTriangle className="size-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-4 py-8 text-center text-xs text-zinc-400 italic">
                            No boxes found.
                        </div>
                    )}

                    <Pagination data={boxes} />
                </div>
            </div>

            <ConfirmModal
                isOpen={isArchiveModalOpen}
                onClose={() => {
                    setIsArchiveModalOpen(false);
                    setSelectedBox(null);
                }}
                onConfirm={handleArchiveConfirm}
                title="Archive Box"
                description={`Are you sure you want to archive box ${selectedBox?.tracking_number || ''}? It can be viewed under the trashed filter or restored later.`}
                confirmText="Archive"
                variant="warning"
                loading={isProcessing}
            />

            <ConfirmModal
                isOpen={isRestoreModalOpen}
                onClose={() => {
                    setIsRestoreModalOpen(false);
                    setSelectedBox(null);
                }}
                onConfirm={handleRestoreConfirm}
                title="Restore Box"
                description={`Are you sure you want to restore box ${selectedBox?.tracking_number || ''}?`}
                confirmText="Restore"
                variant="success"
                loading={isProcessing}
            />

            <UpdateBoxStatusModal
                isOpen={isUpdateStatusModalOpen}
                onClose={() => {
                    setIsUpdateStatusModalOpen(false);
                    setSelectedStatusBox(null);
                }}
                box={selectedStatusBox}
                userRole={auth?.user?.role}
            />


            <TableSelectionBar
                selectedCount={selectedIds.length}
                totalCount={boxes.total}
                isGlobalSelection={isGlobalSelection}
                onToggleGlobal={setIsGlobalSelection}
                onClear={() => {
                    setSelectedIds([]);
                    setIsGlobalSelection(false);
                }}
                actions={[
                    {
                        label: 'Assign Batch',
                        icon: Package,
                        onClick: () => setIsBulkAssignModalOpen(true),
                    },
                    {
                        label: 'Update Selected',
                        icon: Sparkles,
                        onClick: () => setIsBoxBulkUpdateModalOpen(true),
                    }
                ]}
            />

            <BoxBulkUpdateModal
                isOpen={isBoxBulkUpdateModalOpen}
                onClose={() => setIsBoxBulkUpdateModalOpen(false)}
                selectedIds={selectedIds}
                isGlobalSelection={isGlobalSelection}
                filters={filters}
                boxesData={boxes.data}
                onSuccessCallback={() => {
                    setSelectedIds([]);
                    setIsGlobalSelection(false);
                }}
            />

            <BulkAssignBatchModal
                isOpen={isBulkAssignModalOpen}
                onClose={() => setIsBulkAssignModalOpen(false)}
                selectedIds={selectedIds}
                selectedBoxes={selectedBoxes}
                isGlobalSelection={isGlobalSelection}
                activeBatches={activeBatches}
                filters={filters}
                onSuccessCallback={() => {
                    setSelectedIds([]);
                    setIsGlobalSelection(false);
                }}
            />
        </AppLayout>
    );
}
