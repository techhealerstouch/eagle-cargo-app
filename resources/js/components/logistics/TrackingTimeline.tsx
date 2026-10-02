import { MapPin, Clock, CheckCircle2, Ship } from 'lucide-react';
import React from 'react';
import { getFriendlyStepDescription } from '@/lib/logistics-theme';
import { formatDate } from '@/lib/logistics-utils';
import { cn } from '@/lib/utils';
import type { TrackingTimelineItem, NormalizedStep } from '@/types/logistics';

interface TrackingTimelineProps {
    timeline: TrackingTimelineItem[];
    steps: NormalizedStep[];
    currentIndex: number;
    currentStatus?: string;
}

export type TimelineStepState = 'completed' | 'completed_current' | 'in_progress' | 'delivered' | 'next' | 'upcoming';

const FALLBACK_ONGOING_KEYS = new Set([
    'in_transit',
    'out_for_delivery',
    'under_customs_clearance',
    'en_route_roro',
]);

function isOngoingPhase(step: NormalizedStep, currentStatus?: string): boolean {
    if (step.stepType) {
        return step.stepType === 'ongoing';
    }

    const stepKey = (step.statusKey || '').toLowerCase();
    const status = (currentStatus || '').toLowerCase();

    return FALLBACK_ONGOING_KEYS.has(stepKey) ||
            (FALLBACK_ONGOING_KEYS.has(status) && stepKey === status);
}

export function classifyTimelineStep(
    originalIndex: number,
    currentIndex: number,
    step: NormalizedStep,
    currentStatus?: string,
): TimelineStepState {
    if (currentIndex < 0) {
        return originalIndex === 0 ? 'next' : 'upcoming';
    }

    if (originalIndex < currentIndex) {
        return 'completed';
    }

    if (originalIndex > currentIndex) {
        return originalIndex === currentIndex + 1 ? 'next' : 'upcoming';
    }

    const status = (currentStatus || '').toLowerCase().replace(/_/g, ' ');
    const stepKey = step.statusKey.toLowerCase().replace(/_/g, ' ');

    // Safety check: If the box has not yet been picked up by a driver,
    // Picked Up from Sender must never be marked as completed!
    const isPrePickup = [
        'pending',
        'draft',
        'confirmed',
        'awaiting pickup',
        'awaiting_pickup',
        'statuses.box.pending',
        'statuses.booking.pending',
        'statuses.booking.confirmed',
    ].includes(status) || status.includes('pending') || status.includes('confirmed') || status.includes('draft');

    if (isPrePickup && (stepKey === 'picked up' || step.systemStatus === 'collected' || step.statusKey === 'picked_up')) {
        return 'next';
    }

    if (status === 'delivered' || stepKey === 'delivered' || step.systemStatus?.toLowerCase() === 'delivered') {
        return 'delivered';
    }

    // Pending / pre-pickup milestone: if current milestone is pending, it is currently in progress / active, NEVER completed!
    if (
        step.systemStatus === 'pending' ||
        stepKey === 'pending' ||
        status === 'pending' ||
        status.includes('pending')
    ) {
        return 'in_progress';
    }

    return isOngoingPhase(step, currentStatus) ? 'in_progress' : 'completed_current';
}

/**
 * Match a timeline event to a roadmap step by comparing status strings.
 * Returns the index of the best matching step, or -1 if no match.
 */
function matchEventToStep(event: TrackingTimelineItem, steps: NormalizedStep[]): number {
    const eventStatus = (event.status_label || event.status || '').toLowerCase().replace(/_/g, ' ').trim();
    const eventPhase = (event.tracking_phase || '').toLowerCase().replace(/_/g, ' ').trim();
    const rawStatus = (event.status || '').toLowerCase().trim();
    const desc = (event.description || '').toLowerCase();

    // 1. Direct system_status / statusKey match
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepSystem = (step.systemStatus || '').toLowerCase().trim();
        const stepKey = (step.statusKey || '').toLowerCase().trim();

        if (stepSystem && (rawStatus === stepSystem || eventStatus === stepSystem)) {
            return i;
        }
        if (stepKey && (rawStatus === stepKey || eventStatus === stepKey)) {
            return i;
        }
    }

    // 2. Admin confirmation event
    if (desc.includes('booking accepted') || desc.includes('booking confirmed') || desc.includes('confirmed by admin') || rawStatus === 'confirmed') {
        const confirmedStepIdx = steps.findIndex((s) =>
            s.systemStatus === 'confirmed' ||
            s.statusKey?.toLowerCase() === 'booking_confirmed' ||
            s.label.toLowerCase().includes('confirmed')
        );

        if (confirmedStepIdx !== -1) {
            return confirmedStepIdx;
        }
    }

    // 3. Booking registration / creation event (placed by customer)
    if (desc.includes('booking created') || desc.includes('box registered') || desc.includes('booking received') || desc.includes('booking submitted') || desc.includes('booking placed') || rawStatus === 'pending') {
        const placedStepIdx = steps.findIndex((s) =>
            s.systemStatus === 'pending' ||
            ['booking_placed', 'booking_created', 'manifested', 'pending'].includes(s.statusKey?.toLowerCase()) ||
            s.label.toLowerCase().includes('placed') ||
            s.label.toLowerCase().includes('submitted') ||
            s.label.toLowerCase().includes('pending')
        );

        if (placedStepIdx !== -1) {
            return placedStepIdx;
        }
    }

    // 4. Fallback search by label or tracking_phase
    for (let i = 0; i < steps.length; i++) {
        const stepKey = steps[i].statusKey.toLowerCase().replace(/_/g, ' ').trim();
        const stepLabel = steps[i].label.toLowerCase().trim();
        const stepSystem = (steps[i].systemStatus || '').toLowerCase().replace(/_/g, ' ').trim();

        if (
            (eventStatus && (eventStatus === stepKey || eventStatus === stepLabel || eventStatus === stepSystem)) ||
            (eventPhase && (eventPhase === stepKey || eventPhase === stepSystem || eventPhase === stepLabel))
        ) {
            return i;
        }

        if (
            (eventStatus && stepKey && (eventStatus.includes(stepKey) || stepKey.includes(eventStatus))) ||
            (eventStatus && stepLabel && (eventStatus.includes(stepLabel) || stepLabel.includes(eventStatus)))
        ) {
            return i;
        }
    }

    return -1;
}

