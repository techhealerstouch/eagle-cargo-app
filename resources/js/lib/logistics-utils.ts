import type { LucideIcon
} from 'lucide-react';
import {
    Package, PackageCheck, Warehouse, Container, Ship, MapPin,
    ShieldCheck, ArrowDownUp, Truck, Bike, Home, Circle
} from 'lucide-react';

export const iconMap: Record<string, LucideIcon> = {
    'package': Package,
    'package-check': PackageCheck,
    'warehouse': Warehouse,
    'container': Container,
    'ship': Ship,
    'map-pin': MapPin,
    'shield-check': ShieldCheck,
    'arrow-down-up': ArrowDownUp,
    'truck': Truck,
    'bike': Bike,
    'home': Home,
    'circle': Circle,
};

export const resolveIcon = (iconKey?: string): LucideIcon => {
    if (!iconKey) {
return Circle;
}

    const Icon = iconMap[iconKey.toLowerCase()];

    if (!Icon) {
        console.warn(`Icon key "${iconKey}" not found in iconMap. Falling back to Circle.`);

        return Circle;
    }

    return Icon;
};

export const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString);

        if (isNaN(date.getTime())) {
return dateString;
}

        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(date);
    } catch {
        return dateString;
    }
};
