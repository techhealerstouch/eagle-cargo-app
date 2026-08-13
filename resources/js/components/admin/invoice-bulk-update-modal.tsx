import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { 
    AlertTriangle, 
    CheckCircle,
} from 'lucide-react';
import BulkUpdateModal, { BulkUpdateAction } from '@/components/common/bulk-update-modal';

interface InvoiceBulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: number[];
    isGlobalSelection: boolean;
    filters: any;
    onSuccessCallback?: () => void;
}

export default function InvoiceBulkUpdateModal(props: InvoiceBulkUpdateModalProps) {
    const { auth } = usePage<any>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';

    const actions: BulkUpdateAction[] = [
        {
            id: 'mark_paid',
            label: 'Mark as Paid',
            icon: CheckCircle,
            description: 'Mark all selected invoices as Paid. This will also update their corresponding bookings.',
            endpoint: '/admin/invoices/bulk-mark-paid',
            renderForm: () => (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50/40 rounded-xl border border-emerald-200/80 shadow-2xs">
                    <div className="flex items-start gap-3">
                        <div className="size-8 rounded-lg bg-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0">
                            <CheckCircle className="size-4" />
                        </div>
                        <div>
                            <h4 className="text-xs font-semibold text-emerald-900">Confirm Payment Registration</h4>
                            <p className="text-xs text-emerald-700/90 leading-relaxed mt-0.5">
                                Are you sure you want to mark {props.isGlobalSelection ? 'all matching' : props.selectedIds.length} invoice(s) as Paid? Linked bookings will also reflect the updated payment status.
                            </p>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    if (isSuperAdmin) {
        actions.push({
            id: 'archive',
            label: 'Archive Invoices',
            icon: AlertTriangle,
            description: 'Archive invoices to hide them from the main list.',
            endpoint: '/admin/invoices/bulk-destroy',
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
                                Archived invoices will be hidden from the active list view, but data remains stored for audit logs.
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
            title="Update Selected Invoices"
            actions={actions}
            selectedIds={props.selectedIds}
            isGlobalSelection={props.isGlobalSelection}
            filters={props.filters}
            onSuccessCallback={props.onSuccessCallback}
        />
    );
}

