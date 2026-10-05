import type { PageProps } from '@inertiajs/core';
import { Head, useForm, usePage, router, Link } from '@inertiajs/react';
import {
    Package, Ship, ShieldCheck, Layers, ScanLine, Truck, Home,
    Activity, ExternalLink, Camera, CheckCircle2, Sparkles
} from 'lucide-react';
import { useEffect, useMemo, useCallback, useState } from 'react';
import { toast } from 'sonner';
import Heading from '@/components/common/heading';
import { DeclarationAlert } from '@/components/logistics/DeclarationAlert';
import { TrackingDetailsCard } from '@/components/logistics/TrackingDetailsCard';
import { TrackingMultiBoxDashboard } from '@/components/logistics/TrackingMultiBoxDashboard';

import { TrackingSearchForm } from '@/components/logistics/TrackingSearchForm';
import { TrackingSkeleton } from '@/components/logistics/TrackingSkeleton';
import { TrackingTimeline } from '@/components/logistics/TrackingTimeline';
import { useRecentSearches } from '@/hooks/use-recent-searches';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import { resolveIcon } from '@/lib/logistics-utils';
import { cn, humanize } from '@/lib/utils';
import type { Auth, BreadcrumbItem } from '@/types';

// Logistics specific components and utilities
import type { TrackingData, TrackingStep, NormalizedStep } from '@/types/logistics';

interface AdminAnalytics {
    overall?: {
        total_lookups_today: number;
        total_lookups_all_time: number;
        unique_ips_today: number;
    };
    query_analytics?: {
        type: string;
        query: string;
        tracking_views_count: number;
        last_tracked_at?: string | null;
        logs?: Array<{
            id: number;
            search_query: string;
            ip_address: string | null;
            source: string;
            created_at: string;
        }>;
    } | null;
}

interface TrackProps {
    trackingData?: TrackingData;
    tracking_number?: string;
    trackingSteps?: TrackingStep[];
    adminAnalytics?: AdminAnalytics | null;
}

