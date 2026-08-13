import {
    Package,
    Truck,
    Ship,
    ShieldCheck,
    MapPin,
    Home,
    AlertCircle,
    Warehouse,
    ArrowDownUp,
    Bike,
    Clock,
    LucideIcon,
} from 'lucide-react';

export interface StatusTheme {
    label: string;
    bgLight: string;
    textLight: string;
    borderLight: string;
    ringColor: string;
    dotBg: string;
    gradient: string;
    badge: string;
    icon: LucideIcon;
}

export function getStatusTheme(status: string, customLabel?: string): StatusTheme {
    const s = (status || '').toLowerCase().replace(/_/g, ' ');

    if (s === 'delivered') {
        return {
            label: customLabel || 'Delivered',
            bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
            textLight: 'text-emerald-600 dark:text-emerald-400',
            borderLight: 'border-emerald-200/60 dark:border-emerald-800/50',
            ringColor: 'ring-emerald-400/40',
            dotBg: 'bg-emerald-500',
            gradient: 'from-emerald-500 to-teal-600',
            badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            icon: ShieldCheck,
        };
    }

    if (s.includes('out for delivery') || s.includes('dispatched')) {
        return {
            label: customLabel || 'Out for Delivery',
            bgLight: 'bg-amber-50 dark:bg-amber-950/30',
            textLight: 'text-amber-600 dark:text-amber-400',
            borderLight: 'border-amber-200/60 dark:border-amber-800/50',
            ringColor: 'ring-amber-400/40',
            dotBg: 'bg-amber-500',
            gradient: 'from-amber-500 to-orange-600',
            badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
            icon: Bike,
        };
    }

    if (
        s.includes('transit') ||
        s.includes('shipping') ||
        s.includes('container') ||
        s.includes('boc') ||
        s.includes('clearance') ||
        s.includes('arrived') ||
        s.includes('roro') ||
        s.includes('unloaded')
    ) {
        return {
            label: customLabel || 'In Transit',
            bgLight: 'bg-sky-50 dark:bg-sky-950/30',
            textLight: 'text-sky-600 dark:text-sky-400',
            borderLight: 'border-sky-200/60 dark:border-sky-800/50',
            ringColor: 'ring-sky-400/40',
            dotBg: 'bg-sky-500',
            gradient: 'from-sky-500 to-blue-600',
            badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
            icon: Ship,
        };
    }

    if (
        s.includes('collected') ||
        s.includes('picked') ||
        s.includes('warehouse') ||
        s.includes('received')
    ) {
        return {
            label: customLabel || 'Collected & Received',
            bgLight: 'bg-indigo-50 dark:bg-indigo-950/30',
            textLight: 'text-indigo-600 dark:text-indigo-400',
            borderLight: 'border-indigo-200/60 dark:border-indigo-800/50',
            ringColor: 'ring-indigo-400/40',
            dotBg: 'bg-indigo-500',
            gradient: 'from-indigo-500 to-violet-600',
            badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
            icon: Warehouse,
        };
    }

    if (s.includes('cancelled') || s.includes('damaged') || s.includes('held')) {
        return {
            label: customLabel || 'Exception',
            bgLight: 'bg-rose-50 dark:bg-rose-950/30',
            textLight: 'text-rose-600 dark:text-rose-400',
            borderLight: 'border-rose-200/60 dark:border-rose-800/50',
            ringColor: 'ring-rose-400/40',
            dotBg: 'bg-rose-500',
            gradient: 'from-rose-500 to-red-600',
            badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
            icon: AlertCircle,
        };
    }

    return {
        label: customLabel || 'Manifested',
        bgLight: 'bg-zinc-50 dark:bg-zinc-900',
        textLight: 'text-zinc-600 dark:text-zinc-400',
        borderLight: 'border-zinc-200 dark:border-zinc-800',
        ringColor: 'ring-zinc-400/40',
        dotBg: 'bg-zinc-500',
        gradient: 'from-zinc-700 to-zinc-900',
        badge: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
        icon: Package,
    };
}

export interface TimelinePhaseGroup {
    name: string;
    description: string;
    icon: LucideIcon;
    items: any[];
}

