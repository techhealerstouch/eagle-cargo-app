import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { 
    AlertTriangle, 
    Ban, 
    CreditCard, 
    Activity, 
    FileText, 
    Package, 
    Truck, 
    Ship, 
    Clock, 
    CheckCircle, 
    AlertCircle, 
    Info, 
    ArrowRight, 
    Copy 
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import BulkUpdateModal, { BulkUpdateAction } from '@/components/common/bulk-update-modal';
import { humanize } from '@/lib/utils';

export interface BookingItem {
    id: number;
    reference_number: string;
    sender_id?: number;
    sender?: {
        first_name: string;
        last_name: string;
    };
    status: string;
    payment_status: string;
    service_type?: string;
    booking_type?: string;
    destination?: string;
    preferred_date?: string | null;
    box_count?: number;
    admin_notes?: string | null;
    created_at?: string;
}

interface BookingBulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: number[];
    isGlobalSelection: boolean;
    filters: any;
    onSuccessCallback?: () => void;
    bookingsData?: BookingItem[];
}

const STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending / Booked' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'collected', label: 'Picked Up from Sender' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'partially_delivered', label: 'Partially Delivered' },
    { value: 'delivered', label: 'Delivered' },
];

const PAYMENT_STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'cash_on_pickup', label: 'Cash on Pickup' },
    { value: 'cash_collected', label: 'Cash Collected' },
    { value: 'balance_pending', label: 'Balance Pending' },
    { value: 'partially_paid', label: 'Partially Paid' },
];

const BOOKING_TYPE_OPTIONS = [
    { value: 'drop_off', label: 'Drop-Off' },
    { value: 'home_pickup', label: 'Home Pick-Up' },
    { value: 'other', label: 'Other' },
];

const PAYMENT_STATUS_META: Record<string, { label: string; badgeClass: string; icon: React.ElementType; hint: string }> = {
    paid: {
        label: 'Paid',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        icon: CheckCircle,
        hint: 'This booking has already been recorded as fully paid.',
    },
    pending: {
        label: 'Pending',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
        icon: Clock,
        hint: 'Payment has not been recorded yet.',
    },
    cash_on_pickup: {
        label: 'Cash on Pickup',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
        icon: Truck,
        hint: 'Payment is scheduled to be collected in cash upon pickup.',
    },
    cash_collected: {
        label: 'Cash Collected',
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/80',
        icon: CheckCircle,
        hint: 'Cash has been collected by courier or staff.',
    },
    balance_pending: {
        label: 'Balance Pending',
        badgeClass: 'bg-orange-50 text-orange-700 border-orange-200/80',
        icon: AlertCircle,
        hint: 'Initial payment recorded; remaining balance is pending.',
    },
    partially_paid: {
        label: 'Partially Paid',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
        icon: AlertCircle,
        hint: 'A partial payment has been recorded for this booking.',
    },
};

const LOGISTICAL_STATUS_META: Record<string, { label: string; badgeClass: string; icon: React.ElementType; hint: string }> = {
    pending: {
        label: 'Pending / Booked',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
        icon: Clock,
        hint: 'Booking received and awaiting review or collection.',
    },
    confirmed: {
        label: 'Confirmed',
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
        icon: CheckCircle,
        hint: 'Booking confirmed and scheduled for pickup or drop-off.',
    },
    collected: {
        label: 'Picked Up from Sender',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
        icon: Package,
        hint: 'Cargo collected from sender and in transit to warehouse.',
    },
    shipped: {
        label: 'Shipped',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        icon: Ship,
        hint: 'Loaded into shipping container or departed origin terminal.',
    },
    partially_delivered: {
        label: 'Partially Delivered',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
        icon: Truck,
        hint: 'Portion of boxes delivered to destination address.',
    },
    delivered: {
        label: 'Delivered',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        icon: CheckCircle,
        hint: 'All packages successfully delivered to recipient.',
    },
    cancelled: {
        label: 'Cancelled',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
        icon: Ban,
        hint: 'Booking has been cancelled.',
    },
};

