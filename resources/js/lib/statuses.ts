export const BOX_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
    pending: { label: 'Pending', badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    collected: { label: 'Collected', badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    received_by_branch: { label: 'Received by Warehouse', badge: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
    loaded_to_container: { label: 'Loaded to Container', badge: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
    in_transit: { label: 'In Transit', badge: 'bg-sky-500/10 text-sky-600 border-sky-500/20' },
    arrived: { label: 'Arrived', badge: 'bg-teal-500/10 text-teal-600 border-teal-500/20' },
    for_checking_unloading: { label: 'For Checking & Unloading', badge: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20' },
    unloaded_manila: { label: 'Unloaded in Manila Warehouse', badge: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
    for_delivery_scheduling: { label: 'For Delivery Scheduling', badge: 'bg-blue-600/10 text-blue-700 border-blue-600/20' },
    en_route_roro: { label: 'En Route via RoRo', badge: 'bg-sky-600/10 text-sky-700 border-sky-600/20' },
    out_for_delivery: { label: 'Out for Delivery', badge: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
    delivered: { label: 'Delivered', badge: 'bg-green-500/10 text-green-600 border-green-500/20' },
    cancelled: { label: 'Cancelled', badge: 'bg-red-500/10 text-red-600 border-red-500/20' },
    damaged: { label: 'Damaged', badge: 'bg-rose-600/10 text-rose-700 border-rose-600/20' },
    held: { label: 'Held', badge: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
};

export const BATCH_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
    open: { label: 'Open', badge: 'bg-sky-500/10 text-sky-700 border-sky-500/20' },
    loading: { label: 'Loading', badge: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
    ready_to_close: { label: 'Ready to Close', badge: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
    sailed: { label: 'Sailed', badge: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
    arrived: { label: 'Arrived', badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
    delivered: { label: 'Delivered', badge: 'bg-green-500/10 text-green-700 border-green-500/20' },
};
