import { useEffect, useRef, useCallback } from 'react';

/**
 * A custom hook that saves form data to localStorage and optionally to the server.
 *
 * @param key The unique key to store the data under in localStorage
 * @param data The current form data
 * @param setData The function to update the form data
 * @param isEnabled Whether the auto-save is enabled (e.g., disable for editing existing records)
 * @param onServerSave Optional callback to persist data to the server
 */
export function useAutoSave<T>(
    key: string,
    data: T,
    setData: (data: T | ((prev: T) => T)) => void,
    isEnabled: boolean = true,
    onServerSave?: (data: T) => Promise<any>
) {
    const serverSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastServerSaveRef = useRef<string>('');
    const isSavingRef = useRef(false);
    const latestDataRef = useRef<T>(data);
    const lastSaveIndicatorRef = useRef<number>(0);
    const setDataRef = useRef(setData);

    // Keep latest data & setData refs updated
    useEffect(() => {
        latestDataRef.current = data;
        setDataRef.current = setData;
    }, [data, setData]);

    // Restore data on mount
    useEffect(() => {
        if (!isEnabled) {
            return;
        }

        const savedData = localStorage.getItem(`autosave_${key}`);

        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);

                // We use a functional update to merge with existing data if necessary,
                // but usually useForm's setData handles this well.
                setDataRef.current((current) => ({
                    ...current,
                    ...parsedData,
                }));
            } catch (e) {
                console.error(`Failed to parse auto-saved data for ${key}:`, e);
            }
        }
    }, [key, isEnabled]); // Only run on mount or if key/isEnabled changes

    // Save data on change with debounce (localStorage — fast, 1 second)
    useEffect(() => {
        if (!isEnabled) {
            return;
        }

        const timeoutId = setTimeout(() => {
            localStorage.setItem(`autosave_${key}`, JSON.stringify(data));
        }, 1000); // 1 second debounce

        return () => clearTimeout(timeoutId);
    }, [key, data, isEnabled]);

    // Server-side auto-save every 30 seconds (if callback provided)
    const doServerSave = useCallback(async (force: boolean = false) => {
        if (!onServerSave || isSavingRef.current) {
            return;
        }

        const currentDataStr = JSON.stringify(latestDataRef.current);

        // Skip if data hasn't changed since last server save, unless forced
        if (!force && currentDataStr === lastServerSaveRef.current) {
            return;
        }

        isSavingRef.current = true;

        try {
            await onServerSave(latestDataRef.current);
            lastServerSaveRef.current = currentDataStr;
            lastSaveIndicatorRef.current = Date.now();
        } catch (e) {
            // Silent failure — localStorage still has the data
            console.warn('Server auto-save failed (data safe in localStorage):', e);
        } finally {
            isSavingRef.current = false;
        }
    }, [onServerSave]);

    useEffect(() => {
        if (!isEnabled || !onServerSave) {
            return;
        }

        // Start the 30-second interval
        serverSaveTimerRef.current = setInterval(() => doServerSave(), 30000);

        return () => {
            if (serverSaveTimerRef.current) {
                clearInterval(serverSaveTimerRef.current);
                serverSaveTimerRef.current = null;
            }
        };
    }, [isEnabled, doServerSave, onServerSave]);

    /**
     * Clear the saved data from localStorage
     */
    const clearSavedData = useCallback(() => {
        localStorage.removeItem(`autosave_${key}`);
        lastServerSaveRef.current = '';
    }, [key]);

    /**
     * Trigger an immediate server save
     */
    const saveToServerNow = useCallback(async (force: boolean = false) => {
        await doServerSave(force);
    }, [doServerSave]);

    return { clearSavedData, saveToServerNow, lastSaveTime: lastSaveIndicatorRef.current };
}
