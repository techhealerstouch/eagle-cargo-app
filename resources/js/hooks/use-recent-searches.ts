import { useState, useEffect, useCallback } from 'react';

export function useRecentSearches(maxItems: number = 3) {
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('recent_tracks');

        if (saved) {
            try {
                const parsed = JSON.parse(saved);

                if (Array.isArray(parsed)) {
                    setRecentSearches(parsed);
                }
            } catch (e) {
                console.error('Failed to parse recent tracks', e);
                localStorage.removeItem('recent_tracks');
            }
        }
    }, []);

    const addRecentSearch = useCallback((trackingNumber: string) => {
        if (!trackingNumber) {
return;
}

        setRecentSearches(prev => {
            const updated = [
                trackingNumber,
                ...prev.filter(s => s !== trackingNumber)
            ].slice(0, maxItems);

            if (JSON.stringify(updated) !== JSON.stringify(prev)) {
                localStorage.setItem('recent_tracks', JSON.stringify(updated));

                return updated;
            }

            return prev;
        });
    }, [maxItems]);

    const clearRecentSearches = useCallback(() => {
        localStorage.removeItem('recent_tracks');
        setRecentSearches([]);
    }, []);

    return {
        recentSearches,
        addRecentSearch,
        clearRecentSearches
    };
}
