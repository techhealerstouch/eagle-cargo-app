import React from 'react';
import { MapPin, Copy, Check, Plane, Ship, ArrowRight, Share2 } from 'lucide-react';
import { humanize } from '@/lib/utils';
import { getStatusTheme } from '@/lib/logistics-theme';
import type { TrackingData } from '@/types/logistics';
import { Button } from '@/components/ui/button';

interface TrackingDetailsCardProps {
    trackingData: TrackingData;
    isCopied: boolean;
    onCopy: () => void;
}

export const TrackingDetailsCard: React.FC<TrackingDetailsCardProps> = ({
    trackingData,
    isCopied,
    onCopy,
}) => {
    const rawStatus = trackingData.status_label || trackingData.status || '';
    const theme = getStatusTheme(trackingData.status, humanize(rawStatus).replace(/Branch/gi, 'Warehouse'));
    const StatusIcon = theme.icon;

    const originName = trackingData.batch?.branch_code || trackingData.batch?.origin_port || 'Origin Warehouse';
    const destinationName = trackingData.destination || 'Consignee Address';

    return (
        <div className="card overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {/* Top Route Visualization Strip */}
            <div className="bg-zinc-50/80 dark:bg-zinc-900/80 px-5 py-3 md:px-8 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-zinc-600 dark:text-zinc-400">
                    <span className="flex items-center gap-1 text-zinc-900 dark:text-zinc-100 font-black uppercase tracking-tight">
                        <MapPin className="size-3.5 text-zinc-500 shrink-0" /> {originName}
                    </span>
                    <ArrowRight className="size-3.5 text-zinc-400 shrink-0" />
                    <span className="flex items-center gap-1 text-zinc-900 dark:text-zinc-100 font-black uppercase tracking-tight truncate max-w-[200px] md:max-w-[300px]">
                        {destinationName}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300/40 dark:border-zinc-700 flex items-center gap-1">
                        <Ship className="size-3" /> Sea Container
                    </span>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="px-5 py-5 md:px-8 md:py-8 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {/* Current Status Section */}
                <div className="space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 block">
                        Current Status
                    </span>
                    <div className="flex items-center gap-3">
                        <div className="relative flex items-center justify-center shrink-0">
                            <div className={`h-3 w-3 rounded-full ${theme.dotBg}`} />
                            <div className={`absolute inset-0 h-3 w-3 rounded-full ${theme.dotBg} animate-ping opacity-75`} />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
                                {theme.label}
                            </h2>
                            <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${theme.badge}`}>
                                <StatusIcon className="size-3" /> Real-Time Verified
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tracking ID Section */}
                <div className="space-y-3 md:border-x md:border-zinc-100 dark:md:border-zinc-800 md:px-8">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 block">
                        Tracking ID
                    </span>
                    <div className="flex items-center justify-between md:justify-start gap-2">
                        <h2 className="text-lg font-mono font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
                            {trackingData.tracking_number}
                        </h2>
                        <Button
                            onClick={onCopy}
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800 transition-all active:scale-95 shrink-0"
                            title="Copy Tracking ID"
                        >
                            {isCopied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded uppercase tracking-widest border border-zinc-200 dark:border-zinc-700">
                            {trackingData.box_type?.name || 'Standard Box'}
                        </span>
                        {trackingData.booking_reference && (
                            <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                                Ref: #{trackingData.booking_reference}
                            </span>
                        )}
                    </div>
                </div>

                {/* Receiver Section */}
                <div className="space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 block">
                        Receiver / Consignee
                    </span>
                    <h2 className="text-base font-serif font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100 leading-snug truncate">
                        {trackingData.recipient_name || 'Consignee Restricted'}
                    </h2>
                    <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
                        <MapPin className="size-3.5 shrink-0" />
                        <p className="text-[10px] font-bold uppercase tracking-widest truncate">
                            {trackingData.destination || 'Zone Restricted'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
