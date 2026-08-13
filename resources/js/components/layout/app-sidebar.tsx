import type { PageProps } from '@inertiajs/core';
import { Link, usePage } from '@inertiajs/react';
import {
    BookOpen,
    LayoutGrid,
    Box,
    Users,
    ClipboardList,
    FileText,
    MessageSquare,
    Megaphone,
    UserCog,
    ScanLine,
    PlusCircle,
    CreditCard,
    Contact,
    Layers,
    PieChart,
    Truck,
    ShieldAlert,
    History,
    Search,
    Banknote,
    Activity,
} from 'lucide-react';
import AppLogo from '@/components/layout/app-logo';
import { NavFooter } from '@/components/layout/nav-footer';
import { NavMain } from '@/components/layout/nav-main';
import { NavUser } from '@/components/layout/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import admin from '@/routes/admin';
import { bookings } from '@/routes/sender';
import type { NavItem, Auth, SharedData } from '@/types';

// Reusable standard navigation items
const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    // Determine the user's role from the shared page props
    const { auth, sidebarCounts } = usePage<PageProps & SharedData>().props;
    const role = auth.user ? (auth.user as any).role || 'sender' : 'guest';

    const isSuperAdmin = role === 'super_admin';
    const isAdmin = role === 'super_admin' || role === 'admin';
    const isCourier = role === 'courier';
    const isPicker = role === 'picker';
    const isWarehouse = role === 'warehouse';
    const isSender = role === 'sender';
    const isRecipient = role === 'recipient';
    const isGuest = role === 'guest';

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader className="p-3 px-4 group-data-[state=collapsed]:p-2 group-data-[state=collapsed]:py-3">
                <Link href={dashboard()} prefetch className="outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-xl">
                    <AppLogo />
                </Link>
            </SidebarHeader>

            <SidebarContent>
                {/* Admin / Super Admin Navigation */}
                {isAdmin && (
                    <>
                        <NavMain
                            title="Operations"
                            items={[
                                {
                                    title: 'Dashboard',
                                    href: dashboard(),
                                    icon: LayoutGrid,
                                },
                                {
                                    title: 'Bookings',
                                    href: admin.bookings.index().url,
                                    icon: BookOpen,
                                    badge: sidebarCounts?.bookings,
                                },
                                { title: 'Boxes', href: admin.boxes.index().url, icon: Box },
                                {
                                    title: 'Pickups',
                                    href: '/admin/runsheets/pickups',
                                    icon: ClipboardList,
                                },
                                {
                                    title: 'Deliveries',
                                    href: '/admin/runsheets/deliveries',
                                    icon: Truck,
                                },
                                {
                                    title: 'Track Shipment',
                                    href: '/track',
                                    icon: Search,
                                },
                            ]}
                        />
                        <NavMain
                            title="Senders & Accounts"
                            items={[
                                {
                                    title: 'Senders',
                                    href: admin.senders.index().url,
                                    icon: Users,
                                },
                                {
                                    title: 'Recipients',
                                    href: admin.recipients.index().url,
                                    icon: Contact,
                                },
                                {
                                    title: 'Invoices',
                                    href: admin.invoices.index().url,
                                    icon: FileText,
                                },
                                {
                                    title: 'Payments',
                                    href: admin.payments.index().url,
                                    icon: CreditCard,
                                    badge: sidebarCounts?.payments,
                                },
                            ]}
                        />
                        <NavMain
                            title="Intelligence"
                            items={[
                                {
                                    title: 'Commissions',
                                    href: '/admin/commissions',
                                    icon: Banknote,
                                },
                                {
                                    title: 'Financial Report',
                                    href: '/admin/reports/financial',
                                    icon: PieChart,
                                },
                                {
                                    title: 'Tracking Analytics',
                                    href: '/admin/tracking-analytics',
                                    icon: Activity,
                                },
                            ]}
                        />
                        <NavMain
                            title="Logistics"
                            items={[
                                {
                                    title: 'Batches',
                                    href: '/admin/batches',
                                    icon: Layers,
                                    badge: sidebarCounts?.batches,
                                },
                                {
                                    title: 'Serial Numbers',
                                    href: '/admin/serial-numbers',
                                    icon: ScanLine,
                                },
                                {
                                    title: 'Warehouse',
                                    href: '/warehouse/dashboard',
                                    icon: LayoutGrid,
                                },
                            ]}
                        />
                        <NavMain
                            title="Communication"
                            items={[
                                {
                                    title: 'Enquiries',
                                    href: '/admin/enquiries',
                                    icon: MessageSquare,
                                    badge: sidebarCounts?.enquiries,
                                },
                                {
                                    title: 'Shipping Updates',
                                    href: '/admin/shipping-updates',
                                    icon: Megaphone,
                                },
                            ]}
                        />
                        <NavMain
                            title="System"
                            items={[
                                {
                                    title: 'Users',
                                    href: '/admin/users',
                                    icon: UserCog,
                                },
                                ...(isSuperAdmin ? [
                                    {
                                        title: 'System Health',
                                        href: admin.dataIntegrity.index().url,
                                        icon: ShieldAlert,
                                        badge: sidebarCounts?.systemHealth,
                                    },
                                ] : []),
                            ]}
                        />
                    </>
                )}

                {/* Warehouse Navigation */}
                {isWarehouse && (
                    <NavMain
                        items={[
                            {
                                title: 'Scanner Dashboard',
                                href: '/warehouse/dashboard',
                                icon: ScanLine,
                            },
                            {
                                title: 'Box Directory',
                                href: admin.boxes.index().url,
                                icon: Box,
                            },
                            {
                                title: 'Incoming Pickups',
                                href: '/admin/runsheets/pickups',
                                icon: ClipboardList,
                            },
                            {
                                title: 'Incoming Deliveries',
                                href: '/admin/runsheets/deliveries',
                                icon: Truck,
                            },
                            {
                                title: 'Container Batches',
                                href: '/admin/batches',
                                icon: Layers,
                            },
                            {
                                title: 'Track Shipment',
                                href: '/track',
                                icon: Search,
                            },
                        ]}
                    />
                )}

                {/* Courier Navigation */}
                {isCourier && (
                    <NavMain
                        items={[
                            {
                                title: 'Courier Dashboard',
                                href: '/courier/dashboard',
                                icon: LayoutGrid,
                            },
                            {
                                title: 'My Runsheets',
                                href: '/courier/runsheets',
                                icon: ClipboardList,
                            },
                            {
                                title: 'Scan Box',
                                href: '/courier/scan',
                                icon: ScanLine,
                            },
                        ]}
                    />
                )}

                {/* Picker Navigation */}
                {isPicker && (
                    <NavMain
                        items={[
                            {
                                title: 'Picker Dashboard',
                                href: '/picker/dashboard',
                                icon: LayoutGrid,
                            },
                            {
                                title: 'My Runsheets',
                                href: '/picker/runsheets',
                                icon: ClipboardList,
                            },
                            {
                                title: 'Earnings',
                                href: '/picker/earnings',
                                icon: Banknote,
                            },
                            {
                                title: 'Scan Box',
                                href: '/picker/scan',
                                icon: ScanLine,
                            },
                        ]}
                    />
                )}

                {/* Recipient Navigation */}
                {isRecipient && (
                    <NavMain
                        items={[
                            {
                                title: 'Dashboard',
                                href: '/recipient/dashboard',
                                icon: LayoutGrid,
                            },
                            {
                                title: 'Track Shipment',
                                href: '/track',
                                icon: Box,
                            },
                        ]}
                    />
                )}

                {/* Sender Navigation */}
                {isSender && (
                    <NavMain
                        items={[
                            {
                                title: 'Dashboard',
                                href: dashboard(),
                                icon: LayoutGrid,
                            },
                            {
                                title: 'My Bookings',
                                href: bookings(),
                                icon: BookOpen,
                                badge: sidebarCounts?.myBookings,
                            },
                            {
                                title: 'Receipients',
                                href: '/recipients',
                                icon: Contact,
                            },
                            {
                                title: 'Book Shipment',
                                href: '/book',
                                icon: PlusCircle,
                            },
                            { title: 'Track Shipment', href: '/track', icon: Box },
                        ]}
                    />
                )}

                {/* Guest Navigation */}
                {isGuest && (
                    <NavMain
                        items={[
                            { title: 'Home', href: '/home', icon: LayoutGrid },
                            { title: 'Track Shipment', href: '/track', icon: Box },
                            { title: 'About', href: '/about', icon: Users },
                            { title: 'Services', href: '/services', icon: Box },
                            { title: 'FAQ', href: '/faq', icon: MessageSquare },
                            {
                                title: 'Contact',
                                href: '/contact',
                                icon: FileText,
                            },
                        ]}
                    />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}





