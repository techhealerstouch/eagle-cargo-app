import { describe, expect, it } from 'vitest';
import {
    getSenderDashboardStatusStep,
    getSenderBookingStatusIndex,
    isActiveBoxStatus,
    isPendingBoxStatus,
    summarizeBookingBoxStatuses,
} from '../sender-dashboard-statuses';

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

    it('maps box and booking statuses to the correct 4-step stepper index (0: Pending, 1: Picked Up, 2: In Transit, 3: Delivered)', () => {
        // Confirmed booking with uncollected box MUST stay at Pending (step 0), NOT Picked Up
        expect(getSenderBookingStatusIndex('pending', 'confirmed')).toBe(0);
        expect(getSenderBookingStatusIndex('pending', 'pending')).toBe(0);
        expect(getSenderBookingStatusIndex('draft', 'draft')).toBe(0);

        // Picked up / collected boxes
        expect(getSenderBookingStatusIndex('collected', 'confirmed')).toBe(1);
        expect(getSenderBookingStatusIndex('received_by_branch', 'confirmed')).toBe(1);
        expect(getSenderBookingStatusIndex('loaded_to_container', 'confirmed')).toBe(1);
        expect(getSenderBookingStatusIndex('pending', 'collected')).toBe(1);

        // In Transit
        expect(getSenderBookingStatusIndex('in_transit', 'confirmed')).toBe(2);
        expect(getSenderBookingStatusIndex('out_for_delivery', 'confirmed')).toBe(2);
        expect(getSenderBookingStatusIndex('pending', 'shipped')).toBe(2);

        // Delivered
        expect(getSenderBookingStatusIndex('delivered', 'confirmed')).toBe(3);
        expect(getSenderBookingStatusIndex('pending', 'delivered')).toBe(3);
    });
});

