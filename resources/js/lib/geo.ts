/**
 * Shared geolocation utilities for the Picker module.
 *
 * Centralises the haversine distance formula, distance formatting,
 * and GPS-throttle constants that were previously duplicated across
 * Runsheets.tsx, RunsheetDetail.tsx, StartRunModal.tsx, and
 * PickerRunsheetMap.tsx.
 */

// ---------------------------------------------------------------------------
// GPS Throttle Constants
// ---------------------------------------------------------------------------

/** Minimum movement in metres before a GPS state update is applied. */
export const GPS_MIN_MOVEMENT_METERS = 10;

/** Minimum interval in ms between GPS state updates. */
export const GPS_MIN_UPDATE_INTERVAL_MS = 5000;

/** If accuracy improves by more than this many metres, bypass time gate. */
export const GPS_ACCURACY_IMPROVEMENT_METERS = 15;

/** Session-storage key used across picker pages to persist location. */
export const GPS_SESSION_KEY = 'picker:runsheets:last-location';

// ---------------------------------------------------------------------------
// Haversine Distance
// ---------------------------------------------------------------------------

/**
 * Calculate the great-circle distance between two points (in **km**)
 * using the Haversine formula.
 */
export function haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Human-readable distance: metres when < 1 km, otherwise km with 1 dp. */
export function formatDistance(km: number): string {
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Estimate driving minutes at ~30 km/h urban speed. */
export function estimateMinutes(km: number): number {
    return Math.max(1, Math.round((km / 30) * 60));
}

// ---------------------------------------------------------------------------
// Nearest-Neighbor Route Ordering
// ---------------------------------------------------------------------------

/**
 * Greedy nearest-neighbor route solver.
 *
 * Starting from `origin`, repeatedly pick the nearest unvisited stop
 * (by haversine straight-line distance) and append it to the route.
 *
 * Each returned stop is augmented with `routeDistance` — the **cumulative**
 * distance (in km) along the path from the origin through all preceding
 * stops to that stop.
 *
 * Time complexity: O(n²) — perfectly fine for the typical ≤50 runsheet stops.
 */
export function nearestNeighborOrder<T extends { lat: number; lng: number }>(
    origin: { lat: number; lng: number },
    stops: T[],
): (T & { routeDistance: number })[] {
    if (stops.length === 0) return [];

    const remaining = stops.map((s, i) => ({ stop: s, originalIndex: i }));
    const ordered: (T & { routeDistance: number })[] = [];
    let current = origin;
    let cumulative = 0;

    while (remaining.length > 0) {
        let nearestIdx = 0;
        let nearestDist = Infinity;

        for (let i = 0; i < remaining.length; i++) {
            const d = haversineKm(
                current.lat,
                current.lng,
                remaining[i].stop.lat,
                remaining[i].stop.lng,
            );

            if (d < nearestDist) {
                nearestDist = d;
                nearestIdx = i;
            }
        }

        const picked = remaining.splice(nearestIdx, 1)[0];
        cumulative += nearestDist;
        ordered.push({ ...picked.stop, routeDistance: cumulative });
        current = picked.stop;
    }

    return ordered;
}
