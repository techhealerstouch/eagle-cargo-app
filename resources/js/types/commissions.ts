export type CommissionStatus = 'pending' | 'paid' | 'cancelled';
export type CommissionType = 'flat' | 'size' | 'percentage';

export interface Commission {
    id: number;
    picker_id: number;
    box_id: number;
    payout_id: number | null;
    amount: number;
    distance_km: number;
    type: string;
    status: CommissionStatus;
    breakdown?: {
        base_rate: number;
        distance_bonus: number;
        distance_km: number;
    };
    created_at: string;
    updated_at: string;
    box?: any; // Assuming Box type is defined elsewhere or any for now
    picker?: any;
    payout?: Payout;
}

export interface Payout {
    id: number;
    picker_id: number;
    total_amount: number;
    payout_method: string | null;
    payout_provider: string | null;
    reference_number: string | null;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
    picker?: any;
    commissions?: Commission[];
}
