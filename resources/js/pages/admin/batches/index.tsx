import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Layers,
    Plus,
    Pencil,
    Eye,
    Sparkles,
    Ship,
} from 'lucide-react';
import { useState } from 'react';
import ActiveFilterChips from '@/components/common/active-filter-chips';
import ConfirmModal from '@/components/common/confirm-modal';
import FilterSelect from '@/components/common/filter-select';
import Heading from '@/components/common/heading';
import Pagination, { type PaginationData } from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
import TableSelectionBar from '@/components/common/table-selection-bar';
import BatchBulkUpdateModal from '@/components/admin/batch-bulk-update-modal';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import AppLayout from '@/layouts/app-layout';
import { BATCH_STATUS_CONFIG } from '@/lib/statuses';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface BatchData {
    id: number;
    batch_number: string;
    container_number: string | null;
    seal_number: string | null;
    status: string;
    vessel_name: string | null;
    voyage_number: string | null;
    origin_port: string | null;
    destination_port: string | null;
    current_box_count: number;
    capacity_boxes: number | null;
    latest_tracking_phase: string | null;
    latest_tracking_phase_order: number | null;
}

interface TrackingPhaseOption {
    value: string;
    label: string;
    group: string;
    order: number;
}

type BatchPagination = PaginationData & { data: BatchData[] };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Batches', href: '/admin/batches' },
];

