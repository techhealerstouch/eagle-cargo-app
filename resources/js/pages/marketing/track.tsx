import type { PageProps } from '@inertiajs/core';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import {
    Package, Ship, ShieldCheck, Layers, ScanLine, Truck, MapPin, Home, AlertCircle, CalendarClock
} from 'lucide-react';
import { useEffect, useMemo, useCallback, useState } from 'react';
import { toast } from 'sonner';
import Heading from '@/components/common/heading';
import { DeclarationAlert } from '@/components/logistics/DeclarationAlert';
import { TrackingDetailsCard } from '@/components/logistics/TrackingDetailsCard';
import { TrackingMultiBoxDashboard } from '@/components/logistics/TrackingMultiBoxDashboard';
import { TrackingProgressStepper } from '@/components/logistics/TrackingProgressStepper';

import { TrackingSearchForm } from '@/components/logistics/TrackingSearchForm';
import { TrackingSkeleton } from '@/components/logistics/TrackingSkeleton';
import { TrackingTimeline } from '@/components/logistics/TrackingTimeline';
import { Button } from '@/components/ui/button';
import { useRecentSearches } from '@/hooks/use-recent-searches';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import { resolveIcon } from '@/lib/logistics-utils';
import { cn, humanize } from '@/lib/utils';
import type { Auth, BreadcrumbItem } from '@/types';

// Logistics specific components and utilities
import type { TrackingData, TrackingStep, NormalizedStep } from '@/types/logistics';

interface TrackProps {
    trackingData?: TrackingData;
    tracking_number?: string;
    trackingSteps?: TrackingStep[];
}

