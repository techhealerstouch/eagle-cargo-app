import { Head, Link } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import {
    Bell,
    Check,
    CheckSquare,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    CreditCard,
    Info,
    Loader2,
    Package,
    Search,
    Ship,
    Truck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem, Notification } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Notifications',
        href: '/notifications',
    },
];

function xsrfToken(): string {
    return document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'))
        ? decodeURIComponent(document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'))![3])
        : '';
}

function getNotificationIcon(notification: Notification) {
    const type = notification.data?.type ?? 'info';

    switch (type) {
        case 'box_status':
            return <Truck className="size-4" />;
        case 'booking':
            return <Package className="size-4" />;
        case 'payment':
            return <CreditCard className="size-4" />;
        case 'batch_lifecycle':
        case 'batch_status':
            return <Ship className="size-4" />;
        case 'runsheet_assigned':
            return <ClipboardList className="size-4" />;
        default:
            return <Info className="size-4" />;
    }
}

function getNotificationStyle(notification: Notification) {
    const type = notification.data?.type ?? 'info';

    switch (type) {
        case 'box_status':
            return 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20';
        case 'booking':
            return 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20';
        case 'payment':
            return 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20';
        case 'batch_lifecycle':
        case 'batch_status':
            return 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border border-violet-500/20';
        case 'runsheet_assigned':
            return 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20';
        default:
            return 'bg-neutral-500/10 text-neutral-600 dark:bg-neutral-500/20 dark:text-neutral-400 border border-neutral-500/20';
    }
}

function getNotificationTitle(notification: Notification): string {
    return notification.data?.title ?? notification.data?.status_label ?? 'Notification';
}

function getNotificationMessage(notification: Notification): string {
    return notification.data?.message ?? '';
}

type CategoryType = 'all' | 'shipment' | 'booking' | 'payment' | 'other';

export default function NotificationsIndex() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    
    // Filters & Pagination State
    const [statusFilter, setStatusFilter] = useState<'all' | 'unread'>('all');
    const [categoryFilter, setCategoryFilter] = useState<CategoryType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const fetchNotifications = useCallback(async (page: number) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/notifications?page=${page}&per_page=15`, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }

            const res = await response.json();
            if (res.success) {
                setNotifications(res.data.notifications);
                setUnreadCount(res.data.unread_count);
                setCurrentPage(res.data.pagination.current_page);
                setTotalPages(res.data.pagination.last_page);
                setTotalItems(res.data.pagination.total);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('Could not load notifications. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load initial data
    useEffect(() => {
        fetchNotifications(1);
    }, [fetchNotifications]);

    // Handle marking a single notification as read
    const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        try {
            const response = await fetch(`/api/notifications/${id}/read`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
                credentials: 'same-origin',
            });

            if (response.ok) {
                setNotifications((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
                toast.success('Notification marked as read');
            } else {
                toast.error('Failed to update notification');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        }
    };

    // Handle marking all notifications as read
    const handleMarkAllAsRead = async () => {
        if (unreadCount === 0) return;
        setIsActionLoading(true);

        try {
            const response = await fetch('/api/notifications/read-all', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
                credentials: 'same-origin',
            });

            if (response.ok) {
                setNotifications((prev) =>
                    prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
                );
                setUnreadCount(0);
                toast.success('All notifications marked as read');
            } else {
                toast.error('Failed to mark all as read');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read_at) {
            handleMarkAsRead(notification.id);
        }

        if (notification.data?.url) {
            window.location.href = notification.data.url;
        }
    };

    // Filter notifications locally
    const filteredNotifications = notifications.filter((n) => {
        // 1. Status Filter
        if (statusFilter === 'unread' && n.read_at) return false;

        // 2. Category Filter
        const type = n.data?.type ?? 'info';
        if (categoryFilter === 'shipment' && !['box_status', 'batch_lifecycle', 'batch_status', 'runsheet_assigned'].includes(type)) return false;
        if (categoryFilter === 'booking' && type !== 'booking') return false;
        if (categoryFilter === 'payment' && type !== 'payment') return false;
        if (categoryFilter === 'other' && ['box_status', 'batch_lifecycle', 'batch_status', 'booking', 'payment', 'runsheet_assigned'].includes(type)) return false;

        // 3. Search Query
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            const title = getNotificationTitle(n).toLowerCase();
            const msg = getNotificationMessage(n).toLowerCase();
            return title.includes(query) || msg.includes(query);
        }

        return true;
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Notifications" />

            <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
                {/* Header Section */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                            Notifications
                        </h1>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                            Stay up to date with your shipments, bookings, and payments.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleMarkAllAsRead}
                                disabled={isActionLoading}
                                className="h-9 cursor-pointer gap-2 border-brand-rust/20 text-brand-rust hover:bg-brand-rust/5 hover:text-brand-primary"
                            >
                                {isActionLoading ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <CheckSquare className="size-4" />
                                )}
                                Mark all as read
                            </Button>
                        )}
                        <Badge
                            variant={unreadCount > 0 ? 'default' : 'secondary'}
                            className={cn(
                                "px-3 py-1 text-xs font-semibold rounded-full",
                                unreadCount > 0 ? 'bg-brand-primary text-white' : 'text-muted-foreground'
                            )}
                        >
                            {unreadCount} unread
                        </Badge>
                    </div>
                </div>

                {/* Filters Section */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card/40 border border-border/40 p-4 rounded-xl backdrop-blur-sm shadow-sm">
                    {/* Status Tabs */}
                    <Tabs
                        value={statusFilter}
                        onValueChange={(val) => setStatusFilter(val as 'all' | 'unread')}
                        className="w-full md:w-auto"
                    >
                        <TabsList className="bg-muted/50 p-0.5 rounded-lg border border-border/20">
                            <TabsTrigger value="all" className="text-xs font-semibold px-4 py-1.5 rounded-md cursor-pointer data-[state=active]:bg-background data-[state=active]:shadow-sm">All</TabsTrigger>
                            <TabsTrigger value="unread" className="text-xs font-semibold px-4 py-1.5 rounded-md cursor-pointer data-[state=active]:bg-background data-[state=active]:shadow-sm">Unread</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Search Field */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter by keyword..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 border-border/50 bg-background/50 focus-visible:ring-brand-primary"
                        />
                    </div>
                </div>

                {/* Category Tags */}
                <div className="flex flex-wrap gap-2 pb-2">
                    {[
                        { key: 'all', label: 'All Categories' },
                        { key: 'shipment', label: 'Shipments' },
                        { key: 'booking', label: 'Bookings' },
                        { key: 'payment', label: 'Payments' },
                        { key: 'other', label: 'System & Security' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setCategoryFilter(tab.key as CategoryType)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all duration-200 cursor-pointer",
                                categoryFilter === tab.key
                                    ? "bg-brand-primary border-brand-primary text-white shadow-sm scale-102"
                                    : "bg-background border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* List Container */}
                <div className="space-y-3">
                    {isLoading ? (
                        Array.from({ length: 4 }).map((_, idx) => (
                            <Card key={idx} className="border-border/30 bg-card/30">
                                <CardContent className="flex items-start gap-4 p-5">
                                    <Skeleton className="size-9 rounded-full shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-3/4" />
                                        <Skeleton className="h-3 w-1/6" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : filteredNotifications.length > 0 ? (
                        filteredNotifications.map((n) => {
                            const isUnread = !n.read_at;
                            return (
                                <div
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n)}
                                    className={cn(
                                        "group flex items-start gap-4 p-4 md:p-5 rounded-xl border transition-all duration-300",
                                        "cursor-pointer shadow-sm relative overflow-hidden",
                                        isUnread
                                            ? "bg-brand-warm/10 dark:bg-brand-warm/5 border-brand-primary/20 hover:border-brand-primary/40 hover:bg-brand-warm/20 dark:hover:bg-brand-warm/10"
                                            : "bg-card hover:bg-muted/30 border-border/30 hover:border-border/60"
                                    )}
                                >
                                    {/* Action visual background glow on unread */}
                                    {isUnread && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-primary" />
                                    )}

                                    {/* Left Icon */}
                                    <div className={cn(
                                        "rounded-full p-2.5 shrink-0 transition-transform duration-300 group-hover:scale-105",
                                        getNotificationStyle(n)
                                    )}>
                                        {getNotificationIcon(n)}
                                    </div>

                                    {/* Middle Details */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className={cn(
                                                "text-sm font-extrabold text-foreground truncate",
                                                isUnread && "text-brand-navy dark:text-white"
                                            )}>
                                                {getNotificationTitle(n)}
                                            </h3>
                                            {isUnread && (
                                                <Badge className="bg-brand-primary text-white border-0 text-[10px] px-2 py-0">
                                                    New
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                            {getNotificationMessage(n)}
                                        </p>
                                        <p className="text-[10px] md:text-xs text-muted-foreground/60">
                                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                        </p>
                                    </div>

                                    {/* Right Actions */}
                                    <div className="flex items-center gap-2 self-center shrink-0">
                                        {isUnread ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => handleMarkAsRead(n.id, e)}
                                                className="h-8 w-8 text-muted-foreground/50 hover:text-brand-primary hover:bg-brand-primary/10 rounded-full cursor-pointer transition-colors duration-200"
                                                title="Mark as read"
                                            >
                                                <Check className="size-4" />
                                                <span className="sr-only">Mark as read</span>
                                            </Button>
                                        ) : (
                                            <div className="h-8 w-8 flex items-center justify-center text-muted-foreground/20">
                                                <Check className="size-4" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-16 bg-card/20 border border-dashed border-border/50 rounded-2xl p-8 max-w-md mx-auto">
                            <div className="inline-flex items-center justify-center size-14 rounded-full bg-brand-warm/10 dark:bg-brand-warm/5 text-brand-rust mb-4">
                                <Bell className="size-7 opacity-85" />
                            </div>
                            <h3 className="text-base font-extrabold text-foreground">All caught up!</h3>
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                {statusFilter === 'unread' 
                                    ? "You have no unread notifications right now."
                                    : "There are no notifications matching your current filters."
                                }
                            </p>
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border/20 pt-6">
                        <div className="text-xs text-muted-foreground font-medium">
                            Showing page <span className="font-bold text-foreground">{currentPage}</span> of <span className="font-bold text-foreground">{totalPages}</span> ({totalItems} total notifications)
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1 || isLoading}
                                onClick={() => fetchNotifications(currentPage - 1)}
                                className="h-8 px-2 border-border/50 hover:bg-muted/50 cursor-pointer disabled:opacity-50"
                            >
                                <ChevronLeft className="size-4 mr-1" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === totalPages || isLoading}
                                onClick={() => fetchNotifications(currentPage + 1)}
                                className="h-8 px-2 border-border/50 hover:bg-muted/50 cursor-pointer disabled:opacity-50"
                            >
                                Next
                                <ChevronRight className="size-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
