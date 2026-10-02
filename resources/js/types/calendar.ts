export type CalendarEventType =
    | 'cutoff'
    | 'sailing'
    | 'arrival'
    | 'pickup_run'
    | 'delivery_run'
    | 'holiday'
    | 'promo'
    | 'community'
    | 'maintenance'
    | 'custom';

export type CalendarEventCategory =
    | 'logistics'
    | 'marketing'
    | 'operations'
    | 'holiday'
    | 'disruption';

export type CalendarEventVisibility =
    | 'public'
    | 'customer_only'
    | 'staff_only'
    | 'admin_only';

export interface CalendarEvent {
    id: number;
    title: string;
    description?: string | null;
    event_type: CalendarEventType;
    category: CalendarEventCategory;
    visibility: CalendarEventVisibility;
    start_date: string;
    end_date?: string | null;
    is_all_day: boolean;
    is_blocking: boolean;
    color_hex: string;
    badge_label?: string | null;
    location?: string | null;
    batch_id?: number | null;
    runsheet_id?: number | null;
    pickup_zone_id?: number | null;
    area_id?: number | null;
    created_by?: number | null;
    is_virtual_promo?: boolean;
    promo_id?: number;
    batch?: {
        id: number;
        batch_number: string;
        container_number?: string | null;
        vessel_name?: string | null;
        status?: string;
    } | null;
    runsheet?: {
        id: number;
        type: string;
        status: string;
        area_description?: string | null;
        timeslot?: string | null;
    } | null;
    pickup_zone?: {
        id: number;
        name: string;
        code: string;
    } | null;
    area?: {
        id: number;
        name: string;
    } | null;
    creator?: {
        id: number;
        name: string;
        email: string;
    } | null;
    created_at?: string;
    updated_at?: string;
}

export interface PickupZoneOption {
    id: number;
    name: string;
    code: string;
    pickup_windows?: any;
}

export interface AreaOption {
    id: number;
    name: string;
}

export interface BatchOption {
    id: number;
    batch_number: string;
    container_number?: string | null;
    status: string;
}

export interface UpcomingCutoffInfo {
    id: number;
    title: string;
    cutoff_date: string;
    formatted_cutoff: string;
    days_remaining: number;
    is_today: boolean;
    urgency_level: 'normal' | 'closing_soon' | 'last_day';
    vessel_name: string;
    container_number?: string | null;
    batch_number?: string;
    origin_port: string;
    destination_port: string;
    sailing_date: string;
    estimated_delivery_window?: string | null;
    loaded_boxes_count?: number;
}

export interface CalendarMetrics {
    active_batches_count: number;
    upcoming_cutoffs_count: number;
    monthly_runsheets_count: number;
    active_blackouts_count: number;
}

