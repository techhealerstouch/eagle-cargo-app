import React, { useEffect, useRef, useState } from 'react';
import { Marker, Polyline, useMap } from 'react-leaflet';
import MapView from './Map';
import L from 'leaflet';
import { fetchOsrmRoute, OsrmRouteResult } from '@/lib/osrm';
import { AlertTriangle, Calendar, CheckCircle, MapPin, Navigation, Package, PlayCircle, Route, Truck, X } from 'lucide-react';
import { haversineKm, formatDistance, estimateMinutes, GPS_SESSION_KEY } from '@/lib/geo';

export interface StartRunStop {
    id: string | number;
    lat: number;
    lng: number;
    senderName: string;
    address: string;
    boxCount: number;
    bookingRef: string;
}

interface StartRunModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    confirming: boolean;
    stops: StartRunStop[];
    runsheetName: string;
    scheduledDate: string;
    totalBoxes: number;
}

/* ---------- mini-map helpers ---------- */

function BoundsFitter({ points }: { points: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
        if (points.length === 0) return;
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }, [points, map]);
    return null;
}

const stopIcon = (idx: number) =>
    L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:#EA580C;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;font-family:var(--font-mono),monospace;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${idx}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });

const userIcon = () =>
    L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;position:relative">
            <div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(37,99,235,0.35);animation:ping-pulse 2s ease-out infinite"></div>
            <div style="position:absolute;top:4px;left:4px;right:4px;bottom:4px;background:#2563EB;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(37,99,235,0.5)"></div>
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    });

/* ---------- Component ---------- */

