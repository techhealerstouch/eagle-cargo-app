import React, { useMemo } from 'react';
import { usePage } from '@inertiajs/react';
import { cn, humanize } from '@/lib/utils';

interface BoxProgressStepperProps {
    status: string;
    trackingStepKey?: string | null;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

interface TrackingStep {
    key: string;
    label: string;
    phase: string;
    order: number;
    system_status: string;
    [key: string]: any;
}

interface BoxProgressInfo {
    filledSegments: number; // how many of 5 segments are filled
    percentage: number;
    phaseLabel: string;
    isException: boolean;
    exceptionType?: 'held' | 'cancelled' | 'damaged';
}

/**
 * Dynamically computes progress from the admin-configurable tracking_steps.
 * Uses step order / total to derive percentage, then maps to 5 visual segments.
 * Falls back to system_status matching when tracking_step_key is absent.
 */
function computeProgress(
    status: string,
    trackingStepKey: string | null | undefined,
    steps: TrackingStep[]
): BoxProgressInfo {
    const s = (status || '').toLowerCase().trim();

    // ── Exception statuses always take priority ──
    if (s === 'held' || s === 'held_bulging') {
        return {
            filledSegments: 2,
            percentage: 40,
            phaseLabel: s === 'held_bulging' ? 'Held (Bulging)' : 'On Hold',
            isException: true,
            exceptionType: 'held',
        };
    }
    if (s === 'cancelled') {
        return {
            filledSegments: 0,
            percentage: 0,
            phaseLabel: 'Cancelled',
            isException: true,
            exceptionType: 'cancelled',
        };
    }
    if (s === 'damaged') {
        return {
            filledSegments: 2,
            percentage: 40,
            phaseLabel: 'Damaged Notice',
            isException: true,
            exceptionType: 'damaged',
        };
    }

    // ── Normal progress calculation ──
    if (steps.length === 0) {
        // No steps configured at all — show generic based on status name
        return {
            filledSegments: 1,
            percentage: 10,
            phaseLabel: humanize(s || 'Unknown'),
            isException: false,
        };
    }

    const sorted = [...steps].sort((a, b) => a.order - b.order);
    const totalSteps = sorted.length;

    // 1. Primary: match by tracking_step_key
    let matchedIndex = -1;
    let matchedStep: TrackingStep | null = null;

    if (trackingStepKey) {
        const keyNorm = trackingStepKey.toLowerCase().trim();
        matchedIndex = sorted.findIndex((st) => st.key === keyNorm);
        if (matchedIndex !== -1) {
            matchedStep = sorted[matchedIndex];
        }
    }

    // 2. Fallback: match by system_status (pick the highest-order step with that status)
    if (matchedIndex === -1 && s) {
        for (let i = sorted.length - 1; i >= 0; i--) {
            if (sorted[i].system_status === s) {
                matchedIndex = i;
                matchedStep = sorted[i];
                break;
            }
        }
    }

    // 3. Special: "pending" is before any tracking step
    if (matchedIndex === -1 && s === 'pending') {
        return {
            filledSegments: 1,
            percentage: 5,
            phaseLabel: 'Intake / Booking',
            isException: false,
        };
    }

    // 4. Last fallback: completely unknown step
    if (matchedIndex === -1) {
        return {
            filledSegments: 1,
            percentage: 10,
            phaseLabel: humanize(trackingStepKey || s || 'Unknown'),
            isException: false,
        };
    }

    // ── Calculate percentage and segment fill ──
    // Position is 1-indexed: first step = 1, last = totalSteps
    const position = matchedIndex + 1;
    const percentage = Math.round((position / totalSteps) * 100);

    // Map percentage to 5 segments (each segment covers 20%)
    const filledSegments = Math.max(1, Math.min(5, Math.ceil(percentage / 20)));

    return {
        filledSegments,
        percentage,
        phaseLabel: matchedStep?.label || humanize(trackingStepKey || s),
        isException: false,
    };
}

export default function BoxProgressStepper({
    status,
    trackingStepKey,
    className,
    size = 'sm',
}: BoxProgressStepperProps) {
    const { tracking_steps } = usePage<any>().props;
    const steps: TrackingStep[] = tracking_steps || [];

    const progress = useMemo(
        () => computeProgress(status, trackingStepKey, steps),
        [status, trackingStepKey, steps]
    );

    const getSegmentColor = (segment: number) => {
        if (progress.isException) {
            if (segment <= progress.filledSegments) {
                return progress.exceptionType === 'held'
                    ? 'bg-amber-500 dark:bg-amber-400'
                    : 'bg-rose-500 dark:bg-rose-400';
            }
            return 'bg-zinc-200 dark:bg-zinc-700/60';
        }

        if (segment <= progress.filledSegments) {
            // Delivered = all green; pending first segment = amber
            if (progress.percentage === 100) return 'bg-emerald-500 dark:bg-emerald-400';
            if (segment < progress.filledSegments) return 'bg-emerald-500 dark:bg-emerald-400';
            // Active (last filled) segment
            return status === 'pending'
                ? 'bg-amber-500 dark:bg-amber-400'
                : 'bg-emerald-500 dark:bg-emerald-400';
        }

        return 'bg-zinc-200 dark:bg-zinc-700/60';
    };

    const isSm = size === 'sm';
    const isLg = size === 'lg';
    const hasCustomWidth = className?.includes('w-');
    const widthClass = isSm && !hasCustomWidth ? 'w-28 sm:w-32' : 'w-full';

    return (
        <div
            className={cn(
                'flex flex-col select-none',
                widthClass,
                isSm ? 'gap-1' : isLg ? 'gap-2' : 'gap-1.5',
                className
            )}
            title={`${progress.phaseLabel} (${progress.percentage}%)`}
        >
            <div className={cn(
                'flex items-center justify-between leading-tight',
                isSm ? 'text-[10px]' : isLg ? 'text-sm font-medium' : 'text-xs font-medium'
            )}>
                <span
                    className={cn(
                        'truncate',
                        isSm && !hasCustomWidth ? 'max-w-[80px]' : 'max-w-[75%]',
                        progress.isException
                            ? progress.exceptionType === 'held'
                                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                : 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-brand-text-mid dark:text-zinc-400 font-medium'
                    )}
                >
                    {progress.phaseLabel}
                </span>
                <span
                    className={cn(
                        'font-mono font-bold shrink-0',
                        isSm ? 'text-[10px]' : isLg ? 'text-sm' : 'text-xs',
                        progress.isException
                            ? progress.exceptionType === 'held'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                            : 'text-brand-text dark:text-zinc-300'
                    )}
                >
                    {progress.percentage}%
                </span>
            </div>

            {/* 5-segment micro-stepper */}
            <div className={cn(
                'grid grid-cols-5 w-full',
                isSm ? 'gap-1 h-1.5' : isLg ? 'gap-2 h-2.5' : 'gap-1.5 h-2'
            )}>
                {[1, 2, 3, 4, 5].map((seg) => (
                    <div
                        key={seg}
                        className={cn(
                            'rounded-full transition-all duration-300',
                            isSm ? 'h-1.5' : isLg ? 'h-2.5' : 'h-2',
                            getSegmentColor(seg)
                        )}
                    />
                ))}
            </div>
        </div>
    );
}
