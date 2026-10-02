import React from 'react';
import { cn } from '@/lib/utils';
import type { NormalizedStep } from '@/types/logistics';
import { Check } from 'lucide-react';

interface TrackingProgressStepperProps {
    steps: NormalizedStep[];
    currentIndex: number;
}

export const TrackingProgressStepper: React.FC<TrackingProgressStepperProps> = ({
    steps,
    currentIndex,
}) => {
    const totalSteps = steps.length;

    return (
        <div className="w-full py-1 sm:py-2">
            <div className="flex items-start justify-between w-full">
                {steps.map((step, index) => {
                    const isCompleted = index < currentIndex;
                    const isActive = index === currentIndex;
                    const isUpcoming = index > currentIndex;
                    const isLast = index === totalSteps - 1;
                    const StepIcon = step.icon;

                    return (
                        <div key={index} className="relative flex-1 flex flex-col items-center group">
                            {/* Horizontal Connector Line to the next step */}
                            {!isLast && (
                                <div
                                    className={cn(
                                        "absolute top-3.5 sm:top-4 left-1/2 w-full h-[2.5px] -translate-y-1/2 transition-colors duration-500",
                                        index < currentIndex
                                            ? "bg-emerald-500 dark:bg-emerald-500"
                                            : "bg-zinc-200 dark:bg-zinc-700/80"
                                    )}
                                    aria-hidden="true"
                                />
                            )}

                            {/* Milestone Node Circle */}
                            <div className="relative z-10 flex flex-col items-center">
                                <div
                                    className={cn(
                                        "size-7 sm:size-8 rounded-full flex items-center justify-center transition-all duration-300 select-none",
                                        isCompleted && "bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs shadow-emerald-600/20",
                                        isActive && "bg-emerald-600 dark:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 ring-4 ring-emerald-500/20 dark:ring-emerald-400/20 scale-105",
                                        isUpcoming && "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600"
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="size-3.5 sm:size-4 stroke-[3] text-white" />
                                    ) : isActive ? (
                                        <StepIcon className="size-3.5 sm:size-4 text-white animate-pulse" />
                                    ) : (
                                        <StepIcon className="size-3 sm:size-3.5 text-zinc-400 dark:text-zinc-600" />
                                    )}
                                </div>

                                {/* Label and Status Tag */}
                                <div className="mt-2 flex flex-col items-center text-center px-0.5 sm:px-1 max-w-[68px] sm:max-w-[110px]">
                                    <span
                                        className={cn(
                                            "text-[9px] sm:text-[11px] md:text-xs uppercase tracking-tight leading-tight transition-colors line-clamp-2",
                                            isActive && "font-black text-emerald-700 dark:text-emerald-400",
                                            isCompleted && "font-bold text-zinc-800 dark:text-zinc-200",
                                            isUpcoming && "font-medium text-zinc-400 dark:text-zinc-500"
                                        )}
                                    >
                                        {step.label}
                                    </span>

                                    <span
                                        className={cn(
                                            "text-[8px] sm:text-[9px] font-bold uppercase tracking-wider mt-0.5",
                                            isActive && "text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5",
                                            isCompleted && "text-zinc-400 dark:text-zinc-500",
                                            isUpcoming && "text-zinc-300 dark:text-zinc-600"
                                        )}
                                    >
                                        {isActive ? (
                                            <>
                                                <span className="inline-block size-1 sm:size-1.5 rounded-full bg-emerald-500 animate-ping" />
                                                Active
                                            </>
                                        ) : isCompleted ? (
                                            'Done'
                                        ) : (
                                            'Upcoming'
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};




