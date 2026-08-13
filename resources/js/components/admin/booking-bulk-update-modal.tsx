import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { 
    AlertTriangle, 
    Ban, 
    CreditCard, 
    Activity,
    FileText
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import BulkUpdateModal, { BulkUpdateAction } from '@/components/common/bulk-update-modal';

interface BookingBulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: number[];
    isGlobalSelection: boolean;
    filters: any;
    onSuccessCallback?: () => void;
}

const STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending / Booked' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'collected', label: 'Picked Up from Sender' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'partially_delivered', label: 'Partially Delivered' },
    { value: 'delivered', label: 'Delivered' },
];

const PAYMENT_STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'cash_on_pickup', label: 'Cash on Pickup' },
    { value: 'cash_collected', label: 'Cash Collected' },
    { value: 'balance_pending', label: 'Balance Pending' },
    { value: 'partially_paid', label: 'Partially Paid' },
];

export default function BookingBulkUpdateModal(props: BookingBulkUpdateModalProps) {
    const { auth } = usePage().props as any;
    const isSuperAdmin = auth?.user?.role === 'super_admin';

    const actions: BulkUpdateAction[] = [
        {
            id: 'status',
            label: 'Update Status',
            icon: Activity,
            description: 'Change the logistical status of the selected bookings.',
            endpoint: '/admin/bookings/bulk-update-status',
            getPayload: (formState) => ({ status: formState.status || STATUS_OPTIONS[0].value, filter_status: props.filters?.status }),
            renderForm: (formState, setFormState) => (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="bulk-status" className="text-xs font-semibold text-zinc-700">
                            New Logistical Status
                        </Label>
                        <select
                            id="bulk-status"
                            className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-2xs transition-all"
                            value={formState.status || STATUS_OPTIONS[0].value}
                            onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                        >
                            {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/40 rounded-xl border border-amber-200/80 shadow-2xs">
                        <div className="flex items-start gap-2.5">
                            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 leading-relaxed font-normal">
                                Ensure selected bookings permit transitioning to this status. Invalid state transitions will be automatically skipped.
                            </p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'payment_status',
            label: 'Update Payment Status',
            icon: CreditCard,
            description: 'Update the payment status across multiple bookings.',
            endpoint: '/admin/bookings/bulk-update-payment-status',
            getPayload: (formState) => ({ payment_status: formState.payment_status || PAYMENT_STATUS_OPTIONS[0].value, filter_status: props.filters?.status }),
            renderForm: (formState, setFormState) => (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="bulk-payment-status" className="text-xs font-semibold text-zinc-700">
                            New Payment Status
                        </Label>
                        <select
                            id="bulk-payment-status"
                            className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-2xs transition-all"
                            value={formState.payment_status || PAYMENT_STATUS_OPTIONS[0].value}
                            onChange={(e) => setFormState({ ...formState, payment_status: e.target.value })}
                        >
                            {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )
        },
        {
            id: 'admin_notes',
            label: 'Update Internal Note',
            icon: FileText,
            description: 'Set or clear the internal note for the selected bookings.',
            endpoint: '/admin/bookings/bulk-update-notes',
            getPayload: (formState) => ({ admin_notes: formState.admin_notes || '', filter_status: props.filters?.status }),
            renderForm: (formState, setFormState) => (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="bulk-admin-notes" className="text-xs font-semibold text-zinc-700">
                            Internal Note (Optional)
                        </Label>
                        <textarea
                            id="bulk-admin-notes"
                            className="flex min-h-[80px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-2xs transition-all resize-none"
                            placeholder="Add an internal note..."
                            value={formState.admin_notes || ''}
                            onChange={(e) => setFormState({ ...formState, admin_notes: e.target.value })}
                        />
                    </div>
                </div>
            )
        },
        {
            id: 'cancel',
            label: 'Cancel Bookings',
            icon: Ban,
            description: 'Mark the selected bookings as cancelled.',
            endpoint: '/admin/bookings/bulk-cancel',
            renderForm: () => (
                <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50/40 rounded-xl border border-red-200/80 shadow-2xs">
                    <div className="flex items-start gap-3">
                        <div className="size-8 rounded-lg bg-red-100/80 text-red-600 flex items-center justify-center shrink-0">
                            <Ban className="size-4" />
                        </div>
                        <div>
                            <h4 className="text-xs font-semibold text-red-900">Confirm Cancellation</h4>
                            <p className="text-xs text-red-700/90 leading-relaxed mt-0.5">
                                Are you sure you want to cancel these bookings? Ongoing logistical workflows will be halted.
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
            label: 'Archive Bookings',
            icon: AlertTriangle,
            description: 'Archive bookings to hide them from the main list.',
            endpoint: '/admin/bookings/bulk-destroy',
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
                                Archived bookings will be hidden from the active table, but all record data will remain intact for reporting.
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
            title="Update Selected Bookings"
            actions={actions}
            selectedIds={props.selectedIds}
            isGlobalSelection={props.isGlobalSelection}
            filters={props.filters}
            onSuccessCallback={props.onSuccessCallback}
        />
    );
}

