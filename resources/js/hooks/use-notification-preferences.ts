import { useCallback, useEffect, useState } from 'react';
import type {
    ChannelInfo,
    NotificationChannel,
    NotificationPreferenceMatrix,
    PreferencesResponse,
} from '@/types';

type UseNotificationPreferencesReturn = {
    preferences: NotificationPreferenceMatrix;
    channels: ChannelInfo[];
    categories: { [key: string]: string };
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    fetchPreferences: () => Promise<void>;
    updatePreference: (eventType: string, channel: NotificationChannel, enabled: boolean) => Promise<void>;
    toggleChannel: (channel: NotificationChannel, enabled: boolean) => Promise<void>;
    toggleCategory: (category: string, enabled: boolean) => Promise<void>;
};

export function useNotificationPreferences(): UseNotificationPreferencesReturn {
    const [preferences, setPreferences] = useState<NotificationPreferenceMatrix>({});
    const [channels, setChannels] = useState<ChannelInfo[]>([]);
    const [categories, setCategories] = useState<{ [key: string]: string }>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPreferences = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/notifications/preferences', {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch preferences');
            }

            const data: PreferencesResponse = await response.json();

            if (data.success) {
                setPreferences(data.data.preferences);
                setChannels(data.data.channels);
                setCategories(data.data.categories);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updatePreference = useCallback(async (
        eventType: string,
        channel: NotificationChannel,
        enabled: boolean
    ) => {
        setIsSaving(true);
        setError(null);

        // Optimistic update
        setPreferences(prev => ({
            ...prev,
            [eventType]: {
                ...prev[eventType],
                channels: {
                    ...prev[eventType].channels,
                    [channel]: enabled,
                },
            },
        }));

        try {
            const response = await fetch('/api/notifications/preferences', {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)')) ? decodeURIComponent(document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'))![3]) : '',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    channel,
                    event_type: eventType,
                    enabled,
                }),
            });

            if (!response.ok) {
                // Revert on failure
                setPreferences(prev => ({
                    ...prev,
                    [eventType]: {
                        ...prev[eventType],
                        channels: {
                            ...prev[eventType].channels,
                            [channel]: !enabled,
                        },
                    },
                }));

                throw new Error('Failed to update preference');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    }, []);

    const toggleChannel = useCallback(async (channel: NotificationChannel, enabled: boolean) => {
        setIsSaving(true);
        setError(null);

        const updates = Object.keys(preferences).map(eventType => ({
            channel,
            event_type: eventType,
            enabled,
        }));

        // Optimistic update
        setPreferences(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(eventType => {
                next[eventType] = {
                    ...next[eventType],
                    channels: {
                        ...next[eventType].channels,
                        [channel]: enabled,
                    },
                };
            });

            return next;
        });

        try {
            const response = await fetch('/api/notifications/preferences/bulk', {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)')) ? decodeURIComponent(document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'))![3]) : '',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ preferences: updates }),
            });

            if (!response.ok) {
                await fetchPreferences(); // Revert

                throw new Error('Failed to update preferences');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    }, [preferences, fetchPreferences]);

    const toggleCategory = useCallback(async (category: string, enabled: boolean) => {
        setIsSaving(true);
        setError(null);

        const updates: { channel: string; event_type: string; enabled: boolean }[] = [];

        Object.entries(preferences).forEach(([eventType, pref]) => {
            if (pref.category === category) {
                channels.forEach(ch => {
                    updates.push({
                        channel: ch.value,
                        event_type: eventType,
                        enabled,
                    });
                });
            }
        });

        // Optimistic update
        setPreferences(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(eventType => {
                if (next[eventType].category === category) {
                    next[eventType] = {
                        ...next[eventType],
                        channels: Object.fromEntries(
                            channels.map(ch => [ch.value, enabled])
                        ) as NotificationPreferenceMatrix[string]['channels'],
                    };
                }
            });

            return next;
        });

        try {
            const response = await fetch('/api/notifications/preferences/bulk', {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)')) ? decodeURIComponent(document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'))![3]) : '',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ preferences: updates }),
            });

            if (!response.ok) {
                await fetchPreferences(); // Revert

                throw new Error('Failed to update preferences');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    }, [preferences, channels, fetchPreferences]);

    useEffect(() => {
        fetchPreferences();
    }, [fetchPreferences]);

    return {
        preferences,
        channels,
        categories,
        isLoading,
        isSaving,
        error,
        fetchPreferences,
        updatePreference,
        toggleChannel,
        toggleCategory,
    };
}