export default function StartRunModal({
    open,
    onClose,
    onConfirm,
    confirming,
    stops,
    runsheetName,
    scheduledDate,
    totalBoxes,
}: StartRunModalProps) {
    const [gpsLoc, setGpsLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsErr, setGpsErr] = useState<string | null>(null);
    const attemptedRef = useRef(false);

    // Request GPS when modal opens
    useEffect(() => {
        if (!open || attemptedRef.current) return;
        attemptedRef.current = true;

        // Try session first
        try {
            const saved = window.sessionStorage.getItem(GPS_SESSION_KEY);
            if (saved) {
                const p = JSON.parse(saved);
                if (p.lat && p.lng) {
                    setGpsLoc({ lat: p.lat, lng: p.lng });
                    return;
                }
            }
        } catch {
            /* ignore */
        }

        if (!navigator.geolocation) {
            setGpsErr('Geolocation not supported');
            return;
        }

        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGpsLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setGpsLoading(false);
            },
            () => {
                setGpsErr('Could not get your location');
                setGpsLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    }, [open]);

    // Reset on close
    useEffect(() => {
        if (!open) {
            attemptedRef.current = false;
        }
    }, [open]);

    const [osrmRoute, setOsrmRoute] = useState<OsrmRouteResult | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);

    const validStops = stops.filter((s) => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng));

    // Fetch OSRM Route (debounced)
    useEffect(() => {
        if (!open) {
            setOsrmRoute(null);
            return;
        }

        const routePoints: { lat: number; lng: number }[] = [
            ...(gpsLoc ? [{ lat: gpsLoc.lat, lng: gpsLoc.lng }] : []),
            ...validStops.map((s) => ({ lat: s.lat, lng: s.lng })),
        ];

        if (routePoints.length < 2) return;

        let cancelled = false;
        setRouteLoading(true);
        const timer = setTimeout(() => {
            fetchOsrmRoute(routePoints).then((res) => {
                if (!cancelled) {
                    setOsrmRoute(res);
                    setRouteLoading(false);
                }
            });
        }, 500); // Short debounce for modal (only fires once typically)

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [open, gpsLoc, stops]);

    // Build fallback straight-line polyline: user → stops in order
    const polyPoints: [number, number][] = [];
    if (gpsLoc) polyPoints.push([gpsLoc.lat, gpsLoc.lng]);
    validStops.forEach((s) => polyPoints.push([s.lat, s.lng]));

    // Total route distance (fallback)
    let totalDistKm = 0;
    for (let i = 1; i < polyPoints.length; i++) {
        totalDistKm += haversineKm(polyPoints[i - 1][0], polyPoints[i - 1][1], polyPoints[i][0], polyPoints[i][1]);
    }

    const displayDistance = osrmRoute ? osrmRoute.distanceKm : totalDistKm;
    const displayMinutes = osrmRoute ? Math.ceil(osrmRoute.durationMinutes) : estimateMinutes(totalDistKm);
    const hasDistance = displayDistance > 0;

    const lineCoords = osrmRoute ? osrmRoute.coordinates : polyPoints;

    const allMapPoints: [number, number][] = [
        ...(gpsLoc ? [[gpsLoc.lat, gpsLoc.lng] as [number, number]] : []),
        ...validStops.map((s) => [s.lat, s.lng] as [number, number]),
    ];
    const mapCenter: [number, number] = allMapPoints.length > 0 ? allMapPoints[0] : [14.5995, 120.9842];

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-brand-sand/50 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-zinc-500 shadow-sm transition-all hover:bg-zinc-100 hover:text-zinc-800"
                >
                    <X className="size-4" />
                </button>

                {/* Route Preview Map */}
                <div className="relative h-52 w-full overflow-hidden">
                    {/* Pulse animation style */}
                    <style
                        dangerouslySetInnerHTML={{
                            __html: `@keyframes ping-pulse{0%{transform:scale(.6);opacity:.8}100%{transform:scale(2.2);opacity:0}}`,
                        }}
                    />

                    {validStops.length > 0 ? (
                        <MapView center={mapCenter} zoom={12} className="w-full h-full">
                            <BoundsFitter points={allMapPoints} />

                            {/* User location */}
                            {gpsLoc && <Marker position={[gpsLoc.lat, gpsLoc.lng]} icon={userIcon()} zIndexOffset={2000} />}

                            {/* Stop markers */}
                            {validStops.map((s, i) => (
                                <Marker key={s.id} position={[s.lat, s.lng]} icon={stopIcon(i + 1)} />
                            ))}

                            {/* Route polyline */}
                            {lineCoords.length >= 2 && (
                                <Polyline 
                                    positions={lineCoords} 
                                    color="#EA580C" 
                                    weight={osrmRoute ? 4 : 2.5} 
                                    opacity={osrmRoute ? 0.8 : 0.7} 
                                    dashArray={osrmRoute ? undefined : "8, 10"} 
                                />
                            )}
                        </MapView>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-brand-warm/20">
                            <div className="text-center text-brand-text-mid">
                                <MapPin className="mx-auto mb-2 size-8 text-brand-sand" />
                                <p className="text-sm font-medium">No geocoded stops</p>
                            </div>
                        </div>
                    )}

                    {/* Gradient overlay */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-zinc-900" />
                </div>

                {/* Content */}
                <div className="px-6 pb-6 pt-2">
                    {/* Title */}
                    <div className="mb-4">
                        <div className="mb-1 flex items-center gap-2">
                            <Route className="size-5 text-brand-primary" />
                            <h3 className="font-serif text-xl font-black text-brand-navy dark:text-white">Start Pickup Run</h3>
                        </div>
                        <p className="text-sm text-brand-text-mid dark:text-zinc-400">{runsheetName}</p>
                    </div>

                    {/* Route Summary Stats */}
                    <div className="mb-4 grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-brand-warm/50 bg-brand-warm/20 p-3 text-center">
                            <Truck className="mx-auto mb-1 size-5 text-brand-secondary" />
                            <p className="text-lg font-black text-brand-text">{validStops.length}</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-brand-text-light">Stops</p>
                        </div>
                        <div className="rounded-xl border border-brand-warm/50 bg-brand-warm/20 p-3 text-center">
                            <Package className="mx-auto mb-1 size-5 text-brand-rust" />
                            <p className="text-lg font-black text-brand-text">{totalBoxes}</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-brand-text-light">Boxes</p>
                        </div>
                        <div className="rounded-xl border border-brand-warm/50 bg-brand-warm/20 p-3 text-center">
                            <Navigation className="mx-auto mb-1 size-5 text-brand-primary" />
                            <p className="text-lg font-black text-brand-text">
                                {gpsLoc ? formatDistance(displayDistance) : '—'}
                            </p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-brand-text-light">Est. Route</p>
                        </div>
                    </div>

                    {/* Estimated Time */}
                    {gpsLoc && hasDistance && (
                        <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                            <Calendar className="size-3.5 shrink-0" />
                            Estimated driving time: ~{displayMinutes} min ({formatDistance(displayDistance)} total)
                            {routeLoading && <span className="ml-1 animate-pulse opacity-50">(calculating...)</span>}
                        </div>
                    )}

                    {/* GPS Status */}
                    {gpsLoading && (
                        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800">
                            <span className="animate-spin">⏳</span> Acquiring GPS location…
                        </div>
                    )}
                    {gpsErr && (
                        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            {gpsErr} — route distances will be unavailable
                        </div>
                    )}

                    {/* Stop list preview */}
                    <div className="mb-5 max-h-36 overflow-y-auto rounded-xl border border-brand-sand/50 divide-y divide-brand-warm/50">
                        {validStops.map((s, i) => (
                            <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                                <div
                                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                                    style={{ backgroundColor: '#EA580C' }}
                                >
                                    {i + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold text-brand-text">{s.senderName}</p>
                                    <p className="truncate text-[10px] text-brand-text-light">{s.address}</p>
                                </div>
                                <span className="shrink-0 rounded-full bg-brand-warm px-2 py-0.5 text-[9px] font-black text-brand-navy">
                                    {s.boxCount} box{s.boxCount !== 1 ? 'es' : ''}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={confirming}
                            className="flex-1 rounded-2xl border border-brand-sand bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-brand-text-mid transition-all hover:bg-zinc-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={confirming}
                            className="flex flex-[2] items-center justify-center gap-2 rounded-2xl btn-primary px-6 py-3 text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-60"
                        >
                            {confirming ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    Starting…
                                </>
                            ) : (
                                <>
                                    <PlayCircle className="size-4" />
                                    Confirm & Start Navigation
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
