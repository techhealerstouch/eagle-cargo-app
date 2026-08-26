import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Anchor,
    ArrowLeft,
    Bell,
    CheckCircle2,
    CheckSquare,
    Clock,
    Container as ContainerIcon,
    FileCheck,
    Gavel,
    Layers,
    Loader2,
    MapPin,
    Package,
    Search,
    ShieldCheck,
    Ship,
    Sparkles,
    Square,
    Truck,
    User,
    Warehouse,
    Activity,
    RotateCcw,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import ConfirmModal from '@/components/common/confirm-modal';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { cn, humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Recipient {
    id: number;
    name: string;
    city: string;
    province: string;
}

interface Sender {
    first_name: string;
    last_name: string;
}

interface BoxType {
    id: number;
    name: string;
}

interface BoxData {
    id: number;
    tracking_number: string;
    status: string;
    weight: number | null;
    destination: string;
    recipient: Recipient | null;
    box_type: BoxType | null;
    booking: {
        id: number;
        reference_number: string;
        sender: Sender;
    } | null;
}

interface BatchData {
    id: number;
    batch_number: string;
    container_number: string | null;
    seal_number: string | null;
    container_size: string | null;
    vessel_name: string | null;
    status: string;
    current_box_count: number;
    capacity_boxes: number | null;
    latest_tracking_phase: string | null;
    latest_tracking_phase_order: number | null;
    warnings?: string[];
    boxes: BoxData[];
}

interface TrackingPhaseOption {
    value: string;
    label: string;
    group: string;
    order: number;
}

interface PageFlash {
    success?: string;
    error?: string;
    warning?: string;
    batch_full?: boolean;
    skipped_reasons?: string[];
}

/* ------------------------------------------------------------------ */
/*  Status Badge Styling Helpers                                      */
/* ------------------------------------------------------------------ */

const BOX_STATUS_STYLES: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200/80',
    collected: 'bg-sky-50 text-sky-700 border-sky-200/80',
    received_by_branch: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    in_transit: 'bg-sky-50 text-sky-700 border-sky-200/80',
    arrived: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    out_for_delivery: 'bg-amber-50 text-amber-700 border-amber-200/80',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200/80',
};