export function groupTimelineByPhase(timeline: any[]): TimelinePhaseGroup[] {
    if (!timeline || timeline.length === 0) return [];

    const originItems: any[] = [];
    const transitItems: any[] = [];
    const destinationItems: any[] = [];

    timeline.forEach((item) => {
        const rawPhase = (item.tracking_phase || '').toLowerCase();
        const rawStatus = (item.status_label || item.status || '').toLowerCase().replace(/_/g, ' ');

        if (
            rawPhase === 'picked_up' ||
            rawPhase === 'received_by_branch' ||
            rawPhase === 'loading_container' ||
            rawStatus.includes('collected') ||
            rawStatus.includes('picked') ||
            rawStatus.includes('registered') ||
            rawStatus.includes('branch')
        ) {
            originItems.push(item);
        } else if (
            rawPhase === 'in_transit_sea' ||
            rawPhase === 'arrived_manila_port' ||
            rawPhase === 'under_customs_clearance' ||
            rawPhase === 'released_by_boc' ||
            rawStatus.includes('transit') ||
            rawStatus.includes('port') ||
            rawStatus.includes('customs') ||
            rawStatus.includes('boc') ||
            rawStatus.includes('container')
        ) {
            transitItems.push(item);
        } else {
            destinationItems.push(item);
        }
    });

    const groups: TimelinePhaseGroup[] = [];

    if (destinationItems.length > 0) {
        groups.push({
            name: 'Destination & Last Mile',
            description: 'Warehouse sorting, local hub dispatch, and home delivery.',
            icon: Home,
            items: destinationItems,
        });
    }

    if (transitItems.length > 0) {
        groups.push({
            name: 'International Freight & Customs',
            description: 'Ocean vessel transit, port arrival, and customs clearance.',
            icon: Ship,
            items: transitItems,
        });
    }

    if (originItems.length > 0) {
        groups.push({
            name: 'Origin & Warehouse Dispatch',
            description: 'Sender collection, warehouse intake, and container packing.',
            icon: Warehouse,
            items: originItems,
        });
    }

    // Fallback if none matched
    if (groups.length === 0 && timeline.length > 0) {
        groups.push({
            name: 'Shipment Updates',
            description: 'Chronological timeline of box updates.',
            icon: Clock,
            items: timeline,
        });
    }

    return groups;
}

export function getFriendlyStepDescription(
    stepLabel: string,
    rawDesc?: string,
    statusKey?: string,
    configuredStepDesc?: string
): string {
    const desc = (rawDesc || '').trim();

    // If description is specific and not generic "status updated", keep original
    const isGeneric = !desc ||
        /^status\s*updated?(\s*by\s*admin)?\.?$/i.test(desc) ||
        /^status\s*update\.?$/i.test(desc);

    if (!isGeneric) {
        return desc;
    }

    // If admin configured a custom description on the journey milestone step, use it!
    if (configuredStepDesc && configuredStepDesc.trim().length > 0) {
        return configuredStepDesc.trim();
    }

    const key = `${stepLabel || ''} ${statusKey || ''}`.toLowerCase();

    if (key.includes('picked up') || key.includes('collected') || key.includes('pickup')) {
        return 'Box collected from sender and queued for warehouse sorting.';
    }

    if (key.includes('received at warehouse') || key.includes('warehouse') || key.includes('branch')) {
        return 'Box arrived at hub warehouse for inspection, weighing, and manifest packing.';
    }

    if (key.includes('loaded') || key.includes('container')) {
        return 'Box safely loaded into sea freight container and prepped for port departure.';
    }

    if (key.includes('shipping to philippines') || key.includes('transit') || key.includes('sea')) {
        return 'Vessel en route across ocean transit bound for Philippine destination port.';
    }

    if (key.includes('arrived in philippines') || key.includes('port arrival') || key.includes('arrived')) {
        return 'Vessel safely docked at Philippine port for cargo unloading and sorting.';
    }

    if (key.includes('customs') || key.includes('boc clearance') || key.includes('under boc')) {
        return 'Import documentation submitted to Bureau of Customs (BOC) for standard clearance.';
    }

    if (key.includes('released') || key.includes('cleared')) {
        return 'Customs inspection cleared; box released to local delivery hub.';
    }

    if (key.includes('out for delivery') || key.includes('dispatched')) {
        return 'Box assigned to local courier team for doorstep delivery to recipient.';
    }

    if (key.includes('delivered')) {
        return 'Box successfully delivered to recipient. Thank you for choosing Love Balikbayan!';
    }

    if (key.includes('pending') || key.includes('manifested') || key.includes('registered')) {
        return 'Booking registered in system. Awaiting pickup schedule.';
    }

    return 'Milestone verified and logged by logistics management.';
}
