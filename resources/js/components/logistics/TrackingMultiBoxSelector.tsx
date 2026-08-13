import React from 'react';
import { Package, MapPin, Copy, Check, Eye, ChevronRight, Ship, Calendar, CheckCircle2 } from 'lucide-react';
import { cn, humanize } from '@/lib/utils';
import { getStatusTheme } from '@/lib/logistics-theme';
import type { TrackingBox, TrackingData } from '@/types/logistics';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface TrackingMultiBoxSelectorProps {
    allBoxes: TrackingBox[];
    activeTrackingNumber: string;
    onSelectBox: (trackingNumber: string) => void;
}

export const TrackingMultiBoxSelector: React.FC<TrackingMultiBoxSelectorProps> = ({
    allBoxes,
    activeTrackingNumber,
    onSelectBox,
}) => {
    const [copiedNum, setCopiedNum] = React.useState<string | null>(null);

    const handleCopy = (e: React.MouseEvent, num: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(num);
        setCopiedNum(num);
        toast.success(`Copied ${num}`);
        setTimeout(() => setCopiedNum(null), 2000);
    };

    const getProgressPercent = (statusStr: string = '') => {
        const s = statusStr.toLowerCase();
        if (s.includes('delivered')) return 100;
        if (s.includes('delivery') || s.includes('out for')) return 80;
        if (s.includes('transit') || s.includes('shipping') || s.includes('container')) return 60;
        if (s.includes('collected') || s.includes('warehouse') || s.includes('picked')) return 40;
        return 20;
    };

    return (
        <div className="card overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {/* Component Header */}
            <div className="px-5 py-4 md:px-8 md:py-5 bg-zinc-50/70 dark:bg-zinc-900/70 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-brand-rust/10 text-brand-rust flex items-center justify-center font-bold shrink-0">
                        <Package className="size-5" />
                    </div>
                    <div>
                        <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            Boxes in this Shipment ({allBoxes.length})
                        </h3>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-0.5">
                            Click any box below to inspect its individual timeline & status
                        </p>
                    </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 bg-white dark:bg-zinc-800 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
                    Interactive Multi-Box Selector
                </span>
            </div>

            {/* Box Cards Grid */}
            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                    ? "bg-white dark:bg-zinc-900 border-brand-rust ring-2 ring-brand-rust/30 shadow-brand-rust/10 scale-[1.02]"
                                    : "bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-900"
                            )}
                        >
                            {/* Card Top Row: Box Index & Active Badge */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border",
                                        isActive
                                            ? "bg-brand-rust text-white border-brand-rust"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                                    )}>
                                        Box {idx + 1} of {allBoxes.length}
                                    </span>
                                    {box.box_type?.name && (
                                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest truncate">
                                            {box.box_type.name}
                                        </span>
                                    )}
                                </div>

                                {isActive && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-brand-rust bg-brand-rust/10 px-2 py-0.5 rounded-md">
                                        <CheckCircle2 className="size-3" /> Selected
                                    </span>
                                )}
                            </div>

                            {/* Tracking Number */}
                            <div className="space-y-1">
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
                            </div>

                            {/* Status Badge & Progress Bar */}
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

                            {/* Batch & ETA Info Row */}
                            <div className="pt-2 flex items-center justify-between text-[10px] font-bold text-zinc-500 dark:text-zinc-400 gap-2">
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
    );
};
