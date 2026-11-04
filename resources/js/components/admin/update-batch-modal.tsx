import { router, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    Anchor,
    CalendarClock,
    CheckCircle2,
    Container,
    FileText,
    Info,
    Loader2,
    RefreshCw,
    Ship,
    Sparkles,
    Tag,
} from 'lucide-react';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BATCH_STATUS_CONFIG } from '@/lib/statuses';
import { humanize } from '@/lib/utils';

export interface TrackingPhaseOption {
    value: string;
    label: string;
    group: string;
    order: number;
}

const CORRECTION_REASON_PRESETS = [
    'Mistaken status update; container is still sailing',
    'Accidentally updated wrong company / batch',
    'Vessel departure delayed; rolling back milestone',
    'Logistics data entry correction by admin',
];

const BATCH_STATUS_LIST = [
    { value: 'open', label: 'Open (Accepting Boxes)' },
    { value: 'loading', label: 'Loading (Active Loading)' },
    { value: 'ready_to_close', label: 'Ready to Close (Manifest Ready)' },
    { value: 'sailed', label: 'Sailed (Departed Port)' },
    { value: 'arrived', label: 'Arrived at Port' },
    { value: 'under_customs_clearance', label: 'Under BOC Clearance' },
    { value: 'released_by_boc', label: 'Released by BOC' },
    { value: 'received_at_warehouse', label: 'Received at Manila Warehouse' },
];

const STATUS_TO_DEFAULT_PHASE: Record<string, string> = {
    open: 'received_by_branch',
    loading: 'loading_container',
    ready_to_close: 'loading_container',
    sailed: 'in_transit_sea',
    arrived: 'arrived_manila_port',
    under_customs_clearance: 'under_customs_clearance',
    released_by_boc: 'released_by_boc',
    received_at_warehouse: 'received_manila_warehouse',
};

const PHASE_TO_BATCH_STATUS: Record<string, string> = {
    picked_up: 'open',
    received_by_branch: 'open',
    loading_container: 'loading',
    departed_from_origin: 'sailed',
    in_transit_sea: 'sailed',
    arrived_manila_port: 'arrived',
    under_customs_clearance: 'under_customs_clearance',
    released_by_boc: 'released_by_boc',
    received_manila_warehouse: 'received_at_warehouse',
    sorting: 'received_at_warehouse',
    dispatched_to_local_hub: 'received_at_warehouse',
    out_for_delivery: 'received_at_warehouse',
};

export interface UpdateBatchModalBatch {
    id: number;
    batch_number: string;
    container_number?: string | null;
    seal_number?: string | null;
    vessel_name?: string | null;
    voyage_number?: string | null;
    status: string;
    current_box_count: number;
    eta_at?: string | null;
    latest_tracking_phase?: string | null;
    latest_tracking_phase_order?: number | null;
}

interface UpdateBatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    batch: UpdateBatchModalBatch;
    trackingPhases?: TrackingPhaseOption[];
    onSuccessCallback?: () => void;
}

function toDateTimeLocal(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - offset);
    return local.toISOString().slice(0, 16);
}

