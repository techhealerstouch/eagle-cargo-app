import { Package, MapPin, Eye, Search as SearchIcon } from 'lucide-react';
import React from 'react';
import { cn, humanize } from '@/lib/utils';
import type { TrackingData } from '@/types/logistics';

interface TrackingMultiBoxListProps {
    allBoxes: NonNullable<TrackingData['all_boxes']>;
    onTrackSpecific: (trackingNumber: string) => void;
}

export const TrackingMultiBoxList: React.FC<TrackingMultiBoxListProps> = ({
    allBoxes,
    onTrackSpecific
}) => {
    return (
        <div className="card overflow-hidden">
            <div className="px-5 py-5 border-b border-zinc-100 flex items-center gap-3">
                <Package className="size-5 text-zinc-400" />
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900 leading-none">Boxes in this Shipment</h3>
                    <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest mt-1">Showing all {allBoxes.length} boxes for this booking</p>
                </div>
            </div>
            <div className="divide-y divide-zinc-100">
                {allBoxes.map((box, idx) => (
                    <div key={idx} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-50 transition-colors">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <p className="font-mono font-black text-lg tracking-tight">{box.tracking_number}</p>
                                <span className={cn(
                                    "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border",
                                    (box.status_label || box.status).toLowerCase() === 'delivered' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                    "bg-zinc-100 text-zinc-600 border-zinc-200"
                                )}>
                                    {humanize(box.status_label || box.status)}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-medium text-zinc-500">
                                <span className="flex items-center gap-1.5 truncate"><MapPin className="size-3 shrink-0" /> {box.destination}</span>
                                <span className="flex items-center gap-1.5 truncate"><Eye className="size-3 shrink-0" /> {box.recipient_name || 'N/A'}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-left md:text-right">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Batch Assignment</p>
                                {box.batch ? (
                                    <p className="text-sm font-black text-sky-700 uppercase tracking-tight">Batch {box.batch.batch_number}</p>
                                ) : (
                                    <p className="text-sm font-black text-zinc-300 uppercase tracking-tight">Pending</p>
                                )}
                            </div>
                            <button
                                onClick={() => onTrackSpecific(box.tracking_number)}
                                className="shrink-0 p-3 bg-white border border-zinc-200 rounded-xl hover:border-zinc-900 hover:bg-zinc-900 hover:text-white transition-all shadow-sm active:scale-95 text-zinc-400"
                                title={`Track ${box.tracking_number} specifically`}
                                aria-label={`Track ${box.tracking_number} specifically`}
                            >
                                <SearchIcon className="size-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
