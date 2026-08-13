import React, { useState, useEffect } from 'react';
import { Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import Map from './Map';
import { MapPin, Loader2 } from 'lucide-react';

export interface ReverseGeocodedAddress {
    address: string;
    suburb: string;
    city: string;
    state: string;
    postcode: string;
    province: string;
    country: string;
}

interface LocationPickerMapProps {
    initialCenter?: [number, number];
    onLocationSelect: (lat: number, lng: number, address?: ReverseGeocodedAddress) => void;
    className?: string;
}

/**
 * Reverse geocode coordinates using the free Nominatim (OpenStreetMap) API.
 * No API key required.
 */
async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodedAddress | null> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`,
            {
                headers: {
                    'Accept': 'application/json',
                },
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        const addr = data.address || {};

        // Build a street address from the components Nominatim returns
        const houseNumber = addr.house_number || '';
        const road = addr.road || addr.pedestrian || addr.footway || '';
        const streetAddress = [houseNumber, road].filter(Boolean).join(' ').trim();

        // Nominatim returns different keys depending on the country/region
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

// Sub-component to handle map clicks
function LocationMarker({ position, setPosition, onLocationSelect, setIsGeocoding }: {
    position: [number, number] | null;
    setPosition: (pos: [number, number]) => void;
    onLocationSelect: (lat: number, lng: number, address?: ReverseGeocodedAddress) => void;
    setIsGeocoding: (v: boolean) => void;
}) {
    const map = useMap();

    useEffect(() => {
        if (position) {
            map.flyTo(position, map.getZoom());
        }
    }, [position, map]);

    useMapEvents({
        async click(e) {
            const { lat, lng } = e.latlng;
            setPosition([lat, lng]);
            setIsGeocoding(true);
            const address = await reverseGeocode(lat, lng);
            setIsGeocoding(false);
            onLocationSelect(lat, lng, address ?? undefined);
        },
    });

    return position === null ? null : (
        <Marker position={[Number(position[0]), Number(position[1])]}>
            <Popup>Selected Location: <br/> Lat: {Number(position[0]).toFixed(4)}, Lng: {Number(position[1]).toFixed(4)}</Popup>
        </Marker>
    );
}

export default function LocationPickerMap({
    initialCenter = [14.5995, 120.9842], // Default to Manila
    onLocationSelect,
    className = 'w-full h-96 rounded-lg border border-gray-300 overflow-hidden'
}: LocationPickerMapProps) {
    const [position, setPosition] = useState<[number, number] | null>(
        initialCenter ? [Number(initialCenter[0]), Number(initialCenter[1])] : null
    );
    const [isLocating, setIsLocating] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);

    // Initial load
    useEffect(() => {
        if (initialCenter) {
             setPosition([Number(initialCenter[0]), Number(initialCenter[1])]);
        }
    }, [initialCenter]);

    const handleCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        setIsLocating(true);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                setPosition([latitude, longitude]);
                setIsGeocoding(true);
                const address = await reverseGeocode(latitude, longitude);
                setIsGeocoding(false);
                setIsLocating(false);
                onLocationSelect(latitude, longitude, address ?? undefined);
            },
            (error) => {
                setIsLocating(false);
                alert(`Unable to retrieve your location: ${error.message}`);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const isBusy = isLocating || isGeocoding;

    return (
        <div className="relative">
            <Map center={initialCenter} zoom={13} className={className}>
                <LocationMarker
                    position={position}
                    setPosition={setPosition}
                    onLocationSelect={onLocationSelect}
                    setIsGeocoding={setIsGeocoding}
                />
            </Map>

            <div className="absolute top-2 right-2 z-400">
                {/* z-index is set to 400 to appear above the leaflet map which uses z-index up to 400 for panes */}
                <button
                    type="button"
                    onClick={handleCurrentLocation}
                    disabled={isBusy}
                    className="flex items-center gap-2 bg-white text-gray-800 px-3 py-2 rounded-md shadow-md hover:bg-gray-50 transition-colors text-sm font-medium border border-gray-200 disabled:opacity-60 disabled:cursor-wait"
                >
                    {isBusy ? (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    ) : (
                        <MapPin className="w-4 h-4 text-primary" />
                    )}
                    {isLocating ? 'Locating...' : isGeocoding ? 'Getting address...' : 'Use My Location'}
                </button>
            </div>
        </div>
    );
}
