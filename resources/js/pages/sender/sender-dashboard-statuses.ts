export const isPendingBoxStatus = (status: string): boolean => status.toUpperCase() === 'PENDING';

export const isActiveBoxStatus = (status: string): boolean =>
    [
        'COLLECTED',
        'RECEIVED_BY_BRANCH',
        'LOADED_TO_CONTAINER',
        'IN_TRANSIT',
        'ARRIVED',
        'OUT_FOR_DELIVERY',
        'DAMAGED',
        'HELD',
    ].includes(status.toUpperCase());

export const getSenderDashboardStatusStep = (status: string): number => {
    const normalizedStatus = status.toUpperCase();

    if (isPendingBoxStatus(normalizedStatus)) {
        return 1;
    }

    if (['COLLECTED', 'RECEIVED_BY_BRANCH', 'LOADED_TO_CONTAINER', 'DAMAGED', 'HELD'].includes(normalizedStatus)) {
        return 2;
    }

    if (['IN_TRANSIT', 'ARRIVED', 'OUT_FOR_DELIVERY'].includes(normalizedStatus)) {
        return 3;
    }

    if (normalizedStatus === 'DELIVERED') {
        return 4;
    }

    return 1;
};

export const summarizeBookingBoxStatuses = (boxes: Array<{ status?: string }>): { label: string | null; status: string } => {
    const statuses = boxes.map((box) => box.status?.toUpperCase()).filter((status): status is string => Boolean(status));

    if (statuses.length === 0) {
        return { label: 'Processing', status: 'PENDING' };
    }

    if (new Set(statuses).size === 1) {
        return { label: null, status: statuses[0] };
    }

    const leastAdvancedStatus = statuses.reduce((leastAdvanced, status) =>
        getSenderDashboardStatusStep(status) < getSenderDashboardStatusStep(leastAdvanced) ? status : leastAdvanced,
    );
    const deliveredCount = statuses.filter((status) => status === 'DELIVERED').length;

    return {
        label: deliveredCount > 0 ? `${deliveredCount} of ${statuses.length} Delivered` : 'Multiple Statuses',
        status: leastAdvancedStatus,
    };
};

export const getSenderBookingStatusIndex = (boxStatus?: string, bookingStatus?: string): number => {
    const getWeight = (status?: string): number => {
        const s = (status || '').toLowerCase();
        if (s === 'delivered') return 3;
        if (
            [
                'in_transit',
                'shipped',
                'arrived',
                'out_for_delivery',
                'for_checking_unloading',
                'unloaded_manila',
                'for_delivery_scheduling',
                'en_route_roro',
            ].includes(s)
        ) {
            return 2;
        }
        if (
            [
                'collected',
                'warehouse',
                'received_by_branch',
                'loaded_to_container',
                'damaged',
                'held',
                'held_bulging',
            ].includes(s)
        ) {
            return 1;
        }
        // 'pending', 'draft', 'confirmed' are weight 0 (Pending stage: booking confirmed/scheduled, but box not yet picked up)
        return 0;
    };

    return Math.max(getWeight(boxStatus), getWeight(bookingStatus));
};

