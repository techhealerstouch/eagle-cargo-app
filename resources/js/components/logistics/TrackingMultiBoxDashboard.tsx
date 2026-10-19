import React, { useState } from 'react';
import { Package, Layers, MapPin, User, CheckCircle2, Clock, Truck, Ship, Copy, Check, Calendar, ArrowRight } from 'lucide-react';
import { cn, humanize } from '@/lib/utils';
import { getStatusTheme } from '@/lib/logistics-theme';
import type { TrackingBox, TrackingData } from '@/types/logistics';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface TrackingMultiBoxDashboardProps {
    trackingData: TrackingData;
    activeTrackingNumber: string;
    onSelectBox: (trackingNumber: string) => void;
}

export const TrackingMultiBoxDashboard: React.FC<TrackingMultiBoxDashboardProps> = ({
    trackingData,
    activeTrackingNumber,
    onSelectBox,
}) => {
    const [copiedNum, setCopiedNum] = useState<string | null>(null);
    const allBoxes = trackingData.all_boxes || [];
    const totalBoxes = allBoxes.length || trackingData.total_boxes_count || 1;

    const handleCopy = (e: React.MouseEvent, num: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(num);
        setCopiedNum(num);
        toast.success(`Copied ${num}`);
        setTimeout(() => setCopiedNum(null), 2000);
    };

    // Group box statuses for summary counts
    const statusCounts = allBoxes.reduce((acc, box) => {
        const statusKey = (box.status_label || box.status || 'unknown').toLowerCase();
        acc[statusKey] = (acc[statusKey] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const getProgressPercent = (statusStr: string = '') => {
        const s = statusStr.toLowerCase();
        if (s.includes('delivered')) return 100;
        if (s.includes('out for') || s.includes('out_for_delivery')) return 90;
        if (s.includes('hub') || s.includes('sorting') || s.includes('scheduling')) return 85;
        if (s.includes('manila warehouse') || s.includes('received at manila') || s.includes('received_manila_warehouse')) return 82;
        if (s.includes('released') || s.includes('cleared')) return 80;
        if (s.includes('customs') || s.includes('boc') || s.includes('clearance')) return 75;
        if (s.includes('arrived') || s.includes('port')) return 70;
        if (s.includes('transit') || s.includes('shipping') || s.includes('sailing') || s.includes('sea')) return 60;
        if (s.includes('container') || s.includes('loading')) return 50;
        if (s.includes('warehouse') || s.includes('branch')) return 40;
        if (s.includes('collected') || s.includes('picked')) return 25;
        return 15;
    };

    return (
        <div className="card overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 shadow-sm animate-in fade-in duration-500">
            {/* Ultra-Compact Unified Header Strip */}
            <div className="bg-zinc-900 text-white px-4 py-3 sm:px-5 sm:py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Layers className="size-3 text-amber-400" /> {totalBoxes} Boxes
                        </span>
                        <span className="text-xs font-mono font-bold text-zinc-300">
                            #{trackingData.booking_reference || trackingData.booking_id}
                        </span>
                    </div>

                    <span className="text-zinc-600 hidden sm:inline">•</span>

                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 truncate">
                        <span className="text-white uppercase tracking-tight truncate">
                            {trackingData.recipient_name || 'Consignee Restricted'}
                        </span>
                        <span className="text-zinc-500">→</span>
                        <span className="text-zinc-300 font-medium uppercase tracking-tight truncate">
                            {trackingData.destination || 'Zone Restricted'}
                        </span>
                    </div>
                </div>

                {/* Status Summary Pills */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {Object.entries(statusCounts).map(([statusLabel, count]) => {
                        const isDelivered = statusLabel.includes('delivered');
                        const isInTransit = statusLabel.includes('transit') || statusLabel.includes('shipping');
                        const isOutForDelivery = statusLabel.includes('delivery');

                        let pillStyle = "bg-zinc-800 text-zinc-200 border-zinc-700";
                        let IconComponent = Clock;

                        if (isDelivered) {
                            pillStyle = "bg-emerald-950/80 text-emerald-300 border-emerald-700/60";
                            IconComponent = CheckCircle2;
                        } else if (isOutForDelivery) {
                            pillStyle = "bg-amber-950/80 text-amber-300 border-amber-700/60";
                            IconComponent = Truck;
                        } else if (isInTransit) {
                            pillStyle = "bg-sky-950/80 text-sky-300 border-sky-700/60";
                            IconComponent = Ship;
                        }

                        return (
                            <span
                                key={statusLabel}
                                className={cn(
                                    "px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1.5 shadow-xs",
                                    pillStyle
                                )}
                            >
                                <IconComponent className="size-2.5" />
                                <span className="font-mono font-black">{count}</span> {humanize(statusLabel)}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Interactive Box Cards Selector */}
            <div className="p-3.5 sm:p-4 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-3">
                <div className="flex items-center justify-between px-0.5">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Package className="size-3.5 text-brand-rust" /> Boxes in this Shipment ({totalBoxes})
                    </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {allBoxes.map((box, idx) => {
                        const isActive = box.tracking_number === activeTrackingNumber;
                        const statusTheme = getStatusTheme(box.status, humanize(box.status_label || box.status));
                        const progress = getProgressPercent(box.status_label || box.status);

                        return (
                            <div
                                key={box.tracking_number || idx}
                                onClick={() => onSelectBox(box.tracking_number)}
                                className={cn(
                                    "group relative rounded-xl p-3.5 border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2.5 shadow-2xs",
                                    isActive
                                        ? "bg-white dark:bg-zinc-900 border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-900/10 dark:ring-zinc-100/10 shadow-sm"
                                        : "bg-white dark:bg-zinc-900/80 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                                )}
                            >
                                {/* Card Top Row */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                                            isActive
                                                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                                        )}>
                                            Box {idx + 1} of {totalBoxes}
                                        </span>
                                        {box.box_type?.name && (
                                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider truncate">
                                                {box.box_type.name}
                                            </span>
                                        )}
                                    </div>

                                    {isActive ? (
                                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                                            <CheckCircle2 className="size-2.5" /> Active View
                                        </span>
                                    ) : (
                                        <span className="text-[8px] font-semibold text-zinc-400 uppercase tracking-wider group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                                            Click to view
                                        </span>
                                    )}
                                </div>

                                {/* Tracking ID */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-black text-sm md:text-base tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-brand-rust transition-colors">
                                        {box.tracking_number}
                                    </span>
                                    <Button
                                        onClick={(e) => handleCopy(e, box.tracking_number)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 shrink-0"
                                        title="Copy Box Tracking ID"
                                    >
                                        {copiedNum === box.tracking_number ? (
                                            <Check className="size-3 text-emerald-500" />
                                        ) : (
                                            <Copy className="size-3" />
                                        )}
                                    </Button>
                                </div>

                                {/* Status & Mini Progress */}
                                <div className="space-y-1.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={cn(
                                            "inline-flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border",
                                            statusTheme.badge
                                        )}>
                                            <div className={cn("h-1.5 w-1.5 rounded-full", statusTheme.dotBg)} />
                                            {humanize(box.status_label || box.status)}
                                        </span>

                                        <span className="text-[9px] font-mono font-bold text-zinc-400">
                                            {progress}%
                                        </span>
                                    </div>

                                    {/* Mini Progress Bar */}
                                    <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-500",
                                                progress === 100 ? "bg-emerald-500" : "bg-emerald-600"
                                            )}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Batch & ETA Info */}
                                <div className="pt-0.5 flex items-center justify-between text-[9px] font-bold text-zinc-400 dark:text-zinc-500 gap-2">
                                    <div className="flex items-center gap-1 truncate">
                                        <Ship className="size-2.5 text-zinc-400 shrink-0" />
                                        <span className="truncate">
                                            {box.batch?.batch_number ? `Batch ${box.batch.batch_number}` : 'pending batch'}
                                        </span>
                                    </div>

                                    {box.eta_date && (
                                        <div className="flex items-center gap-1 shrink-0 text-amber-600 dark:text-amber-400">
                                            <Calendar className="size-2.5" />
                                            <span>{new Date(box.eta_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
