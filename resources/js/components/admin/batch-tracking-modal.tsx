import * as React from 'react';
import { router } from '@inertiajs/react';
import { Truck, ArrowRight, Loader2, Info } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
} from '@/components/ui/select';
import { BATCH_STATUS_CONFIG } from '@/lib/statuses';

interface TrackingPhase {
    value: string;
    label: string;
    group?: string;
    order: number;
}

interface BatchTrackingModalProps {
    isOpen: boolean;
    onClose: () => void;
    batch: any | null;
    trackingPhases: TrackingPhase[];
}

export default function BatchTrackingModal({
    isOpen,
    onClose,
    batch,
    trackingPhases = [],
}: BatchTrackingModalProps) {
    const [selectedPhase, setSelectedPhase] = React.useState<string>('');
    const [description, setDescription] = React.useState<string>('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Reset state when modal opens/closes or batch changes
    React.useEffect(() => {
        if (isOpen) {
            setSelectedPhase('');
            setDescription('');
        }
    }, [isOpen, batch]);

    if (!batch) return null;

    const availablePhases = trackingPhases.filter(
        (p) => p.order > (batch.latest_tracking_phase_order ?? -1),
    );

    // Group phases
    const groupedPhases = availablePhases.reduce<Record<string, TrackingPhase[]>>((acc, phase) => {
        const group = phase.group || 'Other';
        if (!acc[group]) acc[group] = [];
        acc[group].push(phase);
        return acc;
    }, {});

    const currentPhase = trackingPhases.find(
        (p) => p.value === batch.latest_tracking_phase,
    );
    const nextPhase = trackingPhases.find((p) => p.value === selectedPhase);

    const handleSubmit = () => {
        if (!selectedPhase || !batch) return;

        setIsSubmitting(true);
        router.post(
            `/admin/batches/${batch.id}/tracking-phase`,
            {
                tracking_phase: selectedPhase,
                description: description || undefined,
            },
            {
                onSuccess: () => {
                    onClose();
                },
                onFinish: () => setIsSubmitting(false),
            },
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md gap-0 overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl [&>button]:!top-6 [&>button]:!right-6 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:!rounded-xl [&>button]:border [&>button]:border-brand-warm/15 [&>button]:bg-white [&>button]:p-2.5 [&>button]:shadow-xs [&>button]:transition-all [&>button]:hover:bg-brand-warm/5">
                <div className="p-8 pb-4">
                    <div className="flex items-start gap-5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-warm/10 text-brand-text">
                            <Truck className="size-6 text-brand-text" />
                        </div>
                        <div className="flex-1 pt-1">
                            <DialogHeader>
                                <DialogTitle className="flex flex-col items-start gap-1.5 font-sans text-xl font-semibold tracking-tight text-brand-text">
                                    Update Batch Tracking
                                </DialogTitle>
                                <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-brand-text-mid opacity-85">
                                    <span>{batch.batch_number}</span>
                                    <span>•</span>
                                    <span>
                                        {batch.current_box_count} box
                                        {batch.current_box_count !== 1 ? 'es' : ''}
                                    </span>
                                    {batch.status && (
                                        <span
                                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${BATCH_STATUS_CONFIG[batch.status]?.badge ?? 'border-gray-200 bg-gray-100 text-gray-700'}`}
                                        >
                                            {BATCH_STATUS_CONFIG[batch.status]?.label ??
                                                batch.status.replaceAll('_', ' ')}
                                        </span>
                                    )}
                                </div>
                            </DialogHeader>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-6 px-8 py-2">
                    {/* Current & Next Phase Flow */}
                    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                        <div className="mb-4">
                            <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                                Phase Preview
                            </span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-1 flex-col gap-1">
                                <span className="text-[11px] leading-none font-medium text-neutral-400">
                                    Current
                                </span>
                                <div className="mt-1 min-h-12">
                                    <p className="text-sm leading-tight font-bold text-neutral-900">
                                        {currentPhase?.label || 'Awaiting Start'}
                                    </p>
                                    <span className="mt-1.5 inline-block rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                                        {currentPhase?.group || 'Warehouse'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-xs">
                                <ArrowRight className="size-4" />
                            </div>

                            <div className="flex flex-1 flex-col items-end gap-1 text-right">
                                <span className="text-[11px] leading-none font-semibold text-green-600">
                                    Moving to
                                </span>
                                <div className="mt-1 min-h-12 text-right">
                                    <p className="text-sm leading-tight font-bold text-neutral-900">
                                        {nextPhase?.label || 'Select Target'}
                                    </p>
                                    <span className="mt-1.5 inline-block rounded-md bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                                        {nextPhase?.group || '---'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label
                            htmlFor="phase"
                            className="px-0.5 text-sm font-semibold text-neutral-700"
                        >
                            Choose next tracking step
                        </Label>
                        <Select
                            value={selectedPhase}
                            onValueChange={setSelectedPhase}
                        >
                            <SelectTrigger
                                id="phase"
                                className="h-16 rounded-xl border border-neutral-200 bg-white px-4 text-brand-text shadow-sm transition-all focus:ring-2 focus:ring-brand-rust/20"
                            >
                                <SelectValue placeholder="Select target phase..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-neutral-200 p-1 shadow-2xl">
                                {Object.entries(groupedPhases).map(
                                    ([groupName, phases]: [string, TrackingPhase[]]) => (
                                    <SelectGroup key={groupName}>
                                        <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                            {groupName}
                                        </SelectLabel>
                                        {phases.map((phase) => (
                                            <SelectItem
                                                key={phase.value}
                                                value={phase.value}
                                                className="cursor-pointer rounded-lg py-2 focus:bg-brand-rust/5 focus:text-brand-rust"
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm leading-tight font-bold">
                                                        {phase.label}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                        {availablePhases.length === 0 && (
                            <p className="mt-2 rounded-lg border border-red-100 bg-red-50 p-2 text-[10px] font-bold tracking-wider text-red-500 uppercase">
                                No valid next phases available for your role.
                            </p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label
                            htmlFor="description"
                            className="px-0.5 text-sm font-semibold text-neutral-700"
                        >
                            Remark / Note (Optional)
                        </Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add tracking note (e.g. Flight delayed)"
                            className="resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-brand-text shadow-sm transition-all focus:ring-2 focus:ring-brand-rust/20 min-h-[80px]"
                        />
                    </div>

                    {batch.current_box_count > 0 && selectedPhase && (
                        <div className="flex items-start gap-2 rounded-xl bg-sky-50/50 p-3 text-sky-800 border border-sky-100">
                            <Info className="size-4 shrink-0 mt-0.5" />
                            <p className="text-xs leading-relaxed font-medium">
                                This will update tracking for all <span className="font-bold">{batch.current_box_count}</span> box{batch.current_box_count !== 1 ? 'es' : ''} in this batch.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-row gap-3 bg-transparent p-6 px-8 pt-6 pb-8 sm:justify-end">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="h-12 flex-1 rounded-xl border border-brand-warm/20 bg-white px-8 text-sm font-bold text-brand-text hover:bg-brand-warm/5 hover:text-brand-text sm:flex-none"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-black px-10 text-sm font-bold text-white shadow-lg transition-all hover:bg-neutral-900 active:scale-95 sm:flex-none"
                        disabled={!selectedPhase || isSubmitting}
                    >
                        {isSubmitting ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        Update Tracking
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
