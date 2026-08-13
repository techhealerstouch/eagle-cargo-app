import { Head, useForm, usePage } from '@inertiajs/react';
import { Clock, ArrowUpCircle, CheckCircle, Truck, Warehouse, MapPin, X, Phone, MessageSquare, Eraser, Navigation, Camera, Loader2, Edit3 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import SignaturePad from 'signature_pad';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';

import type { BreadcrumbItem } from '@/types';

const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending (Not Picked up)', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    collected: { label: 'Collected', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    received_by_branch: { label: 'At Warehouse', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    in_transit: { label: 'In Transit', color: 'text-purple-600 bg-purple-50 border-purple-200' },
    arrived: { label: 'Arrived at Destination', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
    out_for_delivery: { label: 'Out for Delivery', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    delivered: { label: 'Delivered', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    cancelled: { label: 'Cancelled', color: 'text-red-600 bg-red-50 border-red-200' },
};

const statusIcons: Record<string, any> = {
    pending: Clock,
    collected: ArrowUpCircle,
    received_by_branch: Warehouse,
    in_transit: Truck,
    arrived: MapPin,
    out_for_delivery: Truck,
    delivered: CheckCircle,
    cancelled: X,
};

export default function BoxDetail({ box, canUpdate, trackingSteps }: { box: any; canUpdate: boolean; trackingSteps: any[] }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Courier Dashboard', href: '/courier/dashboard' },
        { title: 'Scan', href: '/courier/scan' },
        { title: `Box ${box.tracking_number}`, href: '#' },
    ];

    const { flash, settings } = usePage().props as any;
    const appName = settings?.appName || 'App';
    const [isConsoleOpen, setIsConsoleOpen] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        _method: 'put',
        tracking_step_key: trackingSteps.length > 0 ? trackingSteps[0].key : '',
        courier_notes: '',
        delivery_proof: null as File | null,
        signature: '', // Base64 signature
    });

    const signaturePadRef = useRef<SignaturePad | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (!isConsoleOpen || data.tracking_step_key !== 'delivered' || !canvasRef.current) {
            return;
        }

        const canvas = canvasRef.current;
        const pad = new SignaturePad(canvas, {
            backgroundColor: 'rgba(255, 255, 255, 0)',
            penColor: 'rgb(15, 23, 42)',
        });

        const resizeCanvas = () => {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext('2d')?.scale(ratio, ratio);
            pad.clear();

            // Re-draw if there was a signature
            if (data.signature) {
                pad.fromDataURL(data.signature);
            }
        };

        const onSignatureEnd = () => {
            if (!pad.isEmpty()) {
                setData('signature', pad.toDataURL());
            }
        };

        pad.addEventListener('endStroke', onSignatureEnd);

        // Small timeout to ensure the canvas is rendered in the dialog before resizing
        const timeout = setTimeout(resizeCanvas, 200);

        signaturePadRef.current = pad;
        window.addEventListener('resize', resizeCanvas);

        return () => {
            clearTimeout(timeout);
            window.removeEventListener('resize', resizeCanvas);
            pad.removeEventListener('endStroke', onSignatureEnd);
            pad.off();
        };
    }, [isConsoleOpen, data.tracking_step_key, data.signature]);

    const clearSignature = () => {
        signaturePadRef.current?.clear();
        setData('signature', '');
    };

    useEffect(() => {
        if (flash?.success) {
            const t0 = setTimeout(() => setIsConsoleOpen(false), 0);

            return () => {
                clearTimeout(t0);
            };
        }
    }, [flash?.success]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!canUpdate) {
            return;
        }

        post(`/courier/box/${box.id}`, {
            forceFormData: true,
            onSuccess: () => {
                setData('delivery_proof', null);
                setData('signature', '');
                setIsConsoleOpen(false);
            },
        });
    };

    const StatusIcon = statusIcons[box.status] || MapPin;
    const currentStatus = statusConfig[box.status] || {
        label: box.status,
        color: 'text-gray-600 bg-gray-50 border-gray-200',
    };

    const hasStoredProof = Boolean(box.delivery_proof_path);
    const hasStoredSignature = Boolean(box.signature_path);
    const isDeliveryStep = data.tracking_step_key === 'delivered';
    const isMissingDeliveryEvidence = isDeliveryStep && (!data.delivery_proof && !hasStoredProof);
    const isSubmitDisabled = processing || !canUpdate || !data.tracking_step_key || isMissingDeliveryEvidence;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Scanned Box ${box.tracking_number}`} />

            <div className="mx-auto max-w-7xl space-y-8 px-6 py-10 pb-32 lg:px-10">
                {/* Header Section */}
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-text">
                                {box.tracking_number}
                            </h1>
                            <span className={`flex items-center gap-2 rounded-full border px-4 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${currentStatus.color}`}>
                                <StatusIcon className="size-3" />
                                {currentStatus.label}
                            </span>
                        </div>
                        <p className="text-brand-text-mid font-medium">
                            Booking Ref: <span className="font-bold text-brand-navy underline decoration-brand-secondary/50">{box.booking?.reference_number}</span>
                        </p>
                    </div>

                    <button
                        onClick={() => setIsConsoleOpen(true)}
                        disabled={!canUpdate}
                        className="btn-primary group flex items-center justify-center gap-3 px-8 py-4 shadow-md disabled:opacity-50 active:scale-95 sm:w-auto"
                    >
                        <Edit3 className="size-5 transition-transform group-hover:rotate-12" />
                        Update Tracking State
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4 rounded-xl border border-brand-sand/40 bg-white/70 p-5 shadow-xs sm:grid-cols-2">
                    <div className={`rounded-lg border p-4 ${hasStoredProof ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest">Proof Photo/File</p>
                        <p className="mt-1 text-sm font-bold">{hasStoredProof ? 'Already captured' : 'Required for delivery'}</p>
                    </div>
                    <div className={`rounded-lg border p-4 ${hasStoredSignature ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest">Recipient Signature</p>
                        <p className="mt-1 text-sm font-bold">{hasStoredSignature ? 'Already captured' : 'Unsigned by receiver'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
                    <div className="space-y-8">
                        {/* Recipient Card */}
                        <div className="card overflow-hidden border-none bg-white/70 backdrop-blur-xl transition-all hover:shadow-xl dark:bg-slate-900/50">
                    <div className="border-b border-brand-warm/20 bg-brand-warm/10 px-6 py-4">
                        <h3 className="font-serif text-lg font-bold text-brand-text flex items-center gap-2">
                            <MapPin className="size-5 text-brand-primary" />
                            Recipient Details
                        </h3>
                    </div>
                    <div className="p-8">
                        <div className="mb-6 rounded-lg bg-brand-warm/20 p-3 text-sm font-bold text-brand-navy inline-block">
                             Area: {box.recipient?.area?.name || 'Unknown'}
                        </div>
                        <div className="grid gap-8 sm:grid-cols-2">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-light mb-1">Full Name</p>
                                <p className="font-serif text-lg font-bold text-brand-text">{box.recipient?.name || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-light mb-1">Contact Number</p>
                                <p className="font-medium text-brand-text">{box.recipient?.phone_number || 'N/A'}</p>

                                <div className="mt-4 flex gap-3">
                                    <a
                                        href={`tel:${box.recipient?.phone_number}`}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-95"
                                    >
                                        <Phone className="size-4" />
                                        Call
                                    </a>
                                    <a
                                        href={`sms:${box.recipient?.phone_number}?body=Hi ${box.recipient?.name}, this is your ${appName} courier. I am on my way with your box (${box.tracking_number}).`}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-500 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-600 active:scale-95"
                                    >
                                        <MessageSquare className="size-4" />
                                        SMS
                                    </a>
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-light mb-1">Delivery Address</p>
                                <p className="font-medium leading-relaxed text-brand-text mb-4">{box.recipient?.address}, {box.recipient?.city}, {box.recipient?.province}</p>

                                <div className="flex flex-wrap gap-3">
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${box.recipient?.address}, ${box.recipient?.city}, ${box.recipient?.province}`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-3 text-sm font-bold text-white shadow-md shadow-navy/20 transition-all hover:bg-brand-primary active:scale-95"
                                    >
                                        <Navigation className="size-4" />
                                        Open Google Maps
                                    </a>
                                    <a
                                        href={`https://waze.com/ul?q=${encodeURIComponent(`${box.recipient?.address}, ${box.recipient?.city}, ${box.recipient?.province}`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 rounded-lg border-2 border-brand-warm bg-white px-5 py-3 text-sm font-bold text-brand-navy transition-all hover:bg-brand-warm/30 active:scale-95"
                                    >
                                        <div className="size-4 overflow-hidden rounded-full bg-[#33CCFF] flex items-center justify-center p-0.5">
                                            <Navigation className="size-2.5 text-white" />
                                        </div>
                                        Waze
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                <div className="card p-8 bg-white/70 backdrop-blur-xl">
                    <h3 className="font-serif text-xl font-bold text-brand-text mb-8 flex items-center gap-3">
                        <Clock className="size-6 text-brand-secondary" />
                        Tracking History
                    </h3>
                    <div className="relative space-y-0 pl-4 border-l-2 border-brand-warm ml-2">
                        {box.updates.map((update: any, idx: number) => {
                            const UpdateIcon = statusIcons[update.status] || MapPin;
                            const isFirst = idx === 0;

                            return (
                                <div key={update.id} className="relative pb-10 last:pb-0">
                                    {/* Dot */}
                                    <div className={`absolute -left-6.25 flex size-10 items-center justify-center rounded-full border-4 border-white shadow-sm ${
                                        isFirst ? 'bg-brand-secondary text-white scale-110 shadow-gold/20' : 'bg-brand-warm text-brand-navy'
                                    }`}>
                                        <UpdateIcon className="size-4" />
                                    </div>

                                    <div className="ml-6">
                                        <div className="flex flex-wrap items-center gap-3 mb-2">
                                            <span className={`text-sm font-bold uppercase tracking-widest ${isFirst ? 'text-brand-navy' : 'text-brand-text-mid'}`}>
                                                {humanize(update.status)}
                                            </span>
                                            {update.location && (
                                                <span className="rounded-full bg-brand-warm/50 px-3 py-0.5 text-[10px] font-bold text-brand-navy uppercase tracking-widest">
                                                    {update.location}
                                                </span>
                                            )}
                                            <span className="text-[10px] font-bold text-brand-text-light uppercase tracking-widest">
                                                {new Date(update.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                            </span>
                                        </div>

                                        {(update.description || update.updater) && (
                                            <div className={`rounded-md p-4 text-sm ${isFirst ? 'bg-brand-warm/30' : 'bg-gray-50'}`}>
                                                {update.description && <p className="text-brand-text font-medium leading-relaxed">{update.description}</p>}
                                                {update.updater && (
                                                    <p className={`mt-2 text-[10px] font-bold uppercase tracking-widest ${isFirst ? 'text-brand-secondary' : 'text-brand-text-light'}`}>
                                                        Logged By: {update.updater.name}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {box.updates.length === 0 && (
                            <div className="py-10 text-center">
                                <p className="font-serif text-lg text-brand-text-light">No tracking history recorded yet.</p>
                            </div>
                        )}
                    </div>
                </div>
                </div>
                </div>

                {/* Tracking Console Modal */}
                <Dialog open={isConsoleOpen} onOpenChange={setIsConsoleOpen}>
                    <DialogContent className="max-w-5xl p-6 lg:p-12 border-none bg-transparent shadow-none ring-0 focus:ring-0 overflow-y-auto overflow-x-hidden max-h-[95vh] custom-scrollbar [&>button]:hidden">
                        <DialogTitle className="sr-only">Tracking Console</DialogTitle>
                        <DialogDescription className="sr-only">Update tracking state for this box</DialogDescription>
                        <div className={`card relative border-none bg-white p-8 lg:p-14 lg:px-16 shadow-[0_0_100px_rgba(0,0,0,0.2)] transition-all duration-500 overflow-hidden ${
                            data.tracking_step_key === 'delivered' ? 'ring-8 ring-emerald-500/10' :
                            data.tracking_step_key === 'cancelled' ? 'ring-8 ring-red-500/10' :
                            'ring-8 ring-brand-navy/5'
                        }`}>
                            {/* Background Status Indicator */}
                            <div className="absolute -bottom-4 -right-4 text-[100px] lg:text-[140px] font-black text-brand-text/[0.015] italic font-serif pointer-events-none uppercase leading-none select-none truncate">
                                {humanize(data.tracking_step_key || box.status)}
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-10">
                                    <div className="space-y-1">
                                        <h3 className="font-serif text-3xl font-bold text-brand-text flex items-center gap-3">
                                            <Navigation className="size-8 text-brand-navy" />
                                            Tracking Console
                                        </h3>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Logistics • Box {box.tracking_number}</p>
                                    </div>
                                    <button
                                        onClick={() => setIsConsoleOpen(false)}
                                        className="size-10 rounded-full bg-brand-warm/50 flex items-center justify-center text-brand-text hover:bg-brand-warm transition-all"
                                    >
                                        <X className="size-5" />
                                    </button>
                                </div>

                                <form onSubmit={submit} className="relative flex flex-col h-full">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 pb-24">
                                        {/* Left Column: Logic & Observations */}
                                        <div className="lg:col-span-6 space-y-8">
                                            {/* Step 1: Quick Actions */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid ml-1">Step 1: Select Status</label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {trackingSteps?.map((step) => {
                                                        const isSelected = data.tracking_step_key === step.key;
                                                        const StepIcon = statusIcons[step.key] || ArrowUpCircle;

                                                        return (
                                                            <button
                                                                key={step.key}
                                                                type="button"
                                                                onClick={() => setData('tracking_step_key', step.key)}
                                                                className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all group ${
                                                                    isSelected
                                                                        ? 'border-brand-navy bg-brand-navy text-white shadow-md ring-4 ring-brand-navy/10'
                                                                        : 'border-brand-sand/20 bg-brand-warm/10 text-brand-text hover:border-brand-navy/30 hover:bg-white'
                                                                }`}
                                                            >
                                                                <div className={`p-2 rounded-md ${isSelected ? 'bg-brand-secondary/20 text-brand-secondary' : 'bg-white text-brand-text-mid shadow-xs'}`}>
                                                                    <StepIcon className="size-5 transition-transform group-hover:scale-110" />
                                                                </div>
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-left leading-tight">{step.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Step 2: Observations */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid ml-1">Step 2: Observations</label>
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {[
                                                        { label: 'Recipient Not Home', icon: '🏠' },
                                                        { label: 'Left with Security', icon: '🛡️' },
                                                        { label: 'Package Damaged', icon: '📦' },
                                                        { label: 'Phone Unreachable', icon: '📵' },
                                                        { label: 'Address Found', icon: '📍' },
                                                    ].map((chip) => (
                                                        <button
                                                            key={chip.label}
                                                            type="button"
                                                            onClick={() => setData('courier_notes', chip.label)}
                                                            className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                                                                data.courier_notes === chip.label
                                                                    ? 'bg-brand-secondary text-white border-brand-secondary shadow-md'
                                                                    : 'bg-brand-warm/30 border-brand-sand/20 text-brand-text hover:bg-brand-warm'
                                                            }`}
                                                        >
                                                            <span className="mr-1.5">{chip.icon}</span>
                                                            {chip.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                <textarea
                                                    value={data.courier_notes}
                                                    onChange={(e) => setData('courier_notes', e.target.value)}
                                                    placeholder="Add custom delivery observations..."
                                                    rows={2}
                                                    className="w-full rounded-lg border-2 border-brand-sand/30 bg-brand-warm/10 p-4 text-sm font-medium focus:border-brand-navy focus:ring-4 focus:ring-brand-navy/5 transition-all outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Right Column: Proof & Confirmation */}
                                        <div className="lg:col-span-6 space-y-8">
                                            {/* Photo Booth */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid ml-1">Step 3: Delivery Proof</label>
                                                {isDeliveryStep && !hasStoredProof && (
                                                    <p className="text-xs font-bold text-amber-700">A proof photo or file is required before submitting Delivered.</p>
                                                )}
                                                <div className="group relative aspect-video rounded-xl border-4 border-dashed border-brand-sand/50 bg-brand-warm/10 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-brand-navy/30">
                                                    {data.delivery_proof ? (
                                                        <div className="relative w-full h-full">
                                                            <img
                                                                src={URL.createObjectURL(data.delivery_proof)}
                                                                className="w-full h-full object-cover"
                                                                alt="Preview"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setData('delivery_proof', null)}
                                                                title="Remove delivery proof photo"
                                                                className="absolute top-4 right-4 size-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-all active:scale-90"
                                                            >
                                                                <X className="size-5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="p-4 rounded-lg bg-white shadow-xs mb-3 group-hover:scale-110 transition-transform">
                                                                <Camera className="size-8 text-brand-navy" />
                                                            </div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-text">Snap Proof Photo</p>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={(e) => setData('delivery_proof', e.target.files?.[0] || null)}
                                                                aria-label="Upload delivery proof photo"
                                                                title="Upload delivery proof photo"
                                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                                {errors.delivery_proof && <p className="text-xs font-bold text-red-600">{errors.delivery_proof}</p>}
                                            </div>

                                            {/* Signature Pad */}
                                            {data.tracking_step_key === 'delivered' && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid ml-1">Step 4: Recipient Signature (Optional)</label>
                                                        <button
                                                            type="button"
                                                            onClick={clearSignature}
                                                            className="text-[9px] font-black uppercase tracking-widest text-brand-rust hover:text-red-600 transition-colors flex items-center gap-1"
                                                        >
                                                            <Eraser className="size-3" />
                                                            Clear
                                                        </button>
                                                    </div>
                                                    <div className="relative aspect-video rounded-[2rem] border-2 border-brand-sand bg-white shadow-inner overflow-hidden">
                                                        <canvas
                                                            ref={canvasRef}
                                                            className="h-full w-full touch-none cursor-crosshair"
                                                        />
                                                        {!data.signature && (
                                                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center opacity-20">
                                                                <Edit3 className="size-10 mb-2" />
                                                                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Sign Record</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {errors.signature && <p className="text-xs font-bold text-red-600">{errors.signature}</p>}
                                                    {!hasStoredSignature && !data.signature && (
                                                        <p className="text-xs font-bold text-slate-500">Leave blank if recipient is unavailable. Marked as unsigned by receiver.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sticky Final Submission */}
                                    <div className="absolute bottom-0 left-0 right-0 pt-6 pb-2 bg-gradient-to-t from-white via-white/90 to-transparent">
                                        <button
                                            type="submit"
                                            disabled={isSubmitDisabled}
                                            className={`w-full flex items-center justify-center gap-4 px-10 py-5 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 disabled:opacity-30 ${
                                                data.tracking_step_key === 'delivered' ? 'bg-emerald-600 text-white shadow-emerald-600/30' :
                                                data.tracking_step_key === 'cancelled' ? 'bg-red-600 text-white shadow-red-600/30' :
                                                'bg-brand-navy text-white shadow-brand-navy/30'
                                            }`}
                                        >
                                            {processing ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle className="size-5" />}
                                            {processing ? 'Synchronizing...' : 'Submit Tracking Update'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Sticky Mobile Action Bar */}
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-2xl border-t border-brand-sand/30 p-6 lg:hidden animate-in slide-in-from-bottom-full duration-500">
                    <button
                        onClick={() => setIsConsoleOpen(true)}
                        disabled={!canUpdate}
                        className="w-full btn-primary flex items-center justify-center gap-3 py-5 rounded-[2rem] shadow-2xl shadow-brand-navy/20 disabled:opacity-50"
                    >
                        <Edit3 className="size-5" />
                        Update Tracking State
                    </button>
                </div>
            </div>
        </AppLayout>
    );
}



