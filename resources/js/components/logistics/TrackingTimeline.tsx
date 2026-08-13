import React from 'react';
import { MapPin, Clock, CheckCircle2, Ship } from 'lucide-react';
import { formatDate } from '@/lib/logistics-utils';
import { cn, humanize } from '@/lib/utils';
import { getFriendlyStepDescription } from '@/lib/logistics-theme';
import type { TrackingTimelineItem, NormalizedStep } from '@/types/logistics';

interface TrackingTimelineProps {
    timeline: TrackingTimelineItem[];
    steps: NormalizedStep[];
    currentIndex: number;
}

/**
 * Match a timeline event to a roadmap step by comparing status strings.
 * Returns the index of the best matching step, or -1 if no match.
 */
function matchEventToStep(event: TrackingTimelineItem, steps: NormalizedStep[]): number {
    const eventStatus = (event.status_label || event.status || '').toLowerCase().replace(/_/g, ' ');
    const eventPhase = (event.tracking_phase || '').toLowerCase().replace(/_/g, ' ');

    for (let i = 0; i < steps.length; i++) {
        const stepKey = steps[i].statusKey.toLowerCase().replace(/_/g, ' ');
        const stepLabel = steps[i].label.toLowerCase();
        const stepSystem = (steps[i].systemStatus || '').toLowerCase().replace(/_/g, ' ');

        // Direct key/label match
        if (
            eventStatus === stepKey ||
            eventStatus === stepLabel ||
            eventStatus === stepSystem ||
            eventPhase === stepKey ||
            eventPhase === stepSystem
        ) {
            return i;
        }

        // Partial match (status contains step key or vice versa)
        if (
            (eventStatus && stepKey && (eventStatus.includes(stepKey) || stepKey.includes(eventStatus))) ||
            (eventStatus && stepLabel && (eventStatus.includes(stepLabel) || stepLabel.includes(eventStatus)))
        ) {
            return i;
        }
    }

    return -1;
}

export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ timeline, steps, currentIndex }) => {
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
                        className="absolute left-[0.45rem] md:left-[0.6rem] top-3 bottom-3 w-0.5 bg-zinc-100 dark:bg-zinc-800"
                        aria-hidden="true"
                    />

                    {steps.map((step, originalIndex) => ({ step, originalIndex })).reverse().map(({ step, originalIndex }, displayIdx) => {
                        const isCompleted = originalIndex < currentIndex;
                        const isCurrent = originalIndex === currentIndex;
                        const isFuture = originalIndex > currentIndex;
                        const events = stepEvents.get(originalIndex) || [];
                        const StepIcon = step.icon;

                        // Green line overlay connecting current & completed steps downward
                        const hasGreenLineDown = originalIndex <= currentIndex && originalIndex > 0;

                        return (
                            <div key={originalIndex} className="relative pb-8 last:pb-0">
                                {/* Completed segment line overlay going down */}
                                {hasGreenLineDown && (
                                    <div
                                        className="absolute left-[-1.05rem] md:left-[-1.4rem] top-3 h-full w-0.5 bg-emerald-500/40 z-[5]"
                                        aria-hidden="true"
                                    />
                                )}

                                {/* Node Icon */}
                                <div className={cn(
                                    "absolute -left-6 md:-left-8 size-6 rounded-xl border-2 border-white dark:border-zinc-900 shadow-sm flex items-center justify-center z-10 transition-all duration-500",
                                    isCurrent && "bg-zinc-900 dark:bg-zinc-100 ring-4 ring-zinc-900/10 dark:ring-zinc-100/20 scale-110",
                                    isCompleted && "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
                                    isFuture && "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
                                )}>
                                    {isCompleted ? (
                                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                                    ) : isCurrent ? (
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

                                        {isCurrent && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                                                <span className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                                                In Progress
                                            </span>
                                        )}

                                        {isCompleted && (
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">
                                                ✓ Done
                                            </span>
                                        )}

                                        {isFuture && (
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
                                    {isFuture && events.length === 0 && (
                                        <p className="text-[10px] text-zinc-300 dark:text-zinc-600 font-medium italic">
                                            Awaiting update...
                                        </p>
                                    )}
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
