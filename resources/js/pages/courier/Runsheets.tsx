import { Head, Link } from '@inertiajs/react';
import { Package, Truck, ClipboardList, PlayCircle, Calendar, MapPin, Map } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PickerMapMarkerData } from '@/components/ui/PickerRunsheetMap';
import PickerRunsheetMap from '@/components/ui/PickerRunsheetMap';
import AppLayout from '@/layouts/app-layout';
import { haversineKm, formatDistance, nearestNeighborOrder, GPS_MIN_MOVEMENT_METERS, GPS_MIN_UPDATE_INTERVAL_MS, GPS_ACCURACY_IMPROVEMENT_METERS } from '@/lib/geo';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Courier Dashboard', href: '/courier/dashboard' },
    { title: 'My Runsheets', href: '/courier/runsheets' },
];

const statusStyles: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400',
    assigned: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const SCOLOR: Record<string, string> = {
    assigned: '#3B82F6',
    in_progress: '#D97706',
    completed: '#059669',
    draft: '#71717a',
};

const COURIER_LOCATION_SESSION_KEY = 'courier:runsheets:last-location';

type RunsheetCoords = {
    lat: number;
    lng: number;
    label: string;
};

const getRunsheetBoxes = (runsheet: any) => {
    const directBoxes = Array.isArray(runsheet?.boxes) ? runsheet.boxes : [];

    if (directBoxes.length > 0) {
        return directBoxes.map((box: any) => ({ ...box, booking: box.booking ?? null }));
    }

    return (runsheet?.bookings ?? []).flatMap((booking: any) =>
        (booking.boxes ?? []).map((box: any) => ({ ...box, booking })),
    );
};

const countRunsheetBookings = (boxes: any[]) =>
    new Set(boxes.map((box: any) => box.booking?.id ?? box.booking_id).filter(Boolean)).size;

const getRecipientLabel = (box: any) => {
    const recipient = box.recipient;

    return recipient?.address
        || recipient?.full_address
        || recipient?.area?.name
        || recipient?.city
        || recipient?.name
        || box.booking?.destination
        || box.booking?.reference_number
        || box.tracking_number
        || 'Delivery stop';
};

// Resolve representative coordinates for a runsheet from its first geocoded box recipient.
const getRunsheetCoords = (runsheet: any): RunsheetCoords | null => {
    for (const box of getRunsheetBoxes(runsheet)) {
        const lat = Number(box.recipient?.latitude);
        const lng = Number(box.recipient?.longitude);

        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            return { lat, lng, label: getRecipientLabel(box) };
        }
    }

    return null;
};

