import { router, usePage } from '@inertiajs/react';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

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

interface BulkUpdateStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: number[];
    isGlobalSelection: boolean;
    filters: any;
    onSuccessCallback?: () => void;
}

const DEFAULT_TRACKING_STEPS = [
    { key: 'pending', system_status: 'pending', label: 'Pending / Booked', order: 1 },
    { key: 'collected', system_status: 'collected', label: 'Picked Up from Sender', order: 2 },
    { key: 'received_by_branch', system_status: 'received_by_branch', label: 'Received at Branch Warehouse', order: 3 },
    { key: 'loaded_to_container', system_status: 'loaded_to_container', label: 'Loaded to Container Batch', order: 4 },
    { key: 'in_transit', system_status: 'in_transit', label: 'In Transit to Destination Hub', order: 5 },
    { key: 'arrived', system_status: 'arrived', label: 'Arrived at Destination Hub', order: 6 },
    { key: 'out_for_delivery', system_status: 'out_for_delivery', label: 'Out for Final Delivery', order: 7 },
    { key: 'delivered', system_status: 'delivered', label: 'Delivered to Recipient', order: 8 },
];

export default function BulkUpdateStatusModal({
    isOpen,
    onClose,
    selectedIds,
    isGlobalSelection,
    filters,
    onSuccessCallback,
}: BulkUpdateStatusModalProps) {
    const { tracking_steps: pageTrackingSteps } = usePage<any>().props;
    const trackingSteps = pageTrackingSteps ?? DEFAULT_TRACKING_STEPS;

    const [newStatus, setNewStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [updateEtaDate, setUpdateEtaDate] = useState(false);
    const [etaDate, setEtaDate] = useState('');
    const [etaMessage, setEtaMessage] = useState('Your box is expected to be delivered on or before this date');
    const [isUpdating, setIsUpdating] = useState(false);

    // Get all options but exclude Delivered since backend does not allow bulk Delivered updates
    const dynamicOptions = trackingSteps
        .filter((step: any) => step.system_status !== 'delivered')
        .map((step: any) => ({
            value: step.key,
            system_status: step.system_status,
            label: step.label,
        }));

    const exceptionOptions = [
        { value: 'cancelled', system_status: 'cancelled', label: 'Cancelled' },
        { value: 'damaged', system_status: 'damaged', label: 'Damaged' },
        { value: 'held', system_status: 'held', label: 'Held' },
    ];

    const allOptions = [...dynamicOptions, ...exceptionOptions];

    useEffect(() => {
        if (isOpen) {
            setNewStatus(allOptions[0]?.value || 'collected');
            setStatusNotes('');
            setUpdateEtaDate(false);
            setEtaDate('');
            setEtaMessage('Your box is expected to be delivered on or before this date');
        }
    }, [isOpen]);

    const handleBulkUpdate = () => {
        if (!newStatus) return;

        const selectedStep = trackingSteps.find((s: any) => s.key === newStatus);
        const systemStatus = selectedStep ? selectedStep.system_status : newStatus;
        const trackingStepKey = selectedStep ? selectedStep.key : undefined;

        setIsUpdating(true);
        router.post('/admin/boxes/bulk-update-status', {
            ids: selectedIds,
            select_all: isGlobalSelection,
            status: systemStatus,
            tracking_step_key: trackingStepKey,
            courier_notes: statusNotes || undefined,
            update_eta: updateEtaDate,
            eta_date: etaDate || undefined,
            eta_message: etaMessage || undefined,
            filter_status: filters.status || undefined,
            search: filters.search || undefined,
            area_id: filters.area_id || undefined,
        }, {
            onSuccess: () => {
                onClose();
                toast.success('Selected boxes updated successfully');
                onSuccessCallback?.();
            },
            onError: (errors: any) => {
                toast.error(errors?.message || 'Failed to update boxes status');
            },
            onFinish: () => setIsUpdating(false),
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-white border-zinc-200/80 rounded-xl p-0 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
                <div className="bg-zinc-50 border-b border-zinc-200/80 p-5 flex-shrink-0">
                    <DialogHeader>
                        <DialogTitle className="font-sans text-lg font-semibold text-zinc-900">Bulk Update Box Status</DialogTitle>
                        <DialogDescription className="text-zinc-500 font-sans text-xs mt-0.5">
                            Update status for {isGlobalSelection ? 'all matching' : `${selectedIds.length}`} box(es).
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
                    <div className="space-y-2">
                        <Label htmlFor="bulk-status" className="text-xs font-semibold text-zinc-700">
                            New Status
                        </Label>
                        <select
                            id="bulk-status"
                            title="Select new status"
                            className="flex h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                        >
                            {allOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-zinc-400 italic">
                            * Delivered status is excluded from bulk updates as it requires individual signature/photo verification.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bulk-notes" className="text-xs font-semibold text-zinc-700">
                            Status / Courier Notes (Optional)
                        </Label>
                        <textarea
                            id="bulk-notes"
                            placeholder="Add update notes applied to all selected boxes..."
                            value={statusNotes}
                            onChange={(e) => setStatusNotes(e.target.value)}
                            className="flex min-h-[80px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                        />
                    </div>

                    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="bulk-update-eta"
                                checked={updateEtaDate}
                                onCheckedChange={(checked) => setUpdateEtaDate(checked === true)}
                                className="size-4 rounded border-zinc-300"
                            />
                            <Label htmlFor="bulk-update-eta" className="text-xs font-semibold text-zinc-700 cursor-pointer">
                                Update ETA for these boxes
                            </Label>
                        </div>

                        {updateEtaDate && (
                            <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                                <div className="space-y-1.5">
                                    <Label htmlFor="bulk-eta-date" className="text-[11px] font-semibold text-zinc-600">
                                        Expected Delivery Date
                                    </Label>
                                    <input
                                        id="bulk-eta-date"
                                        type="date"
                                        className="flex h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                                        value={etaDate}
                                        onChange={(e) => setEtaDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="bulk-eta-message" className="text-[11px] font-semibold text-zinc-600">
                                        ETA Status Message
                                    </Label>
                                    <input
                                        id="bulk-eta-message"
                                        type="text"
                                        className="flex h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                                        value={etaMessage}
                                        onChange={(e) => setEtaMessage(e.target.value)}
                                        placeholder="ETA status details..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="bg-zinc-50 border-t border-zinc-200/80 p-4 flex flex-row items-center justify-end gap-2 flex-shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isUpdating}
                        className="h-9 rounded-lg px-4 text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleBulkUpdate}
                        disabled={isUpdating || !newStatus}
                        className="h-9 rounded-lg px-4 text-xs font-medium bg-brand-rust text-white hover:bg-brand-rust/90 transition-colors shadow-2xs"
                    >
                        {isUpdating ? 'Updating...' : 'Update Status'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
