import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import BulkUpdateModal, { BulkUpdateAction } from '@/components/common/bulk-update-modal';
import { Label } from '@/components/ui/label';

interface BatchBulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: number[];
    isGlobalSelection: boolean;
    filters: any;
    onSuccessCallback?: () => void;
    batchesData?: BatchData[];
}

interface BatchData {
    id: number;
    batch_number: string;
    status: string;
}

export default function BatchBulkUpdateModal(props: BatchBulkUpdateModalProps) {
    const { auth } = usePage<any>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';
    const selectedBatches = (props.batchesData ?? []).filter((batch) => props.selectedIds.includes(batch.id));
    const singleBatch = !props.isGlobalSelection && props.selectedIds.length === 1 ? selectedBatches[0] : undefined;

    const actions: BulkUpdateAction[] = [
        {
            id: 'status',
            label: 'Update Status / Reopen',
            icon: RefreshCw,
            description: 'Change the logistical stage of the selected batches (or reopen to Open/Loading).',
            endpoint: '/admin/batches/bulk-update-status',
            getPayload: (formState) => ({
                status: formState.status || 'open',
                status_filter: props.filters?.status || undefined,
            }),
            renderForm: (formState, setFormState) => {
                const currentStatus = singleBatch?.status;
                const targetStatus = formState.status || 'open';

                return (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                            {props.isGlobalSelection
                                ? 'All batches matching current filters.'
                                : singleBatch
                                    ? `Batch ${singleBatch.batch_number} is currently ${singleBatch.status}.`
                                    : `${props.selectedIds.length} batches selected from the current page.`}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="batch-bulk-status" className="text-xs font-semibold text-brand-text">
                                Target Batch Status
                            </Label>
                            <select
                                id="batch-bulk-status"
                                className="flex h-10 w-full rounded-xl border border-border bg-card px-3 text-xs text-brand-text focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-all"
                                value={targetStatus}
                                onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                            >
                                <option value="open">Open (Accepting Boxes){currentStatus === 'open' ? ' (Current)' : ''}</option>
                                <option value="loading">Loading (Active Container Loading)</option>
                                <option value="ready_to_close">Ready to Close (Manifest Ready - requires boxes)</option>
                                <option value="sailed">Sailed (Departed - requires boxes)</option>
                                <option value="arrived">Arrived at Port (requires boxes)</option>
                                <option value="under_customs_clearance">Under BOC Clearance (requires boxes)</option>
                                <option value="released_by_boc">Released by BOC (requires boxes)</option>
                                <option value="received_at_warehouse">Received at Manila Warehouse (Unloaded / Terminal)</option>
                            </select>
                        </div>
                        {singleBatch && targetStatus === currentStatus && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">No change: this batch already has that status.</p>
                        )}
                        {singleBatch && targetStatus !== currentStatus && (
                            <p className="text-xs text-zinc-600">{currentStatus} <span aria-hidden="true">-&gt;</span> {targetStatus}</p>
                        )}
                        {!singleBatch && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">Invalid transitions may be skipped.</p>}
                        {currentStatus === 'open' && (
                            <p className="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                                ✅ Reopening batches will reset sailing/arrival dates and allow loading new boxes into the container.
                            </p>
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
            getPayload: () => ({
                status_filter: props.filters?.status || undefined,
            }),
            renderForm: () => (
                <div className="p-4 bg-rose-500/10 rounded-xl border border-rose-500/30 shadow-2xs">
                    <div className="flex items-start gap-3">
                        <div className="size-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                            <AlertTriangle className="size-4" />
                        </div>
                        <div>
                            <h4 className="text-xs font-semibold text-rose-400">Confirm Deletion</h4>
                            <p className="text-xs text-rose-300 leading-relaxed mt-0.5">
                                Are you sure you want to delete {props.isGlobalSelection ? 'all matching' : props.selectedIds.length} batch(es)? Only batches without assigned boxes will be removed. This action cannot be undone.
                            </p>
                        </div>
                    </div>
                </div>
            )
        });
    }

    return (
        <BulkUpdateModal
            isOpen={props.isOpen}
            onClose={props.onClose}
            title="Update Selected Batches"
            actions={actions}
            selectedIds={props.selectedIds}
            isGlobalSelection={props.isGlobalSelection}
            filters={props.filters}
            onSuccessCallback={props.onSuccessCallback}
        />
    );
}

