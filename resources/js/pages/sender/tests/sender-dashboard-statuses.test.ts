import { describe, expect, it } from 'vitest';
import { getSenderDashboardStatusStep, isActiveBoxStatus, isPendingBoxStatus, summarizeBookingBoxStatuses } from '../sender-dashboard-statuses';

describe('sender dashboard box statuses', () => {
    it.each([
        'collected',
        'received_by_branch',
        'loaded_to_container',
        'in_transit',
        'arrived',
        'out_for_delivery',
        'damaged',
        'held',
    ])('shows %s in the active tab', (status) => {
        expect(isActiveBoxStatus(status)).toBe(true);
    });

    it.each(['pending', 'delivered', 'cancelled'])('does not show %s in the active tab', (status) => {
        expect(isActiveBoxStatus(status)).toBe(false);
    });

    it('classifies pending separately and maps later statuses to progress steps', () => {
        expect(isPendingBoxStatus('pending')).toBe(true);
        expect(getSenderDashboardStatusStep('loaded_to_container')).toBe(2);
        expect(getSenderDashboardStatusStep('out_for_delivery')).toBe(3);
        expect(getSenderDashboardStatusStep('delivered')).toBe(4);
    });

    it('summarizes mixed multi-box bookings without hiding the least advanced box', () => {
        expect(summarizeBookingBoxStatuses([{ status: 'delivered' }, { status: 'out_for_delivery' }])).toEqual({
            label: '1 of 2 Delivered',
            status: 'OUT_FOR_DELIVERY',
        });
        expect(summarizeBookingBoxStatuses([{ status: 'arrived' }, { status: 'in_transit' }])).toEqual({
            label: 'Multiple Statuses',
            status: 'ARRIVED',
        });
    });
});
