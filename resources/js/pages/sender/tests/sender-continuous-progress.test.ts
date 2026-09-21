import { describe, expect, it } from 'vitest';
import { getContinuousProgressInfo } from '../sender-dashboard-statuses';

describe('getContinuousProgressInfo', () => {
    it('returns Intake / Booking at 5% for pending/draft/confirmed', () => {
        expect(getContinuousProgressInfo('pending', 'confirmed')).toEqual({
            label: 'Intake / Booking',
            percent: 5,
            isDelivered: false,
            barColor: 'bg-orange-500',
        });
        expect(getContinuousProgressInfo('draft', 'draft')).toEqual({
            label: 'Intake / Booking',
            percent: 5,
            isDelivered: false,
            barColor: 'bg-orange-500',
        });
        expect(getContinuousProgressInfo(undefined, undefined)).toEqual({
            label: 'Intake / Booking',
            percent: 5,
            isDelivered: false,
            barColor: 'bg-orange-500',
        });
    });

    it('returns Picked Up at 25% when collected', () => {
        expect(getContinuousProgressInfo('collected', 'confirmed')).toEqual({
            label: 'Picked Up',
            percent: 25,
            isDelivered: false,
            barColor: 'bg-orange-500',
        });
        expect(getContinuousProgressInfo('pending', 'collected')).toEqual({
            label: 'Picked Up',
            percent: 25,
            isDelivered: false,
            barColor: 'bg-orange-500',
        });
    });

    it('returns Received at Warehouse at 35%', () => {
        expect(getContinuousProgressInfo('received_by_branch', 'confirmed')).toEqual({
            label: 'Received at Warehouse',
            percent: 35,
            isDelivered: false,
            barColor: 'bg-orange-500',
        });
    });

    it('returns Loaded to Container at 45%', () => {
        expect(getContinuousProgressInfo('loaded_to_container', 'confirmed')).toEqual({
            label: 'Loaded to Container',
            percent: 45,
            isDelivered: false,
            barColor: 'bg-orange-500',
        });
    });

    it('returns In Transit at 60%', () => {
        expect(getContinuousProgressInfo('in_transit', 'confirmed')).toEqual({
            label: 'In Transit',
            percent: 60,
            isDelivered: false,
            barColor: 'bg-orange-500',
        });
        expect(getContinuousProgressInfo('shipped', 'confirmed')).toEqual({
            label: 'In Transit',
            percent: 60,
            isDelivered: false,
            barColor: 'bg-orange-500',
        });
    });

    it('returns Arrived in Philippines at 70%', () => {
        expect(getContinuousProgressInfo('arrived', 'confirmed')).toEqual({
            label: 'Arrived in Philippines',
            percent: 70,
            isDelivered: false,
            barColor: 'bg-orange-500',
        });
    });

    it('returns Out for Delivery at 90%', () => {
        expect(getContinuousProgressInfo('out_for_delivery', 'confirmed')).toEqual({
            label: 'Out for Delivery',
            percent: 90,
            isDelivered: false,
            barColor: 'bg-orange-500',
        });
    });

    it('returns Delivered at 100% with green bar', () => {
        expect(getContinuousProgressInfo('delivered', 'confirmed')).toEqual({
            label: 'Delivered',
            percent: 100,
            isDelivered: true,
            barColor: 'bg-emerald-500',
        });
    });

    it('returns On Hold or Damaged with amber bar', () => {
        expect(getContinuousProgressInfo('held', 'confirmed')).toEqual({
            label: 'On Hold',
            percent: 30,
            isDelivered: false,
            barColor: 'bg-amber-500',
        });
        expect(getContinuousProgressInfo('damaged', 'confirmed')).toEqual({
            label: 'Damaged (Inspecting)',
            percent: 30,
            isDelivered: false,
            barColor: 'bg-amber-500',
        });
    });
});
