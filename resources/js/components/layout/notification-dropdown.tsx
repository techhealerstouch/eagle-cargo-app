import { formatDistanceToNow } from 'date-fns';
import { Link } from '@inertiajs/react';
import { Bell, ClipboardList, CreditCard, Info, Loader2, Package, Ship, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

function getNotificationIcon(notification: Notification) {
    const type = notification.data?.type ?? 'info';

    switch (type) {
        case 'box_status':
            return <Truck className="size-3.5" />;
        case 'booking':
            return <Package className="size-3.5" />;
        case 'payment':
            return <CreditCard className="size-3.5" />;
        case 'batch_lifecycle':
        case 'batch_status':
            return <Ship className="size-3.5" />;
        case 'runsheet_assigned':
            return <ClipboardList className="size-3.5" />;
        default:
            return <Info className="size-3.5" />;
    }
}

function getNotificationStyle(notification: Notification) {
    const type = notification.data?.type ?? 'info';

    switch (type) {
        case 'box_status':
            return 'bg-blue-500/10 text-blue-600';
        case 'booking':
            return 'bg-emerald-500/10 text-emerald-600';
        case 'payment':
            return 'bg-amber-500/10 text-amber-600';
        case 'batch_lifecycle':
        case 'batch_status':
            return 'bg-violet-500/10 text-violet-600';
        case 'runsheet_assigned':
            return 'bg-indigo-500/10 text-indigo-600';
        default:
            return 'bg-neutral-500/10 text-neutral-600';
    }
}

function getNotificationTitle(notification: Notification): string {
    return notification.data?.title ?? notification.data?.status_label ?? 'Notification';
}

function getNotificationMessage(notification: Notification): string {
    return notification.data?.message ?? '';
}

export function NotificationDropdown() {
    const {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
    } = useNotifications({ pollInterval: 60000 });

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read_at) {
            markAsRead(notification.id);
        }

        // Navigate if URL provided
        if (notification.data?.url) {
            window.location.href = notification.data.url;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="group relative h-9 w-9 cursor-pointer">
                    <Bell className="size-5 opacity-80 group-hover:opacity-100" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-background">
                            {unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <DropdownMenuLabel className="p-4 flex items-center justify-between">
                    <span className="text-sm font-bold">Notifications</span>
                    {unreadCount > 0 && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                markAllAsRead();
                            }}
                            className="text-xs font-medium text-brand-rust hover:underline"
                        >
                            Mark all as read
                        </button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="m-0" />
                <div className="max-h-96 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-8 text-center">
                            <Loader2 className="mx-auto mb-3 size-6 text-muted-foreground/50 animate-spin" />
                            <p className="text-sm text-muted-foreground">Loading...</p>
                        </div>
                    ) : notifications.length > 0 ? (
                        notifications.map((n) => (
                            <DropdownMenuItem
                                key={n.id}
                                onClick={() => handleNotificationClick(n)}
                                className={cn(
                                    "flex flex-col items-start gap-1 p-4 cursor-pointer focus:bg-brand-warm/10",
                                    !n.read_at && "bg-brand-warm/5"
                                )}
                            >
                                <div className="flex w-full items-start gap-3">
                                    <div className={cn(
                                        "mt-1 rounded-full p-1.5",
                                        getNotificationStyle(n)
                                    )}>
                                        {getNotificationIcon(n)}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className={cn(
                                            "text-xs font-bold leading-none",
                                            !n.read_at && "text-foreground"
                                        )}>
                                            {getNotificationTitle(n)}
                                        </p>
                                        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                                            {getNotificationMessage(n)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/60">
                                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                        </p>
                                    </div>
                                    {!n.read_at && (
                                        <div className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-primary shrink-0"></div>
                                    )}
                                </div>
                            </DropdownMenuItem>
                        ))
                    ) : (
                        <div className="p-8 text-center">
                            <Bell className="mx-auto mb-3 size-8 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No new notifications</p>
                        </div>
                    )}
                </div>
                <DropdownMenuSeparator className="m-0" />
                <DropdownMenuItem asChild className="p-0">
                    <Link
                        href="/notifications"
                        className="flex p-3 text-center w-full justify-center text-xs font-semibold text-brand-rust hover:text-brand-primary cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                        View all notifications
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
