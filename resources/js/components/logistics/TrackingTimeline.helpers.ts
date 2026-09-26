import type { NormalizedStep } from '@/types/logistics';

export type TimelineStepState =
    | 'completed'
    | 'completed_current'
    | 'in_progress'
    | 'delivered'
    | 'next'
    | 'upcoming';

/**
 * Derive semantic step type for legacy configurations or missing types.
 */
export function deriveDefaultStepType(key: string, systemStatus?: string): 'checkpoint' | 'ongoing' {
    const keyLower = (key || '').toLowerCase();
    const statusLower = (systemStatus || '').toLowerCase();

    const ongoingKeys = [
        'in_transit_sea',
        'under_customs_clearance',
        'sorting',
        'dispatched_to_local_hub',
        'out_for_delivery',
        'en_route_roro',
    ];

    if (ongoingKeys.includes(keyLower)) {
        return 'ongoing';
    }

    if (statusLower === 'out_for_delivery') {
        return 'ongoing';
    }

    if (
        keyLower.includes('transit') ||
        keyLower.includes('clearance') ||
        keyLower.includes('sorting') ||
        keyLower.includes('dispatch') ||
        keyLower.includes('shipping') ||
        keyLower.includes('en_route')
    ) {
        return 'ongoing';
    }

    return 'checkpoint';
}

export interface ClassifyStepOptions {
    stepIndex: number;
    currentIndex: number;
    step: NormalizedStep;
    currentStatus?: string | null;
    totalSteps: number;
}

/**
 * Classify a tracking step's visual state based on journey position,
 * current box status, and semantic step type.
 */
export function classifyStepState(options: ClassifyStepOptions): TimelineStepState {
    const { stepIndex, currentIndex, step, currentStatus } = options;

    // 1. Pending with no real milestone scan event
    if (currentIndex < 0) {
        if (stepIndex === 0) {
            return 'next';
        }
        return 'upcoming';
    }

    // 2. Already achieved past steps
    if (stepIndex < currentIndex) {
        return 'completed';
    }

    // 3. Current active milestone/phase
    if (stepIndex === currentIndex) {
        const rawStatus = (currentStatus || '').toLowerCase().replace(/_/g, ' ');
        const stepStatus = (step.systemStatus || '').toLowerCase().replace(/_/g, ' ');
        const stepKey = (step.statusKey || '').toLowerCase();

        if (rawStatus === 'delivered' || stepStatus === 'delivered' || stepKey === 'delivered') {
            return 'delivered';
        }

        const effectiveStepType = step.step_type || step.stepType || deriveDefaultStepType(step.statusKey, step.systemStatus);

        if (effectiveStepType === 'ongoing') {
            return 'in_progress';
        }

        // Checkpoint milestone reached
        return 'completed_current';
    }

    // 4. Immediately upcoming step
    if (stepIndex === currentIndex + 1) {
        return 'next';
    }

    // 5. Future steps
    return 'upcoming';
}

/**
 * Helper to determine if date/time should be temporarily hidden for specific system events.
 * Specifically hides date/time for "Booking created and box registered".
 */
export function shouldHideEventDateTime(
    description?: string,
    event?: { description?: string | null; status?: string | null; status_label?: string | null }
): boolean {
    const desc = (description || '').toLowerCase();
    const rawDesc = (event?.description || '').toLowerCase();
    const status = (event?.status || '').toLowerCase();
    const statusLabel = (event?.status_label || '').toLowerCase();

    return (
        desc.includes('booking created and box registered') ||
        rawDesc.includes('booking created and box registered') ||
        (desc.includes('booking created') && desc.includes('box registered')) ||
        (rawDesc.includes('booking created') && rawDesc.includes('box registered')) ||
        status === 'booking_created' ||
        statusLabel === 'booking created'
    );
}

