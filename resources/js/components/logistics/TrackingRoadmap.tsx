import { Ship, CheckCircle2 } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';
import type { NormalizedStep } from '@/types/logistics';

interface TrackingRoadmapProps {
    steps: NormalizedStep[];
    currentIndex: number;
}

export const TrackingRoadmap: React.FC<TrackingRoadmapProps> = ({
    steps,
    currentIndex
}) => {
    return (
        <div className="card">
            <div className="px-5 py-5 md:px-8 md:py-6 border-b border-zinc-100">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                    <Ship className="size-4" /> Shipment Roadmap
                </h4>
            </div>
            <div className="p-5 md:p-8 space-y-0 relative max-h-[450px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-100 scrollbar-track-transparent">
                {/* Full height vertical line */}
                <div className="absolute left-[1.7rem] top-8 bottom-8 w-0.5 bg-zinc-50" aria-hidden="true" />

                {steps.map((step, idx) => {
                    const isCompleted = idx < currentIndex;
                    const isCurrent = idx === currentIndex;
                    const isFuture = idx > currentIndex;
                    const StepIcon = step.icon;

                    return (
                        <div key={idx} className="relative flex items-start gap-4 pb-6 last:pb-0">
                            {/* Step connection line for completed steps */}
                            {idx < currentIndex && (
                                <div className="absolute left-[0.45rem] top-8 h-full w-0.5 bg-emerald-500/20 z-10" aria-hidden="true" />
                            )}

                            <div className={cn(
                                "h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-500 relative z-20",
                                isCurrent ? "bg-zinc-900 border-zinc-900 text-white shadow-lg scale-110" :
                                isCompleted ? "bg-emerald-50 border-emerald-100 text-emerald-500" : "bg-zinc-50 border-zinc-50 text-zinc-300"
                            )} aria-hidden="true">
                                {isCompleted ? <CheckCircle2 className="size-3.5" /> : <StepIcon className="size-3.5" />}
                            </div>

                            <div className="flex-1 min-w-0 pt-1">
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-widest block truncate",
                                    isCurrent ? "text-zinc-900" : isCompleted ? "text-zinc-600" : "text-zinc-300"
                                )}>
                                    {step.label}
                                </span>
                                {isCurrent && (
                                    <div className="flex items-center gap-1.5 mt-0.5" aria-label={idx === steps.length - 1 ? 'Completed' : 'In Progress'}>
                                        <span className={cn(
                                            "h-1 w-1 rounded-full bg-emerald-500",
                                            idx !== steps.length - 1 && "animate-pulse"
                                        )} />
                                        <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">
                                            {idx === steps.length - 1 ? 'Completed' : 'In Progress'}
                                        </span>
                                    </div>
                                )}
                                {isFuture && (
                                    <span className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest">Upcoming</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