const BATCH_STATUS_STYLES: Record<string, string> = {
    open: 'bg-sky-50 text-sky-700 border-sky-200/80',
    loading: 'bg-sky-50 text-sky-700 border-sky-200/80',
    ready_to_close: 'bg-amber-50 text-amber-700 border-amber-200/80',
    sailed: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    arrived: 'bg-purple-50 text-purple-700 border-purple-200/80',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BatchShow({
    batch,
    trackingPhases = [],
}: {
    batch: BatchData;
    trackingPhases?: TrackingPhaseOption[];
}) {
    const { props } = usePage<{ flash: PageFlash }>();
    const flash = props.flash ?? {};

    // Show flash toasts
    useEffect(() => {
        if (flash.batch_full) {
            setShowBatchFullConfirm(true);
        }
        if (flash.skipped_reasons && flash.skipped_reasons.length > 0) {
            setSkippedReasonsToShow(flash.skipped_reasons);
        }
    }, [flash.batch_full, flash.skipped_reasons]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Batches', href: '/admin/batches' },
        { title: batch.batch_number, href: '#' },
    ];

    // Available-boxes state
    const [availableBoxes, setAvailableBoxes] = useState<BoxData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Confirmation dialog state
    const [showConfirm, setShowConfirm] = useState(false);
    const [showBatchFullConfirm, setShowBatchFullConfirm] = useState(false);
    const [isArrivalModalOpen, setIsArrivalModalOpen] = useState(false);
    const [isQuickTrackingModalOpen, setIsQuickTrackingModalOpen] = useState(false);
    const [isBulkLoadModalOpen, setIsBulkLoadModalOpen] = useState(false);
    const [bulkTrackingNumbers, setBulkTrackingNumbers] = useState('');
    const [skippedReasonsToShow, setSkippedReasonsToShow] = useState<string[] | null>(null);
    const [pendingQuickPhase, setPendingQuickPhase] = useState<{
        phase: string;
        label: string;
    } | null>(null);

    const initialTrackingPhase =
        trackingPhases.find((phase) => {
            return (
                batch.latest_tracking_phase_order === null ||
                batch.latest_tracking_phase_order === undefined ||
                phase.order > batch.latest_tracking_phase_order
            );
        })?.value ??
        trackingPhases.find((phase) => phase.value === batch.latest_tracking_phase)?.value ??
        trackingPhases[0]?.value ??
        '';

    // Bulk tracking-phase form state
    const [selectedTrackingPhase, setSelectedTrackingPhase] = useState(initialTrackingPhase);
    const [trackingDescription, setTrackingDescription] = useState('');
    const [isTrackingPhaseSubmitting, setIsTrackingPhaseSubmitting] = useState(false);
    const [isArriving, setIsArriving] = useState(false);
    const [isCustomsSubmitting, setIsCustomsSubmitting] = useState<string | null>(null);
    const [isReopening, setIsReopening] = useState(false);
    const [showReopenConfirm, setShowReopenConfirm] = useState(false);

    const handleReopenBatch = () => {
        setIsReopening(true);
        router.post(`/admin/batches/${batch.id}/reopen`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                setShowReopenConfirm(false);
                toast.success('Batch reopened to Open status.');
            },
            onError: (err: any) => {
                toast.error(err?.status || 'Failed to reopen batch.');
            },
            onFinish: () => setIsReopening(false),
        });
    };

    const canLoadBoxes = ['open', 'loading'].includes(batch.status);
    const hasBatchBoxes = (batch.boxes?.length ?? 0) > 0;
    const canApplyTrackingPhase = (phase: string) => trackingPhases.some((option) => option.value === phase);
    const selectedPhase = trackingPhases.find((phase) => phase.value === selectedTrackingPhase);
    const latestPhaseOrder = batch.latest_tracking_phase_order ?? null;
    const selectedPhaseIsCurrent =
        selectedTrackingPhase !== '' && selectedTrackingPhase === batch.latest_tracking_phase;
    const selectedPhaseIsPast =
        latestPhaseOrder !== null && selectedPhase !== undefined && selectedPhase.order < latestPhaseOrder;
    const selectedPhaseIsCurrentOrPast = selectedPhaseIsCurrent || selectedPhaseIsPast;
    const nextAllowedPhase = trackingPhases.find((phase) => {
        return latestPhaseOrder === null || phase.order > latestPhaseOrder;
    });
    const selectedPhaseLabel = selectedPhase
        ? `${selectedPhase.group} - ${selectedPhase.label}`
        : 'this tracking phase';

    /* ---- search available boxes ---- */
    const searchAvailableBoxes = useCallback(
        async (query: string) => {
            setIsSearching(true);
            setHasSearched(true);

            try {
                const url = `/admin/batches/${batch.id}/available-boxes?search=${encodeURIComponent(query)}`;
                const res = await fetch(url, {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });

                if (res.ok) {
                    const data = await res.json();
                    setAvailableBoxes(data);
                }
            } catch {
                toast.error('Failed to search boxes.');
            } finally {
                setIsSearching(false);
            }
        },
        [batch.id]
    );

    // Debounced search
    useEffect(() => {
        if (!canLoadBoxes) {
            return;
        }

        const timer = setTimeout(() => {
            searchAvailableBoxes(searchQuery);
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, searchAvailableBoxes, canLoadBoxes]);

    /* ---- selection helpers ---- */
    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === availableBoxes.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(availableBoxes.map((b) => b.id)));
        }
    };

    /* ---- submit ---- */
    const handleLoadBoxes = (e: FormEvent) => {
        e.preventDefault();
        setShowConfirm(true);
    };

    const confirmLoad = () => {
        setShowConfirm(false);
        setIsSubmitting(true);
        router.post(
            `/admin/batches/${batch.id}/load-boxes`,
            { box_ids: Array.from(selectedIds) },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelectedIds(new Set());
                    setAvailableBoxes([]);
                    setSearchQuery('');
                    setHasSearched(false);
                },
                onFinish: () => setIsSubmitting(false),
            }
        );
    };

    const handleBulkLoadBoxes = (e: FormEvent) => {
        e.preventDefault();
        
        // Parse tracking numbers by whitespace/newlines/commas
        const rawNumbers = bulkTrackingNumbers.split(/[\s,]+/).filter(Boolean);
        if (rawNumbers.length === 0) {
            toast.error('Please enter at least one tracking number.');
            return;
        }

        setIsSubmitting(true);
        router.post(
            `/admin/batches/${batch.id}/load-boxes`,
            { tracking_numbers: rawNumbers },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsBulkLoadModalOpen(false);
                    setBulkTrackingNumbers('');
                    setAvailableBoxes([]);
                    setSearchQuery('');
                    setHasSearched(false);
                },
                onFinish: () => setIsSubmitting(false),
            }
        );
    };

    const submitTrackingPhaseUpdate = (e: FormEvent) => {
        e.preventDefault();

        if (!selectedTrackingPhase) {
            toast.error('Please select a tracking phase.');
            return;
        }

        if (selectedPhaseIsCurrentOrPast) {
            toast.error('This batch is already at or past that tracking phase. Select a later phase to continue.');
            return;
        }

        setIsTrackingPhaseSubmitting(true);

        router.post(
            `/admin/batches/${batch.id}/tracking-phase`,
            {
                tracking_phase: selectedTrackingPhase,
                description: trackingDescription.trim() || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setTrackingDescription('');
                },
                onFinish: () => setIsTrackingPhaseSubmitting(false),
            }
        );
    };

    const handleConfirmArrival = () => {
        setIsArrivalModalOpen(true);
    };

    const confirmArrival = () => {
        setIsArriving(true);
        router.post(
            `/admin/batches/${batch.id}/confirm-arrival`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => setIsArrivalModalOpen(false),
                onFinish: () => setIsArriving(false),
            }
        );
    };

    const handleQuickTrackingUpdate = (phase: string, label: string) => {
        setPendingQuickPhase({ phase, label });
        setIsQuickTrackingModalOpen(true);
    };

    const confirmQuickTrackingUpdate = () => {
        if (!pendingQuickPhase) {
            return;
        }

        setIsCustomsSubmitting(pendingQuickPhase.phase);
        router.post(
            `/admin/batches/${batch.id}/tracking-phase`,
            {
                tracking_phase: pendingQuickPhase.phase,
                description: `Batch manually updated to ${pendingQuickPhase.label}.`,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsQuickTrackingModalOpen(false);
                    setPendingQuickPhase(null);
                },
                onFinish: () => setIsCustomsSubmitting(null),
            }
        );
    };

    const capacityLabel = batch.capacity_boxes
        ? `${batch.current_box_count} / ${batch.capacity_boxes}`
        : `${batch.current_box_count}`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Batch ${batch.batch_number} | Admin`} />
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

                {/* Header Section */}
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
                                title="Batch Details"
                                description="View loaded boxes and manage box assignments for this batch."
                            />
                            <span className="rounded-xl bg-sky-50 px-3.5 py-1.5 font-mono text-xs font-bold text-sky-900 border border-sky-200/60 shadow-sm flex items-center gap-2 max-w-[240px] truncate" title={batch.batch_number}>
                                <Layers className="size-3.5 text-sky-600 shrink-0" />
                                <span className="truncate">{batch?.batch_number?.toUpperCase() ?? 'N/A'}</span>
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {batch.status === 'sailed' && (
                            <button
                                type="button"
                                onClick={handleConfirmArrival}
                                disabled={isArriving}
                                className="h-11 px-5 rounded-xl bg-emerald-600 text-white text-xs font-semibold uppercase tracking-wide shadow-md shadow-emerald-600/10 transition-all hover:bg-emerald-700 active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                            >
                                {isArriving ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Anchor className="size-4" />
                                )}
                                Confirm Arrival
                            </button>
                        )}

                        {batch.status === 'arrived' && (
                            <>
                                {canApplyTrackingPhase('under_customs_clearance') &&
                                (!latestPhaseOrder ||
                                    latestPhaseOrder <
                                        (trackingPhases.find((p) => p.value === 'under_customs_clearance')?.order ?? 0)) ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleQuickTrackingUpdate('under_customs_clearance', 'Under Customs Clearance')
                                        }
                                        disabled={isCustomsSubmitting !== null}
                                        className="h-11 px-5 rounded-xl bg-amber-600 text-white text-xs font-semibold uppercase tracking-wide shadow-md shadow-amber-600/10 transition-all hover:bg-amber-700 active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isCustomsSubmitting === 'under_customs_clearance' ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Gavel className="size-4" />
                                        )}
                                        Under BOC
                                    </button>
                                ) : null}

                                {canApplyTrackingPhase('released_by_boc') &&
                                    batch.latest_tracking_phase === 'under_customs_clearance' && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleQuickTrackingUpdate('released_by_boc', 'Released by BOC')
                                            }
                                            disabled={isCustomsSubmitting !== null}
                                            className="h-11 px-5 rounded-xl bg-sky-600 text-white text-xs font-semibold uppercase tracking-wide shadow-md shadow-sky-600/10 transition-all hover:bg-sky-700 active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isCustomsSubmitting === 'released_by_boc' ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <FileCheck className="size-4" />
                                            )}
                                            Released by BOC
                                        </button>
                                    )}

                                {canApplyTrackingPhase('received_manila_warehouse') &&
                                    batch.latest_tracking_phase === 'released_by_boc' && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleQuickTrackingUpdate(
                                                    'received_manila_warehouse',
                                                    'Received at Manila Warehouse'
                                                )
                                            }
                                            disabled={isCustomsSubmitting !== null}
                                            className="h-11 px-5 rounded-xl bg-emerald-600 text-white text-xs font-semibold uppercase tracking-wide shadow-md shadow-emerald-600/10 transition-all hover:bg-emerald-700 active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isCustomsSubmitting === 'received_manila_warehouse' ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <Warehouse className="size-4" />
                                            )}
                                            Receive at Manila Warehouse
                                        </button>
                                    )}
                            </>
                        )}

                        {!['open', 'loading'].includes(batch.status) && (
                            <button
                                type="button"
                                onClick={() => setShowReopenConfirm(true)}
                                disabled={isReopening}
                                className="h-11 px-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold uppercase tracking-wide transition-all hover:bg-amber-100 active:scale-[0.98] flex items-center gap-2"
                            >
                                <RotateCcw className="size-3.5 text-amber-600" />
                                Reopen Batch
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowBatchFullConfirm(true)}
                            className="h-11 px-5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold uppercase tracking-wide transition-all hover:bg-sky-100 active:scale-[0.98] flex items-center gap-2"
                        >
                            <Sparkles className="size-3.5" />
                            Generate Next Batch
                        </button>

                        <Link
                            href={`/admin/batches/${batch.id}/edit`}
                            className="h-11 px-6 rounded-xl bg-zinc-950 text-white text-xs font-semibold uppercase tracking-wide shadow-sm transition-all hover:bg-zinc-800 active:scale-[0.98] flex items-center gap-2"
                        >
                            Edit Batch
                        </Link>
                    </div>
                </div>

                {/* Visual Roadmap Pipeline */}
                <div className="bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-sm">
                    {(() => {
                        const statuses = [
                            'open',
                            'loading',
                            'ready_to_close',
                            'sailed',
                            'arrived',
                            'delivered',
                        ];
                        const currentIdx = Math.max(0, statuses.indexOf(batch.status));
                        const progressPct = batch.status === 'delivered' ? 100 : (currentIdx / (statuses.length - 1)) * 100;

                        return (
                            <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
                                {/* Connecting Track (Desktop) */}
                                <div className="absolute top-1/2 left-8 right-8 hidden h-1 -translate-y-1/2 bg-zinc-100 rounded-full md:block -z-0">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full transition-all duration-700 ease-in-out"
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>

                                {[
                                    { id: 'open', label: 'Open', icon: Package },
                                    { id: 'loading', label: 'Loading', icon: ContainerIcon },
                                    { id: 'ready_to_close', label: 'Ready', icon: ShieldCheck },
                                    { id: 'sailed', label: 'Sailed', icon: Ship },
                                    { id: 'arrived', label: 'Arrived', icon: MapPin },
                                    { id: 'delivered', label: 'Delivered', icon: CheckCircle2 },
                                ].map((step, idx) => {
                                    const isCompleted = idx < currentIdx || batch.status === 'delivered';
                                    const isActive = idx === currentIdx && batch.status !== 'delivered';
                                    const Icon = step.icon;

                                    return (
                                        <div key={step.id} className="relative z-10 flex flex-1 flex-col items-center">
                                            <div className="relative">
                                                <div
                                                    className={cn(
                                                        'size-11 rounded-xl flex items-center justify-center transition-all duration-300 border shadow-2xs',
                                                        isActive
                                                            ? 'bg-sky-600 text-white ring-4 ring-sky-600/15 scale-110 border-sky-600 shadow-md shadow-sky-600/20'
                                                            : isCompleted
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300/80'
                                                            : 'bg-white border-zinc-200 text-zinc-400'
                                                    )}
                                                >
                                                    <Icon className="size-5" />
                                                </div>

                                                {/* Checkmark overlay for completed steps */}
                                                {isCompleted && (
                                                    <div className="absolute -top-1 -right-1 flex size-4.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs border-2 border-white">
                                                        <CheckCircle2 className="size-3.5 fill-emerald-600 text-white" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-2.5 text-center">
                                                <p
                                                    className={cn(
                                                        'text-[10px] font-semibold tracking-tight uppercase',
                                                        isActive ? 'text-sky-900 font-bold' : isCompleted ? 'text-emerald-800 font-semibold' : 'text-zinc-400'
                                                    )}
                                                >
                                                    {step.label}
                                                </p>
                                            </div>

                                            {isActive && (
                                                <div className="mt-1">
                                                    <span className="rounded-full bg-sky-50 border border-sky-200/80 px-2 py-0.5 text-[9px] font-bold text-sky-700 uppercase tracking-wider">
                                                        CURRENT STAGE
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>

                {/* Summary Stat Grid */}
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-2 divide-y divide-zinc-100 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
                        <div className="group flex items-center gap-4 p-5 transition-colors hover:bg-zinc-50/50">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                                <Package className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                                    Loaded Boxes
                                </p>
                                <p className="text-base font-bold text-zinc-900 truncate">
                                    {capacityLabel}
                                </p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-4 p-5 transition-colors hover:bg-zinc-50/50">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                                <ContainerIcon className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                                    Container Ref
                                </p>
                                <p className="font-mono text-base font-bold text-zinc-900 truncate">
                                    {batch.container_number?.toUpperCase() ?? '—'}
                                </p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-4 p-5 transition-colors hover:bg-zinc-50/50">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                                <ShieldCheck className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                                    Seal Number
                                </p>
                                <p className="font-mono text-base font-bold text-zinc-900 truncate">
                                    {batch.seal_number ?? '—'}
                                </p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-4 p-5 transition-colors hover:bg-zinc-50/50">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                                <Ship className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                                    Vessel
                                </p>
                                <p className="text-base font-bold text-zinc-900 uppercase truncate">
                                    {batch.vessel_name ?? '—'}
                                </p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-4 p-5 transition-colors hover:bg-zinc-50/50">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                                <Activity className="size-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                                    Status
                                </p>
                                <span
                                    className={cn(
                                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border capitalize',
                                        BATCH_STATUS_STYLES[batch.status ?? ''] ?? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                    )}
                                >
                                    {humanize(batch.status ?? '')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Loaded Boxes Table */}
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="size-7 rounded-md bg-sky-600 flex items-center justify-center text-white shadow-sm">
                                <Package className="size-4" />
                            </div>
                            <h2 className="font-sans text-sm font-semibold text-zinc-950">Loaded Boxes</h2>
                        </div>
                        <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200/40">
                            {batch.boxes?.length ?? 0} Box(es)
                        </span>
                    </div>

                    {batch.boxes && batch.boxes.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-zinc-100 bg-zinc-50/60 font-sans text-zinc-500">
                                    <tr>
                                        <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider">
                                            Tracking #
                                        </th>
                                        <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider">
                                            Sender
                                        </th>
                                        <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider">
                                            Recipient
                                        </th>
                                        <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider">
                                            Box Type
                                        </th>
                                        <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider">
                                            Destination
                                        </th>
                                        <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {batch.boxes.map((box) => (
                                        <tr
                                            key={box.id}
                                            className="transition-colors hover:bg-zinc-50/80"
                                        >
                                            <td className="px-6 py-4 font-mono text-sm font-semibold text-zinc-900">
                                                {box.tracking_number}
                                            </td>
                                            <td className="px-6 py-4 text-zinc-700">
                                                <div className="flex items-center gap-2">
                                                    <User className="size-3.5 text-zinc-400" />
                                                    <span className="text-sm font-medium">
                                                        {box.booking?.sender
                                                            ? `${box.booking.sender.first_name} ${box.booking.sender.last_name}`
                                                            : '—'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-zinc-700">
                                                <div className="flex items-center gap-2">
                                                    <Truck className="size-3.5 text-zinc-400" />
                                                    <span className="text-sm font-medium">
                                                        {box.recipient?.name ?? '—'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-medium uppercase text-zinc-600">
                                                {box.box_type?.name ?? '—'}
                                            </td>
                                            <td className="px-6 py-4 text-zinc-700">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="size-3.5 text-amber-500" />
                                                    <span className="text-sm font-medium">
                                                        {box.destination || '—'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border capitalize',
                                                        BOX_STATUS_STYLES[box.status] ?? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                                    )}
                                                >
                                                    {humanize(box.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-zinc-100 border border-zinc-200/60">
                                <Package className="size-8 text-zinc-400" />
                            </div>
                            <h3 className="mb-1 text-sm font-semibold text-zinc-900">
                                No boxes loaded yet
                            </h3>
                            <p className="max-w-sm text-xs text-zinc-500 leading-relaxed font-normal">
                                {canLoadBoxes
                                    ? 'Use the panel below to search and load boxes into this batch.'
                                    : 'No boxes have been assigned to this batch.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Bulk Tracking Phase Panel */}
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="size-7 rounded-md bg-amber-500 flex items-center justify-center text-white shadow-sm">
                                <Ship className="size-4" />
                            </div>
                            <h2 className="font-sans text-sm font-semibold text-zinc-950">
                                Bulk Tracking Phase Update
                            </h2>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                            BOC & Transit Milestones
                        </span>
                    </div>

                    <form className="space-y-6 p-6 md:p-8" onSubmit={submitTrackingPhaseUpdate}>
                        <p className="text-xs text-zinc-500 leading-relaxed font-normal">
                            Apply a journey milestone to all boxes in this batch. This writes a tracking history entry per box.
                        </p>

                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <label
                                    htmlFor="tracking-phase-select"
                                    className="text-xs font-semibold text-zinc-700 ml-0.5"
                                >
                                    Tracking Phase
                                </label>
                                <select
                                    id="tracking-phase-select"
                                    value={selectedTrackingPhase}
                                    onChange={(e) => setSelectedTrackingPhase(e.target.value)}
                                    disabled={!hasBatchBoxes || isTrackingPhaseSubmitting}
                                    className="flex h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-900 shadow-sm focus:ring-2 focus:ring-sky-100 outline-none disabled:cursor-not-allowed disabled:bg-zinc-50"
                                >
                                    {trackingPhases.length === 0 && (
                                        <option value="">No tracking phases available</option>
                                    )}
                                    {trackingPhases.map((phase) => (
                                        <option
                                            key={phase.value}
                                            value={phase.value}
                                            disabled={
                                                latestPhaseOrder !== null &&
                                                phase.order <= latestPhaseOrder
                                            }
                                        >
                                            {phase.group} - {phase.label}
                                            {phase.value === batch.latest_tracking_phase ? ' (current)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor="tracking-phase-description"
                                    className="text-xs font-semibold text-zinc-700 ml-0.5"
                                >
                                    Description (Optional)
                                </label>
                                <input
                                    id="tracking-phase-description"
                                    type="text"
                                    maxLength={500}
                                    value={trackingDescription}
                                    onChange={(e) => setTrackingDescription(e.target.value)}
                                    disabled={!hasBatchBoxes || isTrackingPhaseSubmitting}
                                    placeholder="Example: Cleared by BOC and released for local handling."
                                    className="flex h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-900 shadow-sm focus:ring-2 focus:ring-sky-100 outline-none disabled:cursor-not-allowed disabled:bg-zinc-50"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between border-t border-zinc-100 pt-5 gap-4">
                            <p className="text-xs text-zinc-500">
                                {!hasBatchBoxes
                                    ? 'No boxes in this batch yet.'
                                    : selectedPhaseIsCurrent
                                    ? nextAllowedPhase
                                        ? `Already marked as ${selectedPhaseLabel}. Select ${nextAllowedPhase.group} - ${nextAllowedPhase.label} to continue.`
                                        : `Already marked as ${selectedPhaseLabel}. No later phase is available for your role.`
                                    : selectedPhaseIsPast
                                    ? 'This batch has already passed that tracking phase. Select a later phase to continue.'
                                    : `This will update ${batch.boxes.length} box${batch.boxes.length !== 1 ? 'es' : ''}.`}
                            </p>

                            <Button
                                type="submit"
                                disabled={
                                    !hasBatchBoxes ||
                                    !selectedTrackingPhase ||
                                    selectedPhaseIsCurrentOrPast ||
                                    isTrackingPhaseSubmitting
                                }
                                className="h-11 px-8 rounded-xl bg-sky-600 text-white text-xs font-semibold uppercase tracking-wide shadow-md shadow-sky-600/10 transition-all hover:bg-sky-700 active:scale-[0.98] flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none"
                            >
                                {isTrackingPhaseSubmitting ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Ship className="size-4" />
                                        {selectedPhaseIsCurrentOrPast ? 'Already Updated' : 'Update All Boxes'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Load Boxes Panel — only show when batch is in "open" or "loading" status */}
                {canLoadBoxes && (
                    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-7 rounded-md bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                                    <ContainerIcon className="size-4" />
                                </div>
                                <h2 className="font-sans text-sm font-semibold text-zinc-950">Load Boxes</h2>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 animate-pulse">
                                Ready to Load
                            </span>
                        </div>

                        <div className="space-y-6 p-6 md:p-8">
                            {/* Search bar and Bulk Add */}
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                <div className="relative w-full max-w-md">
                                    <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
                                    <input
                                        id="box-search"
                                        type="text"
                                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white pr-4 pl-10 text-xs font-medium text-zinc-900 shadow-sm transition-all focus:ring-2 focus:ring-sky-100 outline-none"
                                        placeholder="Search by tracking number or sender name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {isSearching && (
                                        <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-sky-600" />
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    onClick={() => setIsBulkLoadModalOpen(true)}
                                    variant="outline"
                                    className="h-11 shrink-0 bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl"
                                >
                                    <Layers className="size-4 mr-2" />
                                    Bulk Paste Tracking #s
                                </Button>
                            </div>

                            {/* Results */}
                            {hasSearched && (
                                <>
                                    {availableBoxes.length > 0 ? (
                                        <form onSubmit={handleLoadBoxes}>
                                            <div className="mb-4 flex items-center justify-between">
                                                <button
                                                    type="button"
                                                    onClick={toggleSelectAll}
                                                    className="flex items-center gap-2 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors"
                                                >
                                                    {selectedIds.size === availableBoxes.length ? (
                                                        <CheckSquare className="size-4" />
                                                    ) : (
                                                        <Square className="size-4" />
                                                    )}
                                                    {selectedIds.size === availableBoxes.length
                                                        ? 'Deselect All'
                                                        : 'Select All'}
                                                </button>
                                                <span className="text-xs font-medium text-zinc-500">
                                                    {selectedIds.size} of {availableBoxes.length} selected
                                                </span>
                                            </div>

                                            <div className="overflow-x-auto rounded-xl border border-zinc-200/80">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="border-b border-zinc-100 bg-zinc-50/60 font-sans text-zinc-500">
                                                        <tr>
                                                            <th className="w-12 px-4 py-3" />
                                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                                                Tracking #
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                                                Sender
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                                                Recipient
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                                                Box Type
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                                                Destination
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-zinc-100">
                                                        {availableBoxes.map((box) => {
                                                            const isSelected = selectedIds.has(box.id);

                                                            return (
                                                                <tr
                                                                    key={box.id}
                                                                    className={cn(
                                                                        'cursor-pointer transition-colors',
                                                                        isSelected ? 'bg-emerald-50/40' : 'hover:bg-zinc-50/80'
                                                                    )}
                                                                    onClick={() => toggleSelect(box.id)}
                                                                >
                                                                    <td className="px-4 py-3 text-center">
                                                                        {isSelected ? (
                                                                            <CheckSquare className="size-4.5 text-emerald-600" />
                                                                        ) : (
                                                                            <Square className="size-4.5 text-zinc-400" />
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono text-sm font-semibold text-zinc-900">
                                                                        {box.tracking_number}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-zinc-700">
                                                                        {box.booking?.sender
                                                                            ? `${box.booking.sender.first_name} ${box.booking.sender.last_name}`
                                                                            : '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-zinc-700">
                                                                        {box.recipient?.name ?? '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-xs font-medium uppercase text-zinc-600">
                                                                        {box.box_type?.name ?? '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-zinc-700">
                                                                        {box.destination || '—'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="mt-6 flex justify-end">
                                                <Button
                                                    type="submit"
                                                    disabled={selectedIds.size === 0 || isSubmitting}
                                                    className="h-11 px-8 rounded-xl bg-emerald-600 text-white text-xs font-semibold uppercase tracking-wide shadow-md shadow-emerald-600/10 transition-all hover:bg-emerald-700 active:scale-[0.98] flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none"
                                                >
                                                    {isSubmitting ? (
                                                        <>
                                                            <Loader2 className="size-4 animate-spin" />
                                                            Loading...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Package className="size-4" />
                                                            Load {selectedIds.size} Selected Box{selectedIds.size !== 1 ? 'es' : ''}
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="py-10 text-center">
                                            <p className="text-xs text-zinc-500 font-medium">
                                                {searchQuery
                                                    ? 'No available boxes match your search.'
                                                    : 'No boxes are available for loading (must be in "Received by Warehouse" status and not assigned to any batch).'}
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            {!hasSearched && (
                                <div className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center bg-zinc-50/50">
                                    <Search className="mx-auto mb-3 size-7 text-zinc-300" />
                                    <p className="text-xs font-semibold text-zinc-700">
                                        Start typing to search for boxes available for loading.
                                    </p>
                                    <p className="mt-1 text-[10px] text-zinc-400">
                                        Only boxes in "Received by Warehouse" status are shown
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Modals */}
            <ConfirmModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={confirmLoad}
                loading={isSubmitting}
                title="Confirm Load"
                description={`You are about to load ${selectedIds.size} box${selectedIds.size !== 1 ? 'es' : ''} into batch ${batch.batch_number}. Each box will be transitioned from "Received by Warehouse" to "In Transit". Senders will be notified.`}
                variant="primary"
                confirmText="Confirm Load"
            />

            <ConfirmModal
                isOpen={isArrivalModalOpen}
                onClose={() => setIsArrivalModalOpen(false)}
                onConfirm={confirmArrival}
                loading={isArriving}
                title="Mark batch as arrived"
                subtitle={`Vessel ${batch.vessel_name || 'N/A'} • ${batch.current_box_count} box${batch.current_box_count !== 1 ? 'es' : ''}`}
                bannerText="Recipients will be notified automatically"
                bannerIcon={<Bell className="size-4" />}
                customIcon={<Ship className="size-6 text-green-700" />}
                variant="success"
                flatFooter={true}
                cancelButtonVariant="outline"
                description={`All ${batch.current_box_count} box${batch.current_box_count !== 1 ? 'es' : ''} will be moved to Arrived status. This can't be undone.`}
                confirmText="Confirm Arrival"
            />

            <ConfirmModal
                isOpen={isQuickTrackingModalOpen}
                onClose={() => setIsQuickTrackingModalOpen(false)}
                onConfirm={confirmQuickTrackingUpdate}
                loading={isCustomsSubmitting !== null}
                title={`Mark as ${pendingQuickPhase?.label}?`}
                description={`Are you sure you want to mark all boxes in this batch as "${pendingQuickPhase?.label}"? This will update the tracking history for every loaded item.`}
                variant="primary"
                confirmText="Update All Boxes"
            />

            <ConfirmModal
                isOpen={showBatchFullConfirm}
                onClose={() => setShowBatchFullConfirm(false)}
                onConfirm={() => {
                    setShowBatchFullConfirm(false);
                    router.get(`/admin/batches/create?template_id=${batch.id}`);
                }}
                title="Generate Next Shipment Batch?"
                description={`Would you like to generate a new batch using vessel, voyage, shipping line, and route configurations from Batch ${batch.batch_number}? You will be directed to specify the new Container and Seal details before saving.`}
                confirmText="Proceed & Configure"
                cancelText="Not Now"
                variant="primary"
            />

            {/* Bulk Load Modal */}
            <Dialog open={isBulkLoadModalOpen} onOpenChange={setIsBulkLoadModalOpen}>
                <DialogContent className="max-w-md p-6 rounded-xl border border-zinc-200/80 bg-white shadow-xl gap-5">
                    <DialogHeader>
                        <DialogTitle className="font-sans text-base font-semibold text-zinc-900 tracking-tight">
                            Bulk Paste Tracking Numbers
                        </DialogTitle>
                        <DialogDescription className="mt-2 text-xs leading-relaxed text-zinc-600 font-normal">
                            Paste tracking numbers separated by commas, spaces, or new lines. These boxes will be assigned to batch {batch.batch_number}. If the boxes are pending or collected, they will be automatically marked as Received by Warehouse.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4">
                        <textarea
                            value={bulkTrackingNumbers}
                            onChange={(e) => setBulkTrackingNumbers(e.target.value)}
                            placeholder="BOX-001, BOX-002&#10;BOX-003"
                            className="w-full h-40 p-3 text-sm font-mono border border-zinc-200 rounded-xl focus:ring-2 focus:ring-sky-100 outline-none bg-white resize-none"
                        />
                    </div>

                    <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsBulkLoadModalOpen(false)}
                            disabled={isSubmitting}
                            className="h-9 rounded-lg px-4 text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleBulkLoadBoxes}
                            disabled={isSubmitting || !bulkTrackingNumbers.trim()}
                            className="h-9 rounded-lg px-4 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors shadow-2xs"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                'Load Boxes'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Skipped Reasons Modal */}
            <Dialog open={!!skippedReasonsToShow} onOpenChange={(open) => !open && setSkippedReasonsToShow(null)}>
                <DialogContent className="max-w-md p-6 rounded-xl border border-zinc-200/80 bg-white shadow-xl gap-5">
                    <DialogHeader>
                        <DialogTitle className="font-sans text-base font-semibold text-zinc-900 tracking-tight text-rose-600 flex items-center gap-2">
                            <Layers className="size-5" />
                            Some Tracking Numbers Were Skipped
                        </DialogTitle>
                        <DialogDescription className="mt-2 text-xs leading-relaxed text-zinc-600 font-normal">
                            The following tracking numbers could not be loaded into the batch:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                        <ul className="space-y-2 text-xs text-rose-800 font-mono">
                            {skippedReasonsToShow?.map((reason, idx) => (
                                <li key={idx} className="flex gap-2">
                                    <span className="shrink-0 font-bold text-rose-400">•</span>
                                    <span>{reason}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            onClick={() => setSkippedReasonsToShow(null)}
                            className="h-9 rounded-lg px-4 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-2xs"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reopen Batch Confirmation Modal */}
            <ConfirmModal
                isOpen={showReopenConfirm}
                onClose={() => setShowReopenConfirm(false)}
                onConfirm={handleReopenBatch}
                title="Reopen Shipment Batch?"
                description={`Are you sure you want to reopen batch ${batch.batch_number}? This will change the status back to Open and reset any sailing/arrival timestamps so you can continue managing container boxes.`}
                confirmText={isReopening ? 'Reopening...' : 'Yes, Reopen Batch'}
                cancelText="Cancel"
                variant="primary"
            />
        </AppLayout>
    );
}

