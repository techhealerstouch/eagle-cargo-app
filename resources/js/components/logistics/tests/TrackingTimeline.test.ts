import { describe, expect, it } from 'vitest';
import { Package, Truck, Ship, Home, ShieldCheck } from 'lucide-react';
import {
    classifyStepState,
    deriveDefaultStepType,
    type TimelineStepState,
} from '../TrackingTimeline.helpers';
import type { NormalizedStep } from '@/types/logistics';

describe('TrackingTimeline classification helpers', () => {
    const mockSteps: NormalizedStep[] = [
        { label: 'Picked Up from Sender', statusKey: 'picked_up', systemStatus: 'collected', step_type: 'checkpoint', icon: Truck },
        { label: 'Received at Warehouse', statusKey: 'received_by_branch', systemStatus: 'received_by_branch', step_type: 'checkpoint', icon: Package },
        { label: 'Loaded to Container', statusKey: 'loading_container', systemStatus: 'loaded_to_container', step_type: 'checkpoint', icon: Package },
        { label: 'Shipping to Philippines', statusKey: 'in_transit_sea', systemStatus: 'in_transit', step_type: 'ongoing', icon: Ship },
        { label: 'Arrived in the Philippines', statusKey: 'arrived_manila_port', systemStatus: 'arrived', step_type: 'checkpoint', icon: Ship },
        { label: 'Under BOC Clearance', statusKey: 'under_customs_clearance', systemStatus: 'arrived', step_type: 'ongoing', icon: ShieldCheck },
        { label: 'Released by BOC', statusKey: 'released_by_boc', systemStatus: 'arrived', step_type: 'checkpoint', icon: ShieldCheck },
        { label: 'At Sorting Facility', statusKey: 'sorting', systemStatus: 'in_transit', step_type: 'ongoing', icon: Package },
        { label: 'Out for Delivery', statusKey: 'out_for_delivery', systemStatus: 'out_for_delivery', step_type: 'ongoing', icon: Truck },
        { label: 'Delivered', statusKey: 'delivered', systemStatus: 'delivered', step_type: 'checkpoint', icon: Home },
    ];

    it('classifies current checkpoint milestone as completed_current, NOT in_progress', () => {
        const state = classifyStepState({
            stepIndex: 0,
            currentIndex: 0,
            step: mockSteps[0], // picked_up (checkpoint)
            currentStatus: 'collected',
            totalSteps: mockSteps.length,
        });

        expect(state).toBe('completed_current');
    });

    it('classifies current ongoing phase as in_progress', () => {
        const state = classifyStepState({
            stepIndex: 3,
            currentIndex: 3,
            step: mockSteps[3], // in_transit_sea (ongoing)
            currentStatus: 'in_transit',
            totalSteps: mockSteps.length,
        });

        expect(state).toBe('in_progress');
    });

    it('classifies delivered step as delivered', () => {
        const state = classifyStepState({
            stepIndex: 9,
            currentIndex: 9,
            step: mockSteps[9], // delivered
            currentStatus: 'delivered',
            totalSteps: mockSteps.length,
        });

        expect(state).toBe('delivered');
    });

    it('classifies past steps as completed', () => {
        const state = classifyStepState({
            stepIndex: 1,
            currentIndex: 3,
            step: mockSteps[1], // received_by_branch
            currentStatus: 'in_transit',
            totalSteps: mockSteps.length,
        });

        expect(state).toBe('completed');
    });

    it('classifies immediately upcoming step as next and distant future steps as upcoming', () => {
        const nextState = classifyStepState({
            stepIndex: 4,
            currentIndex: 3,
            step: mockSteps[4],
            currentStatus: 'in_transit',
            totalSteps: mockSteps.length,
        });
        expect(nextState).toBe('next');

        const upcomingState = classifyStepState({
            stepIndex: 5,
            currentIndex: 3,
            step: mockSteps[5],
            currentStatus: 'in_transit',
            totalSteps: mockSteps.length,
        });
        expect(upcomingState).toBe('upcoming');
    });

    it('handles pending shipment with no scans (currentIndex = -1) without marking pickup as completed or in_progress', () => {
        const step0 = classifyStepState({
            stepIndex: 0,
            currentIndex: -1,
            step: mockSteps[0],
            currentStatus: 'pending',
            totalSteps: mockSteps.length,
        });
        expect(step0).toBe('next');

        const step1 = classifyStepState({
            stepIndex: 1,
            currentIndex: -1,
            step: mockSteps[1],
            currentStatus: 'pending',
            totalSteps: mockSteps.length,
        });
        expect(step1).toBe('upcoming');
    });

    it('distinguishes custom steps that share the same broad system status', () => {
        // Step 4: arrived_manila_port (systemStatus = arrived, checkpoint)
        // Step 5: under_customs_clearance (systemStatus = arrived, ongoing)
        const arrivedPortState = classifyStepState({
            stepIndex: 4,
            currentIndex: 4,
            step: mockSteps[4],
            currentStatus: 'arrived',
            totalSteps: mockSteps.length,
        });
        expect(arrivedPortState).toBe('completed_current');

        // When progressing to customs clearance:
        const prevPortState = classifyStepState({
            stepIndex: 4,
            currentIndex: 5,
            step: mockSteps[4],
            currentStatus: 'arrived',
            totalSteps: mockSteps.length,
        });
        expect(prevPortState).toBe('completed');

        const customsState = classifyStepState({
            stepIndex: 5,
            currentIndex: 5,
            step: mockSteps[5],
            currentStatus: 'arrived',
            totalSteps: mockSteps.length,
        });
        expect(customsState).toBe('in_progress');
    });

    it('derives default step type for legacy configurations without step_type', () => {
        expect(deriveDefaultStepType('picked_up', 'collected')).toBe('checkpoint');
        expect(deriveDefaultStepType('received_by_branch', 'received_by_branch')).toBe('checkpoint');
        expect(deriveDefaultStepType('loading_container', 'loaded_to_container')).toBe('checkpoint');
        expect(deriveDefaultStepType('in_transit_sea', 'in_transit')).toBe('ongoing');
        expect(deriveDefaultStepType('under_customs_clearance', 'arrived')).toBe('ongoing');
        expect(deriveDefaultStepType('released_by_boc', 'arrived')).toBe('checkpoint');
        expect(deriveDefaultStepType('sorting', 'in_transit')).toBe('ongoing');
        expect(deriveDefaultStepType('dispatched_to_local_hub', 'in_transit')).toBe('ongoing');
        expect(deriveDefaultStepType('out_for_delivery', 'out_for_delivery')).toBe('ongoing');
        expect(deriveDefaultStepType('delivered', 'delivered')).toBe('checkpoint');
    });
});
