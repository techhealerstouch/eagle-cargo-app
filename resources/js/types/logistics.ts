import type { LucideIcon } from 'lucide-react';

export interface TrackingTimelineItem {
    status: string;
    status_label?: string;
    description: string;
    location?: string;
    date: string;
    tracking_phase?: string;
}

export interface TrackingBox {
    id?: number;
    tracking_number: string;
    status: string;
    status_label?: string;
    destination: string;
    recipient_name?: string;
    box_type?: { name: string };
    area?: { id?: number; name: string } | null;
    current_milestone_id?: number;
    eta_date?: string | null;
    eta_message?: string | null;
    estimate_delivery_date?: string | null;
    estimate_delivery_message?: string | null;
    batch?: {
        batch_number: string;
        status?: string;
        container_number?: string;
        vessel_name?: string;
        voyage_number?: string;
        shipping_line?: string;
        origin_port?: string;
        destination_port?: string;
        branch_code?: string;
        eta_at?: string;
    } | null;
    timeline?: TrackingTimelineItem[];
}

export interface TrackingData {
    tracking_number: string;
    status: string;
    status_label?: string;
    booking_id: number;
    booking_reference?: string;
    recipient_name?: string;
    destination?: string;
    box_type?: { name: string };
    payment_status: 'paid' | 'unpaid' | 'pending';
    area?: { id?: number; name: string } | null;
    timeline: TrackingTimelineItem[];
    is_multi_box: boolean;
    is_booking_search?: boolean;
    total_boxes_count?: number;
    all_boxes: TrackingBox[];
    declaration_form_status?: 'missing' | 'submitted';
    current_milestone_id?: number;
    area_milestones?: Array<{ id: number; name: string; is_final: boolean }>;
    eta_date?: string | null;
    eta_message?: string | null;
    batch?: {
        batch_number: string;
        status?: string;
        container_number?: string;
        vessel_name?: string;
        voyage_number?: string;
        shipping_line?: string;
        origin_port?: string;
        destination_port?: string;
        branch_code?: string;
        eta_at?: string;
    } | null;
}

export interface TrackingStep {
    key: string;
    label: string;
    phase: string;
    order: number;
    icon: string;
    system_status?: string;
    description?: string;
}

export interface NormalizedStep {
    label: string;
    statusKey: string;
    icon: LucideIcon;
    systemStatus?: string;
    description?: string;
}
