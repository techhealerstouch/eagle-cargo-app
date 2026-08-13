import type { PageProps } from '@inertiajs/core';
import { Link, usePage } from '@inertiajs/react';
import {
    Zap,
    PlusCircle,
    Map,
    Layers,
    BellRing,
    BarChart3,
    ShieldCheck,
    Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Auth } from '@/types';

const actions = [
    {
        title: 'New Booking',
        href: '/admin/bookings/create',
        icon: PlusCircle,
    },
    {
        title: 'New Pickup',
        href: '/admin/runsheets/create?type=pickup',
        icon: Map,
    },
    {
        title: 'New Delivery',
        href: '/admin/runsheets/create?type=delivery',
        icon: Truck,
    },
    {
        title: 'New Batch',
        href: '/admin/batches/create',
        icon: Layers,
    },
    {
        title: 'Shipping Update',
        href: '/admin/shipping-updates/create',
        icon: BellRing,
    },
    {
        title: 'System Reports',
        href: '/admin/reports/financial',
        icon: BarChart3,
    },
    {
        title: 'System Health',
        href: '/admin/data-integrity',
        icon: ShieldCheck,
    },
];

export function GlobalQuickActions() {
    const { auth } = usePage<PageProps & { auth: Auth }>().props;
    const role = auth.user ? (auth.user as any).role || 'sender' : 'guest';
    const isSuperAdmin = role === 'super_admin';
    const isAdmin = role === 'super_admin' || role === 'admin';

    if (!isAdmin) {
return null;
}

    const visibleActions = actions.filter(action => {
        if (action.title === 'System Health') {
            return isSuperAdmin;
        }

        return true;
    });

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 rounded-xl bg-brand-warm/10 text-brand-rust hover:bg-brand-rust hover:text-white transition-all duration-300"
                >
                    <Zap className="size-5" />
                    <span className="sr-only">Quick Actions</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-brand-warm/20 p-2 shadow-xl shadow-brand-rust/5">
                <DropdownMenuLabel className="px-3 py-2 font-serif text-sm font-bold text-brand-text">
                    Quick Actions
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-brand-warm/10" />
                <div className="grid gap-1">
                    {visibleActions.map((action) => (
                        <DropdownMenuItem key={action.title} asChild className="rounded-xl focus:bg-brand-rust/5 focus:text-brand-rust cursor-pointer">
                            <Link href={action.href} className="flex items-center gap-3 px-3 py-2">
                                <action.icon className="size-4" />
                                <span className="text-xs font-semibold">{action.title}</span>
                            </Link>
                        </DropdownMenuItem>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
