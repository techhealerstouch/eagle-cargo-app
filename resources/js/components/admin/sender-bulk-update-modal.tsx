import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { AlertTriangle, Archive } from 'lucide-react';
import BulkUpdateModal, { BulkUpdateAction } from '@/components/common/bulk-update-modal';

interface SenderBulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: number[];
    isGlobalSelection: boolean;
    filters: any;
    onSuccessCallback?: () => void;
}

export default function SenderBulkUpdateModal(props: SenderBulkUpdateModalProps) {
    const { auth } = usePage<any>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';

    const actions: BulkUpdateAction[] = [];

    if (isSuperAdmin) {
        actions.push({
            id: 'archive',
            label: 'Archive Senders',
            icon: Archive,
            description: 'Archive senders to hide them from the main list. Associated bookings and boxes remain untouched.',
            endpoint: '/admin/senders/bulk-destroy',
            method: 'delete',
            renderForm: () => (
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/80 shadow-2xs">
                    <div className="flex items-start gap-3">
                        <div className="size-8 rounded-lg bg-zinc-200/60 text-zinc-700 flex items-center justify-center shrink-0">
                            <AlertTriangle className="size-4" />
                        </div>
                        <div>
                            <h4 className="text-xs font-semibold text-zinc-900">Confirm Archive</h4>
                            <p className="text-xs text-zinc-600 leading-relaxed mt-0.5">
                                Archived senders will be hidden from active lists. Related bookings and box tracking history will be fully preserved.
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
            title="Update Selected Senders"
            actions={actions}
            selectedIds={props.selectedIds}
            isGlobalSelection={props.isGlobalSelection}
            filters={props.filters}
            onSuccessCallback={props.onSuccessCallback}
        />
    );
}

