import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { AlertTriangle, Trash2, RotateCcw, Info, ArrowRight, CheckCircle, Package } from 'lucide-react';
import BulkUpdateModal, { BulkUpdateAction } from '@/components/common/bulk-update-modal';
import { Label } from '@/components/ui/label';
import { humanize } from '@/lib/utils';

export interface BatchItem {
    id: number;
    batch_number: string;
    container_number?: string | null;
    status: string;
    boxes_count?: number;
    current_box_count?: number;
    destination?: string | null;
}

interface BatchBulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: number[];
    isGlobalSelection: boolean;
    filters: any;
    onSuccessCallback?: () => void;
    batchesData?: BatchItem[];
}

const BATCH_STATUS_META: Record<string, { label: string; badgeClass: string }> = {
    open: { label: 'Open', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    loading: { label: 'Loading', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
    ready_to_close: { label: 'Ready to Close', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
    sailed: { label: 'Sailed', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    arrived: { label: 'Arrived', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
    delivered: { label: 'Delivered', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200' },
};

function BatchStatusBadge({ status }: { status: string }) {
    const meta = BATCH_STATUS_META[status] || {
        label: humanize(status),
        badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.badgeClass}`}>
            {meta.label}
        </span>
    );
}

export default function BatchBulkUpdateModal(props: BatchBulkUpdateModalProps) {
    const { auth } = usePage<any>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';

    const selectedBatches = React.useMemo(() => {
        if (!props.batchesData || props.selectedIds.length === 0) return [];
        return props.batchesData.filter((b) => props.selectedIds.includes(b.id));
    }, [props.batchesData, props.selectedIds]);

    const isSingle = !props.isGlobalSelection && selectedBatches.length === 1;
    const singleBatch = isSingle ? selectedBatches[0] : null;

    const statusSummary = React.useMemo(() => {
        if (selectedBatches.length === 0) return null;
        const counts: Record<string, number> = {};
        for (const b of selectedBatches) {
            counts[b.status] = (counts[b.status] || 0) + 1;
        }
        return counts;
    }, [selectedBatches]);

    const actions: BulkUpdateAction[] = [
        {
            id: 'status',
            label: 'Change Status / Reopen',
            icon: RotateCcw,
            description: 'Update the operational status or reopen closed/sailed batches back to Open or Loading.',
            endpoint: '/admin/batches/bulk-update-status',
            method: 'post',
            getPayload: (formState) => ({
                status: formState.status !== undefined
                    ? formState.status
                    : (singleBatch ? singleBatch.status : 'open'),
            }),
            renderForm: (formState, setFormState) => {
                const currentStatus = formState.status !== undefined
                    ? formState.status
                    : (singleBatch ? singleBatch.status : 'open');

                return (
                    <div className="space-y-4">
                        {/* Single batch context */}
                        {isSingle && singleBatch && (
                            <div className="p-3.5 rounded-xl border border-zinc-200/90 bg-gradient-to-br from-zinc-50 via-white to-zinc-50/50 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                        Current Batch Status
                                    </span>
                                    <span className="text-xs font-mono font-bold text-zinc-800">
                                        {singleBatch.batch_number}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <BatchStatusBadge status={singleBatch.status} />
                                    <span className="text-xs text-zinc-600">
                                        {(singleBatch.current_box_count ?? singleBatch.boxes_count) !== undefined
                                            ? `${singleBatch.current_box_count ?? singleBatch.boxes_count} assigned boxes`
                                            : ''}
                                        {singleBatch.container_number ? ` • Container: ${singleBatch.container_number}` : ''}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Multi-batch status summary */}
                        {!isSingle && !props.isGlobalSelection && statusSummary && Object.keys(statusSummary).length > 0 && (
                            <div className="p-3.5 rounded-xl border border-zinc-200/90 bg-zinc-50/80 shadow-2xs space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                    Current Statuses Across Selection ({selectedBatches.length} Batches)
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(statusSummary).map(([statusKey, count]) => (
                                        <div key={statusKey} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-zinc-200/80 rounded-lg shadow-2xs">
                                            <BatchStatusBadge status={statusKey} />
                                            <span className="text-[11px] font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">
                                                {count} {count === 1 ? 'batch' : 'batches'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="batch-status-select" className="text-xs font-semibold text-zinc-700">
                                Target Batch Status
                            </Label>
                            <select
                                id="batch-status-select"
                                className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-medium shadow-2xs transition-all"
                                value={currentStatus}
                                onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                            >
                                <option value="open">Open {singleBatch?.status === 'open' ? '(Current)' : ''}</option>
                                <option value="loading">Loading {singleBatch?.status === 'loading' ? '(Current)' : ''}</option>
                                <option value="ready_to_close">Ready to Close {singleBatch?.status === 'ready_to_close' ? '(Current)' : ''}</option>
                                <option value="sailed">Sailed {singleBatch?.status === 'sailed' ? '(Current)' : ''}</option>
                                <option value="arrived">Arrived {singleBatch?.status === 'arrived' ? '(Current)' : ''}</option>
                                <option value="delivered">Delivered {singleBatch?.status === 'delivered' ? '(Current)' : ''}</option>
                            </select>
                        </div>

                        {/* Transition Note */}
                        {isSingle && singleBatch && (
                            <div className="pt-0.5">
                                {currentStatus === singleBatch.status ? (
                                    <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/60">
                                        <Info className="size-4 text-zinc-400 shrink-0" />
                                        <span>No change: Batch is already in <strong>{humanize(singleBatch.status)}</strong> status.</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2.5 text-xs text-sky-900 bg-gradient-to-r from-sky-50 to-blue-50/40 p-2.5 rounded-xl border border-sky-200/80">
                                        <ArrowRight className="size-4 text-sky-600 shrink-0" />
                                        <span>
                                            Batch status will change from <strong className="text-zinc-900">{humanize(singleBatch.status)}</strong> ➔ <strong className="text-sky-700">{humanize(currentStatus)}</strong>.
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {currentStatus === 'open' || currentStatus === 'loading' ? (
                            <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 shadow-2xs">
                                <Info className="size-4 text-sky-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-sky-900">Reopening Batches</p>
                                    <p className="text-[11px] text-sky-800 mt-0.5 leading-relaxed">
                                        Reopening batches allows you to add or remove boxes. Any existing sailing, arrival, or delivery timestamps will be reset to blank.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 shadow-2xs">
                                <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-amber-900">Empty Batch Safeguard</p>
                                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                                        Batches with 0 boxes cannot be moved to shipping statuses (Ready to Close, Sailed, Arrived, Delivered) and will remain unchanged.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                );
            },
        },
    ];

    if (isSuperAdmin) {
        actions.push({
            id: 'delete',
            label: 'Delete Batches',
            icon: Trash2,
            description: 'Permanently delete batches. Only batches without boxes can be deleted.',
            endpoint: '/admin/batches/bulk-destroy',
            method: 'delete',
            renderForm: () => (
                <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50/40 rounded-xl border border-red-200/80 shadow-2xs">
                    <div className="flex items-start gap-3">
                        <div className="size-8 rounded-lg bg-red-100/80 text-red-600 flex items-center justify-center shrink-0">
                            <AlertTriangle className="size-4" />
                        </div>
                        <div>
                            <h4 className="text-xs font-semibold text-red-900">Confirm Deletion</h4>
                            <p className="text-xs text-red-700/90 leading-relaxed mt-0.5">
                                Are you sure you want to delete {props.isGlobalSelection ? 'all matching' : props.selectedIds.length} batch(es)? Only batches without assigned boxes will be removed. This action cannot be undone.
                            </p>
                            {isSingle && singleBatch && (
                                <div className="mt-2 pt-2 border-t border-red-200/60 flex items-center gap-2">
                                    <span className="text-xs font-bold text-red-900">{singleBatch.batch_number}</span>
                                    <BatchStatusBadge status={singleBatch.status} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )
        });
    }

    const dynamicTitle = singleBatch
        ? `Update Batch #${singleBatch.batch_number}`
        : 'Update Selected Batches';

    return (
        <BulkUpdateModal
            isOpen={props.isOpen}
            onClose={props.onClose}
            title={dynamicTitle}
            actions={actions}
            selectedIds={props.selectedIds}
            isGlobalSelection={props.isGlobalSelection}
            filters={props.filters}
            onSuccessCallback={props.onSuccessCallback}
        />
    );
}