const BOOKING_TYPE_META: Record<string, { label: string; badgeClass: string }> = {
    drop_off: { label: 'Drop-Off', badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
    home_pickup: { label: 'Home Pick-Up', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
    other: { label: 'Other', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
};

function PaymentBadge({ status }: { status: string }) {
    const meta = PAYMENT_STATUS_META[status] || {
        label: humanize(status),
        badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        icon: CreditCard,
        hint: '',
    };
    const Icon = meta.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badgeClass}`}>
            <Icon className="size-3.5 shrink-0" />
            <span>{meta.label}</span>
        </span>
    );
}

function LogisticalBadge({ status }: { status: string }) {
    const meta = LOGISTICAL_STATUS_META[status] || {
        label: humanize(status),
        badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
        icon: Activity,
        hint: '',
    };
    const Icon = meta.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badgeClass}`}>
            <Icon className="size-3.5 shrink-0" />
            <span>{meta.label}</span>
        </span>
    );
}

function BookingTypeBadge({ type }: { type: string }) {
    const meta = BOOKING_TYPE_META[type] || {
        label: humanize(type),
        badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border uppercase ${meta.badgeClass}`}>
            {meta.label}
        </span>
    );
}

export default function BookingBulkUpdateModal(props: BookingBulkUpdateModalProps) {
    const { auth } = usePage().props as any;
    const isSuperAdmin = auth?.user?.role === 'super_admin';

    const selectedBookings = React.useMemo(() => {
        if (!props.bookingsData || props.selectedIds.length === 0) return [];
        return props.bookingsData.filter((b) => props.selectedIds.includes(b.id));
    }, [props.bookingsData, props.selectedIds]);

    const isSingle = !props.isGlobalSelection && selectedBookings.length === 1;
    const singleBooking = isSingle ? selectedBookings[0] : null;

    const paymentStatusSummary = React.useMemo(() => {
        if (selectedBookings.length === 0) return null;
        const counts: Record<string, number> = {};
        for (const b of selectedBookings) {
            counts[b.payment_status] = (counts[b.payment_status] || 0) + 1;
        }
        return counts;
    }, [selectedBookings]);

    const logisticalStatusSummary = React.useMemo(() => {
        if (selectedBookings.length === 0) return null;
        const counts: Record<string, number> = {};
        for (const b of selectedBookings) {
            counts[b.status] = (counts[b.status] || 0) + 1;
        }
        return counts;
    }, [selectedBookings]);

    const bookingTypeSummary = React.useMemo(() => {
        if (selectedBookings.length === 0) return null;
        const counts: Record<string, number> = {};
        for (const b of selectedBookings) {
            const type = b.booking_type || 'drop_off';
            counts[type] = (counts[type] || 0) + 1;
        }
        return counts;
    }, [selectedBookings]);

    const notesCount = React.useMemo(() => {
        return selectedBookings.filter(b => b.admin_notes && b.admin_notes.trim().length > 0).length;
    }, [selectedBookings]);

    const totalBoxes = React.useMemo(() => {
        return selectedBookings.reduce((sum, b) => sum + (b.box_count || 0), 0);
    }, [selectedBookings]);

    const renderSelectionContextBanner = () => {
        if (isSingle && singleBooking) {
            return (
                <div className="p-3 bg-gradient-to-r from-zinc-50 via-zinc-50/50 to-white rounded-xl border border-zinc-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-bold text-zinc-900 bg-white px-2 py-0.5 rounded-md border border-zinc-200/90 shadow-2xs">
                            {singleBooking.reference_number}
                        </span>
                        <span className="text-xs font-semibold text-zinc-800 truncate">
                            {singleBooking.sender ? `${singleBooking.sender.first_name} ${singleBooking.sender.last_name}` : 'Sender'}
                        </span>
                        {singleBooking.destination && (
                            <>
                                <span className="text-zinc-300">•</span>
                                <span className="text-xs text-zinc-500 truncate">
                                    {singleBooking.destination}
                                </span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-zinc-500 bg-white px-2 py-0.5 rounded border border-zinc-200 shadow-2xs">
                            {singleBooking.box_count ?? 1} {singleBooking.box_count === 1 ? 'Box' : 'Boxes'}
                        </span>
                    </div>
                </div>
            );
        }

        if (!props.isGlobalSelection && selectedBookings.length > 1) {
            return (
                <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-200/80 flex items-center justify-between text-xs text-zinc-600 mb-4 shadow-2xs">
                    <span className="font-medium">
                        Bulk update affecting <strong>{selectedBookings.length} selected bookings</strong>.
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-500 bg-white px-2 py-0.5 rounded border border-zinc-200 shadow-2xs">
                        {totalBoxes} Total Boxes
                    </span>
                </div>
            );
        }

        if (props.isGlobalSelection) {
            return (
                <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs text-amber-900 mb-4 shadow-2xs">
                    <span className="font-medium">
                        Global mode: targeting <strong>all matching bookings</strong> in filtered dataset.
                    </span>
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-200">
                        All Filtered
                    </span>
                </div>
            );
        }

        return null;
    };

    const actions: BulkUpdateAction[] = [
        {
            id: 'status',
            label: 'Update Status',
            icon: Activity,
            description: 'Change the logistical status of the selected booking(s).',
            endpoint: '/admin/bookings/bulk-update-status',
            getPayload: (formState) => ({
                status: formState.status !== undefined
                    ? formState.status
                    : (singleBooking ? singleBooking.status : STATUS_OPTIONS[0].value),
                filter_status: props.filters?.status
            }),
            renderForm: (formState, setFormState) => {
                const effectiveSelected = formState.status !== undefined
                    ? formState.status
                    : (singleBooking ? singleBooking.status : '');

                return (
                    <div className="space-y-4">
                        {renderSelectionContextBanner()}

                        {/* Current Logistical Status Situation Card */}
                        {isSingle && singleBooking && (
                            <div className="p-3.5 rounded-xl border border-zinc-200/90 bg-gradient-to-br from-zinc-50 via-white to-zinc-50/50 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                        Current Logistical Status
                                    </span>
                                    <span className="text-[11px] text-zinc-400 font-medium">
                                        Active Logistical Stage
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <LogisticalBadge status={singleBooking.status} />
                                    <p className="text-xs text-zinc-600 leading-relaxed font-normal">
                                        {LOGISTICAL_STATUS_META[singleBooking.status]?.hint || `Status is currently set to ${humanize(singleBooking.status)}.`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {!isSingle && !props.isGlobalSelection && logisticalStatusSummary && Object.keys(logisticalStatusSummary).length > 0 && (
                            <div className="p-3.5 rounded-xl border border-zinc-200/90 bg-zinc-50/80 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                        Current Statuses Across Selection ({selectedBookings.length} Bookings)
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(logisticalStatusSummary).map(([statusKey, count]) => (
                                        <div key={statusKey} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-zinc-200/80 rounded-lg shadow-2xs">
                                            <LogisticalBadge status={statusKey} />
                                            <span className="text-[11px] font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">
                                                {count} {count === 1 ? 'booking' : 'bookings'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="bulk-status" className="text-xs font-semibold text-zinc-700">
                                New Logistical Status
                            </Label>
                            <select
                                id="bulk-status"
                                className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-2xs transition-all font-medium"
                                value={effectiveSelected}
                                onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                            >
                                {!singleBooking && <option value="" disabled>— Select Target Logistical Status —</option>}
                                {STATUS_OPTIONS.map((opt) => {
                                    const isCurrent = isSingle && singleBooking?.status === opt.value;
                                    const countInSelection = !isSingle && logisticalStatusSummary ? logisticalStatusSummary[opt.value] : 0;
                                    return (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                            {isCurrent ? ' (Current Status)' : ''}
                                            {countInSelection ? ` (${countInSelection} in selection)` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Transition Note */}
                        {isSingle && singleBooking && (
                            <div className="pt-0.5">
                                {effectiveSelected === singleBooking.status ? (
                                    <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/60">
                                        <Info className="size-4 text-zinc-400 shrink-0" />
                                        <span>No change: This booking is already in <strong>{humanize(singleBooking.status)}</strong> status.</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2.5 text-xs text-indigo-900 bg-gradient-to-r from-indigo-50 to-blue-50/40 p-2.5 rounded-xl border border-indigo-200/80">
                                        <ArrowRight className="size-4 text-indigo-600 shrink-0" />
                                        <span>
                                            Logistical status will transition from <strong className="text-zinc-900">{humanize(singleBooking.status)}</strong> ➔ <strong className="text-indigo-700">{humanize(effectiveSelected)}</strong>.
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/40 rounded-xl border border-amber-200/80 shadow-2xs">
                            <div className="flex items-start gap-2.5">
                                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800 leading-relaxed font-normal">
                                    Ensure selected bookings permit transitioning to this status. Invalid state transitions will be automatically skipped by the transition engine.
                                </p>
                            </div>
                        </div>
                    </div>
                );
            }
        },
        {
            id: 'payment_status',
            label: 'Update Payment Status',
            icon: CreditCard,
            description: 'Update the payment status across selected booking(s).',
            endpoint: '/admin/bookings/bulk-update-payment-status',
            getPayload: (formState) => ({
                payment_status: formState.payment_status !== undefined
                    ? formState.payment_status
                    : (singleBooking ? singleBooking.payment_status : PAYMENT_STATUS_OPTIONS[0].value),
                filter_status: props.filters?.status
            }),
            renderForm: (formState, setFormState) => {
                const effectiveSelected = formState.payment_status !== undefined
                    ? formState.payment_status
                    : (singleBooking ? singleBooking.payment_status : '');

                return (
                    <div className="space-y-4">
                        {renderSelectionContextBanner()}

                        {/* Current Status Situation Card */}
                        {isSingle && singleBooking && (
                            <div className="p-3.5 rounded-xl border border-zinc-200/90 bg-gradient-to-br from-zinc-50 via-white to-zinc-50/50 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                        Current Payment Status
                                    </span>
                                    {singleBooking.payment_status === 'paid' ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                                            <CheckCircle className="size-3 text-emerald-600" />
                                            Already Paid
                                        </span>
                                    ) : (
                                        <span className="text-[11px] text-zinc-400 font-medium">
                                            Active Record State
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <PaymentBadge status={singleBooking.payment_status} />
                                    <p className="text-xs text-zinc-600 leading-relaxed font-normal">
                                        {PAYMENT_STATUS_META[singleBooking.payment_status]?.hint || `Status is currently set to ${humanize(singleBooking.payment_status)}.`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {!isSingle && !props.isGlobalSelection && paymentStatusSummary && Object.keys(paymentStatusSummary).length > 0 && (
                            <div className="p-3.5 rounded-xl border border-zinc-200/90 bg-zinc-50/80 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                        Current Payment Statuses Across Selection ({selectedBookings.length} Bookings)
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(paymentStatusSummary).map(([statusKey, count]) => (
                                        <div key={statusKey} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-zinc-200/80 rounded-lg shadow-2xs">
                                            <PaymentBadge status={statusKey} />
                                            <span className="text-[11px] font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">
                                                {count} {count === 1 ? 'booking' : 'bookings'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {props.isGlobalSelection && (
                            <div className="p-3.5 rounded-xl border border-amber-200/90 bg-amber-50/60 shadow-2xs space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                    Global Selection Active
                                </span>
                                <p className="text-xs text-amber-900 leading-relaxed font-normal">
                                    Applying this update will change the payment status for <strong>all matching bookings</strong> in the filtered dataset.
                                    {props.filters?.payment_status && (
                                        <span className="block mt-1 font-semibold">
                                            Active Payment Filter: {humanize(props.filters.payment_status)}
                                        </span>
                                    )}
                                </p>
                            </div>
                        )}

                        {/* Input Select */}
                        <div className="space-y-2">
                            <Label htmlFor="bulk-payment-status" className="text-xs font-semibold text-zinc-700">
                                New Payment Status
                            </Label>
                            <select
                                id="bulk-payment-status"
                                className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-2xs transition-all font-medium"
                                value={effectiveSelected}
                                onChange={(e) => setFormState({ ...formState, payment_status: e.target.value })}
                            >
                                {!singleBooking && <option value="" disabled>— Select Target Payment Status —</option>}
                                {PAYMENT_STATUS_OPTIONS.map((opt) => {
                                    const isCurrent = isSingle && singleBooking?.payment_status === opt.value;
                                    const countInSelection = !isSingle && paymentStatusSummary ? paymentStatusSummary[opt.value] : 0;
                                    return (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                            {isCurrent ? ' (Current Status)' : ''}
                                            {countInSelection ? ` (${countInSelection} in selection)` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Transition Note */}
                        {isSingle && singleBooking && (
                            <div className="pt-0.5">
                                {effectiveSelected === singleBooking.payment_status ? (
                                    <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200/60">
                                        <Info className="size-4 text-zinc-400 shrink-0" />
                                        <span>No change: This booking is already marked as <strong>{humanize(singleBooking.payment_status)}</strong>.</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2.5 text-xs text-blue-900 bg-gradient-to-r from-blue-50 to-indigo-50/40 p-2.5 rounded-xl border border-blue-200/80">
                                        <ArrowRight className="size-4 text-blue-600 shrink-0" />
                                        <span>
                                            Payment status will change from <strong className="text-zinc-900">{humanize(singleBooking.payment_status)}</strong> ➔ <strong className="text-blue-700">{humanize(effectiveSelected)}</strong>.
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            id: 'admin_notes',
            label: 'Update Internal Note',
            icon: FileText,
            description: 'Set or clear the internal note for the selected booking(s).',
            endpoint: '/admin/bookings/bulk-update-notes',
            getPayload: (formState) => ({
                admin_notes: formState.admin_notes !== undefined
                    ? formState.admin_notes
                    : (singleBooking ? (singleBooking.admin_notes || '') : ''),
                filter_status: props.filters?.status
            }),
            renderForm: (formState, setFormState) => (
                <div className="space-y-4">
                    {renderSelectionContextBanner()}

                    {/* Current Notes Display */}
                    {isSingle && singleBooking && (
                        <div className="p-3.5 bg-zinc-50/90 rounded-xl border border-zinc-200/80 space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                    Current Internal Note
                                </span>
                                {singleBooking.admin_notes && (
                                    <button
                                        type="button"
                                        onClick={() => setFormState({ ...formState, admin_notes: singleBooking.admin_notes })}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
                                    >
                                        <Copy className="size-3" />
                                        Copy to Editor
                                    </button>
                                )}
                            </div>
                            {singleBooking.admin_notes ? (
                                <p className="text-xs text-zinc-800 bg-white p-2.5 rounded-lg border border-zinc-200/60 leading-relaxed font-normal">
                                    "{singleBooking.admin_notes}"
                                </p>
                            ) : (
                                <p className="text-xs text-zinc-400 italic">
                                    No internal note currently recorded for this booking.
                                </p>
                            )}
                        </div>
                    )}

                    {!isSingle && !props.isGlobalSelection && (
                        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 text-xs text-zinc-600 space-y-1">
                            <span className="font-semibold text-zinc-800">
                                {notesCount} of {selectedBookings.length}
                            </span>{' '}
                            selected bookings currently have an internal note.
                            <span className="block text-[11px] text-zinc-400">
                                Entering a note below will overwrite notes across all selected bookings. Leaving blank clears them.
                            </span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="bulk-admin-notes" className="text-xs font-semibold text-zinc-700">
                            New Internal Note (Optional)
                        </Label>
                        <textarea
                            id="bulk-admin-notes"
                            className="flex min-h-[90px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-2xs transition-all resize-none"
                            placeholder="Add or update internal operational notes..."
                            value={formState.admin_notes !== undefined ? formState.admin_notes : (singleBooking ? (singleBooking.admin_notes || '') : '')}
                            onChange={(e) => setFormState({ ...formState, admin_notes: e.target.value })}
                        />
                    </div>
                </div>
            )
        },
        {
            id: 'empty_boxes',
            label: 'Update Empty Boxes',
            icon: Package,
            description: 'Update empty box counts and fees for selected booking(s).',
            endpoint: '/admin/bookings/bulk-update-empty-boxes',
            getPayload: (formState) => ({ 
                empty_box_count: formState.empty_box_count !== undefined 
                    ? formState.empty_box_count 
                    : (singleBooking ? (singleBooking.box_count ?? 0) : 0), 
                empty_box_fee: formState.empty_box_fee !== undefined ? formState.empty_box_fee : 10,
                filter_status: props.filters?.status 
            }),
            renderForm: (formState, setFormState) => (
                <div className="space-y-4">
                    {renderSelectionContextBanner()}

                    {isSingle && singleBooking && (
                        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 flex items-center justify-between text-xs text-zinc-600 shadow-2xs">
                            <span>Current Box Count for this Booking:</span>
                            <span className="font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200 shadow-2xs">
                                {singleBooking.box_count ?? 0} Box(es)
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bulk-empty-box-count" className="text-xs font-semibold text-zinc-700">
                                Target Box Count
                            </Label>
                            <input
                                type="number"
                                id="bulk-empty-box-count"
                                min="0"
                                className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-2xs transition-all"
                                value={formState.empty_box_count !== undefined ? formState.empty_box_count : (singleBooking ? (singleBooking.box_count ?? 0) : 0)}
                                onChange={(e) => setFormState({ ...formState, empty_box_count: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bulk-empty-box-fee" className="text-xs font-semibold text-zinc-700">
                                Target Box Fee ($)
                            </Label>
                            <input
                                type="number"
                                id="bulk-empty-box-fee"
                                min="0"
                                step="0.01"
                                className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-2xs transition-all"
                                value={formState.empty_box_fee !== undefined ? formState.empty_box_fee : 10}
                                onChange={(e) => setFormState({ ...formState, empty_box_fee: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'booking_type',
            label: 'Update Booking Type',
            icon: Truck,
            description: 'Update the collection method (Booking Type) for the selected booking(s).',
            endpoint: '/admin/bookings/bulk-update-booking-type',
            getPayload: (formState) => ({
                booking_type: formState.booking_type || (singleBooking ? (singleBooking.booking_type || 'drop_off') : 'drop_off'),
                filter_status: props.filters?.status
            }),
            renderForm: (formState, setFormState) => {
                const effectiveType = formState.booking_type || (singleBooking ? (singleBooking.booking_type || 'drop_off') : 'drop_off');

                return (
                    <div className="space-y-4">
                        {renderSelectionContextBanner()}

                        {/* Current Booking Type Situation Card */}
                        {isSingle && singleBooking && (
                            <div className="p-3.5 rounded-xl border border-zinc-200/90 bg-gradient-to-br from-zinc-50 via-white to-zinc-50/50 shadow-2xs space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                        Current Booking Type
                                    </span>
                                    <span className="text-[11px] text-zinc-400 font-medium">
                                        Collection Method
                                    </span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <BookingTypeBadge type={singleBooking.booking_type || 'drop_off'} />
                                    <p className="text-xs text-zinc-600 leading-relaxed font-normal">
                                        Currently marked as {singleBooking.booking_type === 'home_pickup' ? 'Home Pick-Up' : singleBooking.booking_type === 'other' ? 'Other' : 'Drop-Off'}.
                                    </p>
                                </div>
                            </div>
                        )}

                        {!isSingle && !props.isGlobalSelection && bookingTypeSummary && (
                            <div className="p-3.5 rounded-xl border border-zinc-200/90 bg-zinc-50/80 shadow-2xs space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                    Current Booking Types Across Selection
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(bookingTypeSummary).map(([typeKey, count]) => (
                                        <div key={typeKey} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-zinc-200/80 rounded-lg shadow-2xs">
                                            <BookingTypeBadge type={typeKey} />
                                            <span className="text-[11px] font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">
                                                {count} {count === 1 ? 'booking' : 'bookings'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="bulk-booking-type" className="text-xs font-semibold text-zinc-700">
                                New Booking Type
                            </Label>
                            <select
                                id="bulk-booking-type"
                                className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-2xs transition-all font-medium"
                                value={effectiveType}
                                onChange={(e) => setFormState({ ...formState, booking_type: e.target.value })}
                            >
                                {BOOKING_TYPE_OPTIONS.map((opt) => {
                                    const isCurrent = isSingle && (singleBooking?.booking_type || 'drop_off') === opt.value;
                                    return (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label} {isCurrent ? ' (Current Type)' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>
                );
            }
        },
        {
            id: 'cancel',
            label: 'Cancel Bookings',
            icon: Ban,
            description: 'Mark the selected booking(s) as cancelled.',
            endpoint: '/admin/bookings/bulk-cancel',
            renderForm: () => (
                <div className="space-y-4">
                    {renderSelectionContextBanner()}

                    <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50/40 rounded-xl border border-red-200/80 shadow-2xs">
                        <div className="flex items-start gap-3">
                            <div className="size-8 rounded-lg bg-red-100/80 text-red-600 flex items-center justify-center shrink-0">
                                <Ban className="size-4" />
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <h4 className="text-xs font-semibold text-red-900">Confirm Cancellation</h4>
                                    <p className="text-xs text-red-700/90 leading-relaxed mt-0.5">
                                        Are you sure you want to cancel these bookings? Active runsheet assignments and tracking updates will be halted.
                                    </p>
                                </div>

                                {isSingle && singleBooking && (
                                    <div className="pt-2 border-t border-red-200/60 flex flex-wrap items-center gap-2">
                                        <span className="text-[11px] font-medium text-red-800">Current Status:</span>
                                        <LogisticalBadge status={singleBooking.status} />
                                        <PaymentBadge status={singleBooking.payment_status} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    if (isSuperAdmin) {
        actions.push({
            id: 'archive',
            label: 'Archive Bookings',
            icon: AlertTriangle,
            description: 'Archive bookings to hide them from the main list view.',
            endpoint: '/admin/bookings/bulk-destroy',
            method: 'delete',
            renderForm: () => (
                <div className="space-y-4">
                    {renderSelectionContextBanner()}

                    <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/80 shadow-2xs">
                        <div className="flex items-start gap-3">
                            <div className="size-8 rounded-lg bg-zinc-200/60 text-zinc-700 flex items-center justify-center shrink-0">
                                <AlertTriangle className="size-4" />
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <h4 className="text-xs font-semibold text-zinc-900">Confirm Archive</h4>
                                    <p className="text-xs text-zinc-600 leading-relaxed mt-0.5">
                                        Archived bookings will be hidden from active logistics views, but remain retained in system audit history.
                                    </p>
                                </div>

                                {isSingle && singleBooking && (
                                    <div className="pt-2 border-t border-zinc-200 flex flex-wrap items-center gap-2">
                                        <span className="text-[11px] font-medium text-zinc-600">Current State:</span>
                                        <LogisticalBadge status={singleBooking.status} />
                                        <PaymentBadge status={singleBooking.payment_status} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )
        });
    }

    const dynamicTitle = singleBooking
        ? `Update Booking #${singleBooking.reference_number}`
        : 'Update Selected Bookings';

    const dynamicDescription = singleBooking
        ? `Managing updates for ${singleBooking.sender ? `${singleBooking.sender.first_name} ${singleBooking.sender.last_name}` : 'selected booking'}. Select an action to configure.`
        : 'Apply changes to multiple items at once. Select an action from the menu to configure.';

    return (
        <BulkUpdateModal
            isOpen={props.isOpen}
            onClose={props.onClose}
            title={dynamicTitle}
            description={dynamicDescription}
            actions={actions}
            selectedIds={props.selectedIds}
            isGlobalSelection={props.isGlobalSelection}
            filters={props.filters}
            onSuccessCallback={props.onSuccessCallback}
        />
    );
}
