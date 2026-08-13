import React, { useEffect, useState } from 'react';
import { Marker, Popup, useMap, Polyline } from 'react-leaflet';
import MapView from './Map';
import L from 'leaflet';
import { fetchOsrmRoute, OsrmRouteResult } from '@/lib/osrm';
import { Navigation, Compass } from 'lucide-react';

export interface PickerMapMarkerData {
    id: string | number;
    lat: number;
    lng: number;
    title: string;
    subtitle?: string;
    status: 'pending' | 'completed' | 'in_progress' | 'cancelled';
    reference_number?: string;
    boxesCount?: number;
    bookingsCount?: number;
    distance?: number;
    stopIndex?: number; // 1-based stop number
}

interface PickerRunsheetMapProps {
    markers: PickerMapMarkerData[];
    userLocation: { lat: number; lng: number } | null;
    userAccuracy: number | null;
    isDemo: boolean;
    activeCenter: [number, number] | null;
    selectedMarkerId: string | number | null;
    onMarkerClick: (id: string | number) => void;
    onCenterOnUser: () => void;
}

// Colors matching status config
const SCOLOR = {
    pending: '#EA580C',      // Orange / Assigned
    in_progress: '#D97706',  // Amber
    completed: '#059669',    // Green
    cancelled: '#ef4444',    // Red
};

const SLABEL = {
    pending: 'Assigned',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

// Map bounds controller to zoom out to fit all points
function MapBoundsFitter({ markers, userLocation }: { markers: PickerMapMarkerData[]; userLocation: { lat: number; lng: number } | null }) {
    const map = useMap();

    useEffect(() => {
        const points: [number, number][] = [];
        if (userLocation) {
            points.push([userLocation.lat, userLocation.lng]);
        }
        markers.forEach(m => {
            if (m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng)) {
                points.push([m.lat, m.lng]);
            }
        });

        if (points.length === 0) return;

        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }, [markers, userLocation, map]);

    return null;
}

// Map pan controller for centering on markers/user
function MapController({ activeCenter }: { activeCenter: [number, number] | null }) {
    const map = useMap();

    useEffect(() => {
        if (activeCenter) {
            map.flyTo(activeCenter, 15, { duration: 0.8 });
        }
    }, [activeCenter, map]);

    return null;
}

