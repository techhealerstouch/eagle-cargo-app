import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Save, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';

import type { BreadcrumbItem } from '@/types';

interface Booking {
    id: number;
    reference_number: string;
    sender: { first_name: string; last_name: string };
}

interface Box {
    id: number;
    tracking_number: string;
    serial_number: string | null;
    booking_id: number;
    status: string;
    courier_notes: string | null;
    delivery_proof_path: string | null;
    signature_path: string | null;
    pickup_proof_path: string | null;
    eta_date?: string | null;
    eta_message?: string | null;
    booking?: {
        sender: {
            first_name: string;
            last_name: string;
        };
    };
}

const STEPPER_STEPS = [
    { key: 'pending', label: 'Pending' },
    { key: 'collected', label: 'Collected' },
    { key: 'received_by_branch', label: 'Received' },
    { key: 'loaded_to_container', label: 'Loaded' },
    { key: 'in_transit', label: 'Transit' },
    { key: 'arrived', label: 'Arrived' },
    { key: 'out_for_delivery', label: 'Out' },
    { key: 'delivered', label: 'Delivered' },
];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['collected', 'received_by_branch', 'cancelled'],
    collected: ['received_by_branch', 'loaded_to_container', 'in_transit', 'damaged', 'cancelled'],
    received_by_branch: ['loaded_to_container', 'in_transit', 'arrived', 'delivered', 'damaged', 'held', 'cancelled'],
    loaded_to_container: ['in_transit', 'arrived', 'delivered', 'damaged', 'held', 'cancelled'],
    damaged: ['received_by_branch', 'loaded_to_container', 'in_transit', 'arrived', 'out_for_delivery', 'delivered', 'cancelled'],
    held: ['received_by_branch', 'loaded_to_container', 'in_transit', 'arrived', 'out_for_delivery', 'delivered', 'cancelled'],
    in_transit: ['arrived', 'out_for_delivery', 'delivered', 'received_by_branch', 'cancelled'],
    arrived: ['in_transit', 'out_for_delivery', 'delivered', 'cancelled'],
    out_for_delivery: ['delivered', 'cancelled', 'held', 'damaged'],
    delivered: [],
    cancelled: ['pending', 'collected'],
};

const isStatusDisabled = (currentStatus: string | undefined, optionStatus: string) => {
    if (!currentStatus) return false;
    if (currentStatus === optionStatus) return false;
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    return !allowed || !allowed.includes(optionStatus);
};

