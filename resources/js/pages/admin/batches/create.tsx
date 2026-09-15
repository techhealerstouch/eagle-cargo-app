import { Head, useForm, Link } from '@inertiajs/react';
import { Save, ArrowLeft, Layers, Ship, MapPin, CalendarClock, Package, Scale, Route, Anchor, Box, Container, Sparkles, Copy, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import Heading from '@/components/common/heading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { ORIGIN_PORTS, DESTINATION_PORTS } from '@/lib/ports';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Batches', href: '/admin/batches' },
    { title: 'Create Batch', href: '#' },
];

function toDateTimeLocal(date: Date): string {
    const offset = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - offset);

    return local.toISOString().slice(0, 16);
}

const STEPS = [
    { id: 'identity', title: 'Container Identity', icon: Container, description: 'Batch & Container details' },
    { id: 'route', title: 'Vessel & Route', icon: Ship, description: 'Carrier and port information' },
    { id: 'schedule', title: 'Logistics Schedule', icon: CalendarClock, description: 'Cut-off and arrival dates' },
    { id: 'capacity', title: 'Load Capacity', icon: Package, description: 'Box and weight limits' },
];

export default function BatchesCreate({ templateBatch }: { templateBatch?: any }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [visitedSteps, setVisitedSteps] = useState<number[]>([0]);
    const [uniqueWarnings, setUniqueWarnings] = useState<Record<string, string>>({});
    const [checkingUnique, setCheckingUnique] = useState<Record<string, boolean>>({});
    const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const checkUnique = useCallback((field: string, value: string) => {
        if (debounceTimers.current[field]) {
            clearTimeout(debounceTimers.current[field]);
        }
        if (!value || value.trim() === '') {
            setUniqueWarnings(prev => { const next = { ...prev }; delete next[field]; return next; });
            setCheckingUnique(prev => ({ ...prev, [field]: false }));
            return;
        }
        setCheckingUnique(prev => ({ ...prev, [field]: true }));
        debounceTimers.current[field] = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ field, value });
                const res = await fetch(`/admin/batches/check-unique?${params}`);
                if (!res.ok) return;
                const result = await res.json();
                setUniqueWarnings(prev => {
                    if (!result.available) {
                        const label = field.replace(/_/g, ' ');
                        return { ...prev, [field]: `This ${label} is already assigned to another batch.` };
                    }
                    const next = { ...prev };
                    delete next[field];
                    return next;
                });
            } catch {
                // Server-side validation will catch it on submit
            } finally {
                setCheckingUnique(prev => ({ ...prev, [field]: false }));
            }
        }, 500);
    }, []);

    const getDefaultDates = () => {
        const cutoff = new Date();

        if (templateBatch?.cutoff_at) {
            const tDate = new Date(templateBatch.cutoff_at);
            cutoff.setFullYear(tDate.getFullYear(), tDate.getMonth() + 1, tDate.getDate());
        } else {
            cutoff.setMonth(cutoff.getMonth() + 1);
        }

        cutoff.setHours(17, 0, 0, 0);

        const eta = new Date(cutoff);
        eta.setMonth(eta.getMonth() + 1);
        eta.setHours(9, 0, 0, 0);

        return {
            cutoff: toDateTimeLocal(cutoff),
            eta: toDateTimeLocal(eta)
        };
    };

    const initialDates = getDefaultDates();

    const getInitialTransitDays = () => {
        if (templateBatch?.cutoff_at && templateBatch?.eta_at) {
            const start = new Date(templateBatch.cutoff_at);
            const end = new Date(templateBatch.eta_at);

            return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }

        return 30;
    };

    const transitDays = getInitialTransitDays();

    const { data, setData, post, processing, errors, clearErrors } = useForm({
        batch_number: '',
        branch_name: templateBatch?.branch_name ?? '',
        container_number: '',
        seal_number: '',
        container_size: templateBatch?.container_size ?? '40ft_hc',
        vessel_name: templateBatch?.vessel_name ?? '',
        shipping_line: templateBatch?.shipping_line ?? '',
        voyage_number: templateBatch?.voyage_number ?? '',
        origin_port: templateBatch?.origin_port ?? '',
        destination_port: templateBatch?.destination_port ?? '',
        capacity_boxes: templateBatch?.capacity_boxes ?? '',
        capacity_cbm: templateBatch?.capacity_cbm ?? '',
        cutoff_at: initialDates.cutoff,
        eta_at: initialDates.eta,
        status: 'open',
    });

    const handleCutoffChange = (newCutoffStr: string) => {
        setData((prev) => {
            const next = { ...prev, cutoff_at: newCutoffStr };

            if (newCutoffStr) {
                const cutoffDate = new Date(newCutoffStr);
                const newEtaDate = new Date(cutoffDate);
                newEtaDate.setDate(newEtaDate.getDate() + transitDays);
                const originalEta = new Date(prev.eta_at);
                newEtaDate.setHours(originalEta.getHours(), originalEta.getMinutes());
                next.eta_at = toDateTimeLocal(newEtaDate);
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

    const getStepUnsatisfiedReason = useCallback((step: number): string | null => {
        if (step === 0) {
            if (checkingUnique.container_number || checkingUnique.seal_number || checkingUnique.batch_number) {
                return 'Verifying uniqueness of reference numbers...';
            }
            if (uniqueWarnings.container_number) return uniqueWarnings.container_number;
            if (uniqueWarnings.seal_number) return uniqueWarnings.seal_number;
            if (uniqueWarnings.batch_number) return uniqueWarnings.batch_number;
            if (!data.container_size) return 'Please select a container size.';
            if (data.batch_number && !/^(?:.*-[a-zA-Z0-9]{1,4}|[a-zA-Z0-9]{1,4})$/.test(data.batch_number)) {
                return 'Batch number sequence segment cannot exceed 4 digits (e.g. LBB-2609-0001).';
            }
            if (errors.container_number) return errors.container_number;
            if (errors.seal_number) return errors.seal_number;
            if (errors.batch_number) return errors.batch_number;
            if (errors.container_size) return errors.container_size;
            return null;
        }
        if (step === 1) {
            if (!data.shipping_line?.trim()) return 'Shipping line is required.';
            if (!data.origin_port) return 'Origin port is required.';
            if (!data.destination_port) return 'Destination port is required.';
            if (data.origin_port === data.destination_port) return 'Origin and destination ports cannot be the same.';
            if (errors.shipping_line) return errors.shipping_line;
            if (errors.origin_port) return errors.origin_port;
            if (errors.destination_port) return errors.destination_port;
            if (errors.vessel_name) return errors.vessel_name;
            if (errors.voyage_number) return errors.voyage_number;
            return null;
        }
        if (step === 2) {
            if (!data.cutoff_at) return 'Cut-off date is required.';
            if (!data.eta_at) return 'Estimated arrival date (ETA) is required.';
            if (new Date(data.eta_at) < new Date(data.cutoff_at)) {
                return 'Estimated arrival date cannot be earlier than cut-off date.';
            }
            if (errors.cutoff_at) return errors.cutoff_at;
            if (errors.eta_at) return errors.eta_at;
            return null;
        }
        if (step === 3) {
            if (!data.capacity_boxes || Number(data.capacity_boxes) < 1) {
                return 'Total box capacity must be at least 1 box.';
            }
            if (errors.capacity_boxes) return errors.capacity_boxes;
            if (errors.capacity_cbm) return errors.capacity_cbm;
            return null;
        }
        return null;
    }, [data, uniqueWarnings, checkingUnique, errors]);

    const isStepSatisfied = useCallback((step: number): boolean => {
        return getStepUnsatisfiedReason(step) === null;
    }, [getStepUnsatisfiedReason]);

    const canProceedCurrentStep = isStepSatisfied(currentStep);

    const canNavigateToStep = useCallback((targetIdx: number): boolean => {
        if (targetIdx <= currentStep) return true;
        for (let i = 0; i < targetIdx; i++) {
            if (!isStepSatisfied(i)) return false;
        }
        return true;
    }, [currentStep, isStepSatisfied]);

    const isStepDone = useCallback((idx: number): boolean => {
        if (!isStepSatisfied(idx)) return false;
        for (let i = 0; i <= idx; i++) {
            if (!isStepSatisfied(i)) return false;
        }
        return idx < currentStep || visitedSteps.includes(idx);
    }, [isStepSatisfied, currentStep, visitedSteps]);

    const allStepsSatisfied = useMemo(() => {
        return [0, 1, 2, 3].every(idx => isStepSatisfied(idx));
    }, [isStepSatisfied]);

    useEffect(() => {
        if (!templateBatch) {
            const defaults: Record<string, any> = {
                '20ft': { boxes: 160, cbm: 33 },
                '40ft': { boxes: 320, cbm: 67 },
                '40ft_hc': { boxes: 340, cbm: 76 }
            };

            if (defaults[data.container_size]) {
                const d = defaults[data.container_size];

                if (!data.capacity_boxes) {
                    setData('capacity_boxes', d.boxes);
                }

                if (!data.capacity_cbm) {
                    setData('capacity_cbm', d.cbm);
                }
            }
        }
    }, [data.container_size]);

    const getPreviewBatchNumber = () => {
        const prefix = 'LBB';
        const date = data.cutoff_at ? new Date(data.cutoff_at) : new Date();
        const yy = date.getFullYear().toString().slice(-2);
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');

        return `${prefix}-${yy}${mm}-###`;
    };

    const nextStep = () => {
        if (!canProceedCurrentStep) {
            const reason = getStepUnsatisfiedReason(currentStep);
            toast.error('Cannot proceed', {
                description: reason || 'Please satisfy all required fields on this step before continuing.',
            });
            return;
        }
        if (currentStep < STEPS.length - 1) {
            const next = currentStep + 1;
            setCurrentStep(next);
            setVisitedSteps(prev => prev.includes(next) ? prev : [...prev, next]);
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        for (let i = 0; i < STEPS.length; i++) {
            if (!isStepSatisfied(i)) {
                setCurrentStep(i);
                const reason = getStepUnsatisfiedReason(i);
                toast.error(`Cannot submit: Step ${i + 1} (${STEPS[i].title}) is incomplete`, {
                    description: reason || 'Please resolve all required fields and warnings.',
                });
                return;
            }
        }

        if (Object.keys(uniqueWarnings).length > 0) {
            toast.error('Cannot submit', { description: 'Please resolve uniqueness warnings before initializing the batch.' });
            return;
        }

        if (Object.values(checkingUnique).some(Boolean)) {
            toast.error('Please wait', { description: 'Reference numbers are still being validated.' });
            return;
        }

        post('/admin/batches', {
            onError: (formErrors) => {
                const firstError = Object.values(formErrors)[0];
                if (firstError) {
                    toast.error('Validation failed', { description: firstError as string });
                }
                // Auto-navigate to the step containing the first error
                if (formErrors.batch_number || formErrors.container_number || formErrors.seal_number || formErrors.container_size || formErrors.branch_name) {
                    setCurrentStep(0);
                } else if (formErrors.vessel_name || formErrors.shipping_line || formErrors.voyage_number || formErrors.origin_port || formErrors.destination_port) {
                    setCurrentStep(1);
                } else if (formErrors.cutoff_at || formErrors.eta_at) {
                    setCurrentStep(2);
                } else if (formErrors.capacity_boxes || formErrors.capacity_cbm) {
                    setCurrentStep(3);
                }
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={templateBatch ? "Initialize Next Batch" : "Plan New Shipment"} />
            <div className="flex flex-col gap-6 p-8 max-w-[1600px] mx-auto w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-100 pb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/batches" className="rounded-xl p-2.5 bg-white border border-zinc-200 text-zinc-500 transition-all hover:bg-zinc-50 hover:text-zinc-900 shadow-sm">
                            <ArrowLeft className="size-5" />
                        </Link>
                        <Heading
                            eyebrow={templateBatch ? "Operational Continuity" : "Global Logistics"}
                            title={templateBatch ? "Initialize Next Batch" : "Plan New Shipment"}
                            description={templateBatch
                                ? "Carry over route and configuration for the upcoming shipment cycle."
                                : "Define container specifications, transit routes, and scheduling for a new consolidated batch."
                            }
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Stepper Navigation */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-sm">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-5 px-1.5">Setup Progress</h3>
                            <nav className="flex flex-col gap-1.5">
                                {STEPS.map((step, idx) => {
                                    const isClickable = canNavigateToStep(idx);
                                    const isCurrent = currentStep === idx;
                                    const isComplete = isStepDone(idx);
                                    const hasError = !isStepSatisfied(idx) && visitedSteps.includes(idx);

                                    return (
                                        <button
                                            key={step.id}
                                            type="button"
                                            disabled={!isClickable}
                                            onClick={() => {
                                                if (isClickable) {
                                                    setCurrentStep(idx);
                                                    setVisitedSteps(prev => prev.includes(idx) ? prev : [...prev, idx]);
                                                } else {
                                                    const reason = getStepUnsatisfiedReason(currentStep);
                                                    toast.error('Cannot navigate forward', {
                                                        description: reason || `Please complete the current step (${STEPS[currentStep].title}) before moving ahead.`,
                                                    });
                                                }
                                            }}
                                            className={cn(
                                                "group flex items-center gap-3.5 p-3 rounded-xl transition-all text-left border w-full",
                                                isCurrent
                                                    ? "bg-sky-50/70 border-sky-100/80 shadow-sm"
                                                    : isClickable
                                                        ? "hover:bg-zinc-50/80 border-transparent cursor-pointer"
                                                        : "border-transparent opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <div className={cn(
                                                "flex size-9 shrink-0 items-center justify-center rounded-lg transition-all",
                                                isCurrent
                                                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/10"
                                                    : isComplete
                                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100/40"
                                                        : hasError
                                                            ? "bg-amber-50 text-amber-600 border border-amber-200/60"
                                                            : "bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200"
                                            )}>
                                                {isComplete && !isCurrent ? (
                                                    <CheckCircle2 className="size-4.5" />
                                                ) : hasError && !isCurrent ? (
                                                    <AlertCircle className="size-4.5 text-amber-600" />
                                                ) : (
                                                    <step.icon className="size-4.5" />
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className={cn(
                                                    "text-xs font-semibold transition-colors",
                                                    isCurrent ? "text-sky-900 font-bold" : "text-zinc-600"
                                                )}>
                                                    {step.title}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 truncate">
                                                    {step.description}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {templateBatch && (
                            <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-5">
                                <div className="flex items-center gap-2 text-sky-600 mb-2">
                                    <Copy className="size-3.5" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Template Source</span>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-mono font-bold text-sky-900">{templateBatch.batch_number}</p>
                                    <p className="text-[10px] text-sky-700 font-medium leading-normal">Vessel, voyage, route, shipping line, and capacity details imported. Please verify or specify Container and Seal numbers before saving.</p>
                                </div>
                            </div>
                        )}
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
                                    <h2 className="font-sans text-sm font-semibold text-zinc-950">{STEPS[currentStep].title}</h2>
                                </div>
                                <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200/40">
                                    Step {currentStep + 1} of 4
                                </span>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 md:p-8 flex-1 flex flex-col">
                                <div className="flex-1">
                                    {currentStep === 0 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="grid grid-cols-1 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="batch_number" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Batch ID Preview <span className="text-zinc-400 font-normal">(Optional)</span>
                                                    </Label>
                                                    <div className="relative group">
                                                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                                            <span className="text-xs font-bold text-zinc-400">#</span>
                                                        </div>
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
                                                                clearErrors('batch_number');
                                                                checkUnique('batch_number', val);
                                                            }}
                                                            className={cn("h-11 rounded-xl border-zinc-200 pl-8 pr-10 font-mono text-sm font-medium focus:ring-sky-100/50", uniqueWarnings.batch_number && "border-amber-400 focus:ring-amber-100/50")}
                                                            placeholder={getPreviewBatchNumber()}
                                                        />
                                                        {checkingUnique.batch_number && (
                                                            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400 animate-spin" />
                                                        )}
                                                        {!checkingUnique.batch_number && data.batch_number && !uniqueWarnings.batch_number && (
                                                            <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                                                        )}
                                                        {!checkingUnique.batch_number && uniqueWarnings.batch_number && (
                                                            <AlertCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-amber-500" />
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 ml-0.5 flex items-center gap-1.5 font-normal">
                                                        <Info className="size-3 text-zinc-400" /> Leave blank to auto-generate, or enter custom ID (max 4 digits on sequence).
                                                    </p>
                                                    {errors.batch_number && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.batch_number}</p>}
                                                    {uniqueWarnings.batch_number && !errors.batch_number && (
                                                        <p className="text-[11px] font-semibold text-amber-600 ml-0.5 mt-1 flex items-center gap-1">
                                                            <AlertCircle className="size-3 shrink-0" />
                                                            {uniqueWarnings.batch_number}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="branch_name" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Branch Name <span className="text-zinc-400 font-normal">(Optional)</span>
                                                    </Label>
                                                    <Input
                                                        disabled={processing}
                                                        id="branch_name"
                                                        value={data.branch_name}
                                                        onChange={(e) => { setData('branch_name', e.target.value); clearErrors('branch_name'); }}
                                                        className="h-11 rounded-xl border-zinc-200 text-sm font-medium"
                                                        placeholder="e.g. Sydney North"
                                                    />
                                                    {errors.branch_name && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.branch_name}</p>}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="container_number" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Container Reference <span className="text-zinc-400 font-normal">(Optional)</span>
                                                        </Label>
                                                        <div className="relative">
                                                            <Container className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                                            <Input disabled={processing} id="container_number" value={data.container_number} onChange={(e) => { setData('container_number', e.target.value); clearErrors('container_number'); checkUnique('container_number', e.target.value); }} className={cn("h-11 rounded-xl border-zinc-200 pl-10 pr-10", uniqueWarnings.container_number && "border-amber-400 focus:ring-amber-100/50")} placeholder="e.g. MSCU1234567" />
                                                            {checkingUnique.container_number && (
                                                                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400 animate-spin" />
                                                            )}
                                                            {!checkingUnique.container_number && data.container_number && !uniqueWarnings.container_number && (
                                                                <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                                                            )}
                                                            {!checkingUnique.container_number && uniqueWarnings.container_number && (
                                                                <AlertCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-amber-500" />
                                                            )}
                                                        </div>
                                                        {errors.container_number && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.container_number}</p>}
                                                        {uniqueWarnings.container_number && !errors.container_number && (
                                                            <p className="text-[11px] font-semibold text-amber-600 ml-0.5 mt-1 flex items-center gap-1">
                                                                <AlertCircle className="size-3 shrink-0" />
                                                                {uniqueWarnings.container_number}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="seal_number" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Seal Number <span className="text-zinc-400 font-normal">(Optional)</span>
                                                        </Label>
                                                        <div className="relative">
                                                            <Anchor className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                                            <Input disabled={processing} id="seal_number" value={data.seal_number} onChange={(e) => { setData('seal_number', e.target.value); clearErrors('seal_number'); checkUnique('seal_number', e.target.value); }} className={cn("h-11 rounded-xl border-zinc-200 pl-10 pr-10", uniqueWarnings.seal_number && "border-amber-400 focus:ring-amber-100/50")} placeholder="Shipping line seal #" />
                                                            {checkingUnique.seal_number && (
                                                                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400 animate-spin" />
                                                            )}
                                                            {!checkingUnique.seal_number && data.seal_number && !uniqueWarnings.seal_number && (
                                                                <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                                                            )}
                                                            {!checkingUnique.seal_number && uniqueWarnings.seal_number && (
                                                                <AlertCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-amber-500" />
                                                            )}
                                                        </div>
                                                        {errors.seal_number && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.seal_number}</p>}
                                                        {uniqueWarnings.seal_number && !errors.seal_number && (
                                                            <p className="text-[11px] font-semibold text-amber-600 ml-0.5 mt-1 flex items-center gap-1">
                                                                <AlertCircle className="size-3 shrink-0" />
                                                                {uniqueWarnings.seal_number}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="container_size" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Container Size <span className="text-red-500 ml-0.5">*</span>
                                                    </Label>
                                                    <Select disabled={processing} value={data.container_size} onValueChange={(value) => { setData('container_size', value); clearErrors('container_size'); }}>
                                                        <SelectTrigger className="w-full h-11 rounded-xl border-zinc-200 text-sm font-medium text-zinc-900 px-4">
                                                            <SelectValue placeholder="Select size" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-zinc-200">
                                                            <SelectItem value="20ft" className="rounded-lg py-2 px-3">20ft Standard</SelectItem>
                                                            <SelectItem value="40ft" className="rounded-lg py-2 px-3">40ft Standard</SelectItem>
                                                            <SelectItem value="40ft_hc" className="rounded-lg py-2 px-3">40ft High Cube</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {errors.container_size && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.container_size}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 1 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="grid grid-cols-1 gap-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="vessel_name" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Vessel Name <span className="text-zinc-400 font-normal">(Optional)</span>
                                                        </Label>
                                                        <div className="relative">
                                                            <Ship className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                                            <Input disabled={processing} id="vessel_name" value={data.vessel_name} onChange={(e) => { setData('vessel_name', e.target.value); clearErrors('vessel_name'); }} className="h-11 rounded-xl border-zinc-200 pl-10 font-medium" placeholder="Enter vessel name" />
                                                        </div>
                                                        {errors.vessel_name && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.vessel_name}</p>}
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="shipping_line" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Shipping Line <span className="text-red-500 ml-0.5">*</span>
                                                        </Label>
                                                        <div className="relative">
                                                            <Anchor className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                                            <Input required disabled={processing} id="shipping_line" value={data.shipping_line} onChange={(e) => { setData('shipping_line', e.target.value); clearErrors('shipping_line'); }} className="h-11 rounded-xl border-zinc-200 pl-10 font-medium" placeholder="Carrier name" />
                                                        </div>
                                                        {errors.shipping_line && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.shipping_line}</p>}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="voyage_number" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Voyage Number <span className="text-zinc-400 font-normal">(Optional)</span>
                                                    </Label>
                                                    <Input disabled={processing} id="voyage_number" value={data.voyage_number} onChange={(e) => { setData('voyage_number', e.target.value); clearErrors('voyage_number'); }} className="h-11 rounded-xl border-zinc-200 font-mono text-sm font-medium" placeholder="Voyage ID" />
                                                    {errors.voyage_number && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.voyage_number}</p>}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="origin_port" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Origin Port <span className="text-red-500 ml-0.5">*</span>
                                                        </Label>
                                                        <Select disabled={processing} value={data.origin_port} onValueChange={(value) => { setData('origin_port', value); clearErrors('origin_port'); }}>
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
                                                        {errors.origin_port && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.origin_port}</p>}
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="destination_port" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                            Destination Port <span className="text-red-500 ml-0.5">*</span>
                                                        </Label>
                                                        <Select disabled={processing} value={data.destination_port} onValueChange={(value) => { setData('destination_port', value); clearErrors('destination_port'); }}>
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
                                                        {errors.destination_port && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.destination_port}</p>}
                                                        {data.origin_port && data.destination_port && data.origin_port === data.destination_port && (
                                                            <p className="text-[11px] font-semibold text-amber-600 ml-0.5 mt-1 flex items-center gap-1">
                                                                <AlertCircle className="size-3 shrink-0" />
                                                                Destination port cannot be the same as origin port.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 2 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            {data.cutoff_at && new Date(data.cutoff_at) < new Date() && (
                                                <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-4 flex gap-3 shadow-sm">
                                                    <div className="size-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                                        <Info className="size-4 text-amber-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs font-bold text-amber-900 mb-1 uppercase tracking-wider">Past Cut-off Date</h4>
                                                        <p className="text-xs text-amber-800 leading-relaxed font-medium">The selected cut-off date has already passed. The batch will remain open but you will need to manage it manually.</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="cutoff_at" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Cut-off Date & Time <span className="text-red-500 ml-0.5">*</span>
                                                    </Label>
                                                    <div className="relative">
                                                        <CalendarClock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-sky-500" />
                                                        <Input
                                                            required
                                                            disabled={processing}
                                                            id="cutoff_at"
                                                            type="datetime-local"
                                                            value={data.cutoff_at}
                                                            onChange={(e) => { handleCutoffChange(e.target.value); clearErrors('cutoff_at'); }}
                                                            className="h-11 rounded-xl border-zinc-200 pl-10 font-medium text-sm"
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 ml-0.5 font-normal italic">Last date for boxes to be received at the warehouse for this batch.</p>
                                                    {errors.cutoff_at && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.cutoff_at}</p>}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between ml-0.5">
                                                        <Label htmlFor="eta_at" className="text-xs font-semibold text-zinc-700">
                                                            Estimated Arrival (ETA) <span className="text-red-500 ml-0.5">*</span>
                                                        </Label>
                                                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100/60 shadow-sm">
                                                            {getTransitDuration()} Day Transit
                                                        </span>
                                                    </div>
                                                    <div className="relative">
                                                        <CalendarClock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                                                        <Input
                                                            required
                                                            disabled={processing}
                                                            id="eta_at"
                                                            type="datetime-local"
                                                            min={data.cutoff_at}
                                                            value={data.eta_at}
                                                            onChange={(e) => { setData('eta_at', e.target.value); clearErrors('eta_at'); }}
                                                            className="h-11 rounded-xl border-zinc-200 pl-10 font-medium text-sm"
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 ml-0.5 font-normal italic">Auto-calculated based on {transitDays}-day standard transit duration.</p>
                                                    {errors.eta_at && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.eta_at}</p>}
                                                    {data.cutoff_at && data.eta_at && new Date(data.eta_at) < new Date(data.cutoff_at) && (
                                                        <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 flex items-center gap-1">
                                                            <AlertCircle className="size-3 shrink-0" />
                                                            Estimated arrival date cannot be earlier than cut-off date.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 3 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="grid grid-cols-1 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="capacity_boxes" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Total Box Capacity <span className="text-red-500 ml-0.5">*</span>
                                                    </Label>
                                                    <div className="relative">
                                                        <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-sky-500" />
                                                        <Input required disabled={processing} id="capacity_boxes" type="number" min="1" value={data.capacity_boxes} onChange={(e) => { setData('capacity_boxes', e.target.value); clearErrors('capacity_boxes'); }} className="h-11 rounded-xl border-zinc-200 pl-10 text-sm font-medium" placeholder="340" />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">Boxes</div>
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 ml-0.5 font-normal italic">Approx. capacity for a {data.container_size.replace('_', ' ')} container.</p>
                                                    {errors.capacity_boxes && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.capacity_boxes}</p>}
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="capacity_cbm" className="text-xs font-semibold text-zinc-700 ml-0.5">
                                                        Volume (CBM) <span className="text-zinc-400 font-normal">(Optional)</span>
                                                    </Label>
                                                    <div className="relative">
                                                        <Box className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                                        <Input disabled={processing} id="capacity_cbm" type="number" min="0" step="0.001" value={data.capacity_cbm} onChange={(e) => { setData('capacity_cbm', e.target.value); clearErrors('capacity_cbm'); }} className="h-11 rounded-xl border-zinc-200 pl-10 font-medium text-sm" />
                                                    </div>
                                                    {errors.capacity_cbm && <p className="text-[11px] font-semibold text-red-500 ml-0.5 mt-1 uppercase tracking-wider">{errors.capacity_cbm}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t border-zinc-100 mt-6 space-y-3">
                                    {!canProceedCurrentStep && (
                                        <div className="p-3 bg-amber-50/90 border border-amber-200/70 rounded-xl flex items-center gap-2.5 text-amber-800 text-xs font-medium animate-in fade-in slide-in-from-bottom-1 duration-200 shadow-sm">
                                            <AlertCircle className="size-4 shrink-0 text-amber-600" />
                                            <div className="flex-1">
                                                <span className="font-semibold text-amber-900 mr-1">Cannot proceed:</span>
                                                <span>{getStepUnsatisfiedReason(currentStep)}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between gap-4">
                                        <button
                                            type="button"
                                            onClick={prevStep}
                                            disabled={currentStep === 0}
                                            className={cn(
                                                "h-11 px-6 flex items-center justify-center rounded-xl border border-zinc-200 text-xs font-semibold uppercase tracking-wide transition-all",
                                                currentStep === 0 ? "opacity-0 pointer-events-none" : "hover:bg-zinc-50 active:scale-[0.98]"
                                            )}
                                        >
                                            <ChevronLeft className="size-4 mr-1.5" /> Back
                                        </button>

                                        {currentStep < STEPS.length - 1 ? (
                                            <button
                                                type="button"
                                                onClick={nextStep}
                                                disabled={!canProceedCurrentStep}
                                                className={cn(
                                                    "h-11 px-8 flex items-center justify-center rounded-xl text-xs font-semibold uppercase tracking-wide transition-all",
                                                    canProceedCurrentStep
                                                        ? "bg-zinc-950 text-white hover:bg-zinc-800 active:scale-[0.98] shadow-sm cursor-pointer"
                                                        : "bg-zinc-200 text-zinc-400 cursor-not-allowed opacity-60 pointer-events-none"
                                                )}
                                            >
                                                Continue <ChevronRight className="size-4 ml-1.5" />
                                            </button>
                                        ) : (
                                            <button
                                                type="submit"
                                                disabled={processing || !allStepsSatisfied}
                                                className={cn(
                                                    "h-11 px-10 flex items-center justify-center rounded-xl text-xs font-semibold uppercase tracking-wide transition-all",
                                                    !processing && allStepsSatisfied
                                                        ? "bg-sky-600 text-white shadow-md shadow-sky-600/10 hover:bg-sky-700 active:scale-[0.98] cursor-pointer"
                                                        : "bg-zinc-200 text-zinc-400 cursor-not-allowed opacity-60"
                                                )}
                                            >
                                                {processing ? 'Processing...' : 'Initialize Batch'}
                                                <Save className="size-4 ml-1.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Sidebar Preview */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-slate-950/98 backdrop-blur-md rounded-2xl p-6 text-white border border-slate-800/85 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500">
                                <Ship className="size-24" />
                            </div>

                            <div className="relative space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Manifest Preview</h4>
                                    <span className="size-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse"></span>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Batch Number</p>
                                    <h3 className="font-mono text-lg font-bold tracking-tight text-white break-all leading-tight">
                                        {data.batch_number || getPreviewBatchNumber()}
                                    </h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Container</p>
                                        <p className="text-xs font-semibold text-slate-200 truncate">{data.container_number || 'TBA'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Size</p>
                                        <p className="text-xs font-semibold text-slate-200 uppercase">{data.container_size.replace('_', ' ')}</p>
                                    </div>
                                </div>

                                <div className="pt-5 border-t border-slate-900/60">
                                    <div className="relative pl-6 space-y-4 pt-0.5">
                                        {/* Vertical connector line */}
                                        <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-slate-900">
                                            <div className={cn(
                                                "w-full bg-gradient-to-b from-emerald-500 to-amber-500 transition-all duration-700 ease-in-out",
                                                data.origin_port && data.destination_port ? "h-full" : data.origin_port ? "h-1/2" : "h-0"
                                            )} />
                                        </div>

                                        {/* Origin */}
                                        <div className="relative flex gap-3 items-start">
                                            <div className={cn(
                                                "absolute -left-[23px] mt-1 size-3 rounded-full border transition-all duration-500",
                                                data.origin_port
                                                    ? "bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                                    : "bg-slate-950 border-slate-800"
                                            )} />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Origin Port</span>
                                                <span className={cn(
                                                    "text-xs font-semibold truncate transition-colors duration-300",
                                                    data.origin_port ? "text-slate-200" : "text-slate-500 italic"
                                                )}>
                                                    {data.origin_port || 'Pending Origin...'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Destination */}
                                        <div className="relative flex gap-3 items-start">
                                            <div className={cn(
                                                "absolute -left-[23px] mt-1 size-3 rounded-full border transition-all duration-500",
                                                data.destination_port
                                                    ? "bg-amber-500 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                                                    : "bg-slate-950 border-slate-800"
                                            )} />
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Destination Port</span>
                                                <span className={cn(
                                                    "text-xs font-semibold truncate transition-colors duration-300",
                                                    data.destination_port ? "text-slate-200" : "text-slate-500 italic"
                                                )}>
                                                    {data.destination_port || 'Pending Destination...'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-5 border-t border-slate-900/60 grid grid-cols-2 gap-3">
                                    <div className="bg-slate-900/40 border border-slate-900/50 p-2.5 rounded-xl">
                                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Capacity</p>
                                        <p className="text-xs font-bold text-slate-200">
                                            <span className="text-sky-400 font-extrabold mr-0.5">{data.capacity_boxes || '0'}</span> Boxes
                                        </p>
                                    </div>
                                    <div className="bg-slate-900/40 border border-slate-900/50 p-2.5 rounded-xl">
                                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Transit</p>
                                        <p className="text-xs font-bold text-slate-200">
                                            <span className="text-emerald-400 font-extrabold mr-0.5">{getTransitDuration()}</span> Days
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
                                    <p className="text-xs font-semibold text-zinc-800">Efficiency Tip</p>
                                    <p className="text-[10px] text-zinc-500 leading-relaxed font-normal">
                                        Setting a realistic cut-off ensures your team has enough time to process and load boxes before the vessel departs.
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