export default function PickerRunsheetMap({
    markers,
    userLocation,
    userAccuracy,
    isDemo,
    activeCenter,
    selectedMarkerId,
    onMarkerClick,
    onCenterOnUser,
}: PickerRunsheetMapProps) {
    const spreadMarkers = React.useMemo(() => {
        const validMarkers = markers.filter(m => m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng));
        const markersByPosition = new globalThis.Map<string, number>();
        return validMarkers.map((marker) => {
            const key = `${marker.lat.toFixed(6)}:${marker.lng.toFixed(6)}`;
            const index = markersByPosition.get(key) ?? 0;
            markersByPosition.set(key, index + 1);

            if (index === 0) {
                return marker;
            }

            const angle = index * 55;
            const radius = 0.00025 * Math.min(index, 4);
            const offsetLat = marker.lat + Math.cos((angle * Math.PI) / 180) * radius;
            const offsetLng = marker.lng + Math.sin((angle * Math.PI) / 180) * radius;

            return {
                ...marker,
                lat: offsetLat,
                lng: offsetLng,
            };
        });
    }, [markers]);

    // Custom stop marker creator with Sequence Number and status color
    const createStopIcon = (num: number, status: string, isSelected: boolean) => {
        const color = SCOLOR[status as keyof typeof SCOLOR] || SCOLOR.pending;
        const isProgress = status === 'in_progress';
        return L.divIcon({
            className: '',
            html: `
                <div class="marker-container ${isSelected ? 'sel' : ''}">
                    ${isProgress ? '<div class="radar-pulse"></div>' : ''}
                    <div class="pin-svg" style="color: ${color}">
                        <svg viewBox="0 0 36 44" class="svg-element">
                            <path fill="currentColor" stroke="#ffffff" stroke-width="2.5" d="M18,0 C8,0 0,8 0,18 C0,31 18,44 18,44 C18,44 36,31 36,18 C36,8 28,0 18,0 Z" />
                            <circle fill="#ffffff" cx="18" cy="18" r="9" />
                            <text x="18" y="22" font-family="var(--font-mono), monospace" font-size="11" font-weight="950" text-anchor="middle" fill="currentColor">${num}</text>
                        </svg>
                    </div>
                </div>
            `,
            iconSize: [36, 44],
            iconAnchor: [18, 44],
            popupAnchor: [0, -44],
        });
    };

    // Pulsing blue marker for user's location
    const createUserIcon = () => {
        return L.divIcon({
            className: '',
            html: `<div class="me-wrap"><div class="me-r"></div><div class="me-r me-r2"></div><div class="me-dot"></div></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
            popupAnchor: [0, -13],
        });
    };

    const [osrmRoute, setOsrmRoute] = useState<OsrmRouteResult | null>(null);

    // Add markers sorted by their stopIndex
    const sortedStops = React.useMemo(() => {
        return [...spreadMarkers].sort((a, b) => (a.stopIndex || 0) - (b.stopIndex || 0));
    }, [spreadMarkers]);

    // Calculate fallback polyline coordinates
    const polylinePoints = React.useMemo(() => {
        const points: [number, number][] = [];
        if (userLocation) {
            points.push([userLocation.lat, userLocation.lng]);
        }
        sortedStops.forEach(m => {
            points.push([m.lat, m.lng]);
        });
        return points;
    }, [userLocation, sortedStops]);

    // Fetch OSRM Route (debounced to avoid spamming on GPS updates)
    useEffect(() => {
        const points: { lat: number; lng: number }[] = [];
        if (userLocation) {
            points.push({ lat: userLocation.lat, lng: userLocation.lng });
        }
        sortedStops.forEach((m) => {
            points.push({ lat: m.lat, lng: m.lng });
        });

        if (points.length < 2) {
            setOsrmRoute(null);
            return;
        }

        let cancelled = false;
        const timer = setTimeout(() => {
            fetchOsrmRoute(points).then((res) => {
                if (!cancelled) setOsrmRoute(res);
            });
        }, 2000); // Wait 2s after last GPS change before fetching

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [userLocation, sortedStops]);

    // Helper for formatting distance
    const formatDistance = (km: number) => {
        return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
    };

    const nextPickup = sortedStops.find(m => m.status !== 'completed' && m.status !== 'cancelled');

    return (
        <div className="relative w-full h-full overflow-hidden">
            {/* Custom styles injected directly inside component */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes ping-pulse {
                    0% { transform: scale(0.6); opacity: 0.8; }
                    100% { transform: scale(2.2); opacity: 0; }
                }
                .me-wrap { width: 26px; height: 26px; position: relative; }
                .me-dot {
                    position: absolute; top: 6px; left: 6px; right: 6px; bottom: 6px;
                    background: #2563EB; border-radius: 50%; border: 3px solid #fff;
                    box-shadow: 0 2px 8px rgba(37,99,235,0.5); z-index: 2;
                }
                .me-r {
                    position: absolute; inset: 0; border-radius: 50%;
                    border: 2px solid rgba(37,99,235,0.35);
                    animation: ping-pulse 2s ease-out infinite;
                }
                .me-r2 { animation-delay: 0.8s; }

                .marker-container {
                    width: 36px;
                    height: 44px;
                    position: relative;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .marker-container.sel {
                    transform: scale(1.25) translateY(-5px) !important;
                    z-index: 1000 !important;
                }
                .marker-container.sel .svg-element path {
                    stroke: #EA580C;
                    stroke-width: 3px;
                }
                .pin-svg {
                    width: 36px;
                    height: 44px;
                    position: relative;
                    z-index: 10;
                }
                .svg-element {
                    width: 100%;
                    height: 100%;
                    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));
                }
                @keyframes marker-radar {
                    0% { transform: scale(0.5); opacity: 0.8; }
                    100% { transform: scale(1.6); opacity: 0; }
                }
                .radar-pulse {
                    position: absolute;
                    width: 36px;
                    height: 36px;
                    top: 0px;
                    left: 0px;
                    border-radius: 50%;
                    border: 3px solid #D97706;
                    animation: marker-radar 1.8s infinite ease-out;
                    z-index: 1;
                }
            `}} />

            {/* Leaflet Map */}
            <MapView
                center={userLocation ? [userLocation.lat, userLocation.lng] : (spreadMarkers.length > 0 ? [spreadMarkers[0].lat, spreadMarkers[0].lng] : [14.5995, 120.9842])}
                zoom={13}
                className="w-full h-full"
            >
                <MapBoundsFitter markers={spreadMarkers} userLocation={userLocation} />
                <MapController activeCenter={activeCenter} />

                {/* User Location Marker */}
                {userLocation && (
                    <Marker
                        position={[userLocation.lat, userLocation.lng]}
                        icon={createUserIcon()}
                        zIndexOffset={2000}
                    >
                        <Popup>
                            <div className="font-sans font-bold text-sm text-brand-navy">📍 Your Current Location</div>
                        </Popup>
                    </Marker>
                )}

                {/* Stop Markers */}
                {spreadMarkers.map((marker) => (
                    <Marker
                        key={marker.id}
                        position={[marker.lat, marker.lng]}
                        icon={createStopIcon(marker.stopIndex || 1, marker.status, marker.id === selectedMarkerId)}
                        eventHandlers={{
                            click: () => onMarkerClick(marker.id),
                        }}
                    >
                        <Popup>
                            <div className="min-w-48 font-sans p-1">
                                <div className="text-[10px] font-black tracking-widest text-brand-text-light uppercase mb-1">
                                    Stop #{marker.stopIndex} · {SLABEL[marker.status as keyof typeof SLABEL]}
                                </div>
                                <h3 className="font-bold text-brand-navy text-base leading-tight mb-0.5">{marker.title}</h3>
                                {marker.subtitle && (
                                    <p className="text-xs text-brand-text-mid leading-tight mb-2">{marker.subtitle}</p>
                                )}
                                <div className="flex gap-4 text-xs font-semibold text-brand-text mb-2.5">
                                    <span>📦 {marker.boxesCount || 0} boxes</span>
                                    <span>🎫 {marker.bookingsCount || 0} bookings</span>
                                </div>
                                {marker.distance !== undefined && (
                                    <div className="text-xs font-bold text-brand-primary mb-3">
                                        {formatDistance(marker.distance)} from your location
                                    </div>
                                )}
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${marker.lat},${marker.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-1.5 w-full bg-brand-primary hover:bg-brand-rust text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs uppercase tracking-widest shadow-sm"
                                >
                                    <Navigation className="size-3.5" />
                                    Navigate Here
                                </a>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Polylines between stops */}
                {osrmRoute ? (
                    <>
                        {/* Shadow/Glow layer */}
                        <Polyline
                            positions={osrmRoute.coordinates}
                            color="#000000"
                            weight={7}
                            opacity={0.12}
                        />
                        {/* Main route line */}
                        <Polyline
                            positions={osrmRoute.coordinates}
                            color="#EA580C"
                            weight={4}
                            opacity={0.95}
                        />
                    </>
                ) : (
                    polylinePoints.map((pt, i) => {
                        if (i === 0) return null;
                        const prevPt = polylinePoints[i - 1];
                        const isFirstSegment = i === 1;
                        return (
                            <Polyline
                                key={`segment-line-${i}`}
                                positions={[prevPt, pt]}
                                color={isFirstSegment ? '#EA580C' : '#94A3B8'}
                                weight={isFirstSegment ? 2.5 : 1.8}
                                opacity={isFirstSegment ? 0.75 : 0.45}
                                dashArray="7, 9"
                            />
                        );
                    })
                )}
            </MapView>

            {/* Map Legend Overlay */}
            <div className="absolute left-3 top-3 z-[500] flex max-w-[calc(100%-4.5rem)] gap-2 rounded-xl border border-white/20 bg-white/75 px-3 py-2 shadow-2xl backdrop-blur-md dark:border-white/5 dark:bg-zinc-950/75 sm:left-4 sm:top-4 sm:max-w-44 sm:flex-col sm:gap-2 sm:rounded-2xl sm:p-4">
                <div className="flex items-center gap-2.5 text-[11px] font-bold text-brand-navy dark:text-white uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                    <span className="hidden sm:inline">Your Location</span>
                </div>
                <div className="flex items-center gap-2.5 text-[11px] font-bold text-brand-navy dark:text-white uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" />
                    <span className="hidden sm:inline">Assigned Stop</span>
                </div>
                <div className="flex items-center gap-2.5 text-[11px] font-bold text-brand-navy dark:text-white uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
                    <span className="hidden sm:inline">In Progress Stop</span>
                </div>
                <div className="flex items-center gap-2.5 text-[11px] font-bold text-brand-navy dark:text-white uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#059669]" />
                    <span className="hidden sm:inline">Completed Stop</span>
                </div>
            </div>

            {/* Center on User Location FAB */}
            <button
                type="button"
                onClick={onCenterOnUser}
                title="Center on my location"
                className="absolute right-3 top-3 z-[500] flex size-10 items-center justify-center rounded-xl border border-white/20 bg-white/85 text-brand-primary shadow-2xl backdrop-blur-md transition-all hover:scale-105 hover:bg-brand-warm dark:border-white/5 dark:bg-zinc-950/80 dark:text-brand-secondary active:scale-95 sm:right-14 sm:top-4 sm:size-11"
            >
                <Compass className="size-5 animate-pulse" />
            </button>

            {/* HUD (Heads-up Display) */}
            <div className="absolute bottom-3 left-1/2 z-[500] w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2 rounded-xl border border-white/10 bg-brand-navy/80 px-3 py-2 text-white shadow-2xl backdrop-blur-lg dark:bg-zinc-950/80 sm:bottom-6 sm:w-[92%] sm:rounded-2xl sm:px-4 sm:py-3">
                <div className="grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-3 sm:gap-4">
                    <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                        <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">My Location</span>
                        <span className="text-xs font-bold truncate">
                            {isDemo ? 'Quezon City (Demo)' : (userLocation ? `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}` : 'Locating...')}
                        </span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5 sm:border-l sm:border-white/10 sm:pl-4">
                        <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Next Pickup</span>
                        <span className="text-xs font-bold truncate text-brand-secondary">
                            {nextPickup ? `${nextPickup.title} (${nextPickup.distance !== undefined ? formatDistance(nextPickup.distance) : '—'})` : 'All complete'}
                        </span>
                    </div>
                    <div className="flex min-w-20 flex-col gap-0.5 border-l border-white/10 pl-3 sm:min-w-0 sm:pl-4">
                        <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">GPS</span>
                        <span className="text-xs font-bold truncate">
                            {isDemo ? 'Demo Mode' : (userAccuracy ? `±${Math.round(userAccuracy)} m` : 'Active')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
