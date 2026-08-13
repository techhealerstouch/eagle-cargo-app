import type { PageProps } from '@inertiajs/core';
import { Link, usePage } from '@inertiajs/react';
import {
    PlusCircle,
    Map,
    Layers,
    BellRing,
    BarChart3,
    ShieldCheck,
    Package,
    Users,
} from 'lucide-react';
import type { Auth } from '@/types';

interface QuickActionProps {
    title: string;
    description: string;
    href: string;
    icon: any;
    color: string;
}

const actions: QuickActionProps[] = [
    {
        title: 'New Booking',
        description: 'Create a new box booking',
        href: '/admin/bookings/create',
        icon: PlusCircle,
        color: 'bg-emerald-500',
    },
    {
        title: 'Create Runsheet',
        description: 'Assign boxes to a driver',
        href: '/admin/runsheets/create',
        icon: Map,
        color: 'bg-blue-500',
    },
    {
        title: 'New Batch',
        description: 'Start a new shipping batch',
        href: '/admin/batches/create',
        icon: Layers,
        color: 'bg-purple-500',
    },
    {
        title: 'Shipping Update',
        description: 'Post a tracking update',
        href: '/admin/shipping-updates/create',
        icon: BellRing,
        color: 'bg-amber-500',
    },
    {
        title: 'System Reports',
        description: 'View financial & ops reports',
        href: '/admin/reports/financial',
        icon: BarChart3,
        color: 'bg-rose-500',
    },
    {
        title: 'System Health',
        description: 'Check for system anomalies',
        href: '/admin/data-integrity',
        icon: ShieldCheck,
        color: 'bg-indigo-500',
    },
];

export function QuickActions() {
    const { auth } = usePage<PageProps & { auth: Auth }>().props;
    const isSuperAdmin = auth.user?.role === 'super_admin';

    const visibleActions = actions.filter(action => {
        if (action.title === 'System Health') {
            return isSuperAdmin;
        }

        return true;
    });

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {visibleActions.map((action) => (
                <Link
                    key={action.title}
                    href={action.href}
                    className="group relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-brand-warm/15 bg-white p-6 text-center transition-all duration-300 hover:border-brand-rust/30 hover:shadow-xl hover:shadow-brand-rust/5 active:scale-[0.98]"
                >
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${action.color} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                        <action.icon className="size-6" />
                    </div>
                    <h3 className="mb-1 font-serif text-sm font-bold text-brand-text tracking-tight">
                        {action.title}
                    </h3>
                    <p className="text-[10px] font-medium text-brand-text-mid line-clamp-1 opacity-70">
                        {action.description}
                    </p>

                    {/* Subtle background decoration */}
                    <div className="absolute -bottom-4 -right-4 size-16 rounded-full bg-brand-warm/5 transition-transform duration-500 group-hover:scale-[2.5] group-hover:bg-brand-warm/10" />
                </Link>
            ))}
        </div>
    );
}