export default function Track({ trackingData, tracking_number, trackingSteps, adminAnalytics }: TrackProps) {
    const { auth } = usePage<PageProps & { auth: Auth }>().props;
    const isGuest = !auth.user;
    const Layout = isGuest ? MarketingLayout : AppLayout;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isGuest ? 'Home' : 'Dashboard', href: isGuest ? '/' : '/dashboard' },
        { title: 'Track', href: '/track' },
    ];

    const { data, setData, processing, errors, reset } = useForm({
        tracking_number: (tracking_number || trackingData?.tracking_number || '').trim(),
    });

    const [hasSearched, setHasSearched] = useState(!!trackingData || !!tracking_number);
    const [isCopied, setIsCopied] = useState(false);
    const [isHighlighted, setIsHighlighted] = useState(false);
    const [activeBoxTrackingNumber, setActiveBoxTrackingNumber] = useState<string>(
        trackingData?.tracking_number || ''
    );

    useEffect(() => {
        if (trackingData?.tracking_number) {
            const timer = setTimeout(() => {
                setActiveBoxTrackingNumber(trackingData.tracking_number);
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [trackingData?.tracking_number]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        if (params.get('highlight') === '1') {
            const timer = setTimeout(() => {
                setIsHighlighted(true);
            }, 0);
            const clearTimer = setTimeout(() => setIsHighlighted(false), 5000);

            return () => {
                clearTimeout(timer);
                clearTimeout(clearTimer);
            };
        }
    }, [trackingData]);

    const { recentSearches, addRecentSearch } = useRecentSearches();

    // Persist successful searches to recent
    useEffect(() => {
        if (trackingData?.tracking_number) {
            addRecentSearch(trackingData.tracking_number);
        }
    }, [trackingData?.tracking_number, addRecentSearch]);

    const handleSearch = useCallback((num?: string) => {
        const searchNum = (num || data.tracking_number).trim();

        if (!searchNum) {
            return;
        }

        setHasSearched(true);
        setData('tracking_number', searchNum);

        router.get('/track', { tracking_number: searchNum }, {
            preserveState: true
        });
    }, [data.tracking_number, setData]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSearch();
    };

    const handleClear = () => {
        reset('tracking_number');
        setHasSearched(false);
    };

    // Dynamically derive active tracking data based on selected box in multi-box booking
    const activeTrackingData = useMemo((): TrackingData => {
        if (!trackingData) {
            return {} as TrackingData;
        }

        if (!trackingData.all_boxes || trackingData.all_boxes.length === 0) {
            return trackingData;
        }

        const selectedBox = trackingData.all_boxes.find(
            (b) => b.tracking_number === activeBoxTrackingNumber
        );

        if (!selectedBox) {
            return trackingData;
        }

        return {
            ...trackingData,
            tracking_number: selectedBox.tracking_number,
            status: selectedBox.status,
            status_label: selectedBox.status_label || selectedBox.status,
            recipient_name: selectedBox.recipient_name || trackingData.recipient_name,
            destination: selectedBox.destination || trackingData.destination,
            box_type: selectedBox.box_type || trackingData.box_type,
            area: selectedBox.area ?? trackingData.area,
            current_milestone_id: selectedBox.current_milestone_id ?? trackingData.current_milestone_id,
            eta_date: selectedBox.eta_date ?? trackingData.eta_date,
            eta_message: selectedBox.eta_message ?? trackingData.eta_message,
            delivery_proof_url: selectedBox.delivery_proof_url ?? trackingData.delivery_proof_url,
            pickup_proof_url: selectedBox.pickup_proof_url ?? trackingData.pickup_proof_url,
            damage_photo_url: selectedBox.damage_photo_url ?? trackingData.damage_photo_url,
            has_delivery_proof: selectedBox.has_delivery_proof ?? trackingData.has_delivery_proof,
            has_pickup_proof: selectedBox.has_pickup_proof ?? trackingData.has_pickup_proof,
            has_signature: selectedBox.has_signature ?? trackingData.has_signature,
            signature_url: selectedBox.signature_url ?? trackingData.signature_url,
            batch: selectedBox.batch ? {
                batch_number: selectedBox.batch.batch_number,
                status: selectedBox.batch.status,
                status_label: selectedBox.batch.status_label,
                container_number: selectedBox.batch.container_number,
                seal_number: selectedBox.batch.seal_number,
                vessel_name: selectedBox.batch.vessel_name,
                voyage_number: selectedBox.batch.voyage_number,
                shipping_line: selectedBox.batch.shipping_line,
                origin_port: selectedBox.batch.origin_port,
                destination_port: selectedBox.batch.destination_port,
                branch_code: selectedBox.batch.branch_code,
                eta_at: selectedBox.batch.eta_at,
            } : null,
            timeline: selectedBox.timeline && selectedBox.timeline.length > 0 ? selectedBox.timeline : trackingData.timeline,
        };
    }, [trackingData, activeBoxTrackingNumber]);

    const copyToClipboard = () => {
        const num = activeTrackingData?.tracking_number || trackingData?.tracking_number || tracking_number || data.tracking_number;

        if (!num) {
            return;
        }

        navigator.clipboard.writeText(num);
        setIsCopied(true);
        toast.success('Tracking ID copied');
        setTimeout(() => setIsCopied(false), 2000);
    };

    const dynamicSteps = useMemo((): NormalizedStep[] => {
        if (trackingSteps && trackingSteps.length > 0) {
            return [...trackingSteps]
                .filter((step) => step.is_public !== false)
                .sort((a, b) => a.order - b.order)
                .map((step) => ({
                    label: step.label,
                    statusKey: step.key,
                    systemStatus: step.system_status,
                    stepType: step.step_type,
                    description: step.customer_message || step.description,
                    icon: resolveIcon(step.icon),
                    isPublic: step.is_public,
                    customerMessage: step.customer_message,
                }));
        }

        if (activeTrackingData?.area_milestones && activeTrackingData.area_milestones.length > 0) {
            return activeTrackingData.area_milestones.map((m) => ({
                label: m.name,
                statusKey: String(m.id),
                icon: m.is_final ? Home : Truck,
            }));
        }

        // Default Fallback Steps if no settings configured
        return [
            { label: 'Pending Confirmation', statusKey: 'pending', systemStatus: 'pending', icon: Package },
            { label: 'Collected', statusKey: 'collected', systemStatus: 'collected', icon: Truck },
            { label: 'In Transit', statusKey: 'in_transit', systemStatus: 'in_transit', icon: Ship },
            { label: 'Delivered', statusKey: 'delivered', systemStatus: 'delivered', icon: Home },
        ];
    }, [activeTrackingData?.area_milestones, trackingSteps]);

    const currentStepIndex = useMemo(() => {
        if (!activeTrackingData || dynamicSteps.length === 0) {
            return 0;
        }

        const { status, booking_status, confirmed_at, current_milestone_id, area_milestones, timeline } = activeTrackingData;
        const rawStatus = (status || '').toLowerCase().trim();
        const s = rawStatus.replace(/_/g, ' ');
        const isBookingConfirmed = (booking_status || '').toLowerCase() === 'confirmed' ||
            Boolean(confirmed_at) ||
            s === 'confirmed' ||
            rawStatus === 'confirmed';

        // 1. Delivered state: Always map to delivered milestone
        if (rawStatus === 'delivered' || s === 'delivered') {
            const deliveredIdx = dynamicSteps.findIndex(
                (step) => step.systemStatus === 'delivered' || step.statusKey === 'delivered'
            );
            return deliveredIdx !== -1 ? deliveredIdx : dynamicSteps.length - 1;
        }

        // 2. Pre-pickup handling (Box is pending / awaiting collection)
        const isPrePickup = [
            'pending',
            'draft',
            'confirmed',
            'awaiting_pickup',
            'statuses.box.pending',
            'statuses.booking.pending',
            'statuses.booking.confirmed',
        ].includes(rawStatus) || s.includes('pending') || s.includes('confirmed') || s.includes('draft');

        if (isPrePickup) {
            const confirmedIdx = dynamicSteps.findIndex(
                (step) => step.statusKey === 'booking_confirmed' || step.systemStatus === 'confirmed' || step.statusKey === 'confirmed'
            );
            const pendingIdx = dynamicSteps.findIndex(
                (step) => step.statusKey === 'pending' || step.systemStatus === 'pending' || step.statusKey === 'booking_placed' || step.statusKey === 'booking_created'
            );

            if (isBookingConfirmed && confirmedIdx !== -1) {
                return confirmedIdx;
            }

            return pendingIdx !== -1 ? pendingIdx : 0;
        }

        // 3. Match by milestone ID if available
        if (area_milestones && current_milestone_id) {
            const index = area_milestones.findIndex((m) => m.id === current_milestone_id);
            if (index !== -1) {
                return index;
            }
        }

        // 4. Match by system status or exact status key
        const systemMatch = dynamicSteps.findIndex((step) =>
            step.systemStatus?.toLowerCase() === rawStatus ||
            step.statusKey.toLowerCase() === rawStatus ||
            step.systemStatus?.toLowerCase().replace(/_/g, ' ') === s ||
            step.statusKey.toLowerCase().replace(/_/g, ' ') === s
        );

        if (systemMatch !== -1) {
            return systemMatch;
        }

        // 5. Match by latest phase in timeline
        if (timeline && timeline.length > 0) {
            for (const event of timeline) {
                const eventPhase = (event.tracking_phase || '').toLowerCase().trim();
                const eventStatus = (event.status || '').toLowerCase().trim();

                const matchIdx = dynamicSteps.findIndex((step) =>
                    (eventPhase && (step.statusKey.toLowerCase() === eventPhase || step.systemStatus?.toLowerCase() === eventPhase)) ||
                    (eventStatus && (step.statusKey.toLowerCase() === eventStatus || step.systemStatus?.toLowerCase() === eventStatus))
                );

                if (matchIdx !== -1) {
                    return matchIdx;
                }
            }
        }

        // 6. Heuristic fallbacks for remaining statuses
        if (s.includes('out for delivery') || s.includes('dispatched')) {
            const outIndex = dynamicSteps.findIndex(
                (step) => step.statusKey === 'out_for_delivery' || step.systemStatus === 'out_for_delivery'
            );
            if (outIndex !== -1) {
                return outIndex;
            }
        }

        if (s.includes('transit') || s.includes('shipping') || s.includes('vessel') || s.includes('container') || s.includes('arrived')) {
            const transitIdx = dynamicSteps.findIndex(
                (step) => step.statusKey === 'in_transit' || step.systemStatus === 'in_transit' || step.label?.toLowerCase().includes('transit')
            );
            if (transitIdx !== -1) {
                return transitIdx;
            }
            return Math.max(1, Math.floor(dynamicSteps.length / 2));
        }

        if (s.includes('collected') || s.includes('picked')) {
            const pickedIndex = dynamicSteps.findIndex(
                (step) => step.statusKey === 'picked_up' || step.systemStatus === 'collected'
            );
            return pickedIndex !== -1 ? pickedIndex : 1;
        }

        return 0;
    }, [activeTrackingData, dynamicSteps]);

    // Stepper steps for TrackingDetailsCard hero section:
    // Dynamically uses configured dynamicSteps (if <= 6 steps, 100% 1:1 match).
    // If > 6 steps, extracts key milestone anchors dynamically without any hardcoding.
    const stepperSteps = useMemo((): NormalizedStep[] => {
        if (dynamicSteps.length <= 6) {
            return dynamicSteps;
        }

        const firstStep = dynamicSteps[0];
        const lastStep = dynamicSteps[dynamicSteps.length - 1];

        const pickupStep = dynamicSteps.find((s) =>
            s.systemStatus === 'collected' || s.statusKey === 'collected' || s.statusKey === 'picked_up'
        );

        const transitStep = dynamicSteps.find((s) =>
            s.systemStatus === 'in_transit' || s.statusKey === 'in_transit' || s.statusKey.includes('transit') || s.statusKey.includes('sea')
        );

        const deliveryStep = dynamicSteps.find((s) =>
            s.systemStatus === 'out_for_delivery' || s.statusKey === 'out_for_delivery' || s.statusKey.includes('delivery')
        );

        const anchors = [firstStep, pickupStep, transitStep, deliveryStep, lastStep].filter(
            (step, idx, arr): step is NormalizedStep => Boolean(step) && arr.indexOf(step) === idx
        );

        return anchors.length >= 3 ? anchors : dynamicSteps.slice(0, 5);
    }, [dynamicSteps]);

    const stepperCurrentIndex = useMemo(() => {
        if (!activeTrackingData || stepperSteps.length === 0) {
            return 0;
        }

        const activeStep = dynamicSteps[currentStepIndex];
        if (!activeStep) {
            return 0;
        }

        const matchIdx = stepperSteps.findIndex((s) =>
            s.statusKey === activeStep.statusKey ||
            (s.systemStatus && s.systemStatus === activeStep.systemStatus)
        );
        if (matchIdx !== -1) {
            return matchIdx;
        }

        const ratio = currentStepIndex / Math.max(1, dynamicSteps.length - 1);
        return Math.min(stepperSteps.length - 1, Math.round(ratio * (stepperSteps.length - 1)));
    }, [activeTrackingData, dynamicSteps, currentStepIndex, stepperSteps]);

    const isMultiBox = trackingData?.is_multi_box || trackingData?.is_booking_search || (trackingData?.all_boxes && trackingData.all_boxes.length > 1);

    return (
        <Layout hideLogin {...(!isGuest ? { breadcrumbs } : {})}>
            <Head title="Track Shipment" />

            <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6 md:space-y-10 min-h-150">
                {/* Page Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-zinc-100 dark:border-zinc-800 pb-4 md:pb-8">
                    <Heading
                        eyebrow="Track Shipment"
                        title="Track Shipment"
                        description="Enter your box tracking ID (TRK-...) or booking reference (BK-...) to view real-time shipment status."
                    />
                </div>

                {/* Search Bar Section */}
                <TrackingSearchForm
                    value={data.tracking_number}
                    onChange={(val) => setData('tracking_number', val)}
                    onSubmit={submit}
                    onClear={handleClear}
                    onRecentClick={handleSearch}
                    processing={processing}
                    errors={errors}
                    recentSearches={recentSearches}
                    hasResult={!!trackingData}
                />


                {!hasSearched && !trackingData && !processing && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                        <div className="card p-5 md:p-6 space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group">
                            <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ScanLine className="size-5" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Real-time Updates</h4>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">Get live notifications as your box moves from pickup to final delivery.</p>
                            </div>
                        </div>
                        <div className="card p-5 md:p-6 space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group">
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ShieldCheck className="size-5" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Secure Transit</h4>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">Every milestone is verified by our logistics command center for your peace of mind.</p>
                            </div>
                        </div>
                        <div className="card p-5 md:p-6 space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group">
                            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Package className="size-5" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Multi-Box Support</h4>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">Search using your Booking Reference (e.g. BK-2026-013) to view status for all boxes in your shipment.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {processing && <TrackingSkeleton />}

                {/* Results Section */}
                {trackingData && !processing && (
                    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                        {/* Admin Intelligence Banner (Admin & SuperAdmin only) */}
                        {adminAnalytics?.query_analytics && (
                            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200">
                                        <Activity className="size-4" />
                                    </div>
                                    <div>
                                        <span className="font-bold uppercase tracking-wider text-[10px] text-purple-700 dark:text-purple-300 block">Admin Intelligence</span>
                                        <span className="font-medium text-xs">
                                            This {adminAnalytics.query_analytics.type} has been looked up <strong>{adminAnalytics.query_analytics.tracking_views_count}</strong> {adminAnalytics.query_analytics.tracking_views_count === 1 ? 'time' : 'times'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {adminAnalytics.query_analytics.last_tracked_at && (
                                        <span className="text-[11px] text-purple-600 dark:text-purple-400 font-mono hidden sm:inline">
                                            Last: {new Date(adminAnalytics.query_analytics.last_tracked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                    <Link
                                        href={`/admin/tracking-analytics?search=${encodeURIComponent(adminAnalytics.query_analytics.query)}`}
                                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition-colors shadow-2xs cursor-pointer"
                                    >
                                        <span>Audit Logs</span>
                                        <ExternalLink className="size-3" />
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Multi-Box Dashboard (Unified Header & Box Selector) */}
                        {isMultiBox ? (
                            <div className="space-y-6">
                                <TrackingMultiBoxDashboard
                                    trackingData={trackingData}
                                    activeTrackingNumber={activeTrackingData.tracking_number}
                                    onSelectBox={(num) => setActiveBoxTrackingNumber(num)}
                                />
                                <TrackingDetailsCard
                                    trackingData={activeTrackingData}
                                    isCopied={isCopied}
                                    onCopy={copyToClipboard}
                                    steps={stepperSteps}
                                    currentIndex={stepperCurrentIndex}
                                    isHighlighted={isHighlighted}
                                />
                            </div>
                        ) : (
                            /* Single Box Unified Command Hero Card */
                            <TrackingDetailsCard
                                trackingData={activeTrackingData}
                                isCopied={isCopied}
                                onCopy={copyToClipboard}
                                steps={stepperSteps}
                                currentIndex={stepperCurrentIndex}
                                isHighlighted={isHighlighted}
                            />
                        )}

                        {/* Customs Declaration Alert */}
                        {activeTrackingData.booking_id && activeTrackingData.declaration_form_status === 'missing' && activeTrackingData.status?.toLowerCase() !== 'cancelled' && (
                            <DeclarationAlert
                                bookingId={activeTrackingData.booking_id}
                                trackingNumber={activeTrackingData.tracking_number || activeTrackingData.booking_reference}
                                canEdit={Boolean(auth.user)}
                                resendsRemaining={activeTrackingData.declaration_resends_remaining}
                                senderEmailMasked={activeTrackingData.sender_email_masked}
                            />
                        )}

                        {/* Delivered Celebration Banner */}
                        {activeTrackingData.status?.toLowerCase() === 'delivered' && (
                            <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-linear-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 p-6 md:p-8 shadow-glow-emerald animate-in fade-in zoom-in-95 duration-700">
                                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="size-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shrink-0">
                                            <Sparkles className="size-6 animate-spin" style={{ animationDuration: '6s' }} />
                                        </div>
                                        <div>
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-1">
                                                <span>Mission Accomplished</span>
                                            </div>
                                            <h3 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                                                Maligayang Pagdating! Package Safely Delivered
                                            </h3>
                                            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mt-1 max-w-xl leading-relaxed">
                                                Your balikbayan box has reached its destination in the Philippines and was handed directly to your recipient. Thank you for trusting Eagle Express Cargo with your padala!
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end md:self-center">
                                        <span className="px-3.5 py-1.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-emerald-500/30 text-xs font-black text-emerald-700 dark:text-emerald-300 shadow-xs flex items-center gap-1.5">
                                            <ShieldCheck className="size-4 text-emerald-500" />
                                            Doorstep Verified
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Ocean Freight / Batch Shipment Details Card (Visible only when box is assigned to a batch) */}
                        {Boolean(
                            activeTrackingData.batch &&
                            (activeTrackingData.batch.batch_number ||
                                activeTrackingData.batch.container_number ||
                                activeTrackingData.batch.origin_port ||
                                activeTrackingData.batch.destination_port)
                        ) &&
                            activeTrackingData.status?.toLowerCase() !== 'delivered' &&
                            activeTrackingData.status?.toLowerCase() !== 'cancelled' && (
                                <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900 shadow-md group min-h-35 sm:min-h-40 flex flex-col justify-between p-3.5 sm:p-5">
                                    {/* Backdrop Image & Gradient */}
                                    <img
                                        src="/images/ocean_freight_vessel.jpg"
                                        alt="Freight Vessel"
                                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 pointer-events-none"
                                    />
                                    <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/60 to-black/35 pointer-events-none" />

                                    {/* Top Row: Voyage & Container Badges */}
                                    <div className="relative z-10 flex items-center justify-between gap-2 flex-wrap">
                                        <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                                            <Ship className="size-3 text-sky-400 animate-pulse" />
                                            <span>
                                                {activeTrackingData.batch?.shipping_line
                                                    ? `${activeTrackingData.batch.shipping_line} Sea Lane`
                                                    : activeTrackingData.batch?.vessel_name
                                                        ? activeTrackingData.batch.vessel_name
                                                        : 'Ocean Freight Transit'}
                                            </span>
                                        </span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {activeTrackingData.batch?.container_number && (
                                                <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/10 text-white text-[9px] sm:text-[10px] font-mono font-bold">
                                                    Container: {activeTrackingData.batch.container_number}
                                                </span>
                                            )}
                                            {activeTrackingData.batch?.batch_number && (
                                                <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white text-[9px] sm:text-[10px] font-mono font-semibold">
                                                    Batch: {activeTrackingData.batch.batch_number}
                                                </span>
                                            )}
                                            {activeTrackingData.batch?.seal_number && (
                                                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-[9px] font-mono hidden md:inline-flex">
                                                    Seal: {activeTrackingData.batch.seal_number}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Row: Nautical Route & Live Transit Status */}
                                    <div className="relative z-10 flex items-end justify-between gap-3 text-white pt-3 sm:pt-4">
                                        <div className="min-w-0">
                                            {(activeTrackingData.batch?.origin_port || activeTrackingData.batch?.destination_port) ? (
                                                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold text-sky-300 uppercase tracking-wider flex-wrap">
                                                    {activeTrackingData.batch.origin_port && (
                                                        <span className="text-white">{activeTrackingData.batch.origin_port}</span>
                                                    )}
                                                    {activeTrackingData.batch.origin_port && activeTrackingData.batch.destination_port && (
                                                        <span className="text-zinc-400">→</span>
                                                    )}
                                                    {activeTrackingData.batch.destination_port && (
                                                        <span className="text-amber-400 font-extrabold">{activeTrackingData.batch.destination_port}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-[11px] sm:text-xs font-bold text-sky-300 uppercase tracking-wider">
                                                    Ocean Freight Shipment
                                                </div>
                                            )}
                                            {(() => {
                                                const meta: string[] = [];
                                                if (activeTrackingData.batch?.vessel_name) {
                                                    meta.push(`Vessel: ${activeTrackingData.batch.vessel_name}`);
                                                }
                                                if (activeTrackingData.batch?.voyage_number) {
                                                    meta.push(`Voyage: ${activeTrackingData.batch.voyage_number}`);
                                                }
                                                if (activeTrackingData.batch?.eta_at) {
                                                    meta.push(`ETA: ${activeTrackingData.batch.eta_at}`);
                                                }
                                                if (meta.length > 0) {
                                                    return (
                                                        <p className="text-[10px] sm:text-xs text-zinc-300 font-medium mt-0.5 hidden sm:block truncate">
                                                            {meta.join(' • ')}
                                                        </p>
                                                    );
                                                }
                                                if (activeTrackingData.batch?.shipping_line) {
                                                    return (
                                                        <p className="text-[10px] sm:text-xs text-zinc-300 font-medium mt-0.5 hidden sm:block truncate">
                                                            Handled by {activeTrackingData.batch.shipping_line}
                                                        </p>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        {(() => {
                                            const rawStatus = (activeTrackingData.batch?.status || '').toLowerCase();
                                            const statusLabel =
                                                activeTrackingData.batch?.status_label ||
                                                humanize(rawStatus) ||
                                                'In Transit';
                                            const isSailed = rawStatus === 'sailed' || rawStatus.includes('transit');
                                            const isArrived = rawStatus === 'arrived';
                                            const isLoading = rawStatus === 'loading' || rawStatus === 'open';

                                            return (
                                                <div className="text-right shrink-0">
                                                    <span className="text-[8px] uppercase font-bold tracking-widest text-zinc-400 block mb-0.5">
                                                        Batch Status
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            "inline-flex items-center text-[10px] sm:text-xs font-black px-2.5 py-0.5 sm:py-1 rounded-md whitespace-nowrap shadow-xs border",
                                                            isSailed
                                                                ? "text-emerald-400 bg-emerald-950/80 border-emerald-500/40"
                                                                : isArrived
                                                                    ? "text-sky-300 bg-sky-950/80 border-sky-500/40"
                                                                    : isLoading
                                                                        ? "text-amber-300 bg-amber-950/80 border-amber-500/40"
                                                                        : "text-emerald-400 bg-emerald-950/80 border-emerald-500/40"
                                                        )}
                                                    >
                                                        {statusLabel}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}


                        {/* Main Content: Timeline & Sidebar */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                                        <Package className="size-4 text-brand-rust" /> Transit Journey ({activeTrackingData.tracking_number})
                                    </h3>
                                </div>
                                <TrackingTimeline
                                    timeline={activeTrackingData.timeline}
                                    steps={dynamicSteps}
                                    currentIndex={currentStepIndex}
                                    currentStatus={activeTrackingData.status}
                                />
                            </div>

                            <div className="space-y-6 md:space-y-8 lg:sticky lg:top-6 self-start">
                                {/* Proof of Delivery Card (Visible only when Delivered) */}
                                {activeTrackingData.status?.toLowerCase() === 'delivered' &&
                                    (activeTrackingData.has_delivery_proof ||
                                     activeTrackingData.has_signature ||
                                     activeTrackingData.delivery_proof_url ||
                                     activeTrackingData.signature_url) && (
                                    <div className="card overflow-hidden border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10 shadow-sm animate-in fade-in duration-300">
                                        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-emerald-500/10 dark:bg-emerald-950/30 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="size-4 text-emerald-500" />
                                                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                                                    Proof of Delivery
                                                </h4>
                                            </div>
                                            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                                                Verified
                                            </span>
                                        </div>

                                        <div className="p-4 sm:p-5 space-y-3">
                                            {/* Delivery Photo (Privacy Protected - No Image on Public) */}
                                            {(activeTrackingData.has_delivery_proof || activeTrackingData.delivery_proof_url) && (
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400">
                                                    <Camera className="size-4 text-emerald-500 shrink-0" />
                                                    <div className="space-y-0.5">
                                                        <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                                                            Doorstep / Handover Photo Verified
                                                        </span>
                                                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                                                            Proof photo captured on delivery. Confidential for recipient privacy.
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Recipient Signature (Privacy Protected - No Image on Public) */}
                                            {(activeTrackingData.has_signature || activeTrackingData.signature_url) && (
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400">
                                                    <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                                                    <div className="space-y-0.5">
                                                        <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                                                            Recipient Signature Verified
                                                        </span>
                                                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                                                            Digital signature recorded on courier handover.
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Details Card */}
                                <div className="card overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                                    <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                            <Layers className="size-3.5 text-zinc-500" /> Shipment Details
                                        </h3>
                                    </div>
                                    <div className="px-4 py-2.5 sm:px-5 sm:py-3 divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                                        <div className="flex items-center justify-between py-2 first:pt-0">
                                            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Booking Ref</span>
                                            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                                                #{trackingData.booking_reference || trackingData.booking_id}
                                            </span>
                                        </div>

                                        {isMultiBox && (
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Active Box</span>
                                                <span className="font-mono font-bold text-brand-rust">
                                                    {activeTrackingData.tracking_number}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Payment</span>
                                            <span className={cn(
                                                "inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider",
                                                trackingData.payment_status === 'paid'
                                                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50"
                                                    : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50"
                                            )}>
                                                {humanize(trackingData.payment_status)}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between py-2 last:pb-0">
                                            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Destination Area</span>
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                                                {activeTrackingData.area?.name || trackingData.area?.name || 'Standard Zone'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Subtle Integrated Verification Trust Footer */}
                                    <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center gap-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                                        <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        <span>Official trace verified by logistics command.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Not Found State */}
                {hasSearched && !trackingData && !processing && (
                    <div className="card p-6 md:p-16 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-[18px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-300 dark:text-zinc-550">
                            <Package className="size-8" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Shipment Not Found</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                                The tracking ID or booking reference you entered does not match any records. Please check and try again.
                            </p>
                        </div>
                    </div>
                )}

            </div>
        </Layout>
    );
}
