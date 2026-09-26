export interface BankDetails {
    bank_name?: string;
    bsb?: string;
    account_number?: string;
    company_name?: string;
    bankName?: string;
    accountName?: string;
    bankBsb?: string;
    bankAccount?: string;
    [key: string]: any;
}

export interface BoxRecipient {
    city?: string;
    province?: string;
    first_name?: string;
    last_name?: string;
    [key: string]: any;
}

export interface Box {
    price_charged: string | number;
    box_type?: { name: string } | string;
    recipient?: BoxRecipient;
    recipient_name?: string;
    destination?: string;
    tracking_number?: string | null;
    [key: string]: any;
}

export interface Booking {
    id: number;
    reference_number: string;
    guest_token?: string;
    payment_status?: string;
    boxes: Box[];
    proof_of_payment?: string | null;
    payment_reference?: string | null;
    payment_method?: string;
    preferred_date?: string;
    declaration_data?: any;
    declaration_form_path?: string | null;
    declaration_form_status?: string;
    [key: string]: any;
}

export interface PaymentFlowProps {
    booking: Booking;
    stripeKey?: string;
    clientSecret?: string | null;
    bankDetails?: BankDetails;
    onSuccess?: () => void;
    onStripeLoadError?: (errorMessage?: string) => void;
    role?: 'sender' | 'picker' | 'admin' | 'guest';
    endpoint?: string;
    uploadUrl?: string;
    verifyUrl?: string;
    invoiceId?: number;
    manualAmount?: number;
    manualAmountCap?: number;
    isLoading?: boolean;
    backUrl?: string;
    backLabel?: string;
}
