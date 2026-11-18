import { router, usePage } from '@inertiajs/react';
import { useEchoNotification } from '@laravel/echo-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
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
    fetchNotifications: (options?: { force?: boolean }) => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    refetch: (options?: { force?: boolean }) => Promise<void>;
};

type NotificationCacheEntry = {
    promise: Promise<NotificationsResponse> | null;
    lastFetchTime: number;
    data: NotificationsResponse | null;
};

type UserAlertState = {
    initialized: boolean;
    lastUnreadCount: number | null;
    alertedIds: Set<string>;
};

const MAX_TRACKED_ALERT_IDS = 500;
const notificationCache = new Map<number, NotificationCacheEntry>();
const userAlertStates = new Map<number, UserAlertState>();

function getUserAlertState(userId: number): UserAlertState {
    let state = userAlertStates.get(userId);
    if (!state) {
        state = {
            initialized: false,
            lastUnreadCount: null,
            alertedIds: new Set<string>(),
        };
        userAlertStates.set(userId, state);
    }

    return state;
}

function trackAlertedId(state: UserAlertState, id: string): void {
    state.alertedIds.add(id);
    if (state.alertedIds.size > MAX_TRACKED_ALERT_IDS) {
        const oldest = state.alertedIds.values().next().value;
        if (oldest !== undefined) {
            state.alertedIds.delete(oldest);
        }
    }
}

