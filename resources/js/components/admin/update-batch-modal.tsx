import { router } from '@inertiajs/react';
import {
    Activity,
    Anchor,
    CalendarClock,
    Container,
    FileText,
    Loader2,
    RefreshCw,
    Ship,
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

    const availablePhases = trackingPhases.filter((p) => p.value !== 'delivered');
    const statusChanged = status !== batch.status;

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
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="flex h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium text-brand-text shadow-2xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                                >
                                    <option value="open">Open (Accepting Boxes)</option>
                                    <option value="loading">Loading (Active Loading)</option>
                                    <option value="ready_to_close">Ready to Close (Manifest Ready)</option>
                                    <option value="sailed">Sailed (Departed Port)</option>
                                    <option value="arrived">Arrived at Port</option>
                                    <option value="under_customs_clearance">Under BOC Clearance</option>
                                    <option value="released_by_boc">Released by BOC</option>
                                    <option value="received_at_warehouse">Received at Manila Warehouse</option>
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
                    </div>

                    {/* Tracking Milestone */}
                    <div className="space-y-3 p-3.5 rounded-xl border border-border bg-brand-warm/5 dark:bg-zinc-900/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-brand-text uppercase tracking-wider">
                                <Anchor className="size-3.5 text-sky-600 dark:text-sky-400" />
                                <span>Tracking Milestone Event</span>
                            </div>
                            <span className="text-[10px] text-brand-text-light">Optional</span>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="batch-milestone" className="text-xs font-semibold text-brand-text">
                                Advance Container Milestone (All Loaded Boxes)
                            </Label>
                            <select
                                id="batch-milestone"
                                value={trackingPhase}
                                onChange={(e) => setTrackingPhase(e.target.value)}
                                className="flex h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium text-brand-text shadow-2xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                            >
                                <option value="">No tracking milestone update</option>
                                {availablePhases.map((phase) => (
                                    <option
                                        key={phase.value}
                                        value={phase.value}
                                        disabled={
                                            batch.latest_tracking_phase_order !== null &&
                                            batch.latest_tracking_phase_order !== undefined &&
                                            phase.order <= batch.latest_tracking_phase_order
                                        }
                                    >
                                        {phase.group ? `${phase.group} - ` : ''}{phase.label}
                                        {phase.value === batch.latest_tracking_phase ? ' (Current)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

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
                            disabled={isSubmitting}
                            className="rounded-xl text-xs bg-brand-rust hover:bg-brand-rust/90 text-white font-semibold uppercase tracking-wider shadow-md shadow-brand-rust/10 flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    Saving...
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
