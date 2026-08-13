/**
 * Fetch road route from public OSRM API
 */

export interface OsrmRouteResult {
    coordinates: [number, number][]; // [lat, lng] for Leaflet Polyline
    distanceKm: number;
    durationMinutes: number;
}

/** Generate a stable cache key from route points */
const routeCacheKey = (points: { lat: number; lng: number }[]) =>
    points.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');

// Simple in-memory cache to avoid duplicate requests for the same route
const routeCache = new Map<string, OsrmRouteResult>();

export async function fetchOsrmRoute(points: { lat: number; lng: number }[]): Promise<OsrmRouteResult | null> {
    if (points.length < 2) {
return null;
}
    
    // OSRM requires max 100 coordinates.
    const limitedPoints = points.slice(0, 100);

    // Check cache first
    const cacheKey = routeCacheKey(limitedPoints);
    const cached = routeCache.get(cacheKey);

    if (cached) {
return cached;
}

    // OSRM format: lon,lat;lon,lat
    const coordsStr = limitedPoints.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    try {
        const res = await fetch(url);

        if (!res.ok) {
            console.warn('OSRM request failed:', res.status, res.statusText);

            return null;
        }

        const data = await res.json();
        
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            console.warn('OSRM routing failed:', data);

            return null;
        }

        const route = data.routes[0];
        
        // GeoJSON gives coordinates as [longitude, latitude]
        // Leaflet Polyline expects [latitude, longitude]
        const rawCoords = route.geometry.coordinates;
        const mappedCoords: [number, number][] = rawCoords.map((c: [number, number]) => [c[1], c[0]]);

        const result: OsrmRouteResult = {
            coordinates: mappedCoords,
            distanceKm: route.distance / 1000,
            durationMinutes: route.duration / 60,
        };

        // Cache the result
        routeCache.set(cacheKey, result);

        // Keep cache small (max 20 entries)
        if (routeCache.size > 20) {
            const firstKey = routeCache.keys().next().value;

            if (firstKey) {
routeCache.delete(firstKey);
}
        }

        return result;

    } catch (error) {
        console.error('Error fetching OSRM route:', error);

        return null;
    }
}
