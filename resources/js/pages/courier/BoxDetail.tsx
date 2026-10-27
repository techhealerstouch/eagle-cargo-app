import { Head, useForm, usePage } from '@inertiajs/react';
import { Clock, ArrowUpCircle, CheckCircle, Truck, Warehouse, MapPin, X, Phone, MessageSquare, Eraser, Navigation, Camera, Loader2, Edit3, UserCheck, ShieldCheck } from 'lucide-react';
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

    const defaultRecipientName = box.recipient?.name ||
        [box.recipient?.first_name, box.recipient?.last_name].filter(Boolean).join(' ') || '';

    const { data, setData, post, processing, errors } = useForm({
        _method: 'put',
        tracking_step_key: trackingSteps.length > 0 ? trackingSteps[0].key : '',
        courier_notes: '',
        recipient_name: defaultRecipientName,
        recipient_relationship: 'Consignee (Self)',
        recipient_id_type: 'National ID (PhilSys)',
        recipient_id_number: '',
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
                <div className="card p-8 bg-white/70 backdrop-blur-xl dark:bg-zinc-900/50">
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
                    <DialogContent className="w-[94vw] sm:max-w-4xl lg:max-w-5xl p-0 border-none bg-transparent shadow-none ring-0 focus:ring-0 overflow-y-auto overflow-x-hidden max-h-[92vh] custom-scrollbar [&>button]:hidden">
                        <DialogTitle className="sr-only">Tracking Console</DialogTitle>
                        <DialogDescription className="sr-only">Update tracking state for this box</DialogDescription>
                        <div className={`card relative border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-10 lg:p-12 shadow-2xl transition-all duration-500 overflow-hidden rounded-3xl ${
                            data.tracking_step_key === 'delivered' ? 'ring-8 ring-emerald-500/10 border-emerald-500' :
                            data.tracking_step_key === 'cancelled' ? 'ring-8 ring-rose-500/10 border-rose-500' :
                            'ring-8 ring-slate-100 dark:ring-slate-800/40'
                        }`}>
                            {/* Background Status Indicator */}
                            <div className="absolute -bottom-4 -right-4 text-[100px] lg:text-[140px] font-black text-slate-900/[0.02] dark:text-white/[0.02] italic font-serif pointer-events-none uppercase leading-none select-none truncate">
                                {humanize(data.tracking_step_key || box.status)}
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8 sm:mb-10">
                                    <div className="space-y-1">
                                        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                            <Navigation className="size-7 sm:size-8 text-amber-500" />
                                            Tracking Console
                                        </h3>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Logistics • Box {box.tracking_number}</p>
                                    </div>
                                    <button
                                        onClick={() => setIsConsoleOpen(false)}
                                        aria-label="Close tracking console"
                                        className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
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
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Step 1: Select Status</label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {trackingSteps?.map((step) => {
                                                        const isSelected = data.tracking_step_key === step.key;
                                                        const StepIcon = statusIcons[step.key] || ArrowUpCircle;

                                                        return (
                                                            <button
                                                                key={step.key}
                                                                type="button"
                                                                onClick={() => setData('tracking_step_key', step.key)}
                                                                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all group ${
                                                                    isSelected
                                                                        ? 'border-slate-900 dark:border-brand-primary bg-slate-900 dark:bg-brand-primary text-white shadow-xl ring-8 ring-slate-900/10 dark:ring-brand-primary/10'
                                                                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                                }`}
                                                            >
                                                                <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/20 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-xs'}`}>
                                                                    <StepIcon className="size-5 transition-transform group-hover:scale-110" />
                                                                </div>
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-left leading-tight">{step.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                             {/* POD Recipient Verification Section (Active when Delivered) */}
                                            {data.tracking_step_key === 'delivered' && (
                                                <div className="space-y-4 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20 p-4 animate-in fade-in duration-300">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                                            <UserCheck className="size-3.5 text-emerald-600" />
                                                            Step 2: Proof of Delivery (POD) Identification
                                                        </label>
                                                        {defaultRecipientName && data.recipient_name !== defaultRecipientName && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setData('recipient_name', defaultRecipientName);
                                                                    setData('recipient_relationship', 'Consignee (Self)');
                                                                }}
                                                                className="text-[9px] font-bold text-emerald-700 underline hover:text-emerald-900"
                                                            >
                                                                Reset to Consignee
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                                                                Received By (Full Name) *
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                                                                value={data.recipient_name}
                                                                onChange={(e) => setData('recipient_name', e.target.value)}
                                                                placeholder="Full name of person receiving box"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                                                                Relationship to Consignee
                                                            </label>
                                                            <select
                                                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                                                                value={data.recipient_relationship}
                                                                onChange={(e) => setData('recipient_relationship', e.target.value)}
                                                            >
                                                                <option value="Consignee (Self)">Consignee (Self / Addressee)</option>
                                                                <option value="Spouse">Spouse / Partner</option>
                                                                <option value="Parent">Parent (Mother / Father)</option>
                                                                <option value="Child">Child (Son / Daughter)</option>
                                                                <option value="Sibling">Sibling (Brother / Sister)</option>
                                                                <option value="Authorized Relative">Authorized Relative / Household</option>
                                                                <option value="House Helper / Staff">House Helper / Caretaker</option>
                                                                <option value="Building Security / Guard">Building Security / Front Desk</option>
                                                                <option value="Neighbor">Neighbor</option>
                                                                <option value="Other">Other Authorized Person</option>
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                                                                Government ID Type
                                                            </label>
                                                            <select
                                                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                                                                value={data.recipient_id_type}
                                                                onChange={(e) => setData('recipient_id_type', e.target.value)}
                                                            >
                                                                <option value="National ID (PhilSys)">National ID (PhilSys)</option>
                                                                <option value="Driver's License (LTO)">Driver's License (LTO)</option>
                                                                <option value="UMID / SSS / GSIS">UMID / SSS / GSIS</option>
                                                                <option value="Philippine Passport">Philippine Passport</option>
                                                                <option value="Postal ID / Barangay ID">Postal ID / Barangay ID</option>
                                                                <option value="Senior Citizen / PWD ID">Senior Citizen / PWD ID</option>
                                                                <option value="Company / School ID">Company / School ID</option>
                                                                <option value="Other Valid Govt ID">Other Valid Govt ID</option>
                                                                <option value="None / Verbal Confirmation">None / Verbal Confirmation</option>
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                                                                ID Number / Last 4 Digits
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                                                                value={data.recipient_id_number}
                                                                onChange={(e) => setData('recipient_id_number', e.target.value)}
                                                                placeholder="e.g. 1234 or ID number"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Step 3: Observations */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">
                                                    {data.tracking_step_key === 'delivered' ? 'Step 3: Courier Observations' : 'Step 2: Observations'}
                                                </label>
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
                                                                    ? 'bg-amber-500 dark:bg-amber-600 text-slate-950 dark:text-white border-amber-500 shadow-md font-black'
                                                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750'
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
                                                    className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-4 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-primary dark:focus:border-brand-primary focus:ring-8 focus:ring-brand-primary/10 transition-all outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Right Column: Proof & Confirmation */}
                                        <div className="lg:col-span-6 space-y-8">
                                            {/* Photo Booth */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">
                                                    {data.tracking_step_key === 'delivered' ? 'Step 4: Delivery Proof Photo' : 'Step 3: Delivery Proof'}
                                                </label>
                                                {isDeliveryStep && !hasStoredProof && (
                                                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400">A proof photo or file is required before submitting Delivered.</p>
                                                )}
                                                <div className="group relative aspect-video rounded-2xl border-4 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-slate-400 dark:hover:border-slate-600">
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
                                                                aria-label="Remove delivery proof photo"
                                                                className="absolute top-4 right-4 size-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md hover:bg-rose-600 transition-all active:scale-90"
                                                            >
                                                                <X className="size-5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-750 text-slate-800 dark:text-slate-100 shadow-md mb-3 group-hover:scale-110 transition-transform">
                                                                <Camera className="size-8 text-amber-500" />
                                                            </div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Snap Proof Photo</p>
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
                                                {errors.delivery_proof && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{errors.delivery_proof}</p>}
                                            </div>

                                            {/* Signature Pad */}
                                            {data.tracking_step_key === 'delivered' && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Step 5: Recipient Signature (Optional)</label>
                                                        <button
                                                            type="button"
                                                            onClick={clearSignature}
                                                            className="text-[9px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 hover:text-rose-700 transition-colors flex items-center gap-1"
                                                        >
                                                            <Eraser className="size-3" />
                                                            Clear
                                                        </button>
                                                    </div>
                                                    <div className="relative aspect-video rounded-[2rem] border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-inner overflow-hidden">
                                                        <canvas
                                                            ref={canvasRef}
                                                            className="h-full w-full touch-none cursor-crosshair"
                                                        />
                                                        {!data.signature && (
                                                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center opacity-30 text-slate-500 dark:text-slate-400">
                                                                <Edit3 className="size-10 mb-2" />
                                                                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Sign Record</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {errors.signature && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{errors.signature}</p>}
                                                    {!hasStoredSignature && !data.signature && (
                                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Leave blank if recipient is unavailable. Marked as unsigned by receiver.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sticky Final Submission */}
                                    <div className="absolute bottom-0 left-0 right-0 pt-6 pb-2 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-slate-900 dark:via-slate-900/95 dark:to-transparent">
                                        <button
                                            type="submit"
                                            disabled={isSubmitDisabled}
                                            className={`w-full flex items-center justify-center gap-4 px-10 py-5 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 disabled:opacity-30 ${
                                                data.tracking_step_key === 'delivered' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30' :
                                                data.tracking_step_key === 'cancelled' ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30' :
                                                'bg-slate-900 dark:bg-brand-primary text-white shadow-slate-900/30 dark:shadow-brand-primary/30'
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
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200/80 dark:border-slate-800 p-6 lg:hidden animate-in slide-in-from-bottom-full duration-500">
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



