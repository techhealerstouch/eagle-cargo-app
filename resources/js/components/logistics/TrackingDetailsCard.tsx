import React from 'react';
import { MapPin, Copy, Check, Ship, ArrowRight, CalendarClock, AlertCircle } from 'lucide-react';
import { cn, humanize } from '@/lib/utils';
import { getStatusTheme } from '@/lib/logistics-theme';
import type { TrackingData, NormalizedStep } from '@/types/logistics';
import { Button } from '@/components/ui/button';
import { TrackingProgressStepper } from './TrackingProgressStepper';

interface TrackingDetailsCardProps {
    trackingData: TrackingData;
    isCopied: boolean;
    onCopy: () => void;
    steps?: NormalizedStep[];
    currentIndex?: number;
    isHighlighted?: boolean;
}

export const TrackingDetailsCard: React.FC<TrackingDetailsCardProps> = ({
    trackingData,
    isCopied,
    onCopy,
    steps,
    currentIndex = 0,
    isHighlighted = false,
}) => {
    const rawStatus = trackingData.status_label || trackingData.status || '';
    const theme = getStatusTheme(trackingData.status, humanize(rawStatus).replace(/Branch/gi, 'Warehouse'));
    const StatusIcon = theme.icon;

    const originName = trackingData.batch?.branch_code || trackingData.batch?.origin_port || 'Origin Warehouse';
    const destinationName = trackingData.destination || 'Consignee Address';
    const isCancelled = trackingData.status?.toLowerCase() === 'cancelled';

    return (
        <div className={cn(
            "card overflow-hidden transition-all duration-500 space-y-0",
            isHighlighted && "ring-2 ring-brand-rust border-brand-rust shadow-brand-rust/20 shadow-lg scale-[1.01]"
        )}>
            {/* Top Route & Attributes Strip */}
            <div className="bg-zinc-50/90 dark:bg-zinc-900/90 px-4 py-2 sm:px-6 sm:py-2.5 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-1.5 sm:gap-2 font-bold text-zinc-600 dark:text-zinc-400 min-w-0">
                    <span className="flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100 font-black uppercase tracking-tight text-[11px] sm:text-xs shrink-0">
                        <MapPin className="size-3.5 text-zinc-500 shrink-0" /> {originName}
                    </span>
                    <ArrowRight className="size-3 text-zinc-400 shrink-0" />
                    <span className="flex items-center gap-1 text-zinc-900 dark:text-zinc-100 font-black uppercase tracking-tight text-[11px] sm:text-xs truncate max-w-[180px] sm:max-w-[320px]">
                        {destinationName}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300/40 dark:border-zinc-700 flex items-center gap-1">
                        <Ship className="size-2.5 text-sky-600 dark:text-sky-400" /> Sea Container
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {trackingData.box_type?.name || 'Standard Box'}
                    </span>
                    {trackingData.booking_reference && (
                        <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hidden sm:inline">
                            Ref: #{trackingData.booking_reference}
                        </span>
                    )}
                </div>
            </div>

            {/* Main Key Metrics Cockpit (3 Columns) */}
            <div className="px-4 py-3 sm:px-6 sm:py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-center">
                {/* 1. Tracking ID */}
                <div className="space-y-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 block">
                        Tracking ID
                    </span>
                    <div className="flex items-center gap-1.5">
                        <h2 className="text-base sm:text-lg font-mono font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
                            {trackingData.tracking_number}
                        </h2>
                        <Button
                            onClick={onCopy}
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 shrink-0"
                            title="Copy Tracking ID"
                        >
                            {isCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        </Button>
                    </div>
                </div>

                {/* 2. Current Status */}
                <div className="space-y-0.5 sm:border-x sm:border-zinc-100 sm:dark:border-zinc-800 sm:px-4">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 block">
                        Current Status
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="relative flex items-center justify-center shrink-0">
                            <div className={`h-2 w-2 rounded-full ${theme.dotBg}`} />
                            <div className={`absolute inset-0 h-2 w-2 rounded-full ${theme.dotBg} animate-ping opacity-75`} />
                        </div>
                        <span className="text-sm sm:text-base font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
                            {theme.label}
                        </span>
                        <span className={`hidden md:inline-flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border ${theme.badge}`}>
                            <StatusIcon className="size-2.5" /> Verified
                        </span>
                    </div>
                </div>

                {/* 3. Estimated Delivery & Consignee */}
                <div className="space-y-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 block">
                        {trackingData.eta_date && !isCancelled && trackingData.status?.toLowerCase() !== 'delivered' 
                            ? 'Estimated Delivery'
                            : (trackingData.batch?.eta_at && !isCancelled && trackingData.status?.toLowerCase() !== 'delivered'
                                ? 'Port Arrival ETA'
                                : 'Consignee')}
                    </span>
                    {trackingData.eta_date && !isCancelled && trackingData.status?.toLowerCase() !== 'delivered' ? (
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                            <CalendarClock className="size-3.5 shrink-0" />
                            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-tight">
                                {new Date(trackingData.eta_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 truncate hidden lg:inline">
                                ({trackingData.recipient_name || 'Recipient'})
                            </span>
                        </div>
                    ) : trackingData.batch?.eta_at && !isCancelled && trackingData.status?.toLowerCase() !== 'delivered' ? (
                        <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                            <CalendarClock className="size-3.5 shrink-0" />
                            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-tight">
                                {new Date(trackingData.batch.eta_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 truncate hidden lg:inline">
                                ({trackingData.recipient_name || 'Recipient'})
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs sm:text-sm font-bold uppercase tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                                {trackingData.recipient_name || 'Consignee Restricted'}
                            </span>
                            <span className="text-[10px] text-zinc-400 truncate hidden md:inline">
                                • {trackingData.destination || 'Zone'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Integrated Stepper Compartment */}
            {steps && steps.length > 0 && (
                <div className="px-3 py-3 sm:px-6 sm:py-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                    {isCancelled ? (
                        <div className="flex items-center gap-2.5 p-2.5 bg-red-50/50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50 rounded-xl">
                            <AlertCircle className="size-4 text-red-600 dark:text-red-400 shrink-0" />
                            <div className="flex items-center justify-between w-full">
                                <h4 className="text-xs font-black text-red-900 dark:text-red-200 uppercase tracking-tight">Shipment Cancelled</h4>
                                <span className="text-[10px] font-bold text-red-800/60 dark:text-red-300/60 uppercase tracking-wider">No active transit</span>
                            </div>
                        </div>
                    ) : (
                        <TrackingProgressStepper
                            steps={steps}
                            currentIndex={currentIndex}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