export default function Track({ trackingData, tracking_number, trackingSteps }: TrackProps) {
    const { auth } = usePage<PageProps & { auth: Auth }>().props;
    const isGuest = !auth.user;
    const Layout = isGuest ? MarketingLayout : AppLayout;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: isGuest ? 'Home' : 'Dashboard', href: isGuest ? '/' : '/dashboard' },
        { title: 'Track', href: '/track' },
    ];

    const { data, setData, get, processing, errors, reset } = useForm({
        tracking_number: (tracking_number || trackingData?.tracking_number || '').trim(),
    });

    const [hasSearched, setHasSearched] = useState(!!trackingData);
    const [isCopied, setIsCopied] = useState(false);
    const [isHighlighted, setIsHighlighted] = useState(false);
    const [activeBoxTrackingNumber, setActiveBoxTrackingNumber] = useState<string>(
        trackingData?.tracking_number || ''
    );

    useEffect(() => {
        if (trackingData?.tracking_number) {
            setActiveBoxTrackingNumber(trackingData.tracking_number);
        }
    }, [trackingData?.tracking_number]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('highlight') === '1') {
            setIsHighlighted(true);
            const timer = setTimeout(() => {
                setIsHighlighted(false);
            }, 5000);
            return () => clearTimeout(timer);
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
        if (!trackingData) return {} as TrackingData;
        if (!trackingData.all_boxes || trackingData.all_boxes.length === 0) return trackingData;

        const selectedBox = trackingData.all_boxes.find(
            (b) => b.tracking_number === activeBoxTrackingNumber
        );

        if (!selectedBox) return trackingData;

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
            batch: selectedBox.batch ? {
                batch_number: selectedBox.batch.batch_number,
                status: selectedBox.batch.status,
                container_number: selectedBox.batch.container_number,
                vessel_name: selectedBox.batch.vessel_name,
                voyage_number: selectedBox.batch.voyage_number,
                shipping_line: selectedBox.batch.shipping_line,
                origin_port: selectedBox.batch.origin_port,
                destination_port: selectedBox.batch.destination_port,
                branch_code: selectedBox.batch.branch_code,
                eta_at: selectedBox.batch.eta_at,
            } : trackingData.batch,
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
                .sort((a, b) => a.order - b.order)
                .map((step) => ({
                    label: step.label,
                    statusKey: step.key,
                    systemStatus: step.system_status,
                    description: step.description,
                    icon: resolveIcon(step.icon),
                }));
        }

        if (activeTrackingData?.area_milestones && activeTrackingData.area_milestones.length > 0) {
            return activeTrackingData.area_milestones.map((m) => ({
                label: m.name,
                statusKey: String(m.id),
                icon: m.is_final ? Home : Truck,
            }));
        }

        // Default Fallback Steps
        return [
            { label: 'Manifested', statusKey: 'pending', icon: Package },
            { label: 'Collected', statusKey: 'collected', icon: Truck },
            { label: 'In Transit', statusKey: 'in_transit', icon: Ship },
            { label: 'Delivered', statusKey: 'delivered', icon: Home },
        ];
    }, [activeTrackingData?.area_milestones, trackingSteps]);

    const simplifiedSteps = useMemo((): NormalizedStep[] => {
        return [
            { label: 'Manifested', statusKey: 'manifested', icon: Package },
            { label: 'Collected', statusKey: 'collected', icon: Truck },
            { label: 'In Transit', statusKey: 'in_transit', icon: Ship },
            { label: 'Out for Delivery', statusKey: 'out_for_delivery', icon: Truck },
            { label: 'Delivered', statusKey: 'delivered', icon: ShieldCheck },
        ];
    }, []);

    const simplifiedStepIndex = useMemo(() => {
        if (!activeTrackingData) {
            return 0;
        }

        const rawStatus = (activeTrackingData.status_label || activeTrackingData.status || '').toLowerCase();
        const s = rawStatus.replace(/_/g, ' ');

        if (s === 'delivered') {
            return 4;
        }

        if (
            s.includes('manila') ||
            s.includes('sorting') ||
            s.includes('hub') ||
            s.includes('out for delivery') ||
            s.includes('dispatched') ||
            s.includes('delivery scheduling')
        ) {
            return 3;
        }

        if (
            s.includes('transit') ||
            s.includes('shipping') ||
            s.includes('container') ||
            s.includes('philippines') ||
            s.includes('boc') ||
            s.includes('clearance') ||
            s.includes('arrived') ||
            s.includes('unloaded') ||
            s.includes('roro')
        ) {
            return 2;
        }

        if (
            s.includes('collected') ||
            s.includes('picked') ||
            s.includes('warehouse') ||
            s.includes('received')
        ) {
            return 1;
        }

        return 0;
    }, [activeTrackingData]);

    const currentStepIndex = useMemo(() => {
        if (!activeTrackingData) {
            return 0;
        }

        const { status, current_milestone_id, area_milestones, timeline } = activeTrackingData;
        const rawStatus = (status || '').toLowerCase();
        const s = rawStatus.replace(/_/g, ' ');

        // 1. Match by milestone ID if available
        if (area_milestones && current_milestone_id) {
            const index = area_milestones.findIndex((m) => m.id === current_milestone_id);

            if (index !== -1) {
                return index;
            }
        }

        // 2. Match by latest phase in timeline
        if (timeline && timeline.length > 0) {
            const latestPhase = timeline[0].tracking_phase?.toLowerCase();

            if (latestPhase) {
                const phaseIndex = dynamicSteps.findIndex((step) =>
                    step.statusKey.toLowerCase() === latestPhase ||
                    step.systemStatus?.toLowerCase() === latestPhase ||
                    step.statusKey.toLowerCase().replace(/_/g, ' ') === latestPhase.replace(/_/g, ' ')
                );

                if (phaseIndex !== -1) {
                    return phaseIndex;
                }
            }
        }

        // 3. Match by system status or exact status key
        const systemMatch = dynamicSteps.findIndex((step) =>
            step.systemStatus?.toLowerCase() === rawStatus ||
            step.statusKey.toLowerCase() === rawStatus ||
            step.systemStatus?.toLowerCase().replace(/_/g, ' ') === s ||
            step.statusKey.toLowerCase().replace(/_/g, ' ') === s
        );

        if (systemMatch !== -1) {
            return systemMatch;
        }

        // 4. Heuristic fallbacks
        if (s === 'delivered') {
            return dynamicSteps.length - 1;
        }

        if (s.includes('out for delivery') || s.includes('dispatched')) {
            const outIndex = dynamicSteps.findIndex(
                (step) => step.statusKey === 'out_for_delivery' || step.systemStatus === 'out_for_delivery'
            );
            if (outIndex !== -1) return outIndex;
        }

        if (s.includes('transit') || s.includes('shipping') || s.includes('vessel') || s.includes('container') || s.includes('arrived')) {
            return Math.max(0, Math.floor(dynamicSteps.length / 2));
        }

        if (s.includes('collected') || s.includes('picked')) {
            return 1;
        }

        return 0;
    }, [activeTrackingData, dynamicSteps]);

    const isMultiBox = trackingData?.is_multi_box || trackingData?.is_booking_search || (trackingData?.all_boxes && trackingData.all_boxes.length > 1);

    return (
        <Layout hideLogin {...(!isGuest ? { breadcrumbs } : {})}>
            <Head title="Track Shipment" />

            <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6 md:space-y-10 min-h-[600px]">
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

                        {/* Multi-Box Dashboard (Unified Header & Box Selector) */}
                        {isMultiBox ? (
                            <TrackingMultiBoxDashboard
                                trackingData={trackingData}
                                activeTrackingNumber={activeTrackingData.tracking_number}
                                onSelectBox={(num) => setActiveBoxTrackingNumber(num)}
                            />
                        ) : (
                            /* Single Box Header Details Card */
                            <TrackingDetailsCard
                                trackingData={activeTrackingData}
                                isCopied={isCopied}
                                onCopy={copyToClipboard}
                            />
                        )}

                        {/* Shipment Container Card for Stepper & ETA */}
                        <div className={cn(
                            "card overflow-hidden transition-all duration-500 space-y-0",
                            isHighlighted && "ring-2 ring-brand-rust border-brand-rust shadow-brand-rust/20 shadow-lg scale-[1.01]"
                        )}>
                            {/* ETA Alert Banner */}
                            {activeTrackingData.eta_date && activeTrackingData.status?.toLowerCase() !== 'cancelled' && activeTrackingData.status?.toLowerCase() !== 'delivered' && (
                                <div className="px-5 py-3 md:px-8 bg-amber-500/10 dark:bg-amber-950/30 flex items-start md:items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                        <CalendarClock className="size-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                            {activeTrackingData.eta_message || 'Your box is expected to be delivered on or before this date'}
                                        </p>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mt-0.5">
                                            {new Date(activeTrackingData.eta_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Horizontal Progress Stepper */}
                            <div className="px-5 pb-6 pt-5 md:px-8 md:pb-8 md:pt-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                                {activeTrackingData.status?.toLowerCase() === 'cancelled' ? (
                                    <div className="flex items-center gap-3 p-4 bg-red-50/50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50 rounded-2xl">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                                            <AlertCircle className="size-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-red-900 dark:text-red-200 uppercase tracking-tight">Shipment Cancelled</h4>
                                            <p className="text-[10px] font-bold text-red-800/60 dark:text-red-300/60 uppercase tracking-widest mt-0.5 leading-relaxed">
                                                This shipment has been cancelled. No further transit tracking is available.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <TrackingProgressStepper
                                        steps={simplifiedSteps}
                                        currentIndex={simplifiedStepIndex}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Action Required Alert */}
                        {trackingData.declaration_form_status === 'missing' && trackingData.status?.toLowerCase() !== 'cancelled' && (
                            <DeclarationAlert bookingId={trackingData.booking_id} />
                        )}

                        {/* Main Content: Timeline & Sidebar */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                                        <Package className="size-4 text-brand-rust" /> Transit Journey ({activeTrackingData.tracking_number})
                                    </h3>
                                </div>
                                <TrackingTimeline timeline={activeTrackingData.timeline} steps={dynamicSteps} currentIndex={currentStepIndex} />
                            </div>

                            <div className="space-y-6 md:space-y-8 lg:sticky lg:top-6 self-start">
                                {/* Details Card */}
                                <div className="card">
                                    <div className="px-5 py-5 md:px-8 md:py-6 border-b border-zinc-100 dark:border-zinc-800">
                                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <Layers className="size-4" /> Details
                                        </h3>
                                    </div>
                                    <div className="p-4 md:p-8 space-y-6">
                                        <div className="space-y-1.5">
                                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Booking Ref</span>
                                            <p className="text-xs font-mono font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">#{trackingData.booking_reference || trackingData.booking_id}</p>
                                        </div>
                                        {isMultiBox && (
                                            <div className="space-y-1.5">
                                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Active Box</span>
                                                <p className="text-xs font-mono font-black text-brand-rust uppercase tracking-tight">{activeTrackingData.tracking_number}</p>
                                            </div>
                                        )}
                                        <div className="space-y-1.5">
                                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Payment</span>
                                            <span className={cn(
                                                "inline-flex px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest",
                                                trackingData.payment_status === 'paid' ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50" : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50"
                                            )}>
                                                {humanize(trackingData.payment_status)}
                                            </span>
                                        </div>
                                        <div className="space-y-1.5">
                                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Area</span>
                                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">{activeTrackingData.area?.name || trackingData.area?.name || 'Standard Zone'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Verified Badge */}
                                <div className="p-5 rounded-2xl bg-zinc-900 text-white space-y-3 shadow-sm">
                                    <div className="flex items-center gap-2.5">
                                        <ShieldCheck className="size-4 text-emerald-400" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Verified Trace</span>
                                    </div>
                                    <p className="text-[10px] font-medium text-zinc-400 leading-relaxed">
                                        Official trace records validated by logistics command. Secure transit guaranteed.
                                    </p>
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