export default function BatchesIndex({
    batches,
    filters,
    trackingPhases = [],
}: {
    batches: BatchPagination;
    filters: { search?: string; status?: string };
    trackingPhases?: TrackingPhaseOption[];
}) {
    const { auth } = usePage<any>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isGlobalSelection, setIsGlobalSelection] = useState(false);
    const [isBatchBulkUpdateModalOpen, setIsBatchBulkUpdateModalOpen] = useState(false);

    const [generateTemplateBatch, setGenerateTemplateBatch] = useState<BatchData | null>(null);
    const [confirmCloseBatch, setConfirmCloseBatch] = useState<BatchData | null>(null);
    const [isConfirmingClose, setIsConfirmingClose] = useState(false);
    const [sailEta, setSailEta] = useState('');

    const toggleSelectAll = () => {
        if (selectedIds.length === batches.data.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(batches.data.map((b) => b.id));
        }
    };

    const toggleSelect = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(item => item !== id));
            setIsGlobalSelection(false);
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Batches | Admin" />
            <div className="flex h-full w-full min-w-0 flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
                <div className="flex flex-col justify-between gap-4 border-b border-brand-warm/20 pb-6 md:flex-row md:items-start">
                    <Heading
                        eyebrow="Consolidated Shipping"
                        title="Shipment Batches"
                        description="Manage batches — each batch is one container (~340 boxes)."
                    />
                    <Link
                        href="/admin/batches/create"
                        className="flex items-center gap-2 rounded-xl bg-brand-rust px-6 py-3 font-sans text-sm font-bold tracking-widest text-white uppercase shadow-lg shadow-brand-rust/10 transition-all hover:bg-brand-rust/90"
                    >
                        <Plus className="size-4" /> New Batch
                    </Link>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 p-2 md:flex-row md:items-end md:justify-between">
                        <div className="flex flex-1 flex-wrap items-end gap-3">
                            <SearchFilter
                                label="Inventory Search"
                                routeName="/admin/batches"
                                queryParams={filters}
                                placeholder="Search by batch, container, or voyage..."
                            />
                            <FilterSelect
                                label="Status"
                                routeName="/admin/batches"
                                paramName="status"
                                queryParams={filters}
                                placeholder="All Status"
                                options={[
                                    { label: 'Open', value: 'open' },
                                    { label: 'Loading', value: 'loading' },
                                    {
                                        label: 'Ready to Close',
                                        value: 'ready_to_close',
                                    },
                                    { label: 'Sailed', value: 'sailed' },
                                    { label: 'Arrived at Port', value: 'arrived' },
                                    { label: 'Under BOC Clearance', value: 'under_customs_clearance' },
                                    { label: 'Released by BOC', value: 'released_by_boc' },
                                    { label: 'Received at Manila Warehouse', value: 'received_at_warehouse' },
                                ]}
                            />
                        </div>
                    </div>
                    <ActiveFilterChips
                        routeName="/admin/batches"
                        queryParams={filters}
                        className="px-3"
                    />
                </div>

                <div className="card overflow-hidden shadow-xs">
                    {batches.data.length > 0 ? (
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border bg-brand-warm/10 dark:bg-brand-warm/20 text-xs font-semibold text-brand-text-mid">
                                        <th className="w-10 px-4 py-3">
                                            <Checkbox
                                                checked={
                                                    selectedIds.length ===
                                                        batches.data.length &&
                                                    batches.data.length > 0
                                                }
                                                onCheckedChange={
                                                    toggleSelectAll
                                                }
                                                aria-label="Select all"
                                                className="size-4 rounded border-border"
                                            />
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                            Batch #
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                            Container / Seal
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                            Vessel / Voyage
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                            Utilization
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 text-right font-semibold">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-xs font-normal">
                                    {batches.data.map((batch) => {
                                        const utilization = batch.capacity_boxes
                                            ? (batch.current_box_count /
                                                  batch.capacity_boxes) *
                                              100
                                            : 0;

                                        return (
                                            <tr
                                                key={batch.id}
                                                className="hover:bg-brand-cream/20 dark:hover:bg-brand-warm/20 transition-colors"
                                            >
                                                <td className="px-4 py-3.5">
                                                    <Checkbox
                                                        checked={selectedIds.includes(
                                                            batch.id,
                                                        )}
                                                        onCheckedChange={() =>
                                                            toggleSelect(
                                                                batch.id,
                                                            )
                                                        }
                                                        aria-label={`Select batch ${batch.batch_number}`}
                                                        className="size-4 rounded border-border"
                                                    />
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-xs font-semibold text-brand-text">
                                                            {batch.batch_number}
                                                        </span>
                                                        <span className="text-[10px] text-brand-text-light/60">
                                                            {[
                                                                batch.origin_port,
                                                                batch.destination_port,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' → ') ||
                                                                'Unassigned Route'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 font-mono text-xs text-brand-text-mid">
                                                    {batch.container_number || '—'}
                                                </td>
                                                <td className="px-4 py-3.5 text-brand-text-mid">
                                                    {batch.vessel_name || '—'}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex min-w-28 flex-col gap-1">
                                                        <div className="flex items-center justify-between text-[11px] font-medium text-brand-text-mid">
                                                            <span>
                                                                {batch.current_box_count} / {batch.capacity_boxes || '∞'}
                                                            </span>
                                                            <span>{Math.round(utilization)}%</span>
                                                        </div>
                                                        <Progress value={utilization} className="h-1.5" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BATCH_STATUS_CONFIG[batch.status]?.badge ?? 'bg-muted text-muted-foreground border border-border'}`}>
                                                        {humanize(batch.status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                    <div className="flex justify-end items-center gap-1.5">
                                                        {batch.status === 'ready_to_close' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfirmCloseBatch(batch)}
                                                                title="Confirm Manifest / Close Batch"
                                                                className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex items-center justify-center shadow-2xs"
                                                            >
                                                                <Ship className="size-3.5" />
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => setGenerateTemplateBatch(batch)}
                                                            title="Generate Next Batch from Template"
                                                            className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 hover:border-sky-300 dark:hover:border-sky-700 transition-all flex items-center justify-center shadow-2xs"
                                                        >
                                                            <Sparkles className="size-3.5" />
                                                        </button>
                                                        <Link
                                                            href={`/admin/batches/${batch.id}`}
                                                            title="View Batch Details"
                                                            className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-brand-rust hover:bg-brand-warm/50 hover:border-brand-sand dark:hover:border-border transition-all flex items-center justify-center shadow-2xs"
                                                        >
                                                            <Eye className="size-3.5" />
                                                        </Link>
                                                        <Link
                                                            href={`/admin/batches/${batch.id}/edit`}
                                                            title="Edit Batch"
                                                            className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-brand-rust hover:bg-brand-warm/50 hover:border-brand-sand dark:hover:border-border transition-all flex items-center justify-center shadow-2xs"
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
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-12">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-warm/20">
                                <Layers className="size-10 text-brand-rust" />
                            </div>
                            <h3 className="mb-2 font-serif text-xl font-medium text-brand-text">
                                No batches yet
                            </h3>
                            <p className="mb-6 max-w-sm text-center text-brand-text-mid">
                                Create your first shipment batch to start
                                loading boxes.
                            </p>
                            <Link
                                href="/admin/batches/create"
                                className="btn-outline"
                            >
                                Add Batch
                            </Link>
                        </div>
                    )}

                    <Pagination data={batches} />
                </div>
                <TableSelectionBar
                    selectedCount={selectedIds.length}
                    totalCount={batches.total}
                    isGlobalSelection={isGlobalSelection}
                    onToggleGlobal={setIsGlobalSelection}
                    onClear={() => {
                        setSelectedIds([]);
                        setIsGlobalSelection(false);
                    }}
                    actions={[
                        ...(isSuperAdmin ? [{
                            label: 'Update Selected',
                            icon: Sparkles,
                            onClick: () => setIsBatchBulkUpdateModalOpen(true),
                        }] : [])
                    ]}
                />

                <BatchBulkUpdateModal
                    isOpen={isBatchBulkUpdateModalOpen}
                    onClose={() => setIsBatchBulkUpdateModalOpen(false)}
                    selectedIds={selectedIds}
                    isGlobalSelection={isGlobalSelection}
                    filters={filters}
                    batchesData={batches.data}
                    onSuccessCallback={() => {
                        setSelectedIds([]);
                        setIsGlobalSelection(false);
                    }}
                />
            </div>

            <Dialog open={!!confirmCloseBatch} onOpenChange={(open) => !open && setConfirmCloseBatch(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Manifest & Sail Batch</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to confirm the manifest for {confirmCloseBatch?.batch_number}? This will lock the batch, mark it as 'Sailed', and allow tracking updates to be applied.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-3">
                        <Label htmlFor="eta_at" className="text-xs font-semibold text-zinc-700">
                            Confirmed Port Arrival ETA (from Shipping Line)
                        </Label>
                        <Input
                            id="eta_at"
                            type="datetime-local"
                            value={sailEta}
                            onChange={(e) => setSailEta(e.target.value)}
                            className="h-11 rounded-xl"
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmCloseBatch(null)}
                            disabled={isConfirmingClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (confirmCloseBatch) {
                                    setIsConfirmingClose(true);
                                    router.post(`/admin/batches/${confirmCloseBatch.id}/confirm-manifest`, {
                                        eta_at: sailEta || null,
                                    }, {
                                        preserveScroll: true,
                                        onFinish: () => {
                                            setIsConfirmingClose(false);
                                            setConfirmCloseBatch(null);
                                            setSailEta('');
                                        }
                                    });
                                }
                            }}
                            disabled={isConfirmingClose}
                        >
                            Confirm & Sail
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmModal
                isOpen={generateTemplateBatch !== null}
                onClose={() => setGenerateTemplateBatch(null)}
                onConfirm={() => {
                    if (generateTemplateBatch) {
                        const id = generateTemplateBatch.id;
                        setGenerateTemplateBatch(null);
                        router.get(`/admin/batches/create?template_id=${id}`);
                    }
                }}
                title="Generate Next Shipment Batch?"
                description={`Do you want to generate a new shipment batch using vessel, voyage, shipping line, and route configurations from ${generateTemplateBatch?.batch_number}? You will be directed to review and specify the new container number and seal before saving.`}
                confirmText="Proceed & Configure"
                cancelText="Cancel"
                variant="primary"
            />
        </AppLayout>
    );
}
