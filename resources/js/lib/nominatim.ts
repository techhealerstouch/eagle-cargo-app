/**
 * OpenStreetMap Nominatim and Navigation Helpers
 * Completely free, no API key required.
 */

export interface GeocodedCoords {
    lat: number;
    lng: number;
    displayName?: string;
}

export interface ReverseGeocodedAddress {
    address: string;
    suburb: string;
    city: string;
    state: string;
    postcode: string;
    province: string;
    country: string;
}

/**
 * Forward geocode a textual address using the free OpenStreetMap Nominatim API.
 */
export async function geocodeWithNominatim(query: string): Promise<GeocodedCoords | null> {
    if (!query || !query.trim()) {
        return null;
    }

    try {
        const cleanQuery = query.replace(/[#&]/g, ' ').trim();
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1&addressdetails=1`,
            {
                headers: {
                    Accept: 'application/json',
                },
            }
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);

        if (isNaN(lat) || isNaN(lng)) {
            return null;
        }

        return {
            lat,
            lng,
            displayName: data[0].display_name,
        };
    } catch (error) {
        console.warn('Nominatim geocode failed:', error);
        return null;
    }
}

/**
 * Reverse geocode coordinates to structured address using Nominatim.
 */
export async function reverseGeocodeWithNominatim(
    lat: number,
    lng: number
): Promise<ReverseGeocodedAddress | null> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`,
            {
                headers: {
                    Accept: 'application/json',
                },
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        const addr = data.address || {};

        const houseNumber = addr.house_number || '';
        const road = addr.road || addr.pedestrian || addr.footway || '';
        const streetAddress = [houseNumber, road].filter(Boolean).join(' ').trim();

        const suburb = addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || '';
        const city = addr.city || addr.town || addr.municipality || addr.city_district || '';
        const state = addr.state || addr.region || '';
        const postcode = addr.postcode || '';
        const province = addr.state || addr.province || addr.region || '';
        const country = addr.country || '';

        return {
            address: streetAddress || data.display_name?.split(',').slice(0, 2).join(',').trim() || '',
            suburb,
            city,
            state,
            postcode,
            province,
            country,
        };
    } catch (error) {
        console.error('Reverse geocoding failed:', error);
        return null;
    }
}

/**
 * Build OpenStreetMap directions / navigation URL.
 * Uses the free FOSSGIS OSRM routing engine hosted for OpenStreetMap.
 */
export function buildOsmDirectionsUrl(
    origin: { lat: number; lng: number } | null,
    destination: { lat: number; lng: number }
): string {
    const dest = `${destination.lat}%2C${destination.lng}`;
    if (origin) {
        const orig = `${origin.lat}%2C${origin.lng}`;
        return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${orig}%3B${dest}`;
    }
    return `https://www.openstreetmap.org/?mlat=${destination.lat}&mlon=${destination.lng}#map=17/${destination.lat}/${destination.lng}`;
}

/**
 * Build OpenStreetMap marker view URL for a location.
 */
export function buildOsmMarkerUrl(lat: number, lng: number, zoom = 17): string {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}
