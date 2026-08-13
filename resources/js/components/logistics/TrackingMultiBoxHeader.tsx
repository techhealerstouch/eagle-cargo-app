import React from 'react';
import { Layers, Package, MapPin, User, CheckCircle2, Clock, Truck, Ship, AlertCircle } from 'lucide-react';
import { cn, humanize } from '@/lib/utils';
import type { TrackingData } from '@/types/logistics';

interface TrackingMultiBoxHeaderProps {
    trackingData: TrackingData;
    activeTrackingNumber: string;
}

export const TrackingMultiBoxHeader: React.FC<TrackingMultiBoxHeaderProps> = ({
    trackingData,
    activeTrackingNumber,
}) => {
    const allBoxes = trackingData.all_boxes || [];
    const totalBoxes = allBoxes.length || trackingData.total_boxes_count || 1;

    // Group box statuses for quick breakdown summary
    const statusCounts = allBoxes.reduce((acc, box) => {
        const statusKey = (box.status_label || box.status || 'unknown').toLowerCase();
        acc[statusKey] = (acc[statusKey] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="card overflow-hidden border-2 border-brand-rust/20 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 text-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="p-5 md:p-8 space-y-6">
                {/* Header Top Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                                <Layers className="size-3.5 text-amber-400" /> Multi-Box Booking Status
                            </span>
                            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest bg-zinc-800/90 text-zinc-100 border border-zinc-700">
                                Ref: #{trackingData.booking_reference || trackingData.booking_id}
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white mt-2">
                            Shipment Overview ({totalBoxes} {totalBoxes === 1 ? 'Box' : 'Boxes'})
                        </h2>
                    </div>

                    {/* Status Counts Summary Pills */}
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

                {/* Sub-header Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="flex items-center gap-3 bg-zinc-800/60 p-3.5 rounded-xl border border-zinc-700/60">
                        <div className="h-8 w-8 rounded-lg bg-zinc-700/60 flex items-center justify-center text-zinc-200 shrink-0">
                            <User className="size-4 text-zinc-300" />
                        </div>
                        <div className="space-y-0.5 truncate">
                            <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest block">Consignee / Recipient</span>
                            <p className="font-serif font-black text-white uppercase tracking-tight truncate">
                                {trackingData.recipient_name || 'Consignee Restricted'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-zinc-800/60 p-3.5 rounded-xl border border-zinc-700/60">
                        <div className="h-8 w-8 rounded-lg bg-zinc-700/60 flex items-center justify-center text-zinc-200 shrink-0">
                            <MapPin className="size-4 text-zinc-300" />
                        </div>
                        <div className="space-y-0.5 truncate">
                            <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest block">Destination</span>
                            <p className="font-bold text-white uppercase tracking-tight truncate">
                                {trackingData.destination || 'Zone Restricted'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/30">
                        <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                            <Package className="size-4" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-amber-300 uppercase tracking-widest block">Active View</span>
                            <p className="font-mono font-black text-white tracking-tight">
                                {activeTrackingNumber}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