export default function BoxesEdit({
    box,
    bookings,
}: {
    box: Box;
    bookings: Booking[];
}) {
    const { auth, tracking_steps } = usePage<any>().props;

    const getValueForSystemStatus = (status: string | undefined) => {
        if (!status) return '';
        const step = tracking_steps?.find((s: any) => s.system_status === status);
        return step ? step.key : status;
    };

    const getStepOrder = (val: string | null | undefined) => {
        if (!val) return 0;
        const step = tracking_steps?.find((s: any) => s.key === val || s.system_status === val);
        return step ? step.order : 0;
    };

    const [selectedStepKey, setSelectedStepKey] = useState(getValueForSystemStatus(box.status));

    const { data, setData, put, processing, errors } = useForm({
        booking_id: box.booking_id.toString(),
        status: box.status,
        tracking_step_key: getValueForSystemStatus(box.status),
        courier_notes: box.courier_notes || '',
        admin_delivery_override_reason: '',
        update_eta: false,
        eta_date: box.eta_date || '',
        eta_message: box.eta_message || 'Your box is expected to be delivered on or before this date',
        update_estimate_delivery: false,
        estimate_delivery_date: box.estimate_delivery_date || '',
        estimate_delivery_message: box.estimate_delivery_message || 'Your box is expected to be delivered on or before this date',
    });

    const handleStatusChange = (val: string) => {
        setSelectedStepKey(val);
        const selectedStep = tracking_steps?.find((s: any) => s.key === val);
        const systemStatus = selectedStep ? selectedStep.system_status : val;
        
        setData((prev) => ({
            ...prev,
            status: systemStatus,
            tracking_step_key: selectedStep ? selectedStep.key : '',
        }));
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Boxes', href: '/admin/boxes' },
        { title: box.tracking_number, href: `/admin/boxes/${box.id}/edit` },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/admin/boxes/${box.id}`);
    };

    const requiresDeliveryOverride = data.status === 'delivered' && !box.delivery_proof_path;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit Box ${box.tracking_number} | Admin`} />
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-brand-warm/20 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/boxes"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-warm/30 bg-white text-brand-text-mid transition-all hover:bg-brand-rust/5 hover:text-brand-rust"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                        <div>
                            <Heading
                                title="Edit Box"
                                description={`Manage details and status for box ${box.tracking_number}`}
                            />
                        </div>
                    </div>
                </div>

                <div className="mx-auto w-full max-w-2xl">
                    <div className="rounded-2xl border border-brand-warm/20 bg-white p-6 shadow-sm sm:p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Box Summary Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-brand-warm/5 p-4 rounded-xl border border-brand-warm/20">
                                <div>
                                    <span className="block text-[9px] font-bold uppercase tracking-widest text-brand-text-mid/60">Tracking Number</span>
                                    <span className="font-mono text-sm font-bold text-brand-rust">{box.tracking_number}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-bold uppercase tracking-widest text-brand-text-mid/60">Serial Number</span>
                                    <span className="text-sm font-bold text-brand-text">{box.serial_number || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-bold uppercase tracking-widest text-brand-text-mid/60">Sender</span>
                                    <span className="text-sm font-bold text-brand-text">
                                        {box.booking?.sender ? `${box.booking.sender.first_name} ${box.booking.sender.last_name}` : 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {/* Visual Journey Stepper */}
                            <div className="bg-brand-rust/5 p-5 rounded-2xl border border-brand-warm/15 space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text-mid/70 flex items-center gap-2">
                                        <span className="h-px w-2 bg-brand-rust/30"></span>
                                        Current Journey
                                    </span>
                                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize border ${
                                        ['cancelled', 'damaged', 'held'].includes(data.status)
                                            ? 'text-red-700 bg-red-50 border-red-200'
                                            : 'text-brand-rust bg-brand-rust/10 border-brand-rust/20'
                                    }`}>
                                        {data.status.replace(/_/g, ' ')}
                                    </span>
                                </div>

                                <div className="relative flex items-center justify-between w-full mt-2">
                                    {/* Background Line */}
                                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-brand-warm/20 z-0"></div>

                                    {/* Active Progress Line */}
                                    <div 
                                         className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-brand-rust transition-all duration-500 z-0"
                                         style={{ 
                                             width: `${(() => {
                                                 const currentStepIdx = STEPPER_STEPS.findIndex(s => s.key === selectedStepKey);
                                                 return currentStepIdx === -1 ? 0 : (currentStepIdx / (STEPPER_STEPS.length - 1)) * 100;
                                             })()}%` 
                                         }}
                                    ></div>

                                    {/* Step Dots */}
                                    {STEPPER_STEPS.map((step, index) => {
                                        const currentStepIdx = STEPPER_STEPS.findIndex(s => s.key === selectedStepKey);
                                        const isCompleted = currentStepIdx !== -1 && index < currentStepIdx;
                                        const isCurrent = currentStepIdx !== -1 && index === currentStepIdx;

                                        return (
                                            <div key={step.key} className="relative z-10 flex flex-col items-center">
                                                <div 
                                                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[8px] font-bold transition-all duration-300 ${
                                                        isCompleted 
                                                            ? "bg-brand-rust border-brand-rust text-white shadow-sm"
                                                            : isCurrent
                                                                ? "bg-white border-brand-rust text-brand-rust ring-4 ring-brand-rust/15 scale-110"
                                                                : "bg-white border-brand-warm/30 text-brand-text-mid/40"
                                                    }`}
                                                >
                                                    {isCompleted ? (
                                                        <svg className="size-3 stroke-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                        </svg>
                                                    ) : (
                                                        <span>{index + 1}</span>
                                                    )}
                                                </div>

                                                {/* Step Label */}
                                                <div className="absolute top-7 flex flex-col items-center">
                                                    <span 
                                                        className={`text-[8px] font-bold tracking-tight whitespace-nowrap ${
                                                            isCurrent 
                                                                ? "text-brand-rust font-extrabold"
                                                                : isCompleted
                                                                    ? "text-brand-text font-semibold"
                                                                    : "text-brand-text-mid/50"
                                                        }`}
                                                    >
                                                        {step.label}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="h-4"></div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="booking_id" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Booking Reference</Label>
                                <select
                                    id="booking_id"
                                    title="Select Booking Reference"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all"
                                    value={data.booking_id}
                                    onChange={(e) =>
                                        setData('booking_id', e.target.value)
                                    }
                                >
                                    {bookings.map((booking) => (
                                        <option key={booking.id} value={booking.id}>
                                            {booking.reference_number} - {booking.sender.first_name} {booking.sender.last_name}
                                        </option>
                                    ))}
                                </select>
                                {errors.booking_id && (
                                    <p className="text-sm text-red-500 font-medium ml-1">{errors.booking_id}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="status" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Status</Label>
                                <select
                                    id="status"
                                    title="Select status"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all"
                                    value={selectedStepKey}
                                    onChange={(e) =>
                                        handleStatusChange(e.target.value)
                                    }
                                >
                                    {(() => {
                                        const dynamicOptions = tracking_steps?.map((step: any) => ({
                                            value: step.key,
                                            system_status: step.system_status,
                                            label: step.label,
                                        })) || [];

                                        const exceptionOptions = [
                                            { value: 'cancelled', system_status: 'cancelled', label: 'Cancelled' },
                                            { value: 'damaged', system_status: 'damaged', label: 'Damaged' },
                                            { value: 'held', system_status: 'held', label: 'Held' },
                                        ];

                                        const allOptions = [...dynamicOptions, ...exceptionOptions];

                                        const getSystemStatusForValue = (val: string) => {
                                            const opt = allOptions.find(o => o.value === val);
                                            return opt ? opt.system_status : val;
                                        };

                                        return allOptions.map((opt) => (
                                            <option 
                                                key={opt.value} 
                                                value={opt.value} 
                                                disabled={isStatusDisabled(box.status, getSystemStatusForValue(opt.value))}
                                            >
                                                {opt.label}
                                            </option>
                                        ));
                                    })()}
                                </select>
                                {errors.status && (
                                    <p className="text-sm text-red-500 font-medium ml-1">{errors.status}</p>
                                )}
                            </div>

                            {(() => {
                                const currentOrder = getStepOrder(box.status);
                                const newOrder = getStepOrder(selectedStepKey);
                                const skippedSteps = tracking_steps?.filter((s: any) => s.order > currentOrder && s.order < newOrder) || [];
                                
                                if (skippedSteps.length === 0 || !['admin', 'super_admin'].includes(auth?.user?.role)) return null;
                                
                                return (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-amber-800 animate-in fade-in duration-300">
                                        <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
                                        <div className="space-y-1">
                                            <span className="text-xs font-bold uppercase tracking-wider">Bypassing Milestones</span>
                                            <p className="text-xs leading-relaxed font-medium">
                                                Warning: You are skipping {skippedSteps.length} journey step(s): {' '}
                                                <span className="font-bold underline">{skippedSteps.map((s: any) => s.label).join(', ')}</span>.
                                                These skipped steps will not be recorded in the tracking history.
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {requiresDeliveryOverride && (
                                <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <Label htmlFor="admin_delivery_override_reason" className="text-[10px] font-bold uppercase tracking-widest text-amber-800 ml-1">
                                        Admin Delivery Proof Override Reason
                                    </Label>
                                    <p className="text-xs font-medium text-amber-700">
                                        This box is missing delivery proof photo/file. Add a reason to mark it delivered anyway.
                                    </p>
                                    <textarea
                                        id="admin_delivery_override_reason"
                                        className="min-h-28 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all"
                                        value={data.admin_delivery_override_reason}
                                        onChange={(e) => setData('admin_delivery_override_reason', e.target.value)}
                                        placeholder="Example: Recipient confirmed delivery by phone; proof will be attached later."
                                    />
                                    {errors.admin_delivery_override_reason && (
                                        <p className="text-sm text-red-500 font-medium ml-1">{errors.admin_delivery_override_reason}</p>
                                    )}
                                </div>
                            )}

                            {['admin', 'super_admin'].includes(auth?.user?.role) && (
                                <div className="space-y-4 rounded-2xl border border-brand-warm/20 bg-brand-warm/5 p-4">
                                    {/* ETA Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-start space-x-2">
                                            <Checkbox
                                                id="update_eta"
                                                checked={data.update_eta}
                                                onCheckedChange={(checked) => setData('update_eta', !!checked)}
                                                className="mt-0.5"
                                            />
                                            <div className="space-y-0.5">
                                                <Label htmlFor="update_eta" className="text-xs font-bold text-brand-text cursor-pointer block">
                                                    Update ETA/Estimated Time Arrival (Visible to Customer)
                                                </Label>
                                                <p className="text-[11px] text-brand-text-mid/70 font-normal">
                                                    Recommended when box is in transit or loaded to container.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {data.update_eta && (
                                            <div className="pl-6 animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="eta_date" className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text-mid/70 ml-1">
                                                        Estimated Time of Arrival
                                                    </Label>
                                                    <input
                                                        type="date"
                                                        id="eta_date"
                                                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand-rust/20 focus:outline-none transition-all"
                                                        value={data.eta_date}
                                                        onChange={(e) => setData('eta_date', e.target.value)}
                                                    />
                                                    {errors.eta_date && (
                                                        <p className="text-sm text-red-500 font-medium ml-1">{errors.eta_date}</p>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="eta_message" className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text-mid/70 ml-1">
                                                        Message to Customer
                                                    </Label>
                                                    <textarea
                                                        id="eta_message"
                                                        className="min-h-16 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand-rust/20 focus:outline-none transition-all"
                                                        value={data.eta_message}
                                                        onChange={(e) => setData('eta_message', e.target.value)}
                                                    />
                                                    {errors.eta_message && (
                                                        <p className="text-sm text-red-500 font-medium ml-1">{errors.eta_message}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Estimate Delivery Section */}
                                    <div className="space-y-3 pt-4 border-t border-brand-warm/10">
                                        <div className="flex items-start space-x-2">
                                            <Checkbox
                                                id="update_estimate_delivery"
                                                checked={data.update_estimate_delivery}
                                                onCheckedChange={(checked) => setData('update_estimate_delivery', !!checked)}
                                                className="mt-0.5"
                                            />
                                            <div className="space-y-0.5">
                                                <Label htmlFor="update_estimate_delivery" className="text-xs font-bold text-brand-text cursor-pointer block">
                                                    Update Estimate Delivery (Visible to Customer)
                                                </Label>
                                                <p className="text-[11px] text-brand-text-mid/70 font-normal">
                                                    Recommended when box is out for delivery or near destination.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {data.update_estimate_delivery && (
                                            <div className="pl-6 animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="estimate_delivery_date" className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text-mid/70 ml-1">
                                                        Will be delivered on or before
                                                    </Label>
                                                    <input
                                                        type="date"
                                                        id="estimate_delivery_date"
                                                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand-rust/20 focus:outline-none transition-all"
                                                        value={data.estimate_delivery_date}
                                                        onChange={(e) => setData('estimate_delivery_date', e.target.value)}
                                                    />
                                                    {errors.estimate_delivery_date && (
                                                        <p className="text-sm text-red-500 font-medium ml-1">{errors.estimate_delivery_date}</p>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="estimate_delivery_message" className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text-mid/70 ml-1">
                                                        Message to Customer
                                                    </Label>
                                                    <textarea
                                                        id="estimate_delivery_message"
                                                        className="min-h-16 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand-rust/20 focus:outline-none transition-all"
                                                        value={data.estimate_delivery_message}
                                                        onChange={(e) => setData('estimate_delivery_message', e.target.value)}
                                                    />
                                                    {errors.estimate_delivery_message && (
                                                        <p className="text-sm text-red-500 font-medium ml-1">{errors.estimate_delivery_message}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="courier_notes" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Courier Notes</Label>
                                <textarea
                                    id="courier_notes"
                                    className="min-h-32 w-full rounded-md border border-input bg-brand-sand/10 px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all"
                                    value={data.courier_notes}
                                    onChange={(e) =>
                                        setData('courier_notes', e.target.value)
                                    }
                                    placeholder="Fragile, handle with care..."
                                />
                                {errors.courier_notes && (
                                    <p className="text-sm text-red-500 font-medium ml-1">{errors.courier_notes}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 border-t border-brand-warm/10 pt-10">
                            <Link href="/admin/boxes" className="btn-outline px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95">
                                Cancel
                            </Link>
                            <Button
                                type="submit"
                                disabled={processing}
                                variant="success"
                                className="flex items-center gap-3 px-10 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                <Save className="size-4" />
                                Update Box
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </AppLayout>
    );
}
