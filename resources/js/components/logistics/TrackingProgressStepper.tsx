import React from 'react';
import { cn } from '@/lib/utils';
import type { NormalizedStep } from '@/types/logistics';
import { Check, Sparkles } from 'lucide-react';

interface TrackingProgressStepperProps {
    steps: NormalizedStep[];
    currentIndex: number;
}

export const TrackingProgressStepper: React.FC<TrackingProgressStepperProps> = ({
    steps,
    currentIndex,
}) => {
    const totalSteps = steps.length;
    const progressPercent = totalSteps <= 1
        ? (currentIndex >= 0 ? 100 : 0)
        : Math.min(100, Math.max(0, (currentIndex / (totalSteps - 1)) * 100));

    const currentStep = steps[currentIndex] || steps[0];

    return (
        <div className="space-y-4">
            {/* Header Stage Badge & Progress Counter */}
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-black uppercase tracking-wider shadow-sm">
                        <Sparkles className="size-3 text-amber-400" /> Stage {Math.min(totalSteps, currentIndex + 1)} of {totalSteps}
                    </span>
                    <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hidden sm:inline-block">
                        • {currentStep?.label}
                    </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-zinc-400 dark:text-zinc-500">
                    {Math.round(progressPercent)}% Complete
                </span>
            </div>

            {/* Desktop Stepper Visual */}
            <div className="hidden md:block relative pt-2 pb-2">
                {/* Background Line */}
                <div className="absolute top-[28px] left-[20px] right-[20px] h-[3px] bg-zinc-200 dark:bg-zinc-800 rounded-full" />

                {/* Animated Filled Progress Line */}
                <div
                    className="absolute top-[28px] left-[20px] h-[3px] bg-gradient-to-r from-zinc-900 via-emerald-600 to-teal-500 rounded-full transition-all duration-1000 ease-out shadow-sm"
                    style={{ width: `calc(${progressPercent}% * (100% - 40px) / 100)` }}
                    aria-hidden="true"
                />

                <div className="relative flex justify-between">
                    {steps.map((step, index) => {
                        const isCompleted = index <= currentIndex;
                        const isActive = index === currentIndex;
                        const StepIcon = step.icon;

                        return (
                            <div
                                key={index}
                                className="flex flex-col items-center gap-3 relative z-10 group"
                                aria-current={isActive ? 'step' : undefined}
                            >
                                <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 shrink-0",
                                    isActive
                                        ? "bg-zinc-900 border-zinc-900 text-white shadow-lg ring-4 ring-zinc-900/10 dark:ring-zinc-100/20 scale-110"
                                        : isCompleted
                                            ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                            : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400"
                                )}>
                                    {isCompleted && !isActive ? (
                                        <Check className="size-4 stroke-[3]" />
                                    ) : (
                                        <StepIcon className="size-4" />
                                    )}
                                </div>

                                <div className="flex flex-col items-center space-y-0.5 max-w-[80px] text-center">
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-tight leading-tight transition-colors",
                                        isActive
                                            ? "text-zinc-900 dark:text-zinc-100 font-extrabold"
                                            : isCompleted
                                                ? "text-zinc-700 dark:text-zinc-300 font-bold"
                                                : "text-zinc-400 dark:text-zinc-600 font-medium"
                                    )}>
                                        {step.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mobile Progress Bar */}
            <div className="md:hidden space-y-2">
                <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-zinc-900 via-emerald-600 to-teal-500 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="flex items-center gap-2 pt-1 text-xs">
                    {React.createElement(currentStep.icon, { className: "size-4 text-zinc-900 dark:text-zinc-100 shrink-0" })}
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight truncate">
                        Current: <span className="text-emerald-600 dark:text-emerald-400 font-black">{currentStep.label}</span>
                    </p>
                </div>
            </div>
        </div>
    );
};
