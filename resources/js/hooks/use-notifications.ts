import { usePage } from '@inertiajs/react';
import { useEchoNotification } from '@laravel/echo-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Notification, NotificationsResponse, UnreadCountResponse } from '@/types';

type PageProps = {
    auth?: {
        user?: {
            id: number;
        };
    };
};

type UseNotificationsOptions = {
    pollInterval?: number; // in milliseconds, 0 to disable
    autoFetch?: boolean;
};

type UseNotificationsReturn = {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    error: string | null;
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    refetch: () => Promise<void>;
};

let globalFetchPromise: Promise<NotificationsResponse> | null = null;
let lastFetchTime = 0;
let cachedData: NotificationsResponse | null = null;

function xsrfToken(): string {
    return document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'))
        ? decodeURIComponent(document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'))![3])
        : '';
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
    const { pollInterval = 0, autoFetch = true } = options;

    const { auth } = usePage<PageProps>().props;
    const userId = auth?.user?.id;

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fetchNotifications = useCallback(async () => {
        const now = Date.now();

        if (!globalFetchPromise && cachedData && now - lastFetchTime < 5000) {
            setNotifications(cachedData.data.notifications);
            setUnreadCount(cachedData.data.unread_count);

            return;
        }

        setIsLoading(true);
        setError(null);

        if (!globalFetchPromise) {
            globalFetchPromise = (async () => {
                try {
                    const response = await fetch('/api/notifications', {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        credentials: 'same-origin',
                    });

                    if (!response.ok) {
                        throw new Error('Failed to fetch notifications');
                    }

                    const data: NotificationsResponse = await response.json();

                    if (data.success) {
                        cachedData = data;
                        lastFetchTime = Date.now();
                    }

                    return data;
                } finally {
                    globalFetchPromise = null;
                }
            })();
        }

        try {
            const data = await globalFetchPromise;

            if (mountedRef.current && data?.success) {
                setNotifications(data.data.notifications);
                setUnreadCount(data.data.unread_count);
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            }
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
            }
        }
    }, []);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const response = await fetch('/api/notifications/unread-count', {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (response.ok) {
                const data: UnreadCountResponse = await response.json();

                if (mountedRef.current && data.success) {
                    setUnreadCount(data.data.count);
                }
            }
        } catch {
            // Polling is a fallback; keep the UI quiet if a single poll fails.
        }
    }, []);

    const markAsRead = useCallback(async (id: string) => {
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
                setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
                setUnreadCount((prev) => Math.max(0, prev - 1));
                cachedData = null;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to mark as read');
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
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
                setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
                setUnreadCount(0);
                cachedData = null;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to mark all as read');
        }
    }, []);

    useEffect(() => {
        if (autoFetch) {
            fetchNotifications();
        }
    }, [autoFetch, fetchNotifications]);

    useEffect(() => {
        if (!pollInterval || pollInterval <= 0) {
            return;
        }

        const interval = window.setInterval(fetchUnreadCount, pollInterval);

        return () => window.clearInterval(interval);
    }, [fetchUnreadCount, pollInterval]);

    useEchoNotification(userId ? `App.Models.User.${userId}` : '', (notification) => {
        setNotifications((prev) => [notification as unknown as Notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
        cachedData = null;
    });

    return {
        notifications,
        unreadCount,
        isLoading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        refetch: fetchNotifications,
    };
}
