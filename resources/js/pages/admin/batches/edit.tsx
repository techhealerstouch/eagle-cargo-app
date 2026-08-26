import { Head, useForm, Link } from '@inertiajs/react';
import {
    Save, ArrowLeft, Ship, MapPin, CalendarClock, RefreshCw, RotateCcw,
    Container, AlertTriangle, ShieldCheck, CheckCircle2,
    Package, Clock, Anchor, Box, ChevronRight, ChevronLeft, Info, Sparkles, Activity
} from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { ORIGIN_PORTS, DESTINATION_PORTS } from '@/lib/ports';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface BatchPayload {
    id: number;
    batch_number: string;
    branch_name: string | null;
    container_number: string | null;
    seal_number: string | null;
    container_size: string | null;
    vessel_name: string | null;
    shipping_line: string | null;
    voyage_number: string | null;
    origin_port: string | null;
    destination_port: string | null;
    capacity_boxes: number | null;
    capacity_cbm: number | null;
    cutoff_at: string | null;
    eta_at: string | null;
    status: string;
    override_note?: string | null;
    current_box_count?: number;
    warnings?: string[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Batches', href: '/admin/batches' },
    { title: 'Edit Batch', href: '#' },
];

const STEPS = [
    { id: 'lifecycle', title: 'Status & Lifecycle', icon: Activity, description: 'Shipment operational stage' },
    { id: 'identity', title: 'Container Identity', icon: Container, description: 'Batch ID & Container details' },
    { id: 'route', title: 'Vessel & Route', icon: Ship, description: 'Carrier and port information' },
    { id: 'schedule', title: 'Logistics Schedule', icon: CalendarClock, description: 'Cut-off and arrival dates' },
    { id: 'capacity', title: 'Load Capacity', icon: Package, description: 'Box and volume limits' },
];

function toDateTimeLocal(value: string | null): string {
    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const offset = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - offset);

    return local.toISOString().slice(0, 16);
}