export function __resetNotificationsStateForTests(): void {
    notificationCache.clear();
    userAlertStates.clear();
}

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
    const previousUserIdRef = useRef<number | undefined>(userId);

    const alertNewNotification = useCallback((targetUserId: number, notification: Notification) => {
        const alertState = getUserAlertState(targetUserId);
        if (alertState.alertedIds.has(notification.id)) {
            return;
        }
        trackAlertedId(alertState, notification.id);

        const title = notification.data?.title ?? notification.data?.status_label ?? 'New Notification';
        const description = notification.data?.message ?? undefined;
        const targetUrl = notification.data?.url;

        if (targetUrl) {
            toast.info(title, {
                description,
                action: {
                    label: 'View',
                    onClick: () => {
                        router.visit(targetUrl);
                    },
                },
                duration: 8000,
            });
        } else {
            toast.info(title, {
                description,
                duration: 8000,
            });
        }

        try {
            router.reload({ only: ['sidebarCounts'] });
        } catch {
            // Safe fallback if router reload is not supported in non-Inertia test contexts
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const previousUserId = previousUserIdRef.current;

        if (previousUserId !== userId) {
            if (previousUserId !== undefined) {
                notificationCache.delete(previousUserId);
                userAlertStates.delete(previousUserId);
            }

            setNotifications([]);
            setUnreadCount(0);
            setError(null);
            previousUserIdRef.current = userId;
        }
    }, [userId]);

    const fetchNotifications = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
        if (!userId) {
            setNotifications([]);
            setUnreadCount(0);
            setError(null);

            return;
        }

        const cacheEntry = notificationCache.get(userId) ?? {
            promise: null,
            lastFetchTime: 0,
            data: null,
        };
        const now = Date.now();

        if (!force && !cacheEntry.promise && cacheEntry.data && now - cacheEntry.lastFetchTime < 5000) {
            const cachedNotifications = cacheEntry.data.data.notifications;
            const cachedUnreadCount = cacheEntry.data.data.unread_count;
            const alertState = getUserAlertState(userId);
            if (!alertState.initialized) {
                alertState.initialized = true;
                cachedNotifications.forEach((n) => trackAlertedId(alertState, n.id));
                alertState.lastUnreadCount = cachedUnreadCount;
            }
            setNotifications(cachedNotifications);
            setUnreadCount(cachedUnreadCount);

            return;
        }

        setIsLoading(true);
        setError(null);

        if (!cacheEntry.promise || force) {
            const requestUserId = userId;
            cacheEntry.promise = (async () => {
                try {
                    const response = await fetch('/api/notifications', {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        credentials: 'same-origin',
                    });

                    if (response.status === 401) {
                        return { success: false } as NotificationsResponse;
                    }

                    if (!response.ok) {
                        throw new Error('Failed to fetch notifications');
                    }

                    const data: NotificationsResponse = await response.json();

                    if (data.success) {
                        const currentEntry = notificationCache.get(requestUserId);

                        if (currentEntry) {
                            currentEntry.data = data;
                            currentEntry.lastFetchTime = Date.now();
                        }
                    }

                    return data;
                } finally {
                    const currentEntry = notificationCache.get(requestUserId);

                    if (currentEntry) {
                        currentEntry.promise = null;
                    }
                }
            })();
            notificationCache.set(userId, cacheEntry);
        }

        try {
            const data = await cacheEntry.promise;

            if (mountedRef.current && userId === previousUserIdRef.current) {
                if (!data?.success) {
                    setNotifications([]);
                    setUnreadCount(0);
                    setError(null);
                } else {
                    const fetchedNotifications = data.data.notifications;
                    const fetchedUnreadCount = data.data.unread_count;
                    const alertState = getUserAlertState(userId);

                    setNotifications(fetchedNotifications);
                    setUnreadCount(fetchedUnreadCount);

                    if (!alertState.initialized) {
                        alertState.initialized = true;
                        fetchedNotifications.forEach((n) => trackAlertedId(alertState, n.id));
                        alertState.lastUnreadCount = fetchedUnreadCount;
                    } else {
                        const unreadIncreased =
                            alertState.lastUnreadCount !== null && fetchedUnreadCount > alertState.lastUnreadCount;

                        if (unreadIncreased) {
                            fetchedNotifications.forEach((n) => {
                                if (!n.read_at && !alertState.alertedIds.has(n.id)) {
                                    alertNewNotification(userId, n);
                                }
                            });
                        }

                        fetchedNotifications.forEach((n) => trackAlertedId(alertState, n.id));
                        alertState.lastUnreadCount = fetchedUnreadCount;
                    }
                }
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
    }, [alertNewNotification, userId]);

    const fetchUnreadCount = useCallback(async () => {
        if (!userId) {
            return;
        }

        if (typeof document !== 'undefined' && document.hidden) {
            return;
        }

        try {
            const response = await fetch('/api/notifications/unread-count', {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (response.status === 401) {
                if (mountedRef.current) {
                    setNotifications([]);
                    setUnreadCount(0);
                    setError(null);
                }

                return;
            }

            if (response.ok) {
                const data: UnreadCountResponse = await response.json();

                if (mountedRef.current && data.success) {
                    const newCount = data.data.count;
                    const alertState = getUserAlertState(userId);
                    const prevCount = alertState.lastUnreadCount;
                    setUnreadCount(newCount);

                    if (prevCount !== null && newCount > prevCount) {
                        void fetchNotifications({ force: true });
                    } else {
                        alertState.lastUnreadCount = newCount;
                    }
                }
            }
        } catch {
            // Polling is a fallback; keep the UI quiet if a single poll fails.
        }
    }, [fetchNotifications, userId]);

    const markAsRead = useCallback(async (id: string) => {
        if (!userId) {
            return;
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
                let wasUnread = false;
                setNotifications((prev) =>
                    prev.map((n) => {
                        if (n.id === id && !n.read_at) {
                            wasUnread = true;

                            return { ...n, read_at: new Date().toISOString() };
                        }

                        return n;
                    })
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
                const alertState = getUserAlertState(userId);
                if (alertState.lastUnreadCount !== null && (wasUnread || alertState.lastUnreadCount > 0)) {
                    alertState.lastUnreadCount = Math.max(0, alertState.lastUnreadCount - 1);
                }
                notificationCache.delete(userId);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to mark as read');
        }
    }, [userId]);

    const markAllAsRead = useCallback(async () => {
        if (!userId) {
            return;
        }

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
                const alertState = getUserAlertState(userId);
                alertState.lastUnreadCount = 0;
                notificationCache.delete(userId);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to mark all as read');
        }
    }, [userId]);

    useEffect(() => {
        if (autoFetch && userId) {
            void fetchNotifications();
        }
    }, [autoFetch, fetchNotifications, userId]);

    useEffect(() => {
        if (!pollInterval || pollInterval <= 0) {
            return;
        }

        if (!userId) {
            return;
        }

        const interval = window.setInterval(fetchUnreadCount, pollInterval);

        return () => window.clearInterval(interval);
    }, [fetchUnreadCount, pollInterval, userId]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (typeof document !== 'undefined' && !document.hidden && userId) {
                void fetchUnreadCount();
            }
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);

            return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
    }, [fetchUnreadCount, userId]);

    useEchoNotification(
        userId ? `App.Models.User.${userId}` : '',
        (rawNotification) => {
            if (!userId) {
                return;
            }

            const raw = (rawNotification ?? {}) as Record<string, unknown>;
            const rawData =
                raw.data && typeof raw.data === 'object' && Object.keys(raw.data).length > 0
                    ? (raw.data as Notification['data'])
                    : (raw as unknown as Notification['data']);

            const normalized: Notification = {
                id: String(raw.id ?? crypto.randomUUID?.() ?? Date.now()),
                type: String(raw.type ?? rawData?.type ?? 'notification'),
                data: rawData,
                read_at: typeof raw.read_at === 'string' ? raw.read_at : null,
                created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
            };

            const alertState = getUserAlertState(userId);
            const alreadySeen = alertState.alertedIds.has(normalized.id);

            setNotifications((prev) => {
                if (prev.some((n) => n.id === normalized.id)) {
                    return prev;
                }

                return [normalized, ...prev];
            });

            if (!alreadySeen) {
                setUnreadCount((prev) => prev + 1);
                if (alertState.lastUnreadCount !== null) {
                    alertState.lastUnreadCount += 1;
                }
            }

            notificationCache.delete(userId);
            alertNewNotification(userId, normalized);
        },
        undefined,
        [String(userId), alertNewNotification]
    );

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
