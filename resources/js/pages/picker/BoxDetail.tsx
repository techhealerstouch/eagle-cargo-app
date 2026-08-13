import { Head, Link, useForm, usePage, router } from '@inertiajs/react';
import { Clock, ArrowUpCircle, CheckCircle, Truck, Warehouse, MapPin, X, Banknote, ShieldAlert, Camera, Loader2, Navigation, Edit3, FileText, Hash } from 'lucide-react';
import { useState, useEffect } from 'react';
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

interface BoxDetailProps {
    box: any;
    canUpdate: boolean;
    activeRunsheetId?: number;
    trackingSteps: any[];
    invoiceSettings: any;
    senderSnapshot: any;
    bookingSnapshot: any;
    lineItemsSnapshot: any[];
    adminTeamSnapshot: any;
    availableSerialNumbers: string[];
}

export default function BoxDetail({
    box,
    canUpdate,
    activeRunsheetId,
    trackingSteps,
    availableSerialNumbers = [],
}: BoxDetailProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Picker Dashboard', href: '/picker/dashboard' },
        { title: 'Scan', href: '/picker/scan' },
        { title: `Box ${box.tracking_number}`, href: '#' },
    ];

    const { flash } = usePage().props as any;
    const [showSuccess, setShowSuccess] = useState(false);

    const [isConsoleOpen, setIsConsoleOpen] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        _method: 'put',
        tracking_step_key: trackingSteps.length > 0 ? trackingSteps[0].key : '',
        courier_notes: '',
        pickup_proof: null as File | null,
        serial_number: box.serial_number || '',
    });

    const { data: uploadData, setData: setUploadData, post: uploadPost, processing: uploadProcessing, reset: uploadReset } = useForm({
        _method: 'post',
        declaration_form: null as File | null,
    });

    useEffect(() => {
        if (flash?.success) {
            const t0 = setTimeout(() => setIsConsoleOpen(false), 0);
            const t1 = setTimeout(() => setShowSuccess(true), 0);
            const t2 = setTimeout(() => setShowSuccess(false), 3000);

            return () => {
                clearTimeout(t0);
                clearTimeout(t1);
                clearTimeout(t2);
            };
        }
    }, [flash?.success]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!canUpdate) {
            return;
        }

        post(`/picker/box/${box.id}`, {
            forceFormData: true,
            onSuccess: () => {
                setData('pickup_proof', null);
                setIsConsoleOpen(false);
            },
        });
    };

    const submitDeclaration = (e: React.FormEvent) => {
        e.preventDefault();

        if (!canUpdate || !uploadData.declaration_form) {
return;
}

        uploadPost(`/picker/box/${box.id}/upload-declaration`, {
            forceFormData: true,
            onSuccess: () => {
                uploadReset();
            },
        });
    };

    const StatusIcon = statusIcons[box.status] || MapPin;
    const currentStatus = statusConfig[box.status] || {
        label: box.status,
        color: 'text-gray-600 bg-gray-50 border-gray-200',
    };

    const isPaymentDue = !['paid', 'cash_collected'].includes(box.booking?.payment_status);
    const isCashCollected = box.booking?.payment_status === 'cash_collected';
    const hasTransitionableSteps = trackingSteps && trackingSteps.length > 0;
    const canUpdateTracking = canUpdate && !isPaymentDue && hasTransitionableSteps;
    const hasStoredProof = Boolean(box.pickup_proof_path);
    const hasStoredSignature = Boolean(box.signature_path);

    const totalAmount = box.booking?.boxes?.reduce(
        (sum: number, b: any) => sum + parseFloat(b.price_charged || 0),
        0
    ) || 0;



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
                        disabled={!canUpdateTracking}
                        className="btn-primary group flex items-center justify-center gap-3 px-8 py-4 shadow-xl disabled:opacity-50 active:scale-95 sm:w-auto"
                    >
                        <Edit3 className="size-5 transition-transform group-hover:rotate-12" />
                        Update Tracking Status
                    </button>
                </div>

                {/* Missing Declaration Alert (below header to avoid crowding on desktops) */}
                {box.booking?.declaration_form_status === 'missing' && (
                    <div className="max-w-2xl rounded-3xl border border-orange-200 bg-orange-50 p-6 md:p-8 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-200">
                                <ShieldAlert className="size-6" />
                            </div>
                            <div className="space-y-1.5 flex-1">
                                <h3 className="font-serif text-lg font-black text-orange-900 uppercase tracking-tight">Missing Customs Declaration</h3>
                                <p className="text-sm font-bold text-orange-800/90 leading-relaxed uppercase tracking-wider">
                                    This box is missing its customs declaration.
                                </p>
                                <p className="text-xs text-orange-700/80 leading-relaxed font-medium">
                                    You can still collect this box, but it cannot be loaded into an international container until the form is submitted. The sender must fill out their declaration online, or you can upload a photo of a physical form below.
                                </p>
                            </div>
                        </div>

                        {canUpdate && (
                            <form onSubmit={submitDeclaration} className="mt-6 border-t border-orange-200/50 pt-5 space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-orange-900 ml-1">
                                        Take Photo / Upload Physical Form
                                    </label>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                        <div className="relative flex-1">
                                            {uploadData.declaration_form ? (
                                                <div className="relative rounded-xl border border-orange-200 bg-white p-3 flex items-center justify-between gap-3 shadow-sm">
                                                    <div className="flex items-center gap-3 truncate">
                                                        {uploadData.declaration_form.type.startsWith('image/') ? (
                                                            <img
                                                                src={URL.createObjectURL(uploadData.declaration_form)}
                                                                className="size-10 rounded-lg object-cover border border-orange-100 shrink-0"
                                                                alt="Preview"
                                                            />
                                                        ) : (
                                                            <div className="size-10 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                                                                <FileText className="size-5 text-orange-600" />
                                                            </div>
                                                        )}
                                                        <span className="text-xs font-bold text-orange-800 truncate">
                                                            {uploadData.declaration_form.name}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setUploadData('declaration_form', null)}
                                                        aria-label="Remove uploaded declaration form"
                                                        title="Remove uploaded declaration form"
                                                        className="size-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100 transition-all active:scale-90 shrink-0"
                                                    >
                                                        <X className="size-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <input
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        aria-label="Upload declaration form"
                                                        title="Upload declaration form"
                                                        onChange={(e) => setUploadData('declaration_form', e.target.files?.[0] || null)}
                                                        className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                                                        disabled={uploadProcessing}
                                                    />
                                                    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 border-2 border-orange-200/60 text-sm font-bold text-orange-800 hover:border-orange-400 transition-colors shadow-sm cursor-pointer">
                                                        <Camera className="size-5 shrink-0 text-orange-600" />
                                                        <span>Capture declaration photo...</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={!uploadData.declaration_form || uploadProcessing}
                                            className="btn-primary shrink-0 bg-orange-600 hover:bg-orange-700 text-white border-none py-3 px-6 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            {uploadProcessing ? <Loader2 className="size-4 animate-spin" /> : 'Upload Proof'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 rounded-3xl border border-brand-sand/40 bg-white/70 p-5 shadow-sm sm:grid-cols-2">
                    <div className={`rounded-2xl border p-4 ${hasStoredProof ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest">Pickup Proof Photo</p>
                        <p className="mt-1 text-sm font-bold">{hasStoredProof ? 'Captured' : 'Required for pickup'}</p>
                    </div>
                    <div className={`rounded-2xl border p-4 ${hasStoredSignature ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest">Recipient Signature</p>
                        <p className="mt-1 text-sm font-bold">{hasStoredSignature ? 'Captured' : 'Unsigned by receiver'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
                    <div className="space-y-8">
                        {/* Summary Card */}
                        <div className="card overflow-hidden border-none bg-white/70 backdrop-blur-xl transition-all hover:shadow-xl dark:bg-slate-900/50">
                            <div className="border-b border-brand-warm/20 bg-brand-warm/10 px-6 py-4">
                                <h3 className="font-serif text-lg font-bold text-brand-text flex items-center gap-2">
                                    <MapPin className="size-5 text-brand-primary" />
                                    Pickup Location
                                </h3>
                            </div>
                            <div className="p-8">
                                <div className="grid gap-8 sm:grid-cols-2">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-light mb-1">Sender</p>
                                        <p className="font-serif text-lg font-bold text-brand-text">
                                            {box.booking?.sender?.first_name} {box.booking?.sender?.last_name}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-light mb-1">Contact</p>
                                        <p className="font-medium text-brand-text">{box.booking?.sender?.mobile || 'N/A'}</p>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-light mb-1">Address</p>
                                        <p className="font-medium leading-relaxed text-brand-text mb-4">
                                            {box.booking?.sender
                                                ? `${box.booking.sender.address}, ${box.booking.sender.suburb}, ${box.booking.sender.state} ${box.booking.sender.postcode}`
                                                : 'No pickup address provided'}
                                        </p>

                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${box.booking?.sender?.address}, ${box.booking?.sender?.suburb}, ${box.booking?.sender?.state} ${box.booking?.sender?.postcode}`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-5 py-3 text-sm font-bold text-white shadow-lg shadow-navy/20 transition-all hover:bg-brand-primary active:scale-95"
                                        >
                                            <Navigation className="size-4" />
                                            Open Google Maps
                                        </a>

                                        {box.booking?.declaration_form_status !== 'missing' && (
                                            <a
                                                href={`/track/declaration/${box.booking.id}/view`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 rounded-xl border-2 border-brand-warm bg-white px-5 py-3 text-sm font-bold text-brand-navy transition-all hover:bg-brand-warm/30 active:scale-95"
                                            >
                                                <FileText className="size-4" />
                                                View Declaration Form
                                            </a>
                                        )}

                                        {box.booking?.invoice && (
                                            <Link
                                                href={`/admin/invoices/${box.booking.invoice.id}`}
                                                className="inline-flex items-center gap-2 rounded-xl border-2 border-emerald-500/30 bg-emerald-50/50 px-5 py-3 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-50 active:scale-95"
                                            >
                                                <FileText className="size-4" />
                                                View Invoice
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Payment Status Card (If due) */}
                        {isCashCollected && (
                            <div className="card border-none bg-emerald-50/50 backdrop-blur-xl p-8 ring-1 ring-emerald-500/30">
                                <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 shadow-inner">
                                        <CheckCircle className="size-8 text-emerald-600" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="font-serif text-xl font-bold text-emerald-900">
                                            Cash Collected — Pending Admin Confirmation
                                        </p>
                                        <p className="text-sm text-emerald-700 font-medium">
                                            You collected <strong>${totalAmount.toFixed(2)}</strong> in cash. The admin will confirm this payment. You can proceed with the pickup.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {isPaymentDue && !isCashCollected && (
                             <div className="card border-none bg-amber-50/50 backdrop-blur-xl p-8 ring-1 ring-amber-500/30">
                                <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-100 shadow-inner">
                                        <Banknote className="size-8 text-amber-600" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="font-serif text-xl font-bold text-amber-900">
                                            {box.booking?.payment_status === 'cash_on_pickup' ? 'Payment Due on Pickup' : 'Payment Outstanding'}
                                        </p>
                                        <p className="text-sm text-amber-700 font-medium">
                                            Booking is <strong>{box.booking?.payment_status === 'cash_on_pickup' ? 'Payment On Pickup' : 'Unpaid'}</strong>. You must collect <strong>${totalAmount.toFixed(2)}</strong> before proceeding.
                                        </p>
                                    </div>
                                    {activeRunsheetId && (
                                        <button
                                            type="button"
                                            onClick={() => router.get(`/picker/runsheet/${activeRunsheetId}/payment/${box.booking?.id}`)}
                                            className="w-full md:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-8 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95"
                                        >
                                            <Banknote className="size-5" />
                                            {box.booking?.payment_status === 'cash_on_pickup' ? 'Cash Collected' : 'Collect Payment'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-8">
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
                                                    <span className="text-[10px] font-bold text-brand-text-light uppercase tracking-widest">
                                                        {new Date(update.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </span>
                                                </div>

                                                {(update.description || update.updater) && (
                                                    <div className={`rounded-xl p-4 text-sm ${isFirst ? 'bg-brand-warm/30' : 'bg-gray-50'}`}>
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
                        <DialogTitle className="sr-only">Pickup Console</DialogTitle>
                        <DialogDescription className="sr-only">Update tracking status for this box</DialogDescription>
                        <div className={`card relative border-none bg-white p-8 lg:p-14 lg:px-16 shadow-[0_0_100px_rgba(0,0,0,0.2)] transition-all duration-500 overflow-hidden ${
                            data.tracking_step_key === 'collected' ? 'ring-8 ring-emerald-500/10' :
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
                                            Pickup Console
                                        </h3>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Logistics • Box {box.tracking_number}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsConsoleOpen(false)}
                                        aria-label="Close pickup console"
                                        className="size-10 rounded-full bg-brand-warm/50 flex items-center justify-center text-brand-text hover:bg-brand-warm transition-all"
                                    >
                                        <X className="size-5" />
                                    </button>
                                </div>

                                {!canUpdate && (
                                    <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/50 p-5 text-sm font-bold text-amber-800 flex items-start gap-3 backdrop-blur-sm">
                                        <ShieldAlert className="size-5 shrink-0" />
                                        <p>This box belongs to a completed runsheet. Viewing is allowed, but status updates are disabled.</p>
                                    </div>
                                )}

                                <form onSubmit={submit} className="relative flex flex-col h-full">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 pb-24">
                                        {/* Left Column: Logic & Observations */}
                                        <div className="lg:col-span-7 space-y-8">
                                            {/* Step 1: Quick Actions */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between ml-1">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid">Step 1: Select Status</label>
                                                    {data.tracking_step_key === 'collected' && (
                                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 animate-pulse">Positive Milestone</span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {trackingSteps?.map((step) => {
                                                        const isSelected = data.tracking_step_key === step.key;
                                                        const StepIcon = statusIcons[step.key] || ArrowUpCircle;

                                                        return (
                                                            <button
                                                                key={step.key}
                                                                type="button"
                                                                disabled={!canUpdateTracking}
                                                                onClick={() => setData('tracking_step_key', step.key)}
                                                                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all group ${
                                                                    isSelected
                                                                        ? (step.key === 'collected' || step.key === 'picked_up'
                                                                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-xl ring-8 ring-emerald-600/10'
                                                                            : 'border-brand-navy bg-brand-navy text-white shadow-xl ring-8 ring-brand-navy/10')
                                                                        : 'border-brand-sand/20 bg-brand-warm/10 text-brand-text hover:border-brand-navy/30 hover:bg-white'
                                                                }`}
                                                            >
                                                                <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/20 text-white' : 'bg-white text-brand-text-mid shadow-sm'}`}>
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
                                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid ml-1">Step 2: Pickup Observations</label>
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {[
                                                        { label: 'Sender Not Home', icon: '🏠', type: 'negative' },
                                                        { label: 'Box Not Ready', icon: '⏳', type: 'negative' },
                                                        { label: 'Partial Pickup', icon: '📦', type: 'neutral' },
                                                        { label: 'Incorrect Address', icon: '📍', type: 'negative' },
                                                        { label: 'Ready for Collection', icon: '✅', type: 'positive' },
                                                    ].map((chip) => {
                                                        const isNegative = chip.type === 'negative';
                                                        const isSelected = data.courier_notes === chip.label;
                                                        const isConflict = isSelected && isNegative && (data.tracking_step_key === 'collected' || data.tracking_step_key === 'picked_up');

                                                        return (
                                                            <button
                                                                key={chip.label}
                                                                type="button"
                                                                disabled={!canUpdateTracking}
                                                                onClick={() => {
                                                                    setData('courier_notes', chip.label);

                                                                    // Auto-switch to Pending if negative is clicked while Collected is active
                                                                    if (isNegative && (data.tracking_step_key === 'collected' || data.tracking_step_key === 'picked_up')) {
                                                                        toast.info(`Switched status to Pending because box is ${chip.label}`);
                                                                        setData(d => ({ ...d, courier_notes: chip.label, tracking_step_key: '' }));
                                                                    }
                                                                }}
                                                                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                                                                    isSelected
                                                                        ? (isConflict ? 'bg-red-500 border-red-500 text-white' : 'bg-brand-secondary text-white border-brand-secondary shadow-md')
                                                                        : 'bg-brand-warm/30 border-brand-sand/20 text-brand-text hover:bg-brand-warm'
                                                                } ${isConflict ? 'animate-bounce' : ''}`}
                                                            >
                                                                <span className="mr-1.5">{chip.icon}</span>
                                                                {chip.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {((data.tracking_step_key === 'collected' || data.tracking_step_key === 'picked_up') &&
                                                  (data.courier_notes.toLowerCase().includes('not ready') || data.courier_notes.toLowerCase().includes('not home'))) && (
                                                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mb-2">
                                                        <ShieldAlert className="size-3.5" />
                                                        Conflict: Cannot mark as collected if not ready/home.
                                                    </div>
                                                )}

                                                <textarea
                                                    value={data.courier_notes}
                                                    onChange={(e) => setData('courier_notes', e.target.value)}
                                                    placeholder="Add pickup observations..."
                                                    rows={2}
                                                    className={`w-full rounded-2xl border-2 p-4 text-sm font-medium transition-all outline-none ${
                                                        (data.tracking_step_key === 'collected' && (data.courier_notes.toLowerCase().includes('not ready') || data.courier_notes.toLowerCase().includes('not home')))
                                                        ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/10'
                                                        : 'border-brand-sand/30 bg-brand-warm/10 focus:border-brand-navy focus:ring-8 focus:ring-brand-navy/5'
                                                    }`}
                                                    disabled={!canUpdateTracking}
                                                />
                                            </div>
                                        </div>

                                        {/* Right Column: Evidence */}
                                        <div className="lg:col-span-5 space-y-8">
                                            {/* Step 3: Photo Booth */}
                                            <div className="space-y-4">
                                                                                <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid ml-1">Step 3: Pickup Proof Photo <span className="text-red-500">*Required</span></label>
                                                {(data.tracking_step_key === 'collected' || data.tracking_step_key === 'picked_up') && !data.pickup_proof && !hasStoredProof && (
                                                    <p className="text-xs font-bold text-red-600">A pickup proof photo is required before marking as Collected.</p>
                                                )}
                                                <div className="group relative aspect-[4/3] rounded-[2rem] border-4 border-dashed border-brand-sand/50 bg-brand-warm/10 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-brand-navy/30">
                                                    {data.pickup_proof ? (
                                                        <div className="relative w-full h-full">
                                                            <img
                                                                src={URL.createObjectURL(data.pickup_proof)}
                                                                className="w-full h-full object-cover"
                                                                alt="Preview"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setData('pickup_proof', null)}
                                                                title="Remove pickup proof photo"
                                                                aria-label="Remove pickup proof photo"
                                                                className="absolute top-4 right-4 size-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-all active:scale-90"
                                                            >
                                                                <X className="size-5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="p-4 rounded-2xl bg-white shadow-lg mb-3 group-hover:scale-110 transition-transform">
                                                                <Camera className="size-8 text-brand-navy" />
                                                            </div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-text">Snap Collection Photo</p>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                title="Upload pickup proof photo"
                                                                onChange={(e) => setData('pickup_proof', e.target.files?.[0] || null)}
                                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                                disabled={!canUpdateTracking}
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Step 4: Serial Number */}
                                            {['collected', 'picked_up'].includes(data.tracking_step_key) && (
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-mid ml-1">
                                                        Step 4: Serial Number <span className="text-red-500">*Required</span>
                                                    </label>
                                                    <div className="relative">
                                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                            <Hash className="size-4 text-brand-sand" />
                                                        </div>
                                                        <select
                                                            value={data.serial_number}
                                                            onChange={(e) => setData('serial_number', e.target.value)}
                                                            className="w-full rounded-2xl border-2 py-4 pl-10 pr-4 font-mono text-sm tracking-widest text-brand-text transition-colors focus:border-brand-primary focus:bg-white focus:outline-none focus:ring-8 focus:ring-brand-primary/5 appearance-none"
                                                            required
                                                            disabled={!canUpdateTracking}
                                                        >
                                                            <option value="" disabled>Select a serial number...</option>
                                                            {availableSerialNumbers.map((serial) => (
                                                                <option key={serial} value={serial}>
                                                                    {serial}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                                                            <svg className="size-4 text-brand-text-mid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                    {errors.serial_number && (
                                                        <p className="mt-1 text-xs font-bold text-red-600">{errors.serial_number}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sticky Final Submission */}
                                    <div className="absolute bottom-0 left-0 right-0 pt-6 pb-2 bg-gradient-to-t from-white via-white/90 to-transparent">
                                        <button
                                            type="submit"
                                            disabled={
                                                processing ||
                                                !data.tracking_step_key ||
                                                !canUpdateTracking ||
                                                ((data.tracking_step_key === 'collected' || data.tracking_step_key === 'picked_up') &&
                                                 (data.courier_notes.toLowerCase().includes('not ready') || data.courier_notes.toLowerCase().includes('not home'))) ||
                                                ((data.tracking_step_key === 'collected' || data.tracking_step_key === 'picked_up') &&
                                                 !data.pickup_proof && !hasStoredProof) ||
                                                ((data.tracking_step_key === 'collected' || data.tracking_step_key === 'picked_up') &&
                                                 !data.serial_number)
                                            }
                                            className={`w-full flex items-center justify-center gap-4 px-10 py-5 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 disabled:opacity-30 ${
                                                ['collected', 'picked_up'].includes(data.tracking_step_key) ? 'bg-emerald-600 text-white shadow-emerald-600/30' :
                                                data.tracking_step_key === 'cancelled' ? 'bg-red-600 text-white shadow-red-600/30' :
                                                'bg-brand-navy text-white shadow-brand-navy/30'
                                            }`}
                                        >
                                            {processing ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle className="size-5" />}
                                            {processing ? 'Synchronizing...' : 'Submit Pickup Update'}
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
                        disabled={!canUpdateTracking}
                        className="w-full btn-primary flex items-center justify-center gap-3 py-5 rounded-[2rem] shadow-2xl shadow-brand-navy/20 disabled:opacity-50"
                    >
                        <Edit3 className="size-5" />
                        Update Status
                    </button>
                </div>



                {/* Success Overlay */}
                {showSuccess && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
                        <div className="absolute inset-0 bg-brand-navy/10 backdrop-blur-md" />
                        <div className="relative card flex flex-col items-center gap-6 p-12 text-center shadow-[0_0_100px_rgba(0,0,0,0.1)] ring-1 ring-emerald-500/20 bg-white/95 backdrop-blur-2xl max-w-sm w-full rounded-[3rem]">
                            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-inner">
                                <CheckCircle className="size-12 animate-pulse" />
                            </div>
                            <div className="space-y-3">
                                <h2 className="font-serif text-3xl font-black text-brand-text">Success!</h2>
                                <p className="text-brand-text-mid font-bold uppercase tracking-widest text-[10px] leading-relaxed">
                                    {flash.success}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowSuccess(false)}
                                className="w-full btn-primary py-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20 active:scale-95 transition-all rounded-2xl font-black uppercase tracking-widest text-xs"
                            >
                                Continue Scanning
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