export default function BatchesEdit({ batch }: { batch: BatchPayload }) {
    const [currentStep, setCurrentStep] = useState(0);

    const { data, setData, put, processing, errors } = useForm({
        batch_number: batch.batch_number,
        branch_name: batch.branch_name || '',
        container_number: batch.container_number || '',
        seal_number: batch.seal_number || '',
        container_size: batch.container_size || '40ft_hc',
        vessel_name: batch.vessel_name || '',
        shipping_line: batch.shipping_line || '',
        voyage_number: batch.voyage_number || '',
        origin_port: batch.origin_port || '',
        destination_port: batch.destination_port || '',
        capacity_boxes: batch.capacity_boxes?.toString() || '',
        capacity_cbm: batch.capacity_cbm?.toString() || '',
        cutoff_at: toDateTimeLocal(batch.cutoff_at),
        eta_at: toDateTimeLocal(batch.eta_at),
        status: batch.status || 'open',
        override_note: batch.override_note || '',
    });

    const STAGE_KEYS = ['open', 'loading', 'ready_to_close', 'sailed', 'arrived', 'delivered'];
    const originalStatusIndex = STAGE_KEYS.indexOf(batch.status || 'open');
    const newStatusIndex = STAGE_KEYS.indexOf(data.status);
    const isBackward = newStatusIndex !== -1 && originalStatusIndex !== -1 && newStatusIndex < originalStatusIndex;

    const transitDays = (() => {
        if (batch.cutoff_at && batch.eta_at) {
            const start = new Date(batch.cutoff_at);
            const end = new Date(batch.eta_at);

            return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }

        return 30;
    })();

    const isBatchEmpty = (batch.current_box_count ?? 0) === 0;

    const handleCutoffChange = (newCutoffStr: string) => {
        setData((prev) => {
            const next = { ...prev, cutoff_at: newCutoffStr };

            if (newCutoffStr) {
                const cutoffDate = new Date(newCutoffStr);
                const newEtaDate = new Date(cutoffDate);
                newEtaDate.setDate(newEtaDate.getDate() + transitDays);

                const originalEta = new Date(prev.eta_at || (batch.eta_at ? new Date(batch.eta_at) : new Date()));
                newEtaDate.setHours(originalEta.getHours(), originalEta.getMinutes());

                next.eta_at = toDateTimeLocal(newEtaDate.toISOString());
            }

            return next;
        });
    };

    const getTransitDuration = () => {
        if (!data.cutoff_at || !data.eta_at) {
            return 0;
        }

        const start = new Date(data.cutoff_at).getTime();
        const end = new Date(data.eta_at).getTime();

        return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/admin/batches/${batch.id}`);
    };

    const getStatusTimeline = () => {
        const stages = [
            { key: 'open', label: 'Open', icon: Package },
            { key: 'loading', label: 'Loading', icon: Container },
            { key: 'ready_to_close', label: 'Ready', icon: ShieldCheck },
            { key: 'sailed', label: 'Sailed', icon: Ship },
            { key: 'arrived', label: 'Arrived', icon: MapPin },
            { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
        ];

        const currentIndex = stages.findIndex((s) => s.key === data.status);

        return stages.map((stage, idx) => ({
            ...stage,
            isCompleted: idx < currentIndex,
            isActive: idx === currentIndex,
            isPending: idx > currentIndex,
        }));
    };

    const nextAction = (() => {
        const map: Record<string, any> = {
            open: { label: 'Start Loading', target: 'loading', color: 'bg-sky-600 hover:bg-sky-700' },
            loading: { label: 'Mark Ready to Close', target: 'ready_to_close', color: 'bg-amber-600 hover:bg-amber-700' },
            ready_to_close: { label: 'Confirm Sailed', target: 'sailed', color: 'bg-indigo-600 hover:bg-indigo-700' },
            sailed: { label: 'Confirm Arrival', target: 'arrived', color: 'bg-purple-600 hover:bg-purple-700' },
            arrived: { label: 'Confirm Delivered', target: 'delivered', color: 'bg-emerald-600 hover:bg-emerald-700' },
        };

        return map[data.status] || null;
    })();

    const timeline = getStatusTimeline();

    const nextStep = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit Batch ${batch.batch_number} | Admin`} />
            <div className="flex flex-col gap-6 p-8 max-w-[1600px] mx-auto w-full">
                {/* Warnings Banner */}
                {batch.warnings && batch.warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm flex gap-3 shadow-sm">
                        <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-amber-900 mb-1">Warning: Action Required</h4>
                            <p>This batch has reached capacity limits or its cut-off date has passed. Please consider closing the batch.</p>
                            <ul className="list-disc pl-5 mt-2 text-xs font-medium">
                                {batch.warnings.map((warning, i) => (
                                    <li key={i}>{warning}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-100 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/batches"
                            className="rounded-xl p-2.5 bg-white border border-zinc-200 text-zinc-500 transition-all hover:bg-zinc-50 hover:text-zinc-900 shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Heading
                                eyebrow="Consolidated Shipping"
                                title="Edit Batch"
                                description="Update shipment metadata, capacities, and lifecycle status."
                            />
                            <span className="rounded-xl bg-sky-50 px-3.5 py-1.5 font-mono text-xs font-bold text-sky-900 border border-sky-200/60 shadow-sm flex items-center gap-2 max-w-[220px] truncate" title={data.batch_number}>
                                <RefreshCw className="size-3.5 text-sky-600 shrink-0" />
                                <span className="truncate">{data.batch_number}</span>
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={processing}
                            className="h-11 px-6 rounded-xl bg-sky-600 text-white text-xs font-semibold uppercase tracking-wide shadow-md shadow-sky-600/10 transition-all hover:bg-sky-700 active:scale-[0.98] flex items-center gap-2"
                        >
                            {processing ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                            {processing ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Stepper Navigation */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-sm">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-5 px-1.5">
                                Batch Settings
                            </h3>
                            <nav className="flex flex-col gap-1.5">
                                {STEPS.map((step, idx) => (
                                    <button
                                        key={step.id}
                                        type="button"
                                        onClick={() => setCurrentStep(idx)}
                                        className={cn(
                                            'group flex items-center gap-3.5 p-3 rounded-xl transition-all text-left border',
                                            currentStep === idx
                                                ? 'bg-sky-50/70 border-sky-100/80 shadow-sm'
                                                : 'hover:bg-zinc-50/80 border-transparent'
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'flex size-9 shrink-0 items-center justify-center rounded-lg transition-all',
                                                currentStep === idx
                                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/10'
                                                    : 'bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200'
                                            )}
                                        >
                                            <step.icon className="size-4.5" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span
                                                className={cn(
                                                    'text-xs font-semibold transition-colors',
                                                    currentStep === idx ? 'text-sky-900 font-bold' : 'text-zinc-600'
                                                )}
                                            >
                                                {step.title}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 truncate">
                                                {step.description}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Form Area */}
                    <div className="lg:col-span-6">
                        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm min-h-[600px] flex flex-col">
                            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-7 rounded-md bg-sky-600 flex items-center justify-center text-white shadow-sm">
                                        {(() => {
                                            const Icon = STEPS[currentStep].icon;
                                            return <Icon className="size-4" />;
                                        })()}
                                    </div>
                                    <h2 className="font-sans text-sm font-semibold text-zinc-950">
                                        {STEPS[currentStep].title}
                                    </h2>
                                </div>
                                <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200/40">
                                    Section {currentStep + 1} of {STEPS.length}
                                </span>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 md:p-8 flex-1 flex flex-col">
                                <div className="flex-1">
                                    {/* Step 0: Status & Lifecycle */}
                                    {currentStep === 0 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-semibold text-zinc-700">
                                                    Shipment Lifecycle
                                                </Label>
                                                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100 px-3 py-1 rounded-full uppercase tracking-wider">
                                                    Current: {data.status.replace('_', ' ')}
                                                </span>
                                            </div>

                                            {/* Status Progress Pipeline */}
                                            <div className="grid grid-cols-6 gap-2 relative py-4">
                                                <div className="absolute top-9 left-4 right-4 h-0.5 bg-zinc-200 -z-0" />
                                                {timeline.map((stage) => (
                                                    <div key={stage.key} className="relative z-10 flex flex-col items-center gap-2">
                                                        <div
                                                            className={cn(
                                                                'size-10 rounded-xl flex items-center justify-center transition-all shadow-sm',
                                                                stage.isActive
                                                                    ? 'bg-sky-600 text-white ring-4 ring-sky-600/10 scale-105'
                                                                    : stage.isCompleted
                                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                                                    : 'bg-white border border-zinc-200 text-zinc-400'
                                                            )}
                                                        >
                                                            <stage.icon className="size-4.5" />
                                                        </div>
                                                        <span
                                                            className={cn(
                                                                'text-[10px] font-semibold tracking-tight text-center',
                                                                stage.isActive ? 'text-sky-900 font-bold' : 'text-zinc-500'
                                                            )}
                                                        >
                                                            {stage.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Update Status Action Box */}
                                            <div className="bg-zinc-50/80 rounded-2xl p-6 border border-zinc-200/80 space-y-4">
                                                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                                    <div className="space-y-0.5">
                                                        <h4 className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                                                            <Clock className="size-4 text-sky-600" />
                                                            Update Status
                                                        </h4>
                                                        <p className="text-[11px] text-zinc-500">
                                                            Transition this shipment to its next operational milestone.
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                                        <select
                                                            id="status"
                                                            title="Select status"
                                                            value={data.status}
                                                            onChange={(e) => setData('status', e.target.value)}
                                                            className="flex h-11 w-full md:w-44 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-900 shadow-sm focus:ring-2 focus:ring-sky-100 outline-none"
                                                        >
                                                            <option value="open">Open</option>
                                                            <option value="loading">Loading</option>
                                                            <option value="ready_to_close" disabled={isBatchEmpty}>Ready to Close</option>
                                                            <option value="sailed" disabled={isBatchEmpty}>Sailed</option>
                                                            <option value="arrived" disabled={isBatchEmpty}>Arrived</option>
                                                            <option value="delivered" disabled={isBatchEmpty}>Delivered</option>
                                                        </select>

                                                        {nextAction && data.status === batch.status && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setData('status', nextAction.target)}
                                                                className={cn(
                                                                    nextAction.color,
                                                                    'text-white px-4 h-11 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2 transition-all whitespace-nowrap active:scale-[0.98]'
                                                                )}
                                                            >
                                                                {nextAction.label}
                                                                <CheckCircle2 className="size-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {data.status === 'ready_to_close' && (
                                                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                                                        <AlertTriangle className="size-4.5 text-amber-600 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="text-xs font-bold text-amber-900">Conditional Transition</p>
                                                            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                                                                The system will automatically revert this to <strong className="font-semibold">Loading</strong> if the batch has not yet reached its capacity limit or passed its cut-off date.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {(data.status === 'open' || data.status === 'loading') && ['ready_to_close', 'sailed', 'arrived', 'delivered'].includes(batch.status) && (
                                                    <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-4">
                                                        <RotateCcw className="size-4.5 text-sky-600 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="text-xs font-bold text-sky-900">Reopening Batch</p>
                                                            <p className="text-[11px] text-sky-800 mt-0.5 leading-relaxed">
                                                                Setting status to <strong className="font-semibold">{data.status === 'open' ? 'Open' : 'Loading'}</strong> will reopen this batch for box modifications and reset sailing/arrival timestamps.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {isBatchEmpty && (
                                                    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 p-4">
                                                        <AlertTriangle className="size-4.5 text-red-600 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="text-xs font-bold text-red-900">Empty Batch</p>
                                                            <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
                                                                This batch contains no boxes. You must assign at least one box before it can be closed or manifested.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {isBackward && (
                                                    <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4 animate-in fade-in slide-in-from-top-2">
                                                        <div className="flex items-start gap-3">
                                                            <AlertTriangle className="size-4.5 text-rose-600 mt-0.5 shrink-0" />
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <p className="text-xs font-bold text-rose-900">Backward Status Override Required</p>
                                                                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                                                                        {batch.status.replace(/_/g, ' ')} → {data.status.replace(/_/g, ' ')}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                                                                    You are moving this batch backwards in its lifecycle. Please provide a mandatory justification for auditing purposes.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="pl-7 w-full">
                                                            <textarea
                                                                required={isBackward}
                                                                value={data.override_note}
                                                                onChange={(e) => setData('override_note', e.target.value)}
                                                                className="w-full min-h-[80px] text-sm rounded-xl border-rose-200 bg-white placeholder:text-rose-300 focus:border-rose-400 focus:ring-rose-400/20 resize-none p-3 shadow-sm"
                                                                placeholder="Reason for overriding status..."
                                                            />
                                                            {errors.override_note && (
                                                                <p className="text-[11px] font-semibold text-red-600 mt-1.5 uppercase tracking-wider">
                                                                    {errors.override_note}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 1: Container Identity */}
                                    {currentStep === 1 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="grid grid-cols-1 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="batch_number" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Batch ID Number <span className="text-sky-600 font-normal">(Last segment max 4 digits)</span>
                                                    </Label>
                                                    <div className="relative group">
                                                        <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-sky-500" />
                                                        <Input
                                                            disabled={processing}
                                                            id="batch_number"
                                                            value={data.batch_number}
                                                            onChange={(e) => {
                                                                let val = e.target.value;
                                                                const parts = val.split('-');
                                                                if (parts.length >= 3) {
                                                                    parts[parts.length - 1] = parts[parts.length - 1].slice(0, 4);
                                                                    val = parts.join('-');
                                                                }
                                                                setData('batch_number', val);
                                                            }}
                                                            className="h-11 rounded-xl border-zinc-200 pl-10 font-mono text-sm font-semibold focus:ring-sky-100/50"
                                                            placeholder="e.g. LBB-2608-0001"
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 ml-0.5 flex items-center gap-1.5">
                                                        <Info className="size-3 text-zinc-400" /> Admin override allowed. Max 4 digits after final hyphen (e.g. LBB-2609-0001).
                                                    </p>
                                                    {errors.batch_number && (
                                                        <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                            {errors.batch_number}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="branch_name" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Branch Name (Optional)
                                                    </Label>
                                                    <Input
                                                        disabled={processing}
                                                        id="branch_name"
                                                        value={data.branch_name}
                                                        onChange={(e) => setData('branch_name', e.target.value)}
                                                        className="h-11 rounded-xl border-zinc-200 text-sm font-medium"
                                                        placeholder="e.g. Sydney North"
                                                    />
                                                    {errors.branch_name && (
                                                        <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                            {errors.branch_name}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="container_number" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Container Reference
                                                        </Label>
                                                        <div className="relative">
                                                            <Container className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                                            <Input
                                                                disabled={processing}
                                                                id="container_number"
                                                                value={data.container_number}
                                                                onChange={(e) => setData('container_number', e.target.value)}
                                                                className="h-11 rounded-xl border-zinc-200 pl-10"
                                                                placeholder="e.g. MSCU1234567"
                                                            />
                                                        </div>
                                                        {errors.container_number && (
                                                            <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                                {errors.container_number}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="seal_number" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Seal Number
                                                        </Label>
                                                        <div className="relative">
                                                            <Anchor className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                                            <Input
                                                                disabled={processing}
                                                                id="seal_number"
                                                                value={data.seal_number}
                                                                onChange={(e) => setData('seal_number', e.target.value)}
                                                                className="h-11 rounded-xl border-zinc-200 pl-10"
                                                                placeholder="Shipping line seal #"
                                                            />
                                                        </div>
                                                        {errors.seal_number && (
                                                            <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                                {errors.seal_number}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="container_size" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Container Size
                                                    </Label>
                                                    <Select
                                                        disabled={processing}
                                                        value={data.container_size}
                                                        onValueChange={(value) => setData('container_size', value)}
                                                    >
                                                        <SelectTrigger className="w-full h-11 rounded-xl border-zinc-200 text-sm font-medium text-zinc-900 px-4">
                                                            <SelectValue placeholder="Select size" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-zinc-200">
                                                            <SelectItem value="20ft" className="rounded-lg py-2 px-3">20ft Standard</SelectItem>
                                                            <SelectItem value="40ft" className="rounded-lg py-2 px-3">40ft Standard</SelectItem>
                                                            <SelectItem value="40ft_hc" className="rounded-lg py-2 px-3">40ft High Cube</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {errors.container_size && (
                                                        <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                            {errors.container_size}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 2: Vessel & Route */}
                                    {currentStep === 2 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="grid grid-cols-1 gap-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="vessel_name" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Vessel Name
                                                        </Label>
                                                        <div className="relative">
                                                            <Ship className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                                            <Input
                                                                disabled={processing}
                                                                id="vessel_name"
                                                                value={data.vessel_name}
                                                                onChange={(e) => setData('vessel_name', e.target.value)}
                                                                className="h-11 rounded-xl border-zinc-200 pl-10 font-medium"
                                                                placeholder="Enter vessel name"
                                                            />
                                                        </div>
                                                        {errors.vessel_name && (
                                                            <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                                {errors.vessel_name}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="shipping_line" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Shipping Line
                                                        </Label>
                                                        <div className="relative">
                                                            <Anchor className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                                            <Input
                                                                disabled={processing}
                                                                id="shipping_line"
                                                                value={data.shipping_line}
                                                                onChange={(e) => setData('shipping_line', e.target.value)}
                                                                className="h-11 rounded-xl border-zinc-200 pl-10 font-medium"
                                                                placeholder="Carrier name"
                                                            />
                                                        </div>
                                                        {errors.shipping_line && (
                                                            <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                                {errors.shipping_line}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="voyage_number" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Voyage Number
                                                    </Label>
                                                    <Input
                                                        disabled={processing}
                                                        id="voyage_number"
                                                        value={data.voyage_number}
                                                        onChange={(e) => setData('voyage_number', e.target.value)}
                                                        className="h-11 rounded-xl border-zinc-200 font-mono text-sm font-medium"
                                                        placeholder="Voyage ID"
                                                    />
                                                    {errors.voyage_number && (
                                                        <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                            {errors.voyage_number}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="origin_port" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Origin Port
                                                        </Label>
                                                        <Select
                                                            disabled={processing}
                                                            value={data.origin_port || ''}
                                                            onValueChange={(value) => setData('origin_port', value)}
                                                        >
                                                            <SelectTrigger className="h-11 w-full rounded-xl border-zinc-200 text-sm font-medium text-zinc-900 px-4">
                                                                <div className="flex items-center gap-2">
                                                                    <MapPin className="size-4 text-emerald-500" />
                                                                    <SelectValue placeholder="Select origin port" />
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl border-zinc-200">
                                                                {ORIGIN_PORTS.map((port) => (
                                                                    <SelectItem key={port} value={port} className="rounded-lg py-2 px-3">
                                                                        {port}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        {errors.origin_port && (
                                                            <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                                {errors.origin_port}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="destination_port" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Destination Port
                                                        </Label>
                                                        <Select
                                                            disabled={processing}
                                                            value={data.destination_port || ''}
                                                            onValueChange={(value) => setData('destination_port', value)}
                                                        >
                                                            <SelectTrigger className="h-11 w-full rounded-xl border-zinc-200 text-sm font-medium text-zinc-900 px-4">
                                                                <div className="flex items-center gap-2">
                                                                    <MapPin className="size-4 text-amber-500" />
                                                                    <SelectValue placeholder="Select destination port" />
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl border-zinc-200">
                                                                {DESTINATION_PORTS.map((port) => (
                                                                    <SelectItem key={port} value={port} className="rounded-lg py-2 px-3">
                                                                        {port}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        {errors.destination_port && (
                                                            <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                                {errors.destination_port}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 3: Logistics Schedule */}
                                    {currentStep === 3 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="grid grid-cols-1 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="cutoff_at" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Cut-off Date & Time
                                                    </Label>
                                                    <div className="relative">
                                                        <CalendarClock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-sky-500" />
                                                        <Input
                                                            disabled={processing}
                                                            id="cutoff_at"
                                                            type="datetime-local"
                                                            value={data.cutoff_at}
                                                            onChange={(e) => handleCutoffChange(e.target.value)}
                                                            className="h-11 rounded-xl border-zinc-200 pl-10 font-medium text-sm"
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 ml-0.5 font-normal italic">
                                                        Last date for boxes to be received at the warehouse for this batch.
                                                    </p>
                                                    {errors.cutoff_at && (
                                                        <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                            {errors.cutoff_at}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between ml-0.5">
                                                        <Label htmlFor="eta_at" className="text-xs font-semibold text-zinc-700">
                                                            Estimated Arrival (ETA)
                                                        </Label>
                                                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100/60 shadow-sm">
                                                            {getTransitDuration()} Day Transit
                                                        </span>
                                                    </div>
                                                    <div className="relative">
                                                        <CalendarClock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                                                        <Input
                                                            disabled={processing}
                                                            id="eta_at"
                                                            type="datetime-local"
                                                            min={data.cutoff_at}
                                                            value={data.eta_at}
                                                            onChange={(e) => setData('eta_at', e.target.value)}
                                                            className="h-11 rounded-xl border-zinc-200 pl-10 font-medium text-sm"
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 ml-0.5 font-normal italic">
                                                        Auto-calculated based on {transitDays}-day standard transit duration.
                                                    </p>
                                                    {errors.eta_at && (
                                                        <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                            {errors.eta_at}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 4: Load Capacity */}
                                    {currentStep === 4 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="grid grid-cols-1 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="capacity_boxes" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Total Box Capacity
                                                    </Label>
                                                    <div className="relative">
                                                        <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-sky-500" />
                                                        <Input
                                                            disabled={processing}
                                                            id="capacity_boxes"
                                                            type="number"
                                                            min="1"
                                                            value={data.capacity_boxes}
                                                            onChange={(e) => setData('capacity_boxes', e.target.value)}
                                                            className="h-11 rounded-xl border-zinc-200 pl-10 text-sm font-medium"
                                                            placeholder="340"
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                                                            Boxes
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 ml-0.5 font-normal italic">
                                                        Approx. capacity for a {data.container_size.replace('_', ' ')} container.
                                                    </p>
                                                    {errors.capacity_boxes && (
                                                        <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                            {errors.capacity_boxes}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="capacity_cbm" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Volume (CBM)
                                                    </Label>
                                                    <div className="relative">
                                                        <Box className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                                        <Input
                                                            disabled={processing}
                                                            id="capacity_cbm"
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            value={data.capacity_cbm}
                                                            onChange={(e) => setData('capacity_cbm', e.target.value)}
                                                            className="h-11 rounded-xl border-zinc-200 pl-10 font-medium text-sm"
                                                        />
                                                    </div>
                                                    {errors.capacity_cbm && (
                                                        <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">
                                                            {errors.capacity_cbm}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Form Action Controls */}
                                <div className="flex justify-between items-center gap-4 pt-6 border-t border-zinc-100 mt-6">
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        disabled={currentStep === 0}
                                        className={cn(
                                            'h-11 px-5 flex items-center justify-center rounded-xl border border-zinc-200 text-xs font-semibold uppercase tracking-wide transition-all',
                                            currentStep === 0
                                                ? 'opacity-0 pointer-events-none'
                                                : 'hover:bg-zinc-50 active:scale-[0.98]'
                                        )}
                                    >
                                        <ChevronLeft className="size-4 mr-1.5" /> Back
                                    </button>

                                    <div className="flex items-center gap-3">
                                        {currentStep < STEPS.length - 1 && (
                                            <button
                                                type="button"
                                                onClick={nextStep}
                                                className="h-11 px-6 flex items-center justify-center rounded-xl bg-zinc-950 text-white text-xs font-semibold uppercase tracking-wide transition-all hover:bg-zinc-800 active:scale-[0.98]"
                                            >
                                                Next <ChevronRight className="size-4 ml-1.5" />
                                            </button>
                                        )}

                                        <Button
                                            type="submit"
                                            disabled={processing}
                                            className="h-11 px-8 rounded-xl bg-sky-600 text-white text-xs font-semibold uppercase tracking-wide shadow-md shadow-sky-600/10 transition-all hover:bg-sky-700 active:scale-[0.98] flex items-center gap-2"
                                        >
                                            {processing ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                                            {processing ? 'Processing...' : 'Update Shipment'}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Sidebar Manifest Preview */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-slate-950/98 backdrop-blur-md rounded-2xl p-6 text-white border border-slate-800/85 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500">
                                <Ship className="size-24" />
                            </div>

                            <div className="relative space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Batch Status & Manifest
                                    </h4>
                                    <span className="size-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Batch Number
                                    </p>
                                    <h3 className="font-mono text-lg font-bold tracking-tight text-white break-all leading-tight">
                                        {data.batch_number || batch.batch_number}
                                    </h3>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400 mt-1">
                                        Status: {data.status.replace('_', ' ')}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                            Container
                                        </p>
                                        <p className="text-xs font-semibold text-slate-200 truncate">
                                            {data.container_number || 'TBA'}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                                            Size
                                        </p>
                                        <p className="text-xs font-semibold text-slate-200 uppercase">
                                            {data.container_size.replace('_', ' ')}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-5 border-t border-slate-900/60">
                                    <div className="relative pl-6 space-y-4 pt-0.5">
                                        <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-slate-900">
                                            <div
                                                className={cn(
                                                    'w-full bg-gradient-to-b from-emerald-500 to-amber-500 transition-all duration-700 ease-in-out',
                                                    data.origin_port && data.destination_port
                                                        ? 'h-full'
                                                        : data.origin_port
                                                        ? 'h-1/2'
                                                        : 'h-0'
                                                )}
                                            />
                                        </div>

                                        <div className="relative flex gap-3 items-start">
                                            <div
                                                className={cn(
                                                    'absolute -left-[23px] mt-1 size-3 rounded-full border transition-all duration-500',
                                                    data.origin_port
                                                        ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                                        : 'bg-slate-950 border-slate-800'
                                                )}
                                            />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                                                    Origin Port
                                                </span>
                                                <span
                                                    className={cn(
                                                        'text-xs font-semibold truncate transition-colors duration-300',
                                                        data.origin_port ? 'text-slate-200' : 'text-slate-500 italic'
                                                    )}
                                                >
                                                    {data.origin_port || 'Pending Origin...'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="relative flex gap-3 items-start">
                                            <div
                                                className={cn(
                                                    'absolute -left-[23px] mt-1 size-3 rounded-full border transition-all duration-500',
                                                    data.destination_port
                                                        ? 'bg-amber-500 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                                        : 'bg-slate-950 border-slate-800'
                                                )}
                                            />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                                                    Destination Port
                                                </span>
                                                <span
                                                    className={cn(
                                                        'text-xs font-semibold truncate transition-colors duration-300',
                                                        data.destination_port ? 'text-slate-200' : 'text-slate-500 italic'
                                                    )}
                                                >
                                                    {data.destination_port || 'Pending Destination...'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-5 border-t border-slate-900/60 grid grid-cols-2 gap-3">
                                    <div className="bg-slate-900/40 border border-slate-900/50 p-2.5 rounded-xl">
                                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                                            Capacity
                                        </p>
                                        <p className="text-xs font-bold text-slate-200">
                                            <span className="text-sky-400 font-extrabold mr-0.5">
                                                {data.capacity_boxes || '0'}
                                            </span>{' '}
                                            Boxes
                                        </p>
                                    </div>
                                    <div className="bg-slate-900/40 border border-slate-900/50 p-2.5 rounded-xl">
                                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                                            Transit
                                        </p>
                                        <p className="text-xs font-bold text-slate-200">
                                            <span className="text-emerald-400 font-extrabold mr-0.5">
                                                {getTransitDuration()}
                                            </span>{' '}
                                            Days
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-3.5">
                                <div className="p-2 bg-white rounded-lg shadow-sm border border-zinc-200/40">
                                    <Sparkles className="size-4 text-amber-500" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs font-semibold text-zinc-800">Quick Tip</p>
                                    <p className="text-[10px] text-zinc-500 leading-relaxed font-normal">
                                        Changes made to dates or ports will automatically reflect across active box updates and manifests.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

