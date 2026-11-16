import { router } from '@inertiajs/react';
import * as EchoReact from '@laravel/echo-react';
import { useCallback, useEffect, useRef } from 'react';

interface UseRealtimeSyncOptions {
    /** Inertia prop keys to partially reload, ignored when `onSync` is supplied. */
    only?: string[];
    /** Optional query parameters merged into partial Inertia reloads (e.g. active thread ID). */
    data?: Record<string, string | number | undefined>;
    /** Custom sync callback (used for API-backed pages such as Notifications). */
    onSync?: () => Promise<void> | void;
    intervalMs?: number;
    paused?: boolean;
    enabled?: boolean;
    echoChannel?: string;
    echoEvent?: string;
    notificationUserId?: number | string | null;
    notificationTypes?: string[];
}

/**
 * Visibility-aware real-time synchronization hook.
 * Combines instant Reverb/Echo triggers (when configured) with resilient interval polling.
 */
export function useRealtimeSync({
    only = [],
    data,
    onSync,
    intervalMs = 4500,
    paused = false,
    enabled = true,
    echoChannel,
    echoEvent,
    notificationUserId,
    notificationTypes,
}: UseRealtimeSyncOptions) {
    const isSyncingRef = useRef(false);
    const pendingSyncRef = useRef(false);

    const onlyRef = useRef(only);
    onlyRef.current = only;

    const dataRef = useRef(data);
    dataRef.current = data;

    const onSyncRef = useRef(onSync);
    onSyncRef.current = onSync;

    const pausedRef = useRef(paused);
    pausedRef.current = paused;

    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    const notificationTypesRef = useRef(notificationTypes);
    notificationTypesRef.current = notificationTypes;

    const triggerSync = useCallback(() => {
        if (
            !enabledRef.current ||
            pausedRef.current ||
            typeof document === 'undefined' ||
            document.visibilityState !== 'visible'
        ) {
            return;
        }

        if (isSyncingRef.current) {
            pendingSyncRef.current = true;
            return;
        }

        isSyncingRef.current = true;

        const finish = () => {
            isSyncingRef.current = false;
            if (pendingSyncRef.current) {
                pendingSyncRef.current = false;
                triggerSync();
            }
        };

        if (onSyncRef.current) {
            Promise.resolve(onSyncRef.current()).finally(finish);
            return;
        }

        router.reload({
            only: onlyRef.current,
            ...(dataRef.current ? { data: dataRef.current } : {}),
            preserveUrl: true,
            onFinish: finish,
        });
    }, []);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const intervalId = window.setInterval(triggerSync, intervalMs);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                triggerSync();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, intervalMs, triggerSync]);

    useEffect(() => {
        if (
            !enabled ||
            !echoChannel ||
            !echoEvent ||
            typeof EchoReact.echoIsConfigured !== 'function' ||
            !EchoReact.echoIsConfigured()
        ) {
            return;
        }

        try {
            const channel = EchoReact.echo().private(echoChannel);
            const handler = () => {
                triggerSync();
            };

            channel.listen(echoEvent, handler);

            return () => {
                channel.stopListening(echoEvent, handler);
            };
        } catch {
            return;
        }
    }, [enabled, echoChannel, echoEvent, triggerSync]);

    useEffect(() => {
        if (
            !enabled ||
            !notificationUserId ||
            typeof EchoReact.echoIsConfigured !== 'function' ||
            !EchoReact.echoIsConfigured()
        ) {
            return;
        }

        try {
            const channel = EchoReact.echo().private(`App.Models.User.${notificationUserId}`);
            const handler = (notification: Record<string, unknown>) => {
                const types = notificationTypesRef.current;
                if (types && types.length > 0) {
                    const data = notification?.data as Record<string, unknown> | undefined;
                    const topType = typeof notification?.type === 'string' ? notification.type : undefined;
                    const nestedType = typeof data?.type === 'string' ? data.type : undefined;
                    if (!types.some((t) => t === topType || t === nestedType)) {
                        return;
                    }
                }
                triggerSync();
            };

            channel.notification(handler);

            return () => {
                channel.stopListeningForNotification(handler);
            };
        } catch {
            return;
        }
    }, [enabled, notificationUserId, triggerSync]);

    return { triggerSync };
}
