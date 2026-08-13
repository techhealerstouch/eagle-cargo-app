import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import BulkUpdateModal, { BulkUpdateAction } from '@/components/common/bulk-update-modal';

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

    const actions: BulkUpdateAction[] = [];

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

