import { router, usePage } from '@inertiajs/react';
import { AlertTriangle, Upload } from 'lucide-react';
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
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

export interface UpdateBoxStatusModalBox {
    id: number;
    status: string;
    tracking_number: string;
    serial_number?: string | null;
    tracking_step_key?: string | null;
    eta_date?: string | null;
    eta_message?: string | null;
    has_delivery_proof?: boolean;
    has_signature?: boolean;
}

interface UpdateBoxStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    box: UpdateBoxStatusModalBox | null;
    trackingSteps?: any[];
    userRole?: string;
    onSuccessCallback?: () => void;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['collected', 'received_by_branch', 'cancelled'],
    collected: ['received_by_branch', 'loaded_to_container', 'in_transit', 'damaged', 'cancelled'],
    received_by_branch: ['loaded_to_container', 'in_transit', 'arrived', 'delivered', 'damaged', 'held', 'cancelled'],
    loaded_to_container: ['in_transit', 'arrived', 'delivered', 'damaged', 'held', 'cancelled'],
    damaged: ['received_by_branch', 'loaded_to_container', 'in_transit', 'arrived', 'out_for_delivery', 'delivered', 'cancelled'],
    held: ['received_by_branch', 'loaded_to_container', 'in_transit', 'arrived', 'out_for_delivery', 'delivered', 'cancelled'],
    in_transit: ['arrived', 'out_for_delivery', 'delivered', 'received_by_branch', 'cancelled'],
    arrived: ['in_transit', 'out_for_delivery', 'delivered', 'cancelled'],
    out_for_delivery: ['delivered', 'cancelled', 'held', 'damaged'],
    delivered: [],
    cancelled: ['pending', 'collected'],
};

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

