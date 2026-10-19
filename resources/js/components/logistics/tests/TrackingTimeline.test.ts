import { Package } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { classifyTimelineStep, matchEventToStep } from '../TrackingTimeline';
import type { NormalizedStep, TrackingTimelineItem } from '@/types/logistics';

const step = (overrides: Partial<NormalizedStep> = {}): NormalizedStep => ({
    label: 'Tracking step',
    statusKey: 'tracking_step',
    icon: Package,
    systemStatus: 'pending',
    ...overrides,
});

describe('TrackingTimeline step classification', () => {
    it('marks the current checkpoint as completed', () => {
        expect(classifyTimelineStep(1, 1, step({ statusKey: 'collected', systemStatus: 'collected' }), 'collected'))
            .toBe('completed_current');
    });

    it('keeps a current ongoing phase in progress', () => {
        expect(classifyTimelineStep(2, 2, step({ statusKey: 'in_transit', systemStatus: 'in_transit' }), 'in_transit'))
            .toBe('in_progress');
    });

    it('marks delivered as a completed terminal state', () => {
        expect(classifyTimelineStep(4, 4, step({ statusKey: 'delivered', systemStatus: 'delivered' }), 'delivered'))
            .toBe('delivered');
    });

    it('shows the immediate following step as next and later steps as upcoming', () => {
        expect(classifyTimelineStep(3, 2, step(), 'collected')).toBe('next');
        expect(classifyTimelineStep(4, 2, step(), 'collected')).toBe('upcoming');
    });

    it('does not treat a shared in_transit status as ongoing for a checkpoint detail step', () => {
        expect(classifyTimelineStep(
            3,
            3,
            step({ statusKey: 'sorting', systemStatus: 'in_transit', stepType: 'checkpoint' }),
            'in_transit',
        )).toBe('completed_current');
    });

    it('supports explicit ongoing semantics for custom steps', () => {
        expect(classifyTimelineStep(
            3,
            3,
            step({ statusKey: 'custom_processing', systemStatus: 'arrived', stepType: 'ongoing' }),
            'arrived',
        )).toBe('in_progress');
    });

    it('keeps every step upcoming before pickup', () => {
        expect(classifyTimelineStep(0, -1, step({ statusKey: 'picked_up' }), 'pending')).toBe('upcoming');
        expect(classifyTimelineStep(3, -1, step({ statusKey: 'delivered' }), 'pending')).toBe('upcoming');
    });
});

describe('TrackingTimeline matchEventToStep', () => {
    const journeySteps: NormalizedStep[] = [
        step({ statusKey: 'arrived_manila_port', label: 'Arrived in the Philippines', systemStatus: 'arrived' }),
        step({ statusKey: 'under_customs_clearance', label: 'Under BOC Clearance', systemStatus: 'arrived' }),
        step({ statusKey: 'released_by_boc', label: 'Released by BOC', systemStatus: 'arrived' }),
        step({ statusKey: 'received_manila_warehouse', label: 'Received at Manila Warehouse', systemStatus: 'arrived' }),
    ];

    it('matches exact tracking_step_key over shared systemStatus', () => {
        const event: TrackingTimelineItem = {
            status: 'arrived',
            tracking_step_key: 'under_customs_clearance',
            description: 'Status updated by Admin',
            date: 'Oct 19, 2026',
        };
        expect(matchEventToStep(event, journeySteps)).toBe(1);
    });

    it('matches tracking_phase over shared systemStatus', () => {
        const event: TrackingTimelineItem = {
            status: 'arrived',
            tracking_phase: 'under_customs_clearance',
            description: 'Status updated by Admin',
            date: 'Oct 19, 2026',
        };
        expect(matchEventToStep(event, journeySteps)).toBe(1);
    });

    it('matches customs status label to Under BOC Clearance', () => {
        const event: TrackingTimelineItem = {
            status: 'arrived',
            status_label: 'Under Customs Clearance',
            description: 'Status updated by Admin',
            date: 'Oct 19, 2026',
        };
        expect(matchEventToStep(event, journeySteps)).toBe(1);
    });

    it('matches released status label to Released by BOC', () => {
        const event: TrackingTimelineItem = {
            status: 'arrived',
            status_label: 'Released by BOC',
            description: 'Status updated by Admin',
            date: 'Oct 19, 2026',
        };
        expect(matchEventToStep(event, journeySteps)).toBe(2);
    });

    it('falls back to first matching systemStatus if no specific key is present', () => {
        const event: TrackingTimelineItem = {
            status: 'arrived',
            description: 'Generic arrival notice',
            date: 'Oct 19, 2026',
        };
        expect(matchEventToStep(event, journeySteps)).toBe(0);
    });
});
