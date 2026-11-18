import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.unmock('@/hooks/use-notifications');
vi.unmock('@laravel/echo-react');

import { useNotifications, __resetNotificationsStateForTests } from '../use-notifications';
import { toast } from 'sonner';
import { router } from '@inertiajs/react';

let capturedEchoCallback: ((payload: any) => void) | null = null;
let capturedEchoEventFilter: any = 'UNSET';
let capturedEchoDependencies: any[] | null = null;

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        props: {
            auth: {
                user: { id: 42, role: 'admin' },
            },
        },
    }),
    router: {
        visit: vi.fn(),
        reload: vi.fn(),
    },
}));

vi.mock('@laravel/echo-react', () => ({
    useEchoNotification: (
        _channelName: string,
        callback: (payload: any) => void,
        event: any,
        dependencies: any[]
    ) => {
        capturedEchoCallback = callback;
        capturedEchoEventFilter = event;
        capturedEchoDependencies = dependencies;
        return {
            listen: vi.fn(),
            stopListening: vi.fn(),
            leaveChannel: vi.fn(),
            leave: vi.fn(),
            channel: vi.fn(),
        };
    },
}));

vi.mock('sonner', () => ({
    toast: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('useNotifications Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetNotificationsStateForTests();
        capturedEchoCallback = null;
        capturedEchoEventFilter = 'UNSET';
        capturedEchoDependencies = null;

        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: false,
        });

        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('/unread-count')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ success: true, data: { count: 1 } }),
                });
            }

            if (url.includes('/read')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ success: true }),
                });
            }

            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        success: true,
                        data: {
                            notifications: [
                                {
                                    id: 'notif-1',
                                    type: 'booking',
                                    data: {
                                        booking_id: 101,
                                        title: 'New Guest Booking',
                                        message: 'New booking BK-2026-101 received from Juan.',
                                        url: '/admin/bookings/101',
                                    },
                                    read_at: null,
                                    created_at: new Date().toISOString(),
                                },
                            ],
                            unread_count: 1,
                        },
                    }),
            });
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('passes dependencies properly to useEchoNotification without filtering event name', () => {
        renderHook(() => useNotifications({ autoFetch: false }));

        expect(capturedEchoEventFilter).toBeUndefined();
        expect(capturedEchoDependencies).toEqual(expect.arrayContaining(['42']));
        expect(capturedEchoCallback).toBeTypeOf('function');
    });

    it('displays toast alert and triggers sidebar count reload on incoming echo broadcast', () => {
        const { result } = renderHook(() => useNotifications({ autoFetch: false }));

        expect(capturedEchoCallback).not.toBeNull();

        act(() => {
            capturedEchoCallback!({
                id: 'broadcast-notif-99',
                type: 'booking',
                booking_id: 99,
                reference: 'BK-GUEST-099',
                is_guest: true,
                title: 'New Guest Booking',
                message: 'New booking BK-GUEST-099 received from Guest Customer.',
                url: '/admin/bookings/99',
            });
        });

        expect(toast.info).toHaveBeenCalledWith(
            'New Guest Booking',
            expect.objectContaining({
                description: 'New booking BK-GUEST-099 received from Guest Customer.',
                action: expect.objectContaining({
                    label: 'View',
                }),
            })
        );

        expect(router.reload).toHaveBeenCalledWith({ only: ['sidebarCounts'] });
        expect(result.current.notifications.length).toBeGreaterThan(0);
        expect(result.current.notifications[0].id).toBe('broadcast-notif-99');
    });

    it('navigates via router.visit when action onClick is executed', () => {
        renderHook(() => useNotifications({ autoFetch: false }));

        act(() => {
            capturedEchoCallback!({
                id: 'notif-test-click',
                type: 'booking',
                title: 'New Guest Booking',
                message: 'Booking received',
                url: '/admin/bookings/123',
            });
        });

        const toastCallArgs = vi.mocked(toast.info).mock.calls[0];
        const actionOptions = toastCallArgs[1] as { action?: { onClick: () => void } };
        expect(actionOptions?.action).toBeDefined();

        actionOptions.action!.onClick();
        expect(router.visit).toHaveBeenCalledWith('/admin/bookings/123');
    });

    it('suppresses toast on initial fetch and alerts when 15s polling detects new booking after markAsRead', async () => {
        vi.useFakeTimers();

        let unreadCountOnServer = 1;
        let notificationsOnServer = [
            {
                id: 'hist-1',
                type: 'booking',
                data: {
                    booking_id: 100,
                    title: 'New Guest Booking',
                    message: 'Historical unread booking',
                    url: '/admin/bookings/100',
                },
                read_at: null as string | null,
                created_at: new Date().toISOString(),
            },
        ];

        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('/unread-count')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ success: true, data: { count: unreadCountOnServer } }),
                });
            }
            if (url.includes('/read')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ success: true }),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        success: true,
                        data: {
                            notifications: notificationsOnServer,
                            unread_count: unreadCountOnServer,
                        },
                    }),
            });
        });

        const { result, unmount } = renderHook(() => useNotifications({ pollInterval: 15000, autoFetch: true }));

        await act(async () => {
            await Promise.resolve();
        });

        // Historical unread item on load must NOT trigger toast
        expect(toast.info).not.toHaveBeenCalled();

        // Mark existing notification read -> count drops from 1 -> 0
        await act(async () => {
            await result.current.markAsRead('hist-1');
        });
        unreadCountOnServer = 0;

        // Remount (simulating Inertia SPA page navigation within 5s cache or after)
        unmount();
        const { result: remounted } = renderHook(() => useNotifications({ pollInterval: 15000, autoFetch: true }));
        await act(async () => {
            await Promise.resolve();
        });
        expect(toast.info).not.toHaveBeenCalled();

        // New guest booking arrives while Echo is offline -> server count rises back from 0 -> 1
        unreadCountOnServer = 1;
        notificationsOnServer = [
            {
                id: 'fresh-guest-202',
                type: 'booking',
                data: {
                    booking_id: 202,
                    title: 'New Guest Booking',
                    message: 'New booking BK-2026-202 received from Maria Santos.',
                    url: '/admin/bookings/202',
                },
                read_at: null,
                created_at: new Date().toISOString(),
            },
            { ...notificationsOnServer[0], read_at: new Date().toISOString() },
        ];

        // Advance 15s poll while hidden -> skipped
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(15000);
        });
        expect(toast.info).not.toHaveBeenCalled();

        // Tab becomes visible -> immediately triggers poll and alerts
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(toast.info).toHaveBeenCalledTimes(1);
        expect(toast.info).toHaveBeenCalledWith(
            'New Guest Booking',
            expect.objectContaining({
                description: 'New booking BK-2026-202 received from Maria Santos.',
            })
        );
        expect(remounted.current.notifications[0].id).toBe('fresh-guest-202');
    });
});