export default function UpdateBoxStatusModal({
    isOpen,
    onClose,
    box,
    trackingSteps: trackingStepsProp,
    userRole = 'super_admin',
    onSuccessCallback,
}: UpdateBoxStatusModalProps) {
    const { tracking_steps: pageTrackingSteps } = usePage<any>().props;
    const trackingSteps = trackingStepsProp ?? pageTrackingSteps ?? DEFAULT_TRACKING_STEPS;

    const getValueForSystemStatus = (sysStatus: string) => {
        const step = trackingSteps.find((s: any) => s.system_status === sysStatus);
        return step ? step.key : sysStatus;
    };

    const [newStatus, setNewStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [overrideReason, setOverrideReason] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [updateEtaDate, setUpdateEtaDate] = useState(false);
    const [updateEtaMessage, setUpdateEtaMessage] = useState(false);
    const [etaDate, setEtaDate] = useState('');
    const [etaMessage, setEtaMessage] = useState('Your box is expected to be delivered on or before this date');
    const [isUpdating, setIsUpdating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (box) {
            setNewStatus(box.tracking_step_key || getValueForSystemStatus(box.status));
            setEtaDate(box.eta_date || '');
            setEtaMessage(box.eta_message || 'Your box is expected to be delivered on or before this date');
            setStatusNotes('');
            setOverrideReason('');
            setProofFile(null);
            setUpdateEtaDate(false);
            setUpdateEtaMessage(false);
        }
    }, [box, isOpen]);

    if (!box) return null;

    const handleStatusUpdate = () => {
        if (!newStatus || !box) return;

        const selectedStep = trackingSteps.find((s: any) => s.key === newStatus);
        const systemStatus = selectedStep ? selectedStep.system_status : newStatus;
        const trackingStepKey = selectedStep ? selectedStep.key : undefined;

        const proofRequiredStatuses = ['delivered', 'collected'];
        if (proofRequiredStatuses.includes(systemStatus) && !proofFile && !box.has_delivery_proof) {
            toast.error('A proof photo is required for this status.');
            return;
        }

        setIsUpdating(true);
        router.post(`/admin/boxes/${box.id}/update-status`, {
            status: systemStatus,
            tracking_step_key: trackingStepKey,
            courier_notes: statusNotes || undefined,
            admin_delivery_override_reason: overrideReason || undefined,
            delivery_proof: proofFile,
            update_eta_date: updateEtaDate,
            update_eta_message: updateEtaMessage,
            eta_date: etaDate || undefined,
            eta_message: etaMessage || undefined,
        }, {
            onSuccess: () => {
                onClose();
                toast.success('Box status updated successfully');
                onSuccessCallback?.();
            },
            onError: (errors: any) => {
                toast.error(errors?.message || 'Failed to update box status');
            },
            onFinish: () => setIsUpdating(false),
        });
    };

    const showDeliveryOverride = newStatus === 'delivered';
    const hasDeliveryProof = box.has_delivery_proof;
    const hasSignature = box.has_signature;

    const dynamicOptions = trackingSteps.map((step: any) => ({
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

    const getSystemStatusForValue = (val: string) => {
        const opt = allOptions.find(o => o.value === val);
        return opt ? opt.system_status : val;
    };

    const isStatusDisabled = (currentStatus: string | undefined, optionStatus: string) => {
        if (!currentStatus) return false;
        if (currentStatus === optionStatus) return false;
        const allowed = ALLOWED_TRANSITIONS[currentStatus];
        return !allowed || !allowed.includes(optionStatus);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg bg-white border-zinc-200/80 rounded-xl p-0 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
                <div className="bg-zinc-50 border-b border-zinc-200/80 p-5 sm:p-6 flex-shrink-0">
                    <DialogHeader>
                        <DialogTitle className="font-sans text-lg font-semibold text-zinc-900">Update Box Status</DialogTitle>
                        <DialogDescription className="text-zinc-500 font-sans uppercase text-[11px] font-medium tracking-wide mt-0.5">
                            Serial #: <span className="font-mono font-semibold text-zinc-900">{box.serial_number || box.tracking_number}</span>
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs">
                    <div className="space-y-2">
                        <Label htmlFor="modal-status" className="text-xs font-semibold text-zinc-700">
                            New Status
                        </Label>
                        <select
                            id="modal-status"
                            title="Select new status"
                            className="flex h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                        >
                            {allOptions.map((opt) => (
                                <option
                                    key={opt.value}
                                    value={opt.value}
                                    disabled={isStatusDisabled(box?.status, getSystemStatusForValue(opt.value))}
                                >
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-zinc-400 italic">
                            * Backward status updates are disabled to maintain chronological tracking integrity.
                        </p>
                    </div>

                    {(() => {
                        const getStepOrder = (status: string) => {
                            const step = trackingSteps.find((s: any) => s.key === status || s.system_status === status);
                            return step?.order ?? 0;
                        };
                        const currentOrder = getStepOrder(box.status);
                        const newOrder = getStepOrder(newStatus);
                        const skippedSteps = trackingSteps.filter((s: any) => s.order > currentOrder && s.order < newOrder);

                        if (skippedSteps.length === 0 || !['admin', 'super_admin'].includes(userRole)) return null;

                        return (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2.5 text-amber-800 animate-in fade-in duration-200">
                                <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                                <div className="space-y-1 text-xs">
                                    <span className="font-semibold uppercase tracking-wider text-[10px]">Bypassing Milestones</span>
                                    <p className="leading-relaxed font-normal">
                                        Warning: You are skipping {skippedSteps.length} journey step(s): {' '}
                                        <span className="font-semibold underline">{skippedSteps.map((s: any) => s.label).join(', ')}</span>.
                                    </p>
                                </div>
                            </div>
                        );
                    })()}

                    {showDeliveryOverride && (
                        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                            <Label htmlFor="modal-override-reason" className="font-semibold text-amber-900 text-xs">
                                Admin Delivery Override Reason
                            </Label>
                            <p className="text-amber-800 text-[11px]">
                                This box is missing {!hasDeliveryProof && !hasSignature ? 'delivery proof and recipient signature' : !hasDeliveryProof ? 'delivery proof' : 'recipient signature'}. Add a reason to mark it delivered anyway.
                            </p>
                            <textarea
                                id="modal-override-reason"
                                className="min-h-16 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                value={overrideReason}
                                onChange={(e) => setOverrideReason(e.target.value)}
                                placeholder="Example: Recipient confirmed delivery by phone; proof will be attached later."
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="modal-proof-file" className="font-semibold text-zinc-700 text-xs">
                            Proof of Status / Delivery {['delivered', 'collected'].includes(newStatus) && <span className="text-red-500">*</span>}
                        </Label>
                        <p className="text-[11px] text-zinc-500">
                            {['delivered', 'collected'].includes(newStatus)
                                ? 'A photo or PDF is required for this status (max 5 MB).'
                                : 'Optional. Attach a photo or PDF as proof (max 5 MB).'}
                        </p>
                        <div className="flex items-center gap-3">
                            <input
                                ref={fileInputRef}
                                id="modal-proof-file"
                                type="file"
                                title="Upload proof"
                                accept="image/jpeg,image/jpg,image/png,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    setProofFile(file);
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 rounded-lg h-9 px-3 text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                            >
                                <Upload className="size-3.5" />
                                {proofFile ? 'Change File' : 'Choose File'}
                            </Button>
                            {proofFile && (
                                <span className="text-xs font-medium text-zinc-600 truncate max-w-48">
                                    {proofFile.name}
                                </span>
                            )}
                        </div>
                    </div>

                    {['admin', 'super_admin'].includes(userRole) && (
                        <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3.5">
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="modal-update-eta-date"
                                        checked={updateEtaDate}
                                        onCheckedChange={(checked) => setUpdateEtaDate(!!checked)}
                                    />
                                    <Label htmlFor="modal-update-eta-date" className="text-xs font-medium text-zinc-800 cursor-pointer">
                                        Update Delivery Estimate Date (Visible to Customer)
                                    </Label>
                                </div>
                                {updateEtaDate && (
                                    <div className="pl-6 pt-1 space-y-1">
                                        <input
                                            type="date"
                                            className="flex h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                                            value={etaDate}
                                            onChange={(e) => setEtaDate(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 pt-2 border-t border-zinc-200/60">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="modal-update-eta-message"
                                        checked={updateEtaMessage}
                                        onCheckedChange={(checked) => setUpdateEtaMessage(!!checked)}
                                    />
                                    <Label htmlFor="modal-update-eta-message" className="text-xs font-medium text-zinc-800 cursor-pointer">
                                        Update Delivery Estimate Message (Visible to Customer)
                                    </Label>
                                </div>
                                {updateEtaMessage && (
                                    <div className="pl-6 pt-1 space-y-1">
                                        <textarea
                                            className="min-h-14 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                                            value={etaMessage}
                                            onChange={(e) => setEtaMessage(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="modal-notes" className="text-xs font-semibold text-zinc-700">
                            Notes (Optional)
                        </Label>
                        <textarea
                            id="modal-notes"
                            className="min-h-20 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                            value={statusNotes}
                            onChange={(e) => setStatusNotes(e.target.value)}
                            placeholder="Add a note about this status change..."
                        />
                    </div>
                </div>

                <DialogFooter className="bg-zinc-50/80 p-4 border-t border-zinc-200/80 flex flex-row items-center justify-end gap-2 flex-shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="h-9 rounded-lg px-4 text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleStatusUpdate}
                        disabled={isUpdating || !newStatus || (['delivered', 'collected'].includes(newStatus) && !proofFile && !box.has_delivery_proof)}
                        className="h-9 rounded-lg px-4 text-xs font-medium bg-brand-rust text-white hover:bg-brand-rust/90 transition-colors shadow-2xs"
                    >
                        {isUpdating ? 'Updating...' : 'Update Status'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
