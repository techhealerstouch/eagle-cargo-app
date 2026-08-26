import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { AlertTriangle, Trash2, RotateCcw, Info } from 'lucide-react';
import BulkUpdateModal, { BulkUpdateAction } from '@/components/common/bulk-update-modal';
import { Label } from '@/components/ui/label';

interface BatchBulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: number[];
    isGlobalSelection: boolean;
    filters: any;
    onSuccessCallback?: () => void;
}

export default function BatchBulkUpdateModal(props: BatchBulkUpdateModalProps) {
    const { auth } = usePage<any>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';

    const actions: BulkUpdateAction[] = [
        {
            id: 'status',
            label: 'Change Status / Reopen',
            icon: RotateCcw,
            description: 'Update the operational status or reopen closed/sailed batches back to Open or Loading.',
            endpoint: '/admin/batches/bulk-update-status',
            method: 'post',
            getPayload: (formState) => ({
                status: formState.status || 'open',
            }),
            renderForm: (formState, setFormState) => {
                const currentStatus = formState.status || 'open';
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="batch-status-select" className="text-xs font-semibold text-zinc-700">
                                Target Batch Status
                            </Label>
                            <select
                                id="batch-status-select"
                                className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-medium"
                                value={currentStatus}
                                onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                            >
                                <option value="open">Open (Reopen for loading)</option>
                                <option value="loading">Loading</option>
                                <option value="ready_to_close">Ready to Close</option>
                                <option value="sailed">Sailed</option>
                                <option value="arrived">Arrived</option>
                                <option value="delivered">Delivered</option>
                            </select>
                        </div>

                        {currentStatus === 'open' || currentStatus === 'loading' ? (
                            <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4">
                                <Info className="size-4.5 text-sky-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-sky-900">Reopening Batches</p>
                                    <p className="text-[11px] text-sky-800 mt-0.5 leading-relaxed">
                                        Reopening batches allows you to add or remove boxes. Any existing sailing, arrival, or delivery timestamps will be reset to blank.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                                <AlertTriangle className="size-4.5 text-amber-600 mt-0.5 shrink-0" />
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

