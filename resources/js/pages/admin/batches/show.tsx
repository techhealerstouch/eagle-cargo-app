import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    Anchor,
    ArrowLeft,
    ArrowRight,
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
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { BOX_STATUS_CONFIG } from '@/lib/statuses';
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
    batch_id?: number | null;
    batch?: {
        id: number;
        batch_number: string;
    } | null;
    booking: {
        id: number;
        reference_number: string;
        sender: Sender;
        payment_status?: string;
        status?: string;
        invoice?: {
            status: string;
        } | null;
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
    boxes: BoxData[];
    warnings?: string[];
    override_note?: string;
    override_details?: {
        from_status?: string | null;
        to_status?: string | null;
        overridden_by?: string | null;
        overridden_at?: string | null;
    } | null;
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
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    collected: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    received_by_branch: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    in_transit: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    arrived: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    out_for_delivery: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

const BATCH_STATUS_STYLES: Record<string, string> = {
    open: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    loading: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    ready_to_close: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    sailed: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    arrived: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    under_customs_clearance: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    released_by_boc: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    received_at_warehouse: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
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

    // Loaded-boxes search & filter state
    const [loadedBoxSearch, setLoadedBoxSearch] = useState('');
    const filteredLoadedBoxes = useMemo(() => {
        if (!batch.boxes) return [];
        if (!loadedBoxSearch.trim()) return batch.boxes;

        const q = loadedBoxSearch.toLowerCase().trim();
        return batch.boxes.filter((box) => {
            const tracking = box.tracking_number?.toLowerCase() ?? '';
            const bookingRef = box.booking?.reference_number?.toLowerCase() ?? '';
            const sender = box.booking?.sender
                ? `${box.booking.sender.first_name} ${box.booking.sender.last_name}`.toLowerCase()
                : '';
            const recipient = box.recipient?.name?.toLowerCase() ?? '';
            const boxType = box.box_type?.name?.toLowerCase() ?? '';
            const destination = box.destination?.toLowerCase() ?? '';
            const status = (BOX_STATUS_CONFIG[box.status]?.label ?? box.status ?? '').toLowerCase();
            const payment = box.booking?.payment_status?.toLowerCase() ?? '';

            return (
                tracking.includes(q) ||
                bookingRef.includes(q) ||
                sender.includes(q) ||
                recipient.includes(q) ||
                boxType.includes(q) ||
                destination.includes(q) ||
                status.includes(q) ||
                payment.includes(q)
            );
        });
    }, [batch.boxes, loadedBoxSearch]);

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
        const eligibleBoxes = availableBoxes.filter(
            (b) => b.booking?.status !== 'cancelled' && (b.booking?.payment_status === 'paid' || b.booking?.payment_status === 'cash_collected' || b.booking?.invoice?.status === 'paid')
        );
        
        if (eligibleBoxes.length === 0) return;

        if (selectedIds.size === eligibleBoxes.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(eligibleBoxes.map((b) => b.id)));
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
                
                {batch.warnings && batch.warnings.length > 0 && ['open', 'loading'].includes(batch.status) && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 shadow-2xs animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <AlertTriangle className="size-3.5" />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap min-w-0 text-xs">
                                <span className="font-bold text-amber-800 dark:text-amber-300 shrink-0">
                                    Batch Warning:
                                </span>
                                <span className="text-amber-900 dark:text-amber-200 font-medium">
                                    {batch.warnings.join(' • ')}
                                </span>
                            </div>
                        </div>
                        <div className="shrink-0 flex items-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                Please consider closing this batch
                            </span>
                        </div>
                    </div>
                )}

                {batch.override_note && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 shadow-2xs animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                            <div className="size-7 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                                <FileCheck className="size-3.5" />
                            </div>
                            <span className="text-xs font-bold text-sky-900 dark:text-sky-100 shrink-0">
                                Override Reason:
                            </span>
                            {batch.override_details?.from_status && batch.override_details?.to_status && (
                                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/30 text-sky-800 dark:text-sky-200 text-[10px] font-bold shrink-0">
                                    <span className="capitalize">{humanize(batch.override_details.from_status)}</span>
                                    <ArrowRight className="size-2.5 text-sky-600 dark:text-sky-400" />
                                    <span className="capitalize">{humanize(batch.override_details.to_status)}</span>
                                </div>
                            )}
                            <span className="text-xs text-sky-950 dark:text-sky-100 font-medium italic bg-white/70 dark:bg-card/70 px-2 py-0.5 rounded border border-sky-200/60 dark:border-sky-800/60 truncate max-w-lg" title={batch.override_note}>
                                "{batch.override_note}"
                            </span>
                        </div>
                        {batch.override_details?.overridden_by && (
                            <div className="text-[10px] text-sky-700/80 dark:text-sky-300/80 font-medium shrink-0">
                                by <strong className="font-semibold text-sky-900 dark:text-sky-100">{batch.override_details.overridden_by}</strong>
                                {batch.override_details.overridden_at && ` • ${batch.override_details.overridden_at}`}
                            </div>
                        )}
                    </div>
                )}

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/batches"
                            className="rounded-xl p-2.5 bg-card border border-border text-brand-text-mid transition-all hover:bg-brand-warm/20 hover:text-brand-text shadow-2xs"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Heading
                                eyebrow="Consolidated Shipping"
                                title="Batch Details"
                                description="View loaded boxes and manage box assignments for this batch."
                            />
                            <span className="rounded-xl bg-brand-warm/20 px-3.5 py-1.5 font-mono text-xs font-bold text-brand-rust border border-border shadow-2xs flex items-center gap-2 max-w-[240px] truncate" title={batch.batch_number}>
                                <Layers className="size-3.5 text-brand-rust shrink-0" />
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

                        <button
                            type="button"
                            onClick={() => setShowBatchFullConfirm(true)}
                            className="h-11 px-5 rounded-xl bg-brand-warm/20 border border-border text-brand-rust text-xs font-semibold uppercase tracking-wide transition-all hover:bg-brand-warm/30 active:scale-[0.98] flex items-center gap-2 cursor-pointer"
                        >
                            <Sparkles className="size-3.5" />
                            Generate Next Batch
                        </button>

                        <Link
                            href={`/admin/batches/${batch.id}/edit`}
                            className="h-11 px-6 rounded-xl bg-brand-rust text-white text-xs font-semibold uppercase tracking-wide shadow-2xs transition-all hover:bg-brand-rust/90 active:scale-[0.98] flex items-center gap-2"
                        >
                            Edit Batch
                        </Link>
                    </div>
                </div>

                {/* Visual Roadmap Pipeline */}
                <div className="bg-card rounded-xl border border-border p-2 sm:p-2.5 shadow-2xs">
                    {(() => {
                        const statuses = [
                            'open',
                            'loading',
                            'ready_to_close',
                            'sailed',
                            'arrived',
                            'under_customs_clearance',
                            'released_by_boc',
                            'received_at_warehouse',
                        ];
                        const currentIdx = Math.max(0, statuses.indexOf(batch.status));
                        const progressPct = batch.status === 'received_at_warehouse' ? 100 : Math.round((currentIdx / (statuses.length - 1)) * 100);

                        const steps = [
                            { id: 'open', label: 'Open', icon: Package },
                            { id: 'loading', label: 'Loading', icon: ContainerIcon },
                            { id: 'ready_to_close', label: 'Ready', icon: ShieldCheck },
                            { id: 'sailed', label: 'Sailed', icon: Ship },
                            { id: 'arrived', label: 'Port Arrived', icon: Anchor },
                            { id: 'under_customs_clearance', label: 'Under BOC', icon: Gavel },
                            { id: 'released_by_boc', label: 'Released', icon: FileCheck },
                            { id: 'received_at_warehouse', label: 'Unloaded (MNL)', icon: Warehouse },
                        ];

                        const currentStep = steps[currentIdx] || steps[0];
                        const CurrentIcon = currentStep.icon;

                        return (
                            <div>
                                {/* Desktop & Tablet: Segmented Stage Pills */}
                                <div className="hidden sm:grid grid-cols-4 lg:grid-cols-8 gap-1.5 md:gap-2">
                                    {steps.map((step, idx) => {
                                        const isCompleted = idx < currentIdx || batch.status === 'received_at_warehouse';
                                        const isActive = idx === currentIdx && batch.status !== 'received_at_warehouse';
                                        const isUpcoming = idx > currentIdx && batch.status !== 'received_at_warehouse';
                                        const Icon = step.icon;

                                        return (
                                            <div
                                                key={step.id}
                                                className={cn(
                                                    'flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-center transition-all select-none',
                                                    isActive && 'bg-sky-600 text-white border-sky-600 shadow-xs shadow-sky-600/20 font-extrabold ring-2 ring-sky-500/25',
                                                    isCompleted && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold',
                                                    isUpcoming && 'bg-zinc-100/70 dark:bg-zinc-800/50 border-zinc-200/60 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 font-medium'
                                                )}
                                                title={`Stage ${idx + 1}: ${step.label}`}
                                            >
                                                {isCompleted ? (
                                                    <CheckCircle2 className="size-3.5 fill-emerald-600 text-white dark:fill-emerald-400 dark:text-zinc-950 shrink-0" />
                                                ) : (
                                                    <Icon className={cn('size-3.5 shrink-0', isActive ? 'text-white' : 'text-current')} />
                                                )}
                                                <span className="text-[10px] md:text-[11px] uppercase tracking-tight truncate leading-tight">
                                                    {step.label}
                                                </span>
                                                {isActive && (
                                                    <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-white/20 text-white hidden xl:inline">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Mobile: Segmented Multi-Bar + Active Stage Label */}
                                <div className="sm:hidden space-y-2 p-1">
                                    <div className="grid grid-cols-8 gap-1">
                                        {steps.map((step, idx) => {
                                            const isCompleted = idx < currentIdx || batch.status === 'received_at_warehouse';
                                            const isActive = idx === currentIdx && batch.status !== 'received_at_warehouse';

                                            return (
                                                <div
                                                    key={step.id}
                                                    className={cn(
                                                        'h-1.5 rounded-full transition-all duration-500',
                                                        isActive && 'bg-sky-600',
                                                        isCompleted && 'bg-emerald-500',
                                                        idx > currentIdx && 'bg-zinc-200 dark:bg-zinc-800'
                                                    )}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-between text-xs px-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <CurrentIcon className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                                            <span className="font-bold text-brand-text uppercase tracking-tight text-[11px]">
                                                {currentStep.label}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-brand-text-light">
                                            Stage {Math.min(steps.length, currentIdx + 1)} of {steps.length} ({progressPct}%)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Empty Batch Status Warning & Quick Reopen Banner */}
                {batch.current_box_count === 0 && ['ready_to_close', 'sailed', 'arrived', 'under_customs_clearance', 'released_by_boc', 'received_at_warehouse'].includes(batch.status) && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                                <AlertTriangle className="size-3.5" />
                            </div>
                            <div className="text-xs min-w-0">
                                <span className="font-bold text-amber-700 dark:text-amber-400">Empty Container ({humanize(batch.status)}): </span>
                                <span className="text-amber-800 dark:text-amber-300 font-medium">
                                    0 boxes loaded. Change status back to <strong>Open</strong> to start loading.
                                </span>
                            </div>
                        </div>
                        <Link
                            href={`/admin/batches/${batch.id}/edit`}
                            className="inline-flex items-center justify-center h-7 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 shadow-xs"
                        >
                            Reopen to Open
                        </Link>
                    </div>
                )}

                {/* Summary Stat Grid */}
                <div className="bg-card rounded-xl border border-border shadow-2xs overflow-hidden">
                    <div className="grid grid-cols-2 divide-y divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
                        <div className="group flex items-center gap-2.5 py-2 px-3 sm:px-3.5 transition-colors hover:bg-brand-warm/10">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-brand-warm/20 text-brand-rust border border-border shrink-0">
                                <Package className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-brand-text-light uppercase tracking-wider">
                                    Loaded Boxes
                                </p>
                                <p className="text-xs sm:text-sm font-bold text-brand-text truncate">
                                    {capacityLabel}
                                </p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-2.5 py-2 px-3 sm:px-3.5 transition-colors hover:bg-brand-warm/10">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-brand-warm/20 text-brand-rust border border-border shrink-0">
                                <ContainerIcon className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-brand-text-light uppercase tracking-wider">
                                    Container Ref
                                </p>
                                <p className="font-mono text-xs sm:text-sm font-bold text-brand-text truncate">
                                    {batch.container_number?.toUpperCase() ?? '—'}
                                </p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-2.5 py-2 px-3 sm:px-3.5 transition-colors hover:bg-brand-warm/10">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-brand-warm/20 text-brand-rust border border-border shrink-0">
                                <ShieldCheck className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-brand-text-light uppercase tracking-wider">
                                    Seal Number
                                </p>
                                <p className="font-mono text-xs sm:text-sm font-bold text-brand-text truncate">
                                    {batch.seal_number ?? '—'}
                                </p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-2.5 py-2 px-3 sm:px-3.5 transition-colors hover:bg-brand-warm/10">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-brand-warm/20 text-brand-rust border border-border shrink-0">
                                <Ship className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-brand-text-light uppercase tracking-wider">
                                    Vessel
                                </p>
                                <p className="text-xs sm:text-sm font-bold text-brand-text uppercase truncate">
                                    {batch.vessel_name ?? '—'}
                                </p>
                            </div>
                        </div>

                        <div className="group flex items-center gap-2.5 py-2 px-3 sm:px-3.5 transition-colors hover:bg-brand-warm/10 col-span-2 sm:col-span-1">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-brand-warm/20 text-brand-rust border border-border shrink-0">
                                <Activity className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-brand-text-light uppercase tracking-wider">
                                    Status
                                </p>
                                <span
                                    className={cn(
                                        'inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-bold border capitalize',
                                        BATCH_STATUS_STYLES[batch.status ?? ''] ?? 'bg-brand-warm/10 text-brand-text-mid border-border'
                                    )}
                                >
                                    {humanize(batch.status ?? '')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Loaded Boxes Table */}
                <div className="bg-card rounded-2xl border border-border shadow-2xs overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card">
                        <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-md bg-brand-rust flex items-center justify-center text-white shadow-2xs shrink-0">
                                <Package className="size-4" />
                            </div>
                            <h2 className="font-sans text-sm font-semibold text-brand-text">Loaded Boxes</h2>
                            <span className="text-[10px] font-bold text-brand-text-light bg-brand-warm/20 px-2.5 py-0.5 rounded-full border border-border">
                                {loadedBoxSearch.trim()
                                    ? `${filteredLoadedBoxes.length} of ${batch.boxes?.length ?? 0}`
                                    : `${batch.boxes?.length ?? 0} Box(es)`}
                            </span>
                        </div>

                        {batch.boxes && batch.boxes.length > 0 && (
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-brand-text-light pointer-events-none" />
                                <input
                                    type="text"
                                    value={loadedBoxSearch}
                                    onChange={(e) => setLoadedBoxSearch(e.target.value)}
                                    placeholder="Search boxes by tracking, name, city..."
                                    className="w-full h-8 pl-8 pr-8 text-xs bg-brand-warm/10 dark:bg-zinc-900/60 border border-border rounded-lg placeholder:text-brand-text-light focus:outline-none focus:ring-1 focus:ring-brand-rust focus:border-brand-rust transition-all"
                                />
                                {loadedBoxSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setLoadedBoxSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-light hover:text-brand-text p-0.5 rounded-md"
                                        title="Clear search"
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {batch.boxes && batch.boxes.length > 0 ? (
                        filteredLoadedBoxes.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="border-b border-border bg-brand-warm/10 dark:bg-brand-warm/20 font-sans text-brand-text-mid">
                                        <tr>
                                            <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider">
                                                Tracking #
                                            </th>
                                            <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider">
                                                Booking #
                                            </th>
                                            <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider">
                                                Payment
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
                                    <tbody className="divide-y divide-border">
                                        {filteredLoadedBoxes.map((box) => (
                                            <tr
                                                key={box.id}
                                                className="transition-colors hover:bg-brand-warm/10"
                                            >
                                                <td className="px-6 py-4 font-mono text-sm font-bold text-brand-text">
                                                    {box.tracking_number}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-medium text-brand-text-mid">
                                                    {box.booking?.reference_number ?? '—'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border capitalize tracking-wide',
                                                            box.booking?.payment_status === 'paid'
                                                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                                                : box.booking?.payment_status === 'pending'
                                                                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                                                    : 'bg-brand-warm/10 text-brand-text-mid border-border'
                                                        )}
                                                    >
                                                        {box.booking?.payment_status ? humanize(box.booking.payment_status) : 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-brand-text">
                                                    <div className="flex items-center gap-2">
                                                        <User className="size-3.5 text-brand-text-light" />
                                                        <span className="text-sm font-medium">
                                                            {box.booking?.sender
                                                                ? `${box.booking.sender.first_name} ${box.booking.sender.last_name}`
                                                                : '—'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-brand-text">
                                                    <div className="flex items-center gap-2">
                                                        <Truck className="size-3.5 text-brand-text-light" />
                                                        <span className="text-sm font-medium">
                                                            {box.recipient?.name ?? '—'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-medium uppercase text-brand-text-mid">
                                                    {box.box_type?.name ?? '—'}
                                                </td>
                                                <td className="px-6 py-4 text-brand-text">
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
                                                            BOX_STATUS_STYLES[box.status] ?? 'bg-brand-warm/10 text-brand-text-mid border-border'
                                                        )}
                                                    >
                                                        {BOX_STATUS_CONFIG[box.status]?.label ?? humanize(box.status)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-10 text-center">
                                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-brand-warm/10 border border-border">
                                    <Search className="size-5 text-brand-text-light" />
                                </div>
                                <h3 className="text-sm font-semibold text-brand-text">
                                    No boxes match your search
                                </h3>
                                <p className="max-w-xs text-xs text-brand-text-light mt-1 mb-3">
                                    No loaded boxes matched <span className="font-semibold text-brand-text">"{loadedBoxSearch}"</span>.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setLoadedBoxSearch('')}
                                    className="text-xs font-semibold text-brand-rust hover:underline"
                                >
                                    Clear search
                                </button>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-warm/10 border border-border">
                                <Package className="size-8 text-brand-text-light" />
                            </div>
                            <h3 className="mb-1 text-sm font-semibold text-brand-text">
                                No boxes loaded yet
                            </h3>
                            <p className="max-w-sm text-xs text-brand-text-light leading-relaxed font-normal">
                                {canLoadBoxes
                                    ? 'Use the panel below to search and load boxes into this batch.'
                                    : 'No boxes have been assigned to this batch.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Bulk Tracking Phase Panel */}
                <div className="bg-card rounded-2xl border border-border shadow-2xs overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-card">
                        <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-md bg-amber-500 flex items-center justify-center text-white shadow-2xs shrink-0">
                                <Ship className="size-4" />
                            </div>
                            <div>
                                <h2 className="font-sans text-sm font-semibold text-brand-text">
                                    Bulk Tracking Phase Update
                                </h2>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                            BOC & Transit Milestones
                        </span>
                    </div>

                    <form className="p-4 sm:p-5 space-y-3" onSubmit={submitTrackingPhaseUpdate}>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <label
                                    htmlFor="tracking-phase-select"
                                    className="text-[11px] font-bold uppercase tracking-wider text-brand-text-light ml-0.5"
                                >
                                    Tracking Phase
                                </label>
                                <select
                                    id="tracking-phase-select"
                                    value={selectedTrackingPhase}
                                    onChange={(e) => setSelectedTrackingPhase(e.target.value)}
                                    disabled={!hasBatchBoxes || isTrackingPhaseSubmitting}
                                    className="flex h-9 w-full rounded-lg border border-border bg-card px-3 text-xs font-semibold text-brand-text shadow-2xs focus:ring-1 focus:ring-brand-rust outline-none disabled:cursor-not-allowed disabled:bg-brand-warm/10"
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

                            <div className="space-y-1">
                                <label
                                    htmlFor="tracking-phase-description"
                                    className="text-[11px] font-bold uppercase tracking-wider text-brand-text-light ml-0.5"
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
                                    className="flex h-9 w-full rounded-lg border border-border bg-card px-3 text-xs font-medium text-brand-text shadow-2xs focus:ring-1 focus:ring-brand-rust outline-none disabled:cursor-not-allowed disabled:bg-brand-warm/10"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border">
                            <p className="text-xs text-brand-text-light leading-snug">
                                {!hasBatchBoxes
                                    ? 'No boxes in this batch yet.'
                                    : selectedPhaseIsCurrent
                                    ? nextAllowedPhase
                                        ? `Already marked as ${selectedPhaseLabel}. Select ${nextAllowedPhase.group} - ${nextAllowedPhase.label} to continue.`
                                        : `Already marked as ${selectedPhaseLabel}. No later phase is available for your role.`
                                    : selectedPhaseIsPast
                                    ? 'This batch has already passed that tracking phase. Select a later phase to continue.'
                                    : `This will update ${batch.boxes.length} box${batch.boxes.length !== 1 ? 'es' : ''} with a tracking history entry.`}
                            </p>

                            <Button
                                type="submit"
                                disabled={
                                    !hasBatchBoxes ||
                                    !selectedTrackingPhase ||
                                    selectedPhaseIsCurrentOrPast ||
                                    isTrackingPhaseSubmitting
                                }
                                className="h-8 px-5 rounded-lg bg-brand-rust text-white text-xs font-semibold uppercase tracking-wide shadow-2xs transition-all hover:bg-brand-rust/90 active:scale-[0.98] flex items-center gap-1.5 disabled:cursor-not-allowed disabled:bg-brand-warm/10 disabled:text-brand-text-light disabled:shadow-none shrink-0"
                            >
                                {isTrackingPhaseSubmitting ? (
                                    <>
                                        <Loader2 className="size-3.5 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Ship className="size-3.5" />
                                        {selectedPhaseIsCurrentOrPast ? 'Already Updated' : 'Update All Boxes'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Load Boxes Panel — only show when batch is in "open" or "loading" status */}
                {canLoadBoxes && (
                    <div className="bg-card rounded-2xl border border-border shadow-2xs overflow-hidden">
                        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-7 rounded-md bg-emerald-600 flex items-center justify-center text-white shadow-2xs">
                                    <ContainerIcon className="size-4" />
                                </div>
                                <h2 className="font-sans text-sm font-semibold text-brand-text">Load Boxes</h2>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 animate-pulse">
                                Ready to Load
                            </span>
                        </div>

                        <div className="space-y-6 p-6 md:p-8">
                            {/* Search bar and Bulk Add */}
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                <div className="relative w-full max-w-md">
                                    <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-brand-text-light" />
                                    <input
                                        id="box-search"
                                        type="text"
                                        className="h-11 w-full rounded-xl border border-border bg-card pr-4 pl-10 text-xs font-medium text-brand-text shadow-2xs transition-all focus:ring-2 focus:ring-ring outline-none"
                                        placeholder="Search by tracking number or sender name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {isSearching && (
                                        <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-brand-rust" />
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    onClick={() => setIsBulkLoadModalOpen(true)}
                                    variant="outline"
                                    className="h-11 shrink-0 bg-card border-border text-brand-text hover:bg-brand-warm/20 rounded-xl"
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
                                                    className="flex items-center gap-2 text-xs font-semibold text-brand-rust hover:text-brand-rust/80 transition-colors cursor-pointer"
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
                                                <span className="text-xs font-medium text-brand-text-light">
                                                    {selectedIds.size} of {availableBoxes.length} selected
                                                </span>
                                            </div>

                                            <div className="overflow-x-auto rounded-xl border border-border">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="border-b border-border bg-brand-warm/10 dark:bg-brand-warm/20 font-sans text-brand-text-mid">
                                                        <tr>
                                                            <th className="w-12 px-4 py-3" />
                                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                                                Tracking #
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                                                Booking #
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                                                Payment
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
                                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                                                Box Status
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                                                Eligibility
                                                            </th>
                                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                                                                Batch Status
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border">
                                                        {availableBoxes.map((box) => {
                                                            const isSelected = selectedIds.has(box.id);
                                                            const isEligible = box.booking?.status !== 'cancelled' && (box.booking?.payment_status === 'paid' || box.booking?.payment_status === 'cash_collected' || box.booking?.invoice?.status === 'paid');

                                                            return (
                                                                <tr
                                                                    key={box.id}
                                                                    className={cn(
                                                                        'transition-colors',
                                                                        isEligible ? 'cursor-pointer hover:bg-brand-warm/10' : 'opacity-70 bg-gray-50/50 dark:bg-gray-900/50',
                                                                        isSelected ? 'bg-emerald-500/10' : ''
                                                                    )}
                                                                    onClick={() => {
                                                                        if (isEligible) toggleSelect(box.id);
                                                                    }}
                                                                >
                                                                    <td className="px-4 py-3 text-center">
                                                                        {isSelected ? (
                                                                            <CheckSquare className="size-4.5 text-emerald-500" />
                                                                        ) : (
                                                                            <Square className={cn("size-4.5", isEligible ? "text-brand-text-light" : "text-gray-300 dark:text-gray-700")} />
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono text-sm font-bold text-brand-text">
                                                                        {box.tracking_number}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-xs font-medium text-brand-text-mid">
                                                                        {box.booking?.reference_number ?? '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <span
                                                                            className={cn(
                                                                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border capitalize tracking-wide',
                                                                                box.booking?.payment_status === 'paid'
                                                                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                                                                    : box.booking?.payment_status === 'pending'
                                                                                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                                                                        : 'bg-brand-warm/10 text-brand-text-mid border-border'
                                                                            )}
                                                                        >
                                                                            {box.booking?.payment_status ? humanize(box.booking.payment_status) : 'N/A'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-brand-text">
                                                                        {box.booking?.sender
                                                                            ? `${box.booking.sender.first_name} ${box.booking.sender.last_name}`
                                                                            : '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-brand-text">
                                                                        {box.recipient?.name ?? '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-xs font-medium uppercase text-brand-text-mid">
                                                                        {box.box_type?.name ?? '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-brand-text">
                                                                        {box.destination || '—'}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <span
                                                                            className={cn(
                                                                                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border capitalize tracking-wide',
                                                                                BOX_STATUS_STYLES[box.status] ?? 'bg-brand-warm/10 text-brand-text-mid border-border'
                                                                            )}
                                                                        >
                                                                            {BOX_STATUS_CONFIG[box.status]?.label ?? humanize(box.status)}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-xs">
                                                                        {isEligible ? (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tracking-wide">
                                                                                <CheckCircle2 className="size-3" />
                                                                                Ready
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20 tracking-wide">
                                                                                <AlertTriangle className="size-3" />
                                                                                {box.booking?.status === 'cancelled' ? 'Cancelled' : 'Unpaid'}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-xs">
                                                                        {box.batch ? (
                                                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500 border border-amber-500/30">
                                                                                <Layers className="size-3" />
                                                                                {box.batch.batch_number} (Re-assign)
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                                                Unassigned
                                                                            </span>
                                                                        )}
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
                                                    className="h-11 px-8 rounded-xl bg-emerald-600 text-white text-xs font-semibold uppercase tracking-wide shadow-2xs transition-all hover:bg-emerald-700 active:scale-[0.98] flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-brand-warm/10 disabled:text-brand-text-light disabled:shadow-none cursor-pointer"
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
                                            <p className="text-xs text-brand-text-light font-medium">
                                                {searchQuery
                                                    ? 'No available boxes match your search.'
                                                    : 'No boxes are available for loading (must be in "Received by Warehouse" status and not assigned to any batch).'}
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            {!hasSearched && (
                                <div className="rounded-2xl border border-dashed border-border py-10 text-center bg-brand-warm/5">
                                    <Search className="mx-auto mb-3 size-7 text-brand-text-light" />
                                    <p className="text-xs font-semibold text-brand-text">
                                        Start typing to search for boxes available for loading.
                                    </p>
                                    <p className="mt-1 text-[10px] text-brand-text-light">
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
                description={`You are about to load ${selectedIds.size} box${selectedIds.size !== 1 ? 'es' : ''} into batch ${batch.batch_number}.${
                    availableBoxes.filter((b) => selectedIds.has(b.id) && b.batch_id).length > 0
                        ? ` Note: ${availableBoxes.filter((b) => selectedIds.has(b.id) && b.batch_id).length} box(es) currently assigned to another batch will be moved to this batch.`
                        : ''
                } Each box will be transitioned to "In Transit". Senders will be notified.`}
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
                customIcon={<Ship className="size-6 text-emerald-400" />}
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
                <DialogContent className="max-w-md p-6 rounded-2xl border border-border bg-card shadow-2xl gap-5">
                    <DialogHeader>
                        <DialogTitle className="font-sans text-base font-semibold text-brand-text tracking-tight">
                            Bulk Paste Tracking Numbers
                        </DialogTitle>
                        <DialogDescription className="mt-2 text-xs leading-relaxed text-brand-text-light font-normal">
                            Paste tracking numbers separated by commas, spaces, or new lines. These boxes will be assigned to batch {batch.batch_number}. If the boxes are pending or collected, they will be automatically marked as Received by Warehouse.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4">
                        <textarea
                            value={bulkTrackingNumbers}
                            onChange={(e) => setBulkTrackingNumbers(e.target.value)}
                            placeholder="BOX-001, BOX-002&#10;BOX-003"
                            className="w-full h-40 p-3 text-sm font-mono border border-border rounded-xl focus:ring-2 focus:ring-ring outline-none bg-card text-brand-text resize-none"
                        />
                    </div>

                    <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsBulkLoadModalOpen(false)}
                            disabled={isSubmitting}
                            className="h-9 rounded-lg px-4 text-xs font-medium border border-border bg-card text-brand-text hover:bg-brand-warm/20 transition-colors"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleBulkLoadBoxes}
                            disabled={isSubmitting || !bulkTrackingNumbers.trim()}
                            className="h-9 rounded-lg px-4 text-xs font-medium text-white bg-brand-rust hover:bg-brand-rust/90 transition-colors shadow-2xs cursor-pointer"
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
                <DialogContent className="max-w-md p-6 rounded-2xl border border-border bg-card shadow-2xl gap-5">
                    <DialogHeader>
                        <DialogTitle className="font-sans text-base font-semibold text-brand-text tracking-tight text-rose-500 flex items-center gap-2">
                            <Layers className="size-5" />
                            Some Tracking Numbers Were Skipped
                        </DialogTitle>
                        <DialogDescription className="mt-2 text-xs leading-relaxed text-brand-text-light font-normal">
                            The following tracking numbers could not be loaded into the batch:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
                        <ul className="space-y-2 text-xs text-rose-400 font-mono">
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
        </AppLayout>
    );
}

