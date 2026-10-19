import * as React from 'react';
import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    Truck,
    ArrowRight,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Navigation,
    Package,
    Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { BATCH_STATUS_CONFIG } from '@/lib/statuses';
import { humanize } from '@/lib/utils';

export interface BatchTrackingData {
    id: number;
    batch_number: string;
    container_number: string | null;
    seal_number: string | null;
    status: string;
    vessel_name: string | null;
    voyage_number: string | null;
    origin_port: string | null;
    destination_port: string | null;
    current_box_count: number;
    capacity_boxes: number | null;
    latest_tracking_phase: string | null;
    latest_tracking_phase_order: number | null;
}

export interface TrackingPhaseOption {
    value: string;
    label: string;
    group: string;
    order: number;
}

interface BatchTrackingModalProps {
    isOpen: boolean;
    onClose: () => void;
    batch: BatchTrackingData | null;
    trackingPhases: TrackingPhaseOption[];
    onSuccessCallback?: () => void;
}

export default function BatchTrackingModal({
    isOpen,
    onClose,
    batch,
    trackingPhases = [],
    onSuccessCallback,
}: BatchTrackingModalProps) {
    const [selectedPhase, setSelectedPhase] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset local state whenever dialog opens or active batch changes
    useEffect(() => {
        if (isOpen && batch) {
            setSelectedPhase('');
            setDescription('');
            setIsSubmitting(false);
        }
    }, [isOpen, batch?.id]);

    if (!batch) return null;

    const currentPhase = trackingPhases.find(
        (p) => p.value === batch.latest_tracking_phase,
    );
    const currentPhaseOrder =
        batch.latest_tracking_phase_order ?? currentPhase?.order ?? -1;

    const availablePhases = trackingPhases.filter(
        (phase) => phase.order > currentPhaseOrder,
    );

    // Group available phases by group name
    const groupedPhases = availablePhases.reduce<
        Record<string, TrackingPhaseOption[]>
    >((acc, phase) => {
        const group = phase.group || 'Milestones';
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(phase);
        return acc;
    }, {});

    const targetPhase = trackingPhases.find((p) => p.value === selectedPhase);
    const hasBoxes = (batch.current_box_count ?? 0) > 0;
    const isCompleted = availablePhases.length === 0;

    const handleSubmit = () => {
        if (!selectedPhase || !batch || !hasBoxes || isSubmitting) return;

        setIsSubmitting(true);
        router.post(
            `/admin/batches/${batch.id}/tracking-phase`,
            {
                tracking_phase: selectedPhase,
                description:
                    description.trim() ||
                    `Batch manually updated to ${targetPhase?.label || selectedPhase}.`,
            },
            {
                onSuccess: () => {
                    toast.success(
                        `Batch tracking updated to "${targetPhase?.label || selectedPhase}"`,
                    );
                    onSuccessCallback?.();
                    onClose();
                },
                onError: (errors: any) => {
                    toast.error(
                        errors?.tracking_phase ||
                            errors?.message ||
                            'Failed to update batch tracking phase.',
                    );
                },
                onFinish: () => setIsSubmitting(false),
            },
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
            <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden bg-card border border-border rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="p-5 sm:p-6 pb-4 border-b border-border/70 bg-gradient-to-r from-muted/40 via-card to-muted/20">
                    <DialogHeader>
                        <div className="flex items-start gap-3.5">
                            <div className="size-10 rounded-xl bg-brand-warm/20 dark:bg-brand-warm/15 text-brand-rust dark:text-brand-primary border border-brand-warm/30 flex items-center justify-center shrink-0 shadow-2xs">
                                <Truck className="size-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <DialogTitle className="font-sans text-base sm:text-lg font-semibold text-brand-text tracking-tight">
                                    Update Batch Tracking
                                </DialogTitle>

                                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-mono font-bold text-brand-text bg-background border border-border/80 px-2 py-0.5 rounded-md shadow-2xs">
                                        {batch.batch_number}
                                    </span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="inline-flex items-center gap-1 font-medium text-brand-text-mid">
                                        <Package className="size-3.5 text-muted-foreground" />
                                        {batch.current_box_count}{' '}
                                        box{batch.current_box_count === 1 ? '' : 'es'}
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
                                                {BATCH_STATUS_CONFIG[batch.status]?.label ??
                                                    humanize(batch.status)}
                                            </span>
                                        </>
                                    )}

                                    {(batch.origin_port || batch.destination_port) && (
                                        <span className="text-[11px] text-muted-foreground">
                                            ({[batch.origin_port, batch.destination_port]
                                                .filter(Boolean)
                                                .join(' → ')})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                {/* Body Content */}
                <div className="p-5 sm:p-6 space-y-5 text-xs">
                    {/* Journey / Milestone Flow Indicator */}
                    <div className="rounded-xl border border-border/80 bg-muted/25 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Navigation className="size-3 text-muted-foreground" />
                                Journey Progression
                            </span>
                            {targetPhase && (
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    Next Step Ready
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                            {/* Current Step */}
                            <div className="flex flex-col gap-1 rounded-lg bg-card/80 border border-border/60 p-3 shadow-2xs">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Current Phase
                                </span>
                                <p className="text-xs sm:text-sm font-semibold text-brand-text leading-snug line-clamp-1">
                                    {currentPhase?.label || 'Awaiting Start'}
                                </p>
                                <div className="mt-0.5">
                                    <span className="inline-block rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-brand-text-mid">
                                        {currentPhase?.group || 'Origin'}
                                    </span>
                                </div>
                            </div>

                            {/* Arrow Indicator */}
                            <div
                                className={`size-8 rounded-full border flex items-center justify-center shrink-0 shadow-2xs transition-colors ${
                                    targetPhase
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        : 'border-border bg-card text-muted-foreground'
                                }`}
                            >
                                <ArrowRight className="size-4" />
                            </div>

                            {/* Next Step Target */}
                            <div
                                className={`flex flex-col gap-1 rounded-lg border p-3 shadow-2xs transition-all ${
                                    targetPhase
                                        ? 'bg-emerald-500/5 border-emerald-500/30 text-brand-text'
                                        : 'bg-card/40 border-dashed border-border/90 text-muted-foreground'
                                }`}
                            >
                                <span
                                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                                        targetPhase
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-muted-foreground'
                                    }`}
                                >
                                    Target Phase
                                </span>
                                <p
                                    className={`text-xs sm:text-sm font-semibold leading-snug line-clamp-1 ${
                                        targetPhase
                                            ? 'text-brand-text font-bold'
                                            : 'text-muted-foreground italic'
                                    }`}
                                >
                                    {targetPhase?.label || 'Select Next Phase'}
                                </p>
                                <div className="mt-0.5">
                                    <span
                                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${
                                            targetPhase
                                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                                : 'bg-muted/30 text-muted-foreground border border-border/40'
                                        }`}
                                    >
                                        {targetPhase?.group || 'Pending Selection'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step Select Input */}
                    <div className="space-y-2">
                        <Label
                            htmlFor="batch-tracking-phase-select"
                            className="text-xs font-semibold text-brand-text"
                        >
                            Next Tracking Milestone <span className="text-destructive">*</span>
                        </Label>
                        <Select
                            value={selectedPhase}
                            onValueChange={setSelectedPhase}
                            disabled={!hasBoxes || isCompleted || isSubmitting}
                        >
                            <SelectTrigger
                                id="batch-tracking-phase-select"
                                className="h-11 rounded-xl border border-border bg-card px-3.5 text-xs text-brand-text shadow-2xs focus:ring-2 focus:ring-ring"
                            >
                                <SelectValue placeholder="Select target milestone..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-border bg-popover text-popover-foreground shadow-xl p-1 max-h-60">
                                {Object.entries(groupedPhases).map(([group, phases]) => (
                                    <SelectGroup key={group}>
                                        <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2.5 py-1">
                                            {group}
                                        </SelectLabel>
                                        {phases.map((phase) => (
                                            <SelectItem
                                                key={phase.value}
                                                value={phase.value}
                                                className="cursor-pointer rounded-lg py-2 focus:bg-accent focus:text-accent-foreground text-xs"
                                            >
                                                <div className="flex items-center justify-between gap-3 w-full">
                                                    <span className="font-semibold text-brand-text">
                                                        {phase.label}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                                                        Step #{phase.order}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Optional Remark / Note */}
                    <div className="space-y-2">
                        <Label
                            htmlFor="batch-tracking-description"
                            className="text-xs font-semibold text-brand-text"
                        >
                            Tracking Remark / Description{' '}
                            <span className="text-[11px] font-normal text-muted-foreground">
                                (Optional)
                            </span>
                        </Label>
                        <Input
                            id="batch-tracking-description"
                            type="text"
                            maxLength={500}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={!hasBoxes || isCompleted || isSubmitting}
                            placeholder="e.g., Container discharged at destination port and customs cleared."
                            className="h-10 rounded-xl border border-border bg-card px-3.5 text-xs text-brand-text placeholder:text-muted-foreground shadow-2xs focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    {/* Context / Impact Notice */}
                    {!hasBoxes ? (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                            <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                            <div>
                                <p className="font-semibold text-xs">No boxes in this batch</p>
                                <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80 mt-0.5">
                                    Assign boxes to this batch container first before recording tracking milestones.
                                </p>
                            </div>
                        </div>
                    ) : isCompleted ? (
                        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
                            <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                            <div>
                                <p className="font-semibold text-xs">Final milestone reached</p>
                                <p className="text-[11px] text-blue-700/90 dark:text-blue-300/80 mt-0.5">
                                    This batch is already at or past all available tracking milestones for your role.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-0.5">
                            <Clock className="size-3.5 shrink-0 text-muted-foreground/80" />
                            Applying this will write a tracking timeline event for all{' '}
                            <span className="font-semibold text-brand-text">
                                {batch.current_box_count} box
                                {batch.current_box_count === 1 ? '' : 'es'}
                            </span>{' '}
                            in this shipment.
                        </p>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 px-6 bg-muted/20 border-t border-border/70 flex flex-row items-center justify-end gap-2.5">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="h-10 px-5 rounded-xl border border-border bg-card text-brand-text hover:bg-muted text-xs font-semibold shadow-2xs cursor-pointer"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!selectedPhase || !hasBoxes || isSubmitting}
                        className="h-10 px-6 rounded-xl bg-brand-rust dark:bg-brand-primary text-white dark:text-zinc-950 hover:bg-brand-rust/90 text-xs font-semibold uppercase tracking-wider shadow-2xs transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Truck className="size-3.5" />
                        )}
                        Update Batch Tracking
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