export default function Runsheets({ runsheets }: { runsheets: any[] }) {
    type CourierLocation = { lat: number; lng: number; accuracy: number | null; isDemo: boolean };
    const [userLocation, setUserLocation] = useState<CourierLocation | null>(() => {
        if (typeof window === 'undefined') {
            return null;
        }

        try {
            const savedLocation = window.sessionStorage.getItem(COURIER_LOCATION_SESSION_KEY);

            if (!savedLocation) {
                return null;
            }

            const parsed = JSON.parse(savedLocation);
            const lat = Number(parsed.lat);
            const lng = Number(parsed.lng);

            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                window.sessionStorage.removeItem(COURIER_LOCATION_SESSION_KEY);

                return null;
            }

            return {
                lat,
                lng,
                accuracy: parsed.accuracy === null || isNaN(Number(parsed.accuracy)) ? null : Number(parsed.accuracy),
                isDemo: Boolean(parsed.isDemo),
            };
        } catch {
            window.sessionStorage.removeItem(COURIER_LOCATION_SESSION_KEY);

            return null;
        }
    });
    const [filter, setFilter] = useState<'all' | 'assigned' | 'in_progress' | 'completed'>('all');
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [activeCenter, setActiveCenter] = useState<[number, number] | null>(null);
    const [gpsRequesting, setGpsRequesting] = useState(false);
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [showMap, setShowMap] = useState(true);

    const watchIdRef = useRef<number | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const userLocationRef = useRef<CourierLocation | null>(userLocation);
    const lastGpsUpdateAtRef = useRef(0);

    const saveUserLocation = useCallback((location: CourierLocation) => {
        userLocationRef.current = location;
        lastGpsUpdateAtRef.current = Date.now();
        setUserLocation(location);

        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(COURIER_LOCATION_SESSION_KEY, JSON.stringify(location));
        }
    }, []);

    /** Throttled GPS update Ã¢â‚¬â€ skips if courier hasn't moved enough or too soon. */
    const throttledGpsUpdate = useCallback((loc: CourierLocation) => {
        const previous = userLocationRef.current;
        const now = Date.now();

        if (previous && !previous.isDemo) {
            const movedMeters = haversineKm(previous.lat, previous.lng, loc.lat, loc.lng) * 1000;
            const accuracyImproved = previous.accuracy !== null
                && loc.accuracy !== null
                && loc.accuracy + GPS_ACCURACY_IMPROVEMENT_METERS < previous.accuracy;
            const minTimeElapsed = now - lastGpsUpdateAtRef.current >= GPS_MIN_UPDATE_INTERVAL_MS;

            if (movedMeters < GPS_MIN_MOVEMENT_METERS && !accuracyImproved && !minTimeElapsed) {
                return;
            }
        }

        saveUserLocation(loc);
    }, [saveUserLocation]);

    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    const handleEnableGPS = () => {
        setGpsRequesting(true);
        setGpsError(null);

        if (!navigator.geolocation) {
            setGpsError('Geolocation is not supported by your browser. Please try demo mode.');
            setGpsRequesting(false);

            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, isDemo: false };
                saveUserLocation(loc);
                setActiveCenter([loc.lat, loc.lng]);
                setGpsRequesting(false);
                watchIdRef.current = navigator.geolocation.watchPosition(
                    (p) => {
                        throttledGpsUpdate({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, isDemo: false });
                    },
                    () => {},
                    { enableHighAccuracy: true, maximumAge: 5000 }
                );
            },
            (error) => {
                setGpsRequesting(false);
                const msgs: Record<number, string> = {
                    1: 'Location permission denied. Please allow GPS access in browser settings, or use Demo Location.',
                    2: 'GPS signal unavailable. Please try demo mode.',
                    3: 'GPS request timed out. Please try again or use demo mode.',
                };
                setGpsError(msgs[error.code] || 'Could not retrieve your location.');
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    };

    const handleUseDemo = () => {
        // Place demo near first valid runsheet coordinate
        let demoLat = 14.6491, demoLng = 121.0439;

        for (const rs of runsheets) {
            const coords = getRunsheetCoords(rs);

            if (coords) {
                demoLat = coords.lat + 0.005;
                demoLng = coords.lng - 0.004;
                break;
            }
        }

        saveUserLocation({ lat: demoLat, lng: demoLng, accuracy: null, isDemo: true });
        setActiveCenter([demoLat, demoLng]);
    };

    const enrichedRunsheets = React.useMemo(() => {
        const enriched = runsheets.map(rs => {
            const coords = getRunsheetCoords(rs);
            let distance = 999999;

            if (userLocation && coords) {
                distance = haversineKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
            }

            const boxes = getRunsheetBoxes(rs);
            const totalBoxes = boxes.length;
            const bookingsCount = countRunsheetBookings(boxes);

            return { ...rs, coords, distance, totalBoxes, bookingsCount };
        });

        // Apply nearest-neighbor route ordering when GPS is available
        if (userLocation) {
            const withCoords = enriched.filter((rs) => rs.coords);
            const withoutCoords = enriched.filter((rs) => !rs.coords);
            const coordStops = withCoords.map((rs) => ({
                ...rs,
                lat: rs.coords!.lat,
                lng: rs.coords!.lng,
            }));
            const ordered = nearestNeighborOrder(userLocation, coordStops);

            return [
                ...ordered.map((rs) => ({ ...rs, distance: rs.routeDistance })),
                ...withoutCoords,
            ];
        }

        return enriched.sort((a, b) => a.distance - b.distance);
    }, [runsheets, userLocation]);

    const statusCounts = {
        all: runsheets.length,
        assigned: runsheets.filter(rs => rs.status === 'assigned').length,
        in_progress: runsheets.filter(rs => rs.status === 'in_progress').length,
        completed: runsheets.filter(rs => rs.status === 'completed').length,
    };

    const filteredRunsheets = React.useMemo(() => {
        return filter === 'all'
            ? enrichedRunsheets.filter(rs => rs.status !== 'completed')
            : enrichedRunsheets.filter(rs => rs.status === filter);
    }, [enrichedRunsheets, filter]);

    // Build map markers from sorted+filtered runsheets
    const mapMarkers: PickerMapMarkerData[] = React.useMemo(() => {
        return filteredRunsheets
            .filter(rs => rs.coords)
            .map((rs, idx) => {
                let markerStatus: PickerMapMarkerData['status'] = 'pending';

                if (rs.status === 'completed') {
                    markerStatus = 'completed';
                } else if (rs.status === 'in_progress') {
                    markerStatus = 'in_progress';
                }

                return {
                    id: rs.id,
                    lat: rs.coords!.lat,
                    lng: rs.coords!.lng,
                    title: rs.area_description,
                    subtitle: `${rs.coords!.label} - ${rs.totalBoxes} boxes - ${rs.bookingsCount} bookings`,
                    status: markerStatus,
                    reference_number: undefined,
                    boxesCount: rs.totalBoxes,
                    bookingsCount: rs.bookingsCount,
                    distance: rs.distance < 999999 ? rs.distance : undefined,
                    stopIndex: idx + 1,
                };
            });
    }, [filteredRunsheets]);

    const handleCardClick = (rs: any) => {
        setSelectedId(rs.id);

        if (rs.coords) {
            setActiveCenter([rs.coords.lat, rs.coords.lng]);
        }
    };

    const handleMarkerClick = (id: string | number) => {
        setSelectedId(id);
        const rs = enrichedRunsheets.find(r => r.id === id);

        if (rs?.coords) {
            setActiveCenter([rs.coords.lat, rs.coords.lng]);
        }

        setTimeout(() => {
            if (listRef.current) {
                const el = listRef.current.querySelector(`[data-runsheet-id="${id}"]`);

                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }, 100);
    };

    const handleCenterOnUser = () => {
        if (userLocation) {
            setActiveCenter([userLocation.lat, userLocation.lng]);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My Runsheets" />

            {/* GPS Access Required Overlay */}
            {userLocation === null && (
                <div className="fixed inset-0 z-9999 bg-brand-navy/95 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 border border-brand-sand/50 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center flex flex-col items-center">
                        <div className="relative size-20 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mb-6">
                            <div className="absolute inset-0 rounded-full border-2 border-dashed border-orange-300 dark:border-orange-700 animate-[spin_8s_linear_infinite]" />
                            <MapPin className="size-9 text-brand-primary" />
                        </div>
                        <h2 className="font-serif text-2xl font-black text-brand-navy dark:text-white mb-2">GPS Location Required</h2>
                        <p className="text-sm text-brand-text-mid dark:text-zinc-400 leading-relaxed mb-6">
                            Your real-time location is mandatory to use the Courier Runsheet.<br />
                            Runsheets are automatically sorted by your driving distance.
                        </p>
                        <div className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 mb-6">
                            Ã¢Å¡Â Ã¯Â¸Â GPS tracking is mandatory Ã¢â‚¬â€ required for all deliveries
                        </div>
                        <button
                            type="button"
                            onClick={handleEnableGPS}
                            disabled={gpsRequesting}
                            className="w-full btn-primary py-3.5 px-6 rounded-2xl shadow-lg active:scale-95 transition-all text-sm font-bold uppercase tracking-wider mb-3 flex items-center justify-center gap-2"
                        >
                            {gpsRequesting ? 'Ã¢ÂÂ³ Requesting Access...' : 'Ã°Å¸â€œÂ Enable GPS & Start'}
                        </button>
                        <button
                            type="button"
                            onClick={handleUseDemo}
                            className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-brand-navy dark:text-white border border-brand-sand dark:border-zinc-700 py-3 px-6 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all"
                        >
                            Use Demo Location (Near Deliveries)
                        </button>
                        {gpsError && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium leading-normal w-full">
                                {gpsError}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Split-screen Layout */}
            <div className="relative z-10 flex h-[calc(100svh-4rem)] w-full flex-col overflow-hidden lg:h-full lg:min-h-[calc(100svh-4rem)] lg:flex-row">

                {/* Left Panel Ã¢â‚¬â€ Runsheet List */}
                <div className="order-2 flex flex-1 min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-brand-sand bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:order-1 lg:h-full lg:w-120 lg:flex-none">

                    {/* Header */}
                    <div className="shrink-0 border-b border-brand-sand/50 bg-brand-warm/10 p-3 dark:border-zinc-800 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <ClipboardList className="size-6 text-brand-secondary" />
                                <h1 className="font-serif text-xl font-black text-brand-text">My Runsheets</h1>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Map Toggle Button (Mobile Only) */}
                                <button
                                    onClick={() => setShowMap(!showMap)}
                                    className="flex items-center gap-1.5 rounded-full border border-brand-sand bg-white px-3 py-1 text-[10px] font-black tracking-widest uppercase text-brand-navy shadow-xs transition-all hover:bg-zinc-50 active:scale-95 lg:hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                                >
                                    <Map className="size-3 text-brand-secondary" />
                                    {showMap ? 'Hide Map' : 'Show Map'}
                                </button>

                                {userLocation && (
                                    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black tracking-widest uppercase border ${
                                        userLocation.isDemo
                                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    }`}>
                                        <span className="relative flex size-1.5">
                                            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${userLocation.isDemo ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                            <span className={`relative inline-flex size-1.5 rounded-full ${userLocation.isDemo ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                        </span>
                                        {userLocation.isDemo ? 'Demo Mode' : (userLocation.accuracy ? `Ã‚Â±${Math.round(userLocation.accuracy)} m` : 'GPS Active')}
                                    </div>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-brand-text-mid">All your assigned delivery runsheets</p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex shrink-0 gap-1 p-1 mx-3 my-2.5 rounded-xl bg-brand-warm/15 dark:bg-zinc-900/50 border border-brand-sand/30 dark:border-zinc-800/50">
                        {([
                            { id: 'all', label: 'Active', count: statusCounts.assigned + statusCounts.in_progress },
                            { id: 'assigned', label: 'Assigned', count: statusCounts.assigned },
                            { id: 'in_progress', label: 'In Progress', count: statusCounts.in_progress },
                            { id: 'completed', label: 'Completed', count: statusCounts.completed },
                        ] as const).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setFilter(tab.id); setSelectedId(null);
                                }}
                                className={`flex flex-1 items-center justify-center gap-1 sm:gap-2 rounded-lg px-1.5 py-1.5 sm:px-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                                    filter === tab.id
                                        ? 'bg-white dark:bg-zinc-800 text-brand-navy dark:text-white shadow-xs border border-brand-sand/10 dark:border-zinc-700/30'
                                        : 'text-brand-text-mid hover:bg-white/50 hover:text-brand-text dark:hover:bg-zinc-900/40'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`flex h-4 w-4 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full text-[8px] sm:text-[9px] font-black ${
                                    filter === tab.id
                                        ? 'bg-brand-navy/10 text-brand-navy dark:bg-zinc-700 dark:text-white'
                                        : 'bg-brand-sand text-brand-text-mid'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Sort Bar */}
                    <div className="bg-orange-50 border-b border-orange-200 px-5 py-2.5 flex items-center gap-2 shrink-0 dark:border-orange-900/50 dark:bg-orange-950/20">
                        <MapPin className="size-3.5 text-orange-700 dark:text-orange-400 animate-bounce" />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-orange-800 dark:text-orange-300">
                            Optimized route from your GPS location
                        </span>
                    </div>

                    {/* Runsheet Cards */}
                    <div ref={listRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 scroll-smooth sm:gap-3 sm:p-4">
                        {filteredRunsheets.length === 0 ? (
                            <div className="text-center py-16 px-4 border border-dashed border-brand-sand/50 rounded-2xl bg-brand-warm/5">
                                <Truck className="size-10 text-brand-sand mx-auto mb-3" />
                                <p className="font-serif text-sm font-bold text-brand-text-mid">No runsheets found</p>
                                <p className="mt-1 text-xs text-brand-text-light">
                                    {filter !== 'all' ? `No runsheets with status "${humanize(filter)}".` : 'You have no assigned runsheets yet.'}
                                </p>
                            </div>
                        ) : (
                            filteredRunsheets.map((rs, idx) => {
                                const isSelected = rs.id === selectedId;
                                const distStr = rs.distance < 999999 ? formatDistance(rs.distance) : 'No coordinates';
                                const color = SCOLOR[rs.status] || SCOLOR.draft;

                                return (
                                    <div
                                        key={rs.id}
                                        data-runsheet-id={rs.id}
                                        onClick={() => handleCardClick(rs)}
                                        style={{
                                            borderLeftColor: color,
                                            borderLeftWidth: '4px',
                                        }}
                                        className={`card relative transition-all cursor-pointer border ${
                                            isSelected
                                                ? 'border-brand-primary ring-2 ring-brand-primary/20 shadow-md scale-[1.01]'
                                                : 'hover:border-brand-secondary hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="p-3.5 pl-4">
                                            {/* Top Row: Stop Number + Status + Distance */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-black text-white shadow-xs"
                                                        style={{ backgroundColor: color }}
                                                    >
                                                        {idx + 1}
                                                    </div>
                                                    <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black tracking-widest uppercase ${
                                                        statusStyles[rs.status] || statusStyles.draft
                                                    }`}>
                                                        {humanize(rs.status)}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-black text-brand-primary tracking-wide">
                                                    {distStr}
                                                </span>
                                            </div>

                                            {/* Area Name */}
                                            <h4 className="font-serif text-base font-bold text-brand-text leading-snug mb-0.5 group-hover:text-brand-secondary transition-colors">
                                                {rs.area_description}
                                            </h4>

                                            {rs.coords && (
                                                <p className="truncate text-[11px] font-medium text-brand-text-light" title={rs.coords.label}>
                                                    Stop: {rs.coords.label}
                                                </p>
                                            )}

                                            {/* Date */}
                                            <div className="flex items-center gap-1.5 text-xs text-brand-text-mid mt-1">
                                                <Calendar className="size-3.5 text-brand-secondary" />
                                                <span>
                                                    {new Date(rs.scheduled_date).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </span>
                                            </div>

                                            {/* Stats Row */}
                                            <div className="flex items-center gap-4 border-t border-brand-warm/40 pt-2.5 mt-2.5">
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-mid">
                                                    <Package className="size-4 text-brand-rust" />
                                                    <span className="font-bold text-brand-text">{rs.totalBoxes}</span>
                                                    <span className="text-[9px] font-bold text-brand-text-light uppercase tracking-wider">Boxes</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-mid">
                                                    <PlayCircle className="size-4 text-brand-rust" />
                                                    <span className="font-bold text-brand-text">{rs.bookingsCount}</span>
                                                    <span className="text-[9px] font-bold text-brand-text-light uppercase tracking-wider">Bookings</span>
                                                </div>

                                                {/* Open Button */}
                                                <Link
                                                    href={`/courier/runsheet/${rs.id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="ml-auto btn-primary flex h-8 shrink-0 items-center gap-1.5 px-3 py-0 text-[10px] font-bold uppercase tracking-widest shadow-xs transition-all active:scale-95 sm:px-4"
                                                >
                                                    Open
                                                    <PlayCircle className="size-3.5" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Panel Ã¢â‚¬â€ Map */}
                <div className={`relative order-1 min-h-0 flex-none overflow-hidden bg-brand-warm/20 lg:order-2 lg:h-full lg:flex-1 ${
                    showMap ? 'h-[32%] block' : 'h-0 hidden'
                }`}>
                    <PickerRunsheetMap
                        markers={mapMarkers}
                        userLocation={userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null}
                        userAccuracy={userLocation?.accuracy ?? null}
                        isDemo={userLocation?.isDemo ?? false}
                        activeCenter={activeCenter}
                        selectedMarkerId={selectedId}
                        onMarkerClick={handleMarkerClick}
                        onCenterOnUser={handleCenterOnUser}
                    />
                </div>
            </div>
        </AppLayout>
    );
}





