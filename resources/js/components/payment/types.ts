export interface Box {
    price_charged: string;
    box_type?: { name: string };
    recipient: {
        city: string;
        province: string;
        first_name: string;
        last_name: string;
    };
}

export interface Booking {
    id: number;
    reference_number: string;
    payment_status?: string;
    boxes: Box[];
    proof_of_payment?: string;
    payment_method?: string;
    preferred_date?: string;
    declaration_data?: any;
    declaration_form_path?: string | null;
}

export interface PaymentFlowProps {
    booking: Booking;
    stripeKey?: string;
    clientSecret?: string | null;
    bankDetails?: { bank_name?: string; bsb?: string; account_number?: string; company_name?: string; };
    onSuccess?: () => void;
    onStripeLoadError?: (errorMessage?: string) => void;
    role?: 'sender' | 'picker' | 'admin';
    endpoint?: string;
    invoiceId?: number;
    manualAmount?: number;
    manualAmountCap?: number;
    isLoading?: boolean;
    backUrl?: string;
    backLabel?: string;
}
