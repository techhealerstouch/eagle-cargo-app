import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Layers,
    Plus,
    Pencil,
    CheckCircle2,
    Eye,
    ScanLine,
    AlertTriangle,
    Trash2,
    Ship,
    Anchor,
    Truck,
    Loader2,
    ArrowRight,
    Sparkles,
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
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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

    // Tracking update state
    const [trackingBatch, setTrackingBatch] = useState<BatchData | null>(null);
    const [selectedPhase, setSelectedPhase] = useState<string>('');
    const [isTrackingSubmitting, setIsTrackingSubmitting] = useState(false);
    const [generateTemplateBatch, setGenerateTemplateBatch] = useState<BatchData | null>(null);

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
                            <div className="flex max-w-sm flex-1 flex-col gap-1.5">
                                <span className="flex items-center gap-1.5 px-1 text-[9px] font-black tracking-[0.2em] text-brand-text-mid/70 uppercase">
                                    <span className="h-px w-2 bg-brand-rust/20"></span>
                                    Inventory Search
                                </span>
                                <SearchFilter
                                    routeName="/admin/batches"
                                    queryParams={filters}
                                    placeholder="Search by batch, container, or voyage..."
                                />
                            </div>
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
                                    { label: 'Arrived', value: 'arrived' },
                                    { label: 'Delivered', value: 'delivered' },
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

                <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                    {batches.data.length > 0 ? (
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
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
                                                className="size-4 rounded border-zinc-300"
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
                                <tbody className="divide-y divide-zinc-100 text-xs font-normal">
                                    {batches.data.map((batch) => {
                                        const utilization = batch.capacity_boxes
                                            ? (batch.current_box_count /
                                                  batch.capacity_boxes) *
                                              100
                                            : 0;

                                        return (
                                            <tr
                                                key={batch.id}
                                                className="hover:bg-zinc-50/60 transition-colors"
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
                                                        className="size-4 rounded border-zinc-300"
                                                    />
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-xs font-semibold text-zinc-900">
                                                            {batch.batch_number}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-400">
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
                                                <td className="px-4 py-3.5 font-mono text-xs text-zinc-600">
                                                    {batch.container_number || '—'}
                                                </td>
                                                <td className="px-4 py-3.5 text-zinc-600">
                                                    {batch.vessel_name || '—'}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex min-w-28 flex-col gap-1">
                                                        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-600">
                                                            <span>
                                                                {batch.current_box_count} / {batch.capacity_boxes || '∞'}
                                                            </span>
                                                            <span>{Math.round(utilization)}%</span>
                                                        </div>
                                                        <Progress value={utilization} className="h-1.5" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BATCH_STATUS_CONFIG[batch.status]?.badge ?? 'bg-zinc-100 text-zinc-700 border border-zinc-200'}`}>
                                                        {humanize(batch.status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                    <div className="flex justify-end items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setGenerateTemplateBatch(batch)}
                                                            title="Generate Next Batch from Template"
                                                            className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-sky-600 hover:bg-sky-50 hover:border-sky-300 transition-all flex items-center justify-center shadow-2xs"
                                                        >
                                                            <Sparkles className="size-3.5" />
                                                        </button>
                                                        <Link
                                                            href={`/admin/batches/${batch.id}`}
                                                            title="View Batch Details"
                                                            className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                        >
                                                            <Eye className="size-3.5" />
                                                        </Link>
                                                        <Link
                                                            href={`/admin/batches/${batch.id}/edit`}
                                                            title="Edit Batch"
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
                            <div className="flex items-center justify-center gap-2 border-t border-border px-6 py-4">
                                {(
                                    (batches as any).meta?.links ||
                                    batches.links ||
                                    []
                                ).map((link: { url: string | null; label: string; active: boolean }, i: number) =>
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
                        {
                            label: 'Update Selected',
                            icon: Sparkles,
                            onClick: () => setIsBatchBulkUpdateModalOpen(true),
                        },
                    ]}
                />

                <BatchBulkUpdateModal
                    isOpen={isBatchBulkUpdateModalOpen}
                    onClose={() => setIsBatchBulkUpdateModalOpen(false)}
                    selectedIds={selectedIds}
                    isGlobalSelection={isGlobalSelection}
                    filters={filters}
                    onSuccessCallback={() => {
                        setSelectedIds([]);
                        setIsGlobalSelection(false);
                    }}
                />
            </div>

            <Dialog
                open={!!trackingBatch}
                onOpenChange={(open) => !open && setTrackingBatch(null)}
            >
                <DialogContent className="max-w-md gap-0 overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl [&>button]:!top-6 [&>button]:!right-6 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:!rounded-xl [&>button]:border [&>button]:border-brand-warm/15 [&>button]:bg-white [&>button]:p-2.5 [&>button]:shadow-xs [&>button]:transition-all [&>button]:hover:bg-brand-warm/5">
                    <div className="p-8 pb-4">
                        <div className="flex items-start gap-5">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-warm/10 text-brand-text">
                                <Truck className="size-6 text-brand-text" />
                            </div>
                            <div className="flex-1 pt-1">
                                <DialogHeader>
                                    <DialogTitle className="flex flex-col items-start gap-1.5 font-sans text-xl font-semibold tracking-tight text-brand-text">
                                        Update Batch Tracking
                                    </DialogTitle>
                                    <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-brand-text-mid opacity-85">
                                        <span>
                                            {trackingBatch?.batch_number}
                                        </span>
                                        <span>•</span>
                                        <span>
                                            {trackingBatch?.current_box_count}{' '}
                                            box
                                            {trackingBatch?.current_box_count !==
                                            1
                                                ? 'es'
                                                : ''}
                                        </span>
                                        {trackingBatch?.status && (
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${BATCH_STATUS_CONFIG[trackingBatch.status]?.badge ?? 'border-gray-200 bg-gray-100 text-gray-700'}`}
                                            >
                                                {BATCH_STATUS_CONFIG[
                                                    trackingBatch.status
                                                ]?.label ??
                                                    trackingBatch.status.replaceAll(
                                                        '_',
                                                        ' ',
                                                    )}
                                            </span>
                                        )}
                                    </div>
                                </DialogHeader>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-6 px-8 py-2">
                        {/* Current & Next Phase Flow */}
                        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                            <div className="mb-4">
                                <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                                    Phase Preview
                                </span>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-1 flex-col gap-1">
                                    <span className="text-[11px] leading-none font-medium text-neutral-400">
                                        Current
                                    </span>
                                    <div className="mt-1 min-h-12">
                                        <p className="text-sm leading-tight font-bold text-neutral-900">
                                            {trackingPhases.find(
                                                (p) =>
                                                    p.value ===
                                                    trackingBatch?.latest_tracking_phase,
                                            )?.label || 'Awaiting Start'}
                                        </p>
                                        <span className="mt-1.5 inline-block rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                                            {trackingPhases.find(
                                                (p) =>
                                                    p.value ===
                                                    trackingBatch?.latest_tracking_phase,
                                            )?.group || 'Warehouse'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-xs">
                                    <ArrowRight className="size-4" />
                                </div>

                                <div className="flex flex-1 flex-col items-end gap-1 text-right">
                                    <span className="text-[11px] leading-none font-semibold text-green-600">
                                        Moving to
                                    </span>
                                    <div className="mt-1 min-h-12 text-right">
                                        <p className="text-sm leading-tight font-bold text-neutral-900">
                                            {selectedPhase
                                                ? trackingPhases.find(
                                                      (p) =>
                                                          p.value ===
                                                          selectedPhase,
                                                  )?.label
                                                : 'Select Target'}
                                        </p>
                                        <span className="mt-1.5 inline-block rounded-md bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                                            {selectedPhase
                                                ? trackingPhases.find(
                                                      (p) =>
                                                          p.value ===
                                                          selectedPhase,
                                                  )?.group
                                                : '---'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label
                                htmlFor="phase"
                                className="px-0.5 text-sm font-semibold text-neutral-700"
                            >
                                Choose next tracking step
                            </Label>
                            <Select
                                value={selectedPhase}
                                onValueChange={setSelectedPhase}
                            >
                                <SelectTrigger
                                    id="phase"
                                    className="h-16 rounded-xl border border-neutral-200 bg-white px-4 text-brand-text shadow-sm transition-all focus:ring-2 focus:ring-brand-rust/20"
                                >
                                    <SelectValue placeholder="Select target phase..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border border-neutral-200 p-1 shadow-2xl">
                                    {trackingPhases
                                        .filter(
                                            (p) =>
                                                p.order >
                                                (trackingBatch?.latest_tracking_phase_order ??
                                                    -1),
                                        )
                                        .map((phase) => (
                                            <SelectItem
                                                key={phase.value}
                                                value={phase.value}
                                                className="cursor-pointer rounded-lg py-2 focus:bg-brand-rust/5 focus:text-brand-rust"
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm leading-tight font-bold">
                                                        {phase.label}
                                                    </span>
                                                    <span className="text-[10px] leading-tight font-medium text-brand-text-mid/70">
                                                        {phase.group}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                            {trackingPhases.length === 0 && (
                                <p className="mt-2 rounded-lg border border-red-100 bg-red-50 p-2 text-[10px] font-bold tracking-wider text-red-500 uppercase">
                                    No valid next phases available for your
                                    role.
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex-row gap-3 bg-transparent p-6 px-8 pt-6 pb-8 sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setTrackingBatch(null)}
                            className="h-12 flex-1 rounded-xl border border-brand-warm/20 bg-white px-8 text-sm font-bold text-brand-text hover:bg-brand-warm/5 hover:text-brand-text sm:flex-none"
                            disabled={isTrackingSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (!selectedPhase || !trackingBatch) {
                                    return;
                                }

                                setIsTrackingSubmitting(true);
                                router.post(
                                    `/admin/batches/${trackingBatch.id}/tracking-phase`,
                                    {
                                        tracking_phase: selectedPhase,
                                        description: `Batch manually updated from list view.`,
                                    },
                                    {
                                        onSuccess: () => setTrackingBatch(null),
                                        onFinish: () =>
                                            setIsTrackingSubmitting(false),
                                    },
                                );
                            }}
                            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-black px-10 text-sm font-bold text-white shadow-lg transition-all hover:bg-neutral-900 active:scale-95 sm:flex-none"
                            disabled={!selectedPhase || isTrackingSubmitting}
                        >
                            {isTrackingSubmitting ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : null}
                            Update Batch
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