export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ timeline, steps, currentIndex, currentStatus }) => {
    // Build a map: step index → timeline events that belong to it
    const stepEvents = new Map<number, TrackingTimelineItem[]>();
    const unmatchedEvents: TrackingTimelineItem[] = [];

    (timeline || []).forEach((event) => {
        const matchIdx = matchEventToStep(event, steps);

        if (matchIdx >= 0) {
            const existing = stepEvents.get(matchIdx) || [];
            existing.push(event);
            stepEvents.set(matchIdx, existing);
        } else {
            unmatchedEvents.push(event);
        }
    });

    // Sort events within each step by date (newest first)
    stepEvents.forEach((events) => {
        events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    const isBoxPending = (currentStatus || '').toLowerCase().includes('pending') ||
        (currentStatus || '').toLowerCase().includes('draft');

    return (
        <div className="card space-y-0 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-5 md:px-8 md:py-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
                <div className="space-y-0.5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Ship className="size-4 text-emerald-500" /> Shipment Journey
                    </h3>
                    <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                        Track your box through every milestone of its journey.
                    </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    {timeline?.length || 0} {(timeline?.length || 0) === 1 ? 'Update' : 'Updates'}
                </span>
            </div>

            {/* Roadmap-based Timeline (Reversed order: Latest milestone at top) */}
            <div className="p-4 md:p-8">
                <div className="relative pl-6 md:pl-8 space-y-0">
                    {/* Full vertical background line */}
                    <div
                        className="absolute left-2.75 top-3 bottom-3 w-0.5 bg-zinc-100 dark:bg-zinc-800"
                        aria-hidden="true"
                    />

                    {steps.map((step, originalIndex) => ({ step, originalIndex })).reverse().map(({ step, originalIndex }) => {
                        const state = classifyTimelineStep(originalIndex, currentIndex, step, currentStatus);
                        const isStepPendingOrConfirm = step.systemStatus === 'pending' ||
                            step.statusKey === 'pending' ||
                            step.systemStatus === 'confirmed' ||
                            step.statusKey === 'booking_confirmed' ||
                            step.label.toLowerCase().includes('confirmed');

                        const isAwaitingAdmin = isBoxPending && (
                            (state === 'in_progress' && (step.systemStatus === 'pending' || step.statusKey === 'pending')) ||
                            (state === 'next' && isStepPendingOrConfirm)
                        );

                        const isCompleted = ['completed', 'completed_current', 'delivered'].includes(state);
                        const isCurrent = ['completed_current', 'in_progress', 'delivered'].includes(state);
                        const isFuture = ['next', 'upcoming'].includes(state);
                        const isOngoing = state === 'in_progress';
                        const events = stepEvents.get(originalIndex) || [];
                        const StepIcon = step.icon;

                        // Green line overlay connecting current & completed steps downward
                        const hasGreenLineDown = originalIndex <= currentIndex && originalIndex > 0 && !isBoxPending;

                        return (
                            <div key={originalIndex} className="relative pb-8 last:pb-0">
                                {/* Completed segment line overlay going down */}
                                {hasGreenLineDown && (
                                    <div
                                        className="absolute -left-3.25 md:-left-5.25 top-3 h-full w-0.5 bg-emerald-500/40 z-5"
                                        aria-hidden="true"
                                    />
                                )}

                                {/* Node Icon */}
                                <div className={cn(
                                    "absolute -left-6 md:-left-8 size-6 rounded-xl border-2 border-white dark:border-zinc-900 shadow-sm flex items-center justify-center z-10 transition-all duration-500",
                                    isAwaitingAdmin && "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 ring-4 ring-amber-400/20 scale-105",
                                    state === 'in_progress' && !isAwaitingAdmin && "bg-zinc-900 dark:bg-zinc-100 ring-4 ring-zinc-900/10 dark:ring-zinc-100/20 scale-110",
                                    isCompleted && "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
                                    isFuture && !isAwaitingAdmin && "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
                                )}>
                                    {isCompleted ? (
                                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                                    ) : isAwaitingAdmin ? (
                                        <Clock className="size-3 text-amber-500 animate-pulse" />
                                    ) : isOngoing ? (
                                        <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                                    ) : (
                                        <StepIcon className="size-3 text-zinc-300 dark:text-zinc-600" />
                                    )}
                                </div>

                                {/* Step Content */}
                                <div className="space-y-2">
                                    {/* Step Label Row */}
                                    <div className="flex items-center flex-wrap gap-2">
                                        <h5 className={cn(
                                            "text-xs font-black uppercase tracking-tight",
                                            isCurrent && "text-zinc-900 dark:text-zinc-100",
                                            isCompleted && "text-zinc-700 dark:text-zinc-300",
                                            isFuture && "text-zinc-300 dark:text-zinc-600",
                                        )}>
                                            {step.label}
                                        </h5>

                                        {isAwaitingAdmin ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
                                                <span className="size-1 rounded-full bg-amber-500 animate-pulse" />
                                                Awaiting Admin Confirmation
                                            </span>
                                        ) : state === 'in_progress' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                                                <span className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                                                In Progress
                                            </span>
                                        ) : state === 'completed' ? (
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">
                                                ✓ Done
                                            </span>
                                        ) : state === 'completed_current' ? (
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">
                                                ✓ Completed
                                            </span>
                                        ) : state === 'delivered' ? (
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">
                                                ✓ Delivered
                                            </span>
                                        ) : state === 'next' ? (
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                                                Next Up
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-300 dark:text-zinc-600">
                                                Upcoming
                                            </span>
                                        )}
                                    </div>

                                    {/* Events attached to this step */}
                                    {events.length > 0 && (
                                        <div className="space-y-2">
                                            {events.map((event, eIdx) => {
                                                const description = getFriendlyStepDescription(
                                                    step.label,
                                                    event.description,
                                                    step.statusKey,
                                                    step.description
                                                );

                                                return (
                                                    <div
                                                        key={eIdx}
                                                        className={cn(
                                                            "p-3.5 md:p-4 rounded-xl border transition-all duration-300 space-y-1.5",
                                                            isCurrent
                                                                ? "bg-zinc-50/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 shadow-sm"
                                                                : "bg-white dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800/60"
                                                        )}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <p className={cn(
                                                                "text-xs font-medium leading-relaxed",
                                                                isCurrent ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500 dark:text-zinc-400"
                                                            )}>
                                                                {description}
                                                            </p>
                                                            <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1 shrink-0 ml-3">
                                                                <Clock className="size-2.5" /> {formatDate(event.date)}
                                                            </span>
                                                        </div>

                                                        {event.location && (
                                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                                                                <MapPin className="size-2.5 shrink-0" /> {event.location}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Future steps with no events — empty hint */}
                                    {isAwaitingAdmin && events.length === 0 ? (
                                        <div className="p-3 md:p-3.5 rounded-xl border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs">
                                            <p className="font-medium leading-relaxed">
                                                Your booking has been received and is waiting for admin acceptance and scheduling.
                                            </p>
                                        </div>
                                    ) : isFuture && events.length === 0 ? (
                                        <p className="text-[10px] text-zinc-300 dark:text-zinc-600 font-medium italic">
                                            Awaiting update...
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}

                    {/* Unmatched events (if any) */}
                    {unmatchedEvents.length > 0 && (
                        <div className="relative pb-0 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Other Updates</p>
                            <div className="space-y-2">
                                {unmatchedEvents
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map((event, eIdx) => {
                                        const description = getFriendlyStepDescription(
                                            event.status_label || event.status || '',
                                            event.description
                                        );

                                        return (
                                            <div
                                                key={eIdx}
                                                className="p-3.5 md:p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-950 space-y-1.5"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                                        {description}
                                                    </p>
                                                    <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1 shrink-0 ml-3">
                                                        <Clock className="size-2.5" /> {formatDate(event.date)}
                                                    </span>
                                                </div>
                                                {event.location && (
                                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                                                        <MapPin className="size-2.5 shrink-0" /> {event.location}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Empty state */}
                {(!timeline || timeline.length === 0) && steps.length === 0 && (
                    <div className="py-12 text-center space-y-2">
                        <Clock className="size-8 text-zinc-300 dark:text-zinc-700 mx-auto" />
                        <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                            Awaiting initial scan update...
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
