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
        if (s.includes('delivery') || s.includes('out for')) return 80;
        if (s.includes('transit') || s.includes('shipping') || s.includes('container')) return 60;
        if (s.includes('collected') || s.includes('warehouse') || s.includes('picked')) return 40;
        return 20;
    };

    return (
        <div className="card overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 border-2 border-brand-rust/20 shadow-lg animate-in fade-in duration-500">
            {/* Top Shipment Summary Header */}
            <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 text-white p-5 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                                <Layers className="size-3.5 text-amber-400" /> Multi-Box Booking Status
                            </span>
                            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest bg-zinc-800/90 text-zinc-100 border border-zinc-700">
                                Ref: #{trackingData.booking_reference || trackingData.booking_id}
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white mt-1">
                            Shipment Overview ({totalBoxes} {totalBoxes === 1 ? 'Box' : 'Boxes'})
                        </h2>
                    </div>

                    {/* Status Summary Pills */}
                    <div className="flex items-center gap-2 flex-wrap">
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
                                        "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 shadow-sm",
                                        pillStyle
                                    )}
                                >
                                    <IconComponent className="size-3" />
                                    <span className="font-mono font-black">{count}</span> {humanize(statusLabel)}
                                </span>
                            );
                        })}
                    </div>
                </div>

                {/* Receiver & Destination Info Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-zinc-200 pt-1">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="flex items-center gap-1.5 text-white font-bold uppercase tracking-tight">
                            <User className="size-3.5 text-zinc-300 shrink-0" />
                            {trackingData.recipient_name || 'Consignee Restricted'}
                        </span>
                        <span className="text-zinc-500">•</span>
                        <span className="flex items-center gap-1.5 text-zinc-200 font-semibold uppercase tracking-tight">
                            <MapPin className="size-3.5 text-zinc-300 shrink-0" />
                            {trackingData.destination || 'Zone Restricted'}
                        </span>
                    </div>

                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300/90">
                        Select a box below to view its specific status & timeline
                    </span>
                </div>
            </div>

            {/* Interactive Box Cards Selector */}
            <div className="p-5 md:p-6 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Package className="size-4 text-brand-rust" /> Boxes in this Shipment ({totalBoxes})
                    </h3>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        Click card to switch view
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allBoxes.map((box, idx) => {
                        const isActive = box.tracking_number === activeTrackingNumber;
                        const statusTheme = getStatusTheme(box.status, humanize(box.status_label || box.status));
                        const progress = getProgressPercent(box.status_label || box.status);

                        return (
                            <div
                                key={box.tracking_number || idx}
                                onClick={() => onSelectBox(box.tracking_number)}
                                className={cn(
                                    "group relative rounded-2xl p-5 border transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md",
                                    isActive
                                        ? "bg-white dark:bg-zinc-900 border-brand-rust ring-2 ring-brand-rust/40 shadow-brand-rust/10 scale-[1.01]"
                                        : "bg-white dark:bg-zinc-900/80 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                                )}
                            >
                                {/* Card Top Row */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border",
                                            isActive
                                                ? "bg-brand-rust text-white border-brand-rust"
                                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                                        )}>
                                            Box {idx + 1} of {totalBoxes}
                                        </span>
                                        {box.box_type?.name && (
                                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest truncate">
                                                {box.box_type.name}
                                            </span>
                                        )}
                                    </div>

                                    {isActive && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-brand-rust bg-brand-rust/10 px-2 py-0.5 rounded-md">
                                            <CheckCircle2 className="size-3" /> Active
                                        </span>
                                    )}
                                </div>

                                {/* Tracking ID */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-black text-base md:text-lg tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-brand-rust transition-colors">
                                        {box.tracking_number}
                                    </span>
                                    <Button
                                        onClick={(e) => handleCopy(e, box.tracking_number)}
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 shrink-0"
                                        title="Copy Box Tracking ID"
                                    >
                                        {copiedNum === box.tracking_number ? (
                                            <Check className="size-3.5 text-emerald-500" />
                                        ) : (
                                            <Copy className="size-3.5" />
                                        )}
                                    </Button>
                                </div>

                                {/* Status & Progress */}
                                <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg border",
                                            statusTheme.badge
                                        )}>
                                            <div className={cn("h-2 w-2 rounded-full", statusTheme.dotBg)} />
                                            {humanize(box.status_label || box.status)}
                                        </span>

                                        <span className="text-[10px] font-mono font-bold text-zinc-400">
                                            {progress}%
                                        </span>
                                    </div>

                                    {/* Mini Progress Bar */}
                                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-500",
                                                progress === 100 ? "bg-emerald-500" : "bg-brand-rust"
                                            )}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Batch & ETA Info */}
                                <div className="pt-1 flex items-center justify-between text-[10px] font-bold text-zinc-500 dark:text-zinc-400 gap-2">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <Ship className="size-3 text-zinc-400 shrink-0" />
                                        <span className="truncate">
                                            {box.batch?.batch_number ? `Batch ${box.batch.batch_number}` : 'Unassigned'}
                                        </span>
                                    </div>

                                    {box.eta_date && (
                                        <div className="flex items-center gap-1 shrink-0 text-amber-600 dark:text-amber-400">
                                            <Calendar className="size-3" />
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