export default function UpdateBatchModal({
    isOpen,
    onClose,
    batch,
    trackingPhases = [],
    onSuccessCallback,
}: UpdateBatchModalProps) {
    const { auth } = usePage<any>().props;
    const isSuperAdminOrAdmin = ['admin', 'super_admin'].includes(auth?.user?.role) || auth?.user?.is_developer;

    const [status, setStatus] = useState(batch.status || 'open');
    const [trackingPhase, setTrackingPhase] = useState('');
    const [trackingDescription, setTrackingDescription] = useState('');
    const [containerNumber, setContainerNumber] = useState(batch.container_number || '');
    const [sealNumber, setSealNumber] = useState(batch.seal_number || '');
    const [vesselName, setVesselName] = useState(batch.vessel_name || '');
    const [voyageNumber, setVoyageNumber] = useState(batch.voyage_number || '');
    const [etaAt, setEtaAt] = useState(toDateTimeLocal(batch.eta_at));
    const [overrideNote, setOverrideNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const availablePhases = trackingPhases.filter((p) => p.value !== 'delivered');
    const statusChanged = status !== batch.status;

    const selectedPhaseObj = availablePhases.find((p) => p.value === trackingPhase);
    const isBackwardTrackingPhase =
        selectedPhaseObj !== undefined &&
        batch.latest_tracking_phase_order !== null &&
        batch.latest_tracking_phase_order !== undefined &&
        selectedPhaseObj.order <= batch.latest_tracking_phase_order;

    const statusesOrder = ['open', 'loading', 'ready_to_close', 'sailed', 'arrived', 'under_customs_clearance', 'released_by_boc', 'received_at_warehouse'];
    const currentStatusIdx = statusesOrder.indexOf(batch.status);
    const newStatusIdx = statusesOrder.indexOf(status);
    const isBackwardStatus = statusChanged && newStatusIdx !== -1 && currentStatusIdx !== -1 && newStatusIdx < currentStatusIdx;

    const requiresCorrectionReason = isBackwardTrackingPhase || isBackwardStatus;

    // Sync form state when modal opens or batch changes
    useEffect(() => {
        if (isOpen) {
            setStatus(batch.status || 'open');
            setTrackingPhase('');
            setTrackingDescription('');
            setContainerNumber(batch.container_number || '');
            setSealNumber(batch.seal_number || '');
            setVesselName(batch.vessel_name || '');
            setVoyageNumber(batch.voyage_number || '');
            setEtaAt(toDateTimeLocal(batch.eta_at));
            setOverrideNote('');
        }
    }, [isOpen, batch]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (requiresCorrectionReason && overrideNote.trim().length < 10) {
            toast.error('A correction reason of at least 10 characters is required when reverting status or milestones.');
            return;
        }

        setIsSubmitting(true);

        const payload: Record<string, any> = {
            status: status !== batch.status ? status : undefined,
            tracking_phase: trackingPhase || undefined,
            tracking_description: trackingDescription.trim() || undefined,
            container_number: containerNumber.trim() || null,
            seal_number: sealNumber.trim() || null,
            vessel_name: vesselName.trim() || null,
            voyage_number: voyageNumber.trim() || null,
            eta_at: etaAt || null,
            override_note: overrideNote.trim() || undefined,
            is_correction: requiresCorrectionReason ? true : undefined,
        };

        // Remove undefined keys
        Object.keys(payload).forEach((key) => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        router.patch(`/admin/batches/${batch.id}/quick-update`, payload, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`Batch ${batch.batch_number} updated successfully.`);
                setIsSubmitting(false);
                onSuccessCallback?.();
                onClose();
            },
            onError: (errors) => {
                setIsSubmitting(false);
                const firstError = Object.values(errors)[0] as string;
                toast.error(firstError || 'Failed to update batch.');
            },
            onFinish: () => {
                setIsSubmitting(false);
            },
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-card border border-border rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="p-5 sm:p-6 pb-4 border-b border-border/70 bg-gradient-to-r from-muted/40 via-card to-muted/20">
                    <DialogHeader>
                        <div className="flex items-start gap-3.5">
                            <div className="size-10 rounded-xl bg-brand-warm/20 text-brand-rust border border-brand-warm/30 flex items-center justify-center shrink-0 shadow-2xs">
                                <RefreshCw className="size-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <DialogTitle className="font-sans text-base sm:text-lg font-semibold text-brand-text tracking-tight">
                                    Update Batch
                                </DialogTitle>
                                <DialogDescription className="text-xs text-brand-text-mid mt-0.5">
                                    Quickly update batch status, milestone, and container details.
                                </DialogDescription>

                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-mono font-bold text-brand-text bg-background border border-border px-2 py-0.5 rounded-md shadow-2xs">
                                        {batch.batch_number}
                                    </span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-brand-text-mid font-medium">
                                        {batch.current_box_count} box{batch.current_box_count === 1 ? '' : 'es'}
                                    </span>
                                    {batch.status && (
                                        <>
                                            <span className="text-muted-foreground">•</span>
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                                    BATCH_STATUS_CONFIG[batch.status]?.badge ??
                                                    'border-border bg-muted text-muted-foreground'
                                                }`}
                                            >
                                                {humanize(batch.status)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
                    {/* Lifecycle & Status */}
                    <div className="space-y-3 p-3.5 rounded-xl border border-border bg-brand-warm/5 dark:bg-zinc-900/40">
                        <div className="flex items-center gap-2 text-xs font-bold text-brand-text uppercase tracking-wider">
                            <Activity className="size-3.5 text-brand-rust" />
                            <span>Lifecycle Status</span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="batch-status" className="text-xs font-semibold text-brand-text">
                                    Batch Status
                                </Label>
                                <select
                                    id="batch-status"
                                    value={status}
                                    onChange={(e) => {
                                        const nextStatus = e.target.value;
                                        setStatus(nextStatus);
                                        if (nextStatus !== batch.status) {
                                            const defaultPhase = STATUS_TO_DEFAULT_PHASE[nextStatus];
                                            if (defaultPhase && availablePhases.some((p) => p.value === defaultPhase)) {
                                                setTrackingPhase(defaultPhase);
                                            }
                                        } else {
                                            setTrackingPhase('');
                                        }
                                    }}
                                    className="flex h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium text-brand-text shadow-2xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                                >
                                    {BATCH_STATUS_LIST.map((s, idx) => {
                                        const isCurrent = s.value === batch.status;
                                        const isPast = currentStatusIdx !== -1 && idx < currentStatusIdx;
                                        return (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                                {isCurrent ? ' (Current)' : isPast ? ' (Revert / Correction)' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="batch-eta" className="text-xs font-semibold text-brand-text">
                                    Confirmed Port Arrival ETA
                                </Label>
                                <Input
                                    id="batch-eta"
                                    type="datetime-local"
                                    value={etaAt}
                                    onChange={(e) => setEtaAt(e.target.value)}
                                    className="h-10 text-xs rounded-xl"
                                />
                            </div>
                        </div>

                        {statusChanged && (
                            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg">
                                <span>Status will change from <strong>{humanize(batch.status)}</strong> → <strong>{humanize(status)}</strong></span>
                            </div>
                        )}

                        {isBackwardStatus && !trackingPhase && (
                            <div className="flex items-start gap-2 text-xs text-sky-800 dark:text-sky-200 bg-sky-500/10 border border-sky-500/25 p-2.5 rounded-xl animate-in fade-in duration-200">
                                <Info className="size-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
                                <div className="space-y-1">
                                    <span className="font-semibold block">Need to revert loaded boxes too?</span>
                                    <span className="text-[11px] leading-relaxed block text-sky-900/90 dark:text-sky-200/90">
                                        To also revert all <strong>{batch.current_box_count}</strong> loaded boxes back to sailing, select <strong>"Sailed / Ocean Transit"</strong> in the Tracking Milestone dropdown below.
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bulk Tracking Milestone */}
                    <div className="space-y-3 p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 dark:bg-sky-500/10 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-sky-950 dark:text-sky-200 uppercase tracking-wider">
                                <Ship className="size-4 text-sky-600 dark:text-sky-400" />
                                <span>Bulk Milestone Update (All {batch.current_box_count} Boxes)</span>
                            </div>
                            <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-full">
                                Syncs All Loaded Boxes
                            </span>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="batch-milestone" className="text-xs font-semibold text-brand-text">
                                Milestone Phase
                            </Label>
                            <select
                                id="batch-milestone"
                                value={trackingPhase}
                                onChange={(e) => {
                                    const nextPhase = e.target.value;
                                    setTrackingPhase(nextPhase);
                                    if (nextPhase && PHASE_TO_BATCH_STATUS[nextPhase]) {
                                        setStatus(PHASE_TO_BATCH_STATUS[nextPhase]);
                                    }
                                }}
                                className="flex h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium text-brand-text shadow-2xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                            >
                                <option value="">No tracking milestone update</option>
                                {availablePhases.map((phase) => {
                                    const isPast =
                                        batch.latest_tracking_phase_order !== null &&
                                        batch.latest_tracking_phase_order !== undefined &&
                                        phase.order <= batch.latest_tracking_phase_order;
                                    const isCurrent = phase.value === batch.latest_tracking_phase;
                                    const isDisabled = isPast && !isSuperAdminOrAdmin;

                                    return (
                                        <option
                                            key={phase.value}
                                            value={phase.value}
                                            disabled={isDisabled}
                                        >
                                            {phase.group ? `${phase.group} - ` : ''}{phase.label}
                                            {isCurrent ? ' (Current)' : isPast ? ' (Revert / Correction)' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {requiresCorrectionReason && (
                            <div className="space-y-3 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/5 animate-in fade-in duration-200">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                                    <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <span>Admin Journey Correction Required</span>
                                </div>
                                <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed font-medium">
                                    You are reverting this container or its milestones backward from <strong>{humanize(batch.status)}</strong> / <strong>{batch.latest_tracking_phase ? humanize(batch.latest_tracking_phase) : 'current'}</strong>.
                                    An explicit explanation is required for the immutable audit ledger. Customer status change notifications will be silenced.
                                </p>

                                {/* Quick Autofill Presets */}
                                <div className="space-y-1.5 pt-0.5">
                                    <span className="text-[10px] font-bold text-amber-900/80 dark:text-amber-200/80 uppercase tracking-wider flex items-center gap-1">
                                        <Sparkles className="size-3 text-amber-600" />
                                        Quick Presets (Click to autofill):
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {CORRECTION_REASON_PRESETS.map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setOverrideNote(preset)}
                                                className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/80 dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 transition-all text-left active:scale-95 cursor-pointer shadow-2xs"
                                            >
                                                ⚡ {preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1 pt-1">
                                    <Label htmlFor="correction-reason" className="text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                                        Reason for Reversion / Correction *
                                    </Label>
                                    <Input
                                        id="correction-reason"
                                        type="text"
                                        maxLength={500}
                                        placeholder="e.g. Mistakenly marked as unloaded in Manila warehouse while still sailing."
                                        value={overrideNote}
                                        onChange={(e) => setOverrideNote(e.target.value)}
                                        className="h-10 text-xs rounded-xl bg-white dark:bg-zinc-900 border-amber-300 dark:border-amber-700"
                                    />
                                    <div className="flex items-center justify-between text-[11px] pt-1">
                                        {overrideNote.trim().length === 0 ? (
                                            <span className="text-amber-700/80 dark:text-amber-300/80">
                                                Minimum 10 characters required for audit trail (or select a quick preset above)
                                            </span>
                                        ) : overrideNote.trim().length < 10 ? (
                                            <span className="text-red-500 font-semibold flex items-center gap-1">
                                                <span>Needs {10 - overrideNote.trim().length} more character{10 - overrideNote.trim().length === 1 ? '' : 's'}</span>
                                                <span className="text-[10px] text-muted-foreground">({overrideNote.trim().length}/10)</span>
                                            </span>
                                        ) : (
                                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                                <CheckCircle2 className="size-3.5" />
                                                <span>Valid audit reason ({overrideNote.trim().length} characters)</span>
                                            </span>
                                        )}
                                        <span className="text-[10px] text-muted-foreground font-mono">{overrideNote.length}/500</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {trackingPhase && (
                            <div className="space-y-1.5 animate-in fade-in duration-200">
                                <Label htmlFor="tracking-desc" className="text-xs font-semibold text-brand-text">
                                    Tracking Event Remark / Description
                                </Label>
                                <Input
                                    id="tracking-desc"
                                    type="text"
                                    maxLength={500}
                                    placeholder="e.g., Container discharged at port and customs cleared."
                                    value={trackingDescription}
                                    onChange={(e) => setTrackingDescription(e.target.value)}
                                    className="h-10 text-xs rounded-xl"
                                />
                                <p className="text-[11px] text-sky-600 dark:text-sky-400">
                                    ℹ️ This will write a tracking timeline update for all <strong>{batch.current_box_count}</strong> box(es).
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Container & Vessel Information */}
                    <div className="space-y-3 p-3.5 rounded-xl border border-border bg-brand-warm/5 dark:bg-zinc-900/40">
                        <div className="flex items-center gap-2 text-xs font-bold text-brand-text uppercase tracking-wider">
                            <Container className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Container & Vessel Reference</span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="container-num" className="text-xs font-semibold text-brand-text">
                                    Container Number
                                </Label>
                                <Input
                                    id="container-num"
                                    type="text"
                                    maxLength={20}
                                    placeholder="e.g., MSKU1234567"
                                    value={containerNumber}
                                    onChange={(e) => setContainerNumber(e.target.value)}
                                    className="h-10 text-xs font-mono uppercase rounded-xl"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="seal-num" className="text-xs font-semibold text-brand-text">
                                    Seal Number
                                </Label>
                                <Input
                                    id="seal-num"
                                    type="text"
                                    maxLength={50}
                                    placeholder="e.g., SL-987654"
                                    value={sealNumber}
                                    onChange={(e) => setSealNumber(e.target.value)}
                                    className="h-10 text-xs font-mono rounded-xl"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="vessel-name" className="text-xs font-semibold text-brand-text">
                                    Vessel Name
                                </Label>
                                <Input
                                    id="vessel-name"
                                    type="text"
                                    maxLength={255}
                                    placeholder="e.g., Ever Given"
                                    value={vesselName}
                                    onChange={(e) => setVesselName(e.target.value)}
                                    className="h-10 text-xs rounded-xl"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="voyage-num" className="text-xs font-semibold text-brand-text">
                                    Voyage Number
                                </Label>
                                <Input
                                    id="voyage-num"
                                    type="text"
                                    maxLength={50}
                                    placeholder="e.g., V.1024W"
                                    value={voyageNumber}
                                    onChange={(e) => setVoyageNumber(e.target.value)}
                                    className="h-10 text-xs font-mono uppercase rounded-xl"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="rounded-xl text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || (requiresCorrectionReason && overrideNote.trim().length < 10)}
                            className={`rounded-xl text-xs font-semibold uppercase tracking-wider shadow-md flex items-center gap-2 ${
                                requiresCorrectionReason
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                                    : 'bg-brand-rust hover:bg-brand-rust/90 text-white shadow-brand-rust/10'
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    Applying...
                                </>
                            ) : requiresCorrectionReason ? (
                                <>
                                    <AlertTriangle className="size-3.5" />
                                    Apply Journey Correction
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="size-3.5" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
