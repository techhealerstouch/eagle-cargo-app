import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { 
    AlertTriangle, 
    RefreshCw, 
    Package, 
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import BulkUpdateModal, { BulkUpdateAction } from '@/components/common/bulk-update-modal';
import { humanize } from '@/lib/utils';

interface BoxBulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: number[];
    isGlobalSelection: boolean;
    filters: any;
    onSuccessCallback?: () => void;
    boxesData?: any[]; // To check unreceived boxes for batch assignment warning
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

export default function BoxBulkUpdateModal(props: BoxBulkUpdateModalProps) {
    const { auth, tracking_steps: pageTrackingSteps, activeBatches } = usePage<any>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';
    const trackingSteps = pageTrackingSteps ?? DEFAULT_TRACKING_STEPS;

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

    const currentStatusesSummary = React.useMemo<[string, number][] | null>(() => {
        if (!props.boxesData || props.boxesData.length === 0 || props.selectedIds.length === 0) return null;
        
        const selectedBoxes = props.boxesData.filter((box: any) => props.selectedIds.includes(box.id));
        const statusCounts: Record<string, number> = {};
        for (const box of selectedBoxes) {
            const step = trackingSteps.find((s: any) => s.system_status === box.status);
            const label = step ? step.label : humanize(box.status);
            statusCounts[label] = (statusCounts[label] || 0) + 1;
        }
        
        return Object.entries(statusCounts);
    }, [props.selectedIds, props.boxesData, trackingSteps]);

    const actions: BulkUpdateAction[] = [
        {
            id: 'status',
            label: 'Update Status',
            icon: RefreshCw,
            description: 'Change the logistical status of the selected boxes.',
            endpoint: '/admin/boxes/bulk-update-status',
            getPayload: (formState) => {
                const newStatus = formState.status;
                let systemStatus = undefined;
                let trackingStepKey = undefined;

                if (newStatus && newStatus !== '') {
                    const selectedStep = trackingSteps.find((s: any) => s.key === newStatus);
                    systemStatus = selectedStep ? selectedStep.system_status : newStatus;
                    trackingStepKey = selectedStep ? selectedStep.key : undefined;
                }

                return {
                    status: systemStatus,
                    tracking_step_key: trackingStepKey,
                    courier_notes: formState.statusNotes || undefined,
                    update_eta: formState.updateEtaDate || false,
                    eta_date: formState.etaDate || undefined,
                    eta_message: formState.etaMessage !== undefined ? formState.etaMessage : 'Your box is expected to be delivered on or before this date',
                    filter_status: props.filters?.status || undefined,
                };
            },
            renderForm: (formState, setFormState) => {
                const currentStatus = formState.status ?? '';
                const currentEtaMessage = formState.etaMessage !== undefined 
                    ? formState.etaMessage 
                    : 'Your box is expected to be delivered on or before this date';

                return (
                    <div className="space-y-4">
                        {currentStatusesSummary && currentStatusesSummary.length > 0 && !props.isGlobalSelection && (
                            <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-1 shadow-2xs">
                                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Current Statuses in Selection</span>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {currentStatusesSummary.map(([label, count]) => (
                                        <div key={label} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-zinc-200/80 rounded-md shadow-2xs">
                                            <span className="text-[11px] font-medium text-zinc-700">{label}</span>
                                            <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-sm">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="bulk-status" className="text-xs font-semibold text-zinc-700">New Status</Label>
                            <select
                                id="bulk-status"
                                className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-2xs transition-all"
                                value={currentStatus}
                                onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                            >
                                <option value="">— Keep Current Status (Update ETA Only) —</option>
                                <optgroup label="Tracking Steps">
                                    {dynamicOptions.map((opt: any) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Exceptions">
                                    {exceptionOptions.map((opt: any) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bulk-notes" className="text-xs font-semibold text-zinc-700">Courier / Internal Notes (Optional)</Label>
                            <Textarea
                                id="bulk-notes"
                                className="min-h-[64px] text-xs resize-none rounded-xl border-zinc-200 focus:ring-2 focus:ring-zinc-900/10 shadow-2xs"
                                placeholder="Add notes for this status update..."
                                value={formState.statusNotes || ''}
                                onChange={(e) => setFormState({ ...formState, statusNotes: e.target.value })}
                            />
                        </div>

                        <div className="pt-3 border-t border-zinc-100">
                            <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="bulk-update-eta" 
                                    checked={formState.updateEtaDate || false}
                                    onCheckedChange={(checked) => setFormState({ ...formState, updateEtaDate: checked === true })}
                                />
                                <Label htmlFor="bulk-update-eta" className="text-xs font-medium leading-none text-zinc-700 cursor-pointer select-none">
                                    Update Estimated Delivery Date
                                </Label>
                            </div>

                            {(formState.updateEtaDate) && (
                                <div className="mt-3 space-y-3 p-3.5 bg-zinc-50/80 border border-zinc-200/80 rounded-xl shadow-2xs">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="bulk-eta-date" className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
                                            New ETA Date
                                        </Label>
                                        <Input
                                            id="bulk-eta-date"
                                            type="date"
                                            className="h-9 text-xs rounded-xl border-zinc-200 bg-white"
                                            value={formState.etaDate || ''}
                                            onChange={(e) => setFormState({ ...formState, etaDate: e.target.value })}
                                            min={new Date().toISOString().split('T')[0]}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="bulk-eta-message" className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
                                            Customer ETA Message
                                        </Label>
                                        <Textarea
                                            id="bulk-eta-message"
                                            className="min-h-[60px] text-xs resize-none bg-white rounded-xl border-zinc-200"
                                            placeholder="Your box is expected to be delivered on or before this date"
                                            value={currentEtaMessage}
                                            onChange={(e) => setFormState({ ...formState, etaMessage: e.target.value })}
                                        />
                                        <p className="text-[10px] text-zinc-400">Visible to customer on the tracking portal.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
        },
    ];


    if (isSuperAdmin) {
        actions.push({
            id: 'archive',
            label: 'Archive Boxes',
            icon: AlertTriangle,
            description: 'Archive boxes to hide them from the main list.',
            endpoint: '/admin/boxes/bulk-destroy',
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
                                Archived boxes will be hidden from the active inventory, but their underlying tracking history and logs will be preserved.
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
            title="Update Selected Boxes"
            actions={actions}
            selectedIds={props.selectedIds}
            isGlobalSelection={props.isGlobalSelection}
            filters={props.filters}
            onSuccessCallback={props.onSuccessCallback}
        />
    );
}
