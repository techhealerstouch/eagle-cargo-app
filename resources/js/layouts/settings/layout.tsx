import { Link, usePage } from '@inertiajs/react';
import {
    Bell,
    Map,
    Layers,
    Contact,
    Shield,
    Settings2,
    FileText,
    Ship,
    Building2,
    Search,
    ChevronRight,
    Compass,
    User,
    Truck,
    DollarSign,
} from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import admin from '@/routes/admin';
import { edit as editAppearance } from '@/routes/appearance';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import { index as generalSettingsIndex } from '@/routes/settings/general';
import type { NavItem, Auth } from '@/types';

const accountNavItems: NavItem[] = [
    {
        title: 'Personal Info',
        href: edit(),
        icon: Contact,
    },
    {
        title: 'Login & Security',
        href: editSecurity(),
        icon: Shield,
    },
    {
        title: 'Alerts & Messages',
        href: '/settings/notifications',
        icon: Bell,
    },
    {
        title: 'Look & Feel',
        href: editAppearance(),
        icon: Settings2,
    },
];

const companyNavItems: NavItem[] = [
    {
        title: 'App Name & Contact',
        href: generalSettingsIndex().url,
        icon: Building2,
    },
    {
        title: 'Invoice',
        href: '/settings/invoice',
        icon: FileText,
    },
    {
        title: 'Declaration Form',
        href: '/settings/declaration',
        icon: FileText,
    },
];

const operationsNavItems: NavItem[] = [
    {
        title: 'Pickup Rules',
        href: '/settings/logistics',
        icon: Map,
    },
    {
        title: 'Tracking Journey',
        href: '/settings/tracking',
        icon: Ship,
    },
    {
        title: 'Destination Areas',
        href: admin.areas.index().url,
        icon: Compass,
    },
    {
        title: 'Pickup Areas',
        href: admin.pickupZones.index().url,
        icon: Map,
    },
    {
        title: 'Booking Rates',
        href: admin.bookingRates.index().url,
        icon: DollarSign,
    },
    {
        title: 'Provinces',
        href: '/admin/provinces',
        icon: Map,
    },
    {
        title: 'Suburbs',
        href: admin.suburbs.index().url,
        icon: Compass,
    },
    {
        title: 'Box Sizes',
        href: admin.boxTypes.index().url,
        icon: Layers,
    },
];

function SidebarLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            className={cn(
                'group flex items-center justify-between w-full rounded-lg px-3 py-2 text-sm font-medium transition-all',
                isActive
                    ? 'bg-zinc-900 text-white font-medium shadow-2xs dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
            )}
        >
            <div className="flex items-center gap-2.5">
                {Icon && (
                    <Icon
                        className={cn(
                            'size-4 shrink-0 transition-colors',
                            isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-400 group-hover:text-zinc-600',
                        )}
                    />
                )}
                <span>{item.title}</span>
            </div>
            {isActive && <ChevronRight className="size-4 text-white/70 dark:text-zinc-900/70" />}
        </Link>
    );
}

interface SettingsLayoutProps extends PropsWithChildren {
    eyebrow?: string;
    title?: string;
    description?: string;
    actions?: React.ReactNode;
}

export default function SettingsLayout({
    children,
    eyebrow = 'Settings',
    title = 'Profile',
    description = 'Manage your account and operational preferences.',
    actions,
}: SettingsLayoutProps) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const [searchQuery, setSearchQuery] = useState('');

    const isAdmin =
        auth.user?.role === 'admin' || auth.user?.role === 'super_admin';

    const navSections = [
        { label: 'Account', items: accountNavItems },
        ...(isAdmin
            ? [
                  { label: 'Company', items: companyNavItems },
                  { label: 'Operations', items: operationsNavItems },
              ]
            : []),
    ];

    const filteredSections = navSections.map(section => ({
        ...section,
        items: section.items.filter(item =>
            item.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
        ),
    })).filter(section => section.items.length > 0);

    const allNavItems = navSections.flatMap((section) => section.items);

    if (typeof window === 'undefined') {
        return null;
    }

    return (
        <div className="mx-auto w-full space-y-6 px-4 sm:px-6 py-6 md:py-8 max-w-6xl">
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-zinc-200/80 pb-5">
                <div className="space-y-1">
                    {eyebrow && <div className="eyebrow">{eyebrow}</div>}
                    <h1 className="font-sans text-xl md:text-2xl font-semibold text-zinc-900 dark:text-white">
                        {title}
                    </h1>
                    <p className="text-sm text-zinc-500 leading-relaxed max-w-2xl dark:text-zinc-400">
                        {description}
                    </p>
                </div>
                {actions && <div className="shrink-0">{actions}</div>}
            </div>

            <div className="flex flex-col lg:flex-row lg:gap-8 items-start">
                {/* Mobile Scrollable Navigation */}
                <div className="mb-4 block w-full lg:hidden">
                    <div className="flex overflow-x-auto pb-2 gap-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {allNavItems.map((item) => {
                            const isActive = isCurrentOrParentUrl(item.href);
                            return (
                                <Link
                                    key={toUrl(item.href)}
                                    href={item.href}
                                    className={cn(
                                        "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all border",
                                        isActive
                                            ? "bg-zinc-900 text-white border-zinc-900 font-medium shadow-2xs"
                                            : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                                    )}
                                >
                                    {item.icon && (
                                        <item.icon className={cn("size-4", isActive ? "text-white" : "text-zinc-400")} />
                                    )}
                                    {item.title}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Desktop Sidebar Navigation */}
                <aside className="hidden shrink-0 lg:block lg:w-60 space-y-4">
                    {/* Settings Search Input */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search settings..."
                            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all placeholder:text-zinc-400"
                        />
                    </div>

                    <nav className="space-y-4" aria-label="Settings Navigation">
                        {filteredSections.map((section) => (
                            <div key={section.label} className="space-y-1">
                                <h4 className="px-3 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                                    {section.label}
                                </h4>
                                <div className="space-y-0.5">
                                    {section.items.map((item, index) => (
                                        <SidebarLink
                                            key={index}
                                            item={item}
                                            isActive={isCurrentOrParentUrl(item.href)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                        {filteredSections.length === 0 && (
                            <p className="text-center text-sm text-zinc-400 py-3 italic">No matching settings</p>
                        )}
                    </nav>
                </aside>

                {/* Content Container */}
                <div className="min-w-0 flex-1 w-full">
                    <div className="w-full animate-in duration-200 fade-in">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
