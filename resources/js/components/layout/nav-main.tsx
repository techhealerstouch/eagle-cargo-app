import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuBadge,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';

export function NavMain({
    title,
    items = [],
}: {
    title?: string;
    items: NavItem[];
}) {
    const { isCurrentUrl } = useCurrentUrl();

    if (items.length === 0) {
        return null;
    }

    return (
        <SidebarGroup className="px-2 py-0">
            {title && <SidebarGroupLabel>{title}</SidebarGroupLabel>}
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            isActive={isCurrentUrl(item.href)}
                            tooltip={{ children: item.title }}
                        >
                            <Link href={item.href} prefetch>
                                {item.icon && <item.icon style={{ color: 'var(--brand-icon)' }} />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                        {item.badge !== undefined && item.badge !== null && item.badge > 0 && (
                            <SidebarMenuBadge className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-background">
                                {item.badge > 9 ? '9+' : item.badge}
                            </SidebarMenuBadge>
                        )}
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}





