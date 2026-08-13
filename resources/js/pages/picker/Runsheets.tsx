import { Head, Link } from '@inertiajs/react';
import {
    Package,
    Truck,
    ClipboardList,
    PlayCircle,
    Calendar,
    MapPin,
    Search,
    X,
    Map,
} from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PickerMapMarkerData } from '@/components/ui/PickerRunsheetMap';
import PickerRunsheetMap from '@/components/ui/PickerRunsheetMap';
import AppLayout from '@/layouts/app-layout';
import {
    haversineKm,
    formatDistance,
    nearestNeighborOrder,
    GPS_MIN_MOVEMENT_METERS,
    GPS_MIN_UPDATE_INTERVAL_MS,
    GPS_ACCURACY_IMPROVEMENT_METERS,
    GPS_SESSION_KEY,
} from '@/lib/geo';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Picker Dashboard', href: '/picker/dashboard' },
    { title: 'My Runsheets', href: '/picker/runsheets' },
];

const statusStyles: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400',
    assigned:
        'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
    in_progress:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
    completed:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const SCOLOR: Record<string, string> = {
    assigned: '#EA580C',
    in_progress: '#D97706',
    completed: '#059669',
    draft: '#71717a',
};

const PICKER_LOCATION_SESSION_KEY = GPS_SESSION_KEY;

type RunsheetCoords = {
    lat: number;
    lng: number;
    label: string;
};

const getSenderStopLabel = (booking: any) => {
    const sender = booking.sender;

    return (
        sender?.address ||
        sender?.full_address ||
        sender?.area ||
        sender?.city ||
        sender?.name ||
        booking.reference_number ||
        'Pickup stop'
    );
};

// Resolve representative coordinates for a runsheet from its first geocoded booking.
const getRunsheetCoords = (runsheet: any): RunsheetCoords | null => {
    for (const booking of runsheet.bookings || []) {
        const lat = Number(booking.sender?.latitude);
        const lng = Number(booking.sender?.longitude);

        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            return { lat, lng, label: getSenderStopLabel(booking) };
        }
    }

    return null;
};

export default function Runsheets({ runsheets }: { runsheets: any[] }) {
    type PickerLocation = {
        lat: number;
        lng: number;
        accuracy: number | null;
        isDemo: boolean;
    };
    const [userLocation, setUserLocation] = useState<PickerLocation | null>(
        () => {
            if (typeof window === 'undefined') {
                return null;
            }

            try {
                const savedLocation = window.sessionStorage.getItem(
                    PICKER_LOCATION_SESSION_KEY,
                );

                if (!savedLocation) {
                    return null;
                }

                const parsed = JSON.parse(savedLocation);
                const lat = Number(parsed.lat);
                const lng = Number(parsed.lng);

                if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                    window.sessionStorage.removeItem(
                        PICKER_LOCATION_SESSION_KEY,
                    );

                    return null;
                }

                return {
                    lat,
                    lng,
                    accuracy:
                        parsed.accuracy === null ||
                        isNaN(Number(parsed.accuracy))
                            ? null
                            : Number(parsed.accuracy),
                    isDemo: Boolean(parsed.isDemo),
                };
            } catch {
                window.sessionStorage.removeItem(PICKER_LOCATION_SESSION_KEY);

                return null;
            }
        },
    );
    const [filter, setFilter] = useState<
        'all' | 'assigned' | 'in_progress' | 'completed'
    >('all');
    const [boxStatus, setBoxStatus] = useState('all');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<
        'route' | 'distance' | 'date_asc' | 'date_desc' | 'area'
    >('route');
    const [gpsPromptDismissed, setGpsPromptDismissed] = useState(false);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [activeCenter, setActiveCenter] = useState<[number, number] | null>(
        null,
    );
    const [gpsRequesting, setGpsRequesting] = useState(false);
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [showMap, setShowMap] = useState(true);

    const watchIdRef = useRef<number | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const userLocationRef = useRef<PickerLocation | null>(userLocation);
    const lastGpsUpdateAtRef = useRef(0);

    const saveUserLocation = useCallback((location: PickerLocation) => {
        userLocationRef.current = location;
        lastGpsUpdateAtRef.current = Date.now();
        setUserLocation(location);

        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(
                PICKER_LOCATION_SESSION_KEY,
                JSON.stringify(location),
            );
        }
    }, []);

    /** Throttled GPS update — skips if picker hasn't moved enough or too soon. */
    const throttledGpsUpdate = useCallback(
        (loc: PickerLocation) => {
            const previous = userLocationRef.current;
            const now = Date.now();

            if (previous && !previous.isDemo) {
                const movedMeters =
                    haversineKm(previous.lat, previous.lng, loc.lat, loc.lng) *
                    1000;
                const accuracyImproved =
                    previous.accuracy !== null &&
                    loc.accuracy !== null &&
                    loc.accuracy + GPS_ACCURACY_IMPROVEMENT_METERS <
                        previous.accuracy;
                const minTimeElapsed =
                    now - lastGpsUpdateAtRef.current >=
                    GPS_MIN_UPDATE_INTERVAL_MS;

                if (
                    movedMeters < GPS_MIN_MOVEMENT_METERS &&
                    !accuracyImproved &&
                    !minTimeElapsed
                ) {
                    return;
                }
            }

            saveUserLocation(loc);
        },
        [saveUserLocation],
    );

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
            setGpsError(
                'Geolocation is not supported by your browser. Please try demo mode.',
            );
            setGpsRequesting(false);

            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    isDemo: false,
                };
                saveUserLocation(loc);
                setActiveCenter([loc.lat, loc.lng]);
                setGpsRequesting(false);
                watchIdRef.current = navigator.geolocation.watchPosition(
                    (p) => {
                        throttledGpsUpdate({
                            lat: p.coords.latitude,
                            lng: p.coords.longitude,
                            accuracy: p.coords.accuracy,
                            isDemo: false,
                        });
                    },
                    () => {},
                    { enableHighAccuracy: true, maximumAge: 5000 },
                );
            },
            (error) => {
                setGpsRequesting(false);
                const msgs: Record<number, string> = {
                    1: 'Location permission denied. Please allow GPS access in browser settings, or use Demo Location.',
                    2: 'GPS signal unavailable. Please try demo mode.',
                    3: 'GPS request timed out. Please try again or use demo mode.',
                };
                setGpsError(
                    msgs[error.code] || 'Could not retrieve your location.',
                );
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        );
    };

    const handleUseDemo = () => {
        for (const rs of runsheets) {
            const coords = getRunsheetCoords(rs);

            if (coords) {
                const demoLat = coords.lat + 0.005;
                const demoLng = coords.lng - 0.004;
                saveUserLocation({
                    lat: demoLat,
                    lng: demoLng,
                    accuracy: null,
                    isDemo: true,
                });
                setActiveCenter([demoLat, demoLng]);

                return;
            }
        }

        setGpsError(
            'Demo location is unavailable because these runsheets do not have pickup coordinates.',
        );
    };

    const enrichedRunsheets = React.useMemo(() => {
        return runsheets.map((rs) => {
            const coords = getRunsheetCoords(rs);
            let distance = 999999;

            if (userLocation && coords) {
                distance = haversineKm(
                    userLocation.lat,
                    userLocation.lng,
                    coords.lat,
                    coords.lng,
                );
            }

            const totalBoxes = rs.bookings.reduce(
                (acc: number, b: any) => acc + (b.boxes?.length || 0),
                0,
            );

            return { ...rs, coords, distance, totalBoxes };
        });
    }, [runsheets, userLocation]);

    const statusCounts = {
        all: runsheets.length,
        assigned: runsheets.filter((rs) => rs.status === 'assigned').length,
        in_progress: runsheets.filter((rs) => rs.status === 'in_progress')
            .length,
        completed: runsheets.filter((rs) => rs.status === 'completed').length,
    };

    const filteredRunsheets = React.useMemo(() => {
        const statusFiltered =
            filter === 'all'
                ? enrichedRunsheets.filter((rs) => rs.status !== 'completed')
                : enrichedRunsheets.filter((rs) => rs.status === filter);
        const query = search.trim().toLowerCase();
        const visible = statusFiltered.filter((rs) => {
            const matchesSearch =
                !query ||
                rs.area_description?.toLowerCase().includes(query) ||
                rs.bookings.some(
                    (booking: any) =>
                        booking.reference_number
                            ?.toLowerCase()
                            .includes(query) ||
                        `${booking.sender?.first_name ?? ''} ${booking.sender?.last_name ?? ''}`
                            .toLowerCase()
                            .includes(query) ||
                        booking.boxes?.some((box: any) =>
                            box.tracking_number?.toLowerCase().includes(query),
                        ),
                );
            const matchesBoxStatus =
                boxStatus === 'all' ||
                rs.bookings.some((booking: any) =>
                    booking.boxes?.some((box: any) => box.status === boxStatus),
                );

            return matchesSearch && matchesBoxStatus;
        });

        // Nearest-neighbor route ordering
        if (sortBy === 'route' && userLocation) {
            const withCoords = visible.filter((rs) => rs.coords);
            const withoutCoords = visible.filter((rs) => !rs.coords);
            const coordStops = withCoords.map((rs) => ({
                ...rs,
                lat: rs.coords!.lat,
                lng: rs.coords!.lng,
            }));
            const ordered = nearestNeighborOrder(userLocation, coordStops);
            return [
                ...ordered.map((rs) => ({ ...rs, routeDistance: rs.routeDistance })),
                ...withoutCoords,
            ];
        }

        return [...visible].sort((a, b) => {
            if (sortBy === 'date_asc') {
                return (
                    new Date(a.scheduled_date).getTime() -
                    new Date(b.scheduled_date).getTime()
                );
            }

            if (sortBy === 'date_desc') {
                return (
                    new Date(b.scheduled_date).getTime() -
                    new Date(a.scheduled_date).getTime()
                );
            }

            if (sortBy === 'area') {
                return a.area_description.localeCompare(b.area_description);
            }

            return a.distance - b.distance;
        });
    }, [boxStatus, enrichedRunsheets, filter, search, sortBy, userLocation]);

    // Build map markers from sorted+filtered runsheets
    const mapMarkers: PickerMapMarkerData[] = React.useMemo(() => {
        return filteredRunsheets
            .filter((rs) => rs.coords)
            .map((rs, idx) => {
                // Map runsheet status to marker status
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
                    subtitle: `${rs.coords!.label} - ${rs.totalBoxes} boxes - ${rs.bookings.length} bookings`,
                    status: markerStatus,
                    reference_number: undefined,
                    boxesCount: rs.totalBoxes,
                    bookingsCount: rs.bookings.length,
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
        const rs = enrichedRunsheets.find((r) => r.id === id);

        if (rs?.coords) {
            setActiveCenter([rs.coords.lat, rs.coords.lng]);
        }

        setTimeout(() => {
            if (listRef.current) {
                const el = listRef.current.querySelector(
                    `[data-runsheet-id="${id}"]`,
                );

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
            {userLocation === null && !gpsPromptDismissed && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-brand-navy/95 p-4 backdrop-blur-md">
                    <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-brand-sand/50 bg-white p-8 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="relative mb-6 flex size-20 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/30">
                            <div className="absolute inset-0 animate-[spin_8s_linear_infinite] rounded-full border-2 border-dashed border-orange-300 dark:border-orange-700" />
                            <MapPin className="size-9 text-brand-primary" />
                        </div>
                        <h2 className="mb-2 font-serif text-2xl font-black text-brand-navy dark:text-white">
                            Use your location?
                        </h2>
                        <p className="mb-6 text-sm leading-relaxed text-brand-text-mid dark:text-zinc-400">
                            Location sorts runsheets by nearest pickup. You can
                            continue without it and choose a manual sort.
                        </p>
                        <div className="hidden">
                            ⚠️ GPS tracking is mandatory — required for all
                            pickups
                        </div>
                        <button
                            type="button"
                            onClick={handleEnableGPS}
                            disabled={gpsRequesting}
                            className="btn-primary mb-3 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold tracking-wider uppercase shadow-lg transition-all active:scale-95"
                        >
                            {gpsRequesting
                                ? '⏳ Requesting Access...'
                                : '📍 Enable GPS & Start'}
                        </button>
                        <button
                            type="button"
                            onClick={handleUseDemo}
                            className="w-full rounded-2xl border border-brand-sand bg-zinc-100 px-6 py-3 text-xs font-bold tracking-wider text-brand-navy uppercase transition-all hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                        >
                            Use Demo Location (Near Pickups)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setGpsPromptDismissed(true);
                                setSortBy('date_asc');
                            }}
                            className="mt-3 w-full py-2 text-xs font-bold tracking-wider text-brand-text-mid uppercase hover:text-brand-navy"
                        >
                            Ask Me Later
                        </button>
                        {gpsError && (
                            <div className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-normal font-medium text-red-600">
                                {gpsError}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Split-screen Layout */}
            <div className="relative z-10 flex h-[calc(100svh-4rem)] w-full flex-col overflow-hidden lg:h-[calc(100svh-4rem)] lg:flex-row">
                {/* Left Panel — Runsheet List */}
                <div className="order-2 flex flex-1 min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-brand-sand bg-white lg:order-1 lg:h-full lg:w-[480px] lg:flex-none dark:border-zinc-800 dark:bg-zinc-950">
                    {/* Header */}
                    <div className="shrink-0 border-b border-brand-sand/50 bg-brand-warm/10 p-3 sm:p-5 dark:border-zinc-800">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <ClipboardList className="size-6 text-brand-secondary" />
                                <h1 className="font-serif text-xl font-black text-brand-text">
                                    My Runsheets
                                </h1>
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
                                    <div
                                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black tracking-widest uppercase ${
                                            userLocation.isDemo
                                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        }`}
                                    >
                                        <span className="relative flex size-1.5">
                                            <span
                                                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${userLocation.isDemo ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                            />
                                            <span
                                                className={`relative inline-flex size-1.5 rounded-full ${userLocation.isDemo ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                            />
                                        </span>
                                        {userLocation.isDemo
                                            ? 'Demo Mode'
                                            : userLocation.accuracy
                                              ? `±${Math.round(userLocation.accuracy)} m`
                                              : 'GPS Active'}
                                    </div>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-brand-text-mid">
                            All your assigned pickup runsheets
                        </p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex shrink-0 gap-1 p-1 mx-3 my-2.5 rounded-xl bg-brand-warm/15 dark:bg-zinc-900/50 border border-brand-sand/30 dark:border-zinc-800/50">
                        {(
                            [
                                {
                                    id: 'all',
                                    label: 'Active',
                                    count:
                                        statusCounts.assigned +
                                        statusCounts.in_progress,
                                },
                                {
                                    id: 'assigned',
                                    label: 'Assigned',
                                    count: statusCounts.assigned,
                                },
                                {
                                    id: 'in_progress',
                                    label: 'In Progress',
                                    count: statusCounts.in_progress,
                                },
                                {
                                    id: 'completed',
                                    label: 'Completed',
                                    count: statusCounts.completed,
                                },
                            ] as const
                        ).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setFilter(tab.id);
                                    setSelectedId(null);
                                }}
                                className={`flex flex-1 items-center justify-center gap-1 sm:gap-2 rounded-lg px-1.5 py-1.5 sm:px-3 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase transition-all ${
                                    filter === tab.id
                                        ? 'bg-white dark:bg-zinc-800 text-brand-navy dark:text-white shadow-xs border border-brand-sand/10 dark:border-zinc-700/30'
                                        : 'text-brand-text-mid hover:bg-white/50 hover:text-brand-text dark:hover:bg-zinc-900/40'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span
                                    className={`flex h-4 w-4 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full text-[8px] sm:text-[9px] font-black ${
                                        filter === tab.id
                                            ? 'bg-brand-navy/10 text-brand-navy dark:bg-zinc-700 dark:text-white'
                                            : 'bg-brand-sand text-brand-text-mid'
                                    }`}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-brand-sand/50 bg-white p-3 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-950">
                        <label className="relative col-span-2 sm:col-span-3">
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-text-light dark:text-zinc-400" />
                            <input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search area, sender, booking, or box"
                                className="h-10 w-full rounded-xl border border-brand-sand bg-brand-warm/10 pr-9 pl-9 text-xs font-medium text-brand-text placeholder:text-brand-text-light dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-white"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute top-1/2 right-3 -translate-y-1/2"
                                >
                                    <X className="size-4 text-brand-text-light dark:text-zinc-400" />
                                </button>
                            )}
                        </label>
                        <select
                            value={boxStatus}
                            onChange={(event) =>
                                setBoxStatus(event.target.value)
                            }
                            className="h-9 rounded-lg border border-brand-sand bg-white px-2 text-xs font-bold text-brand-text dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                        >
                            <option value="all" className="dark:bg-zinc-900">All box statuses</option>
                            <option value="pending" className="dark:bg-zinc-900">Pending boxes</option>
                            <option value="collected" className="dark:bg-zinc-900">Collected boxes</option>
                            <option value="cancelled" className="dark:bg-zinc-900">Cancelled boxes</option>
                        </select>
                        <select
                            value={sortBy}
                            onChange={(event) =>
                                setSortBy(event.target.value as typeof sortBy)
                            }
                            className="h-9 rounded-lg border border-brand-sand bg-white px-2 text-xs font-bold sm:col-span-2 text-brand-text dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                        >
                            <option value="route" disabled={!userLocation} className="dark:bg-zinc-900">
                                Nearest route
                            </option>
                            <option value="distance" disabled={!userLocation} className="dark:bg-zinc-900">
                                Nearest distance
                            </option>
                            <option value="date_asc" className="dark:bg-zinc-900">
                                Date: earliest first
                            </option>
                            <option value="date_desc" className="dark:bg-zinc-900">
                                Date: latest first
                            </option>
                            <option value="area" className="dark:bg-zinc-900">Area: A-Z</option>
                        </select>
                    </div>

                    {/* Sort Bar */}
                    <div className="flex shrink-0 items-center gap-2 border-b border-orange-200 bg-orange-50 px-5 py-2.5 dark:border-orange-900/50 dark:bg-orange-950/20">
                        <MapPin className="size-3.5 text-orange-700 dark:text-orange-400" />
                        <span className="text-[10px] font-bold tracking-wide text-orange-800 dark:text-orange-300 uppercase">
                            {sortBy === 'route'
                                ? 'Optimized route from your GPS location'
                                : sortBy === 'distance'
                                  ? 'Sorted by nearest distance from your GPS location'
                                  : 'Using manual sort'}
                        </span>
                    </div>

                    {/* Runsheet Cards */}
                    <div
                        ref={listRef}
                        className="flex flex-1 flex-col gap-2 overflow-y-auto scroll-smooth p-3 sm:gap-3 sm:p-4"
                    >
                        {filteredRunsheets.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-brand-sand/50 bg-brand-warm/5 px-4 py-16 text-center">
                                <Truck className="mx-auto mb-3 size-10 text-brand-sand" />
                                <p className="font-serif text-sm font-bold text-brand-text-mid">
                                    No runsheets found
                                </p>
                                <p className="mt-1 text-xs text-brand-text-light">
                                    {filter !== 'all'
                                        ? `No runsheets with status "${humanize(filter)}".`
                                        : 'You have no assigned runsheets yet.'}
                                </p>
                            </div>
                        ) : (
                            filteredRunsheets.map((rs, idx) => {
                                const isSelected = rs.id === selectedId;
                                const displayDist =
                                    sortBy === 'route' && (rs as any).routeDistance != null
                                        ? (rs as any).routeDistance
                                        : rs.distance;
                                const distStr =
                                    displayDist < 999999
                                        ? formatDistance(displayDist)
                                        : 'No coordinates';
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
                                        className={`card relative cursor-pointer border transition-all ${
                                            isSelected
                                                ? 'scale-[1.01] border-brand-primary shadow-md ring-2 ring-brand-primary/20'
                                                : 'hover:border-brand-secondary hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="p-3.5 pl-4">
                                            {/* Top Row: Stop Number + Status + Distance */}
                                            <div className="mb-2 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-black text-white shadow-xs"
                                                        style={{
                                                            backgroundColor:
                                                                color,
                                                        }}
                                                    >
                                                        {idx + 1}
                                                    </div>
                                                    <span
                                                        className={`rounded-full border px-2 py-0.5 text-[8px] font-black tracking-widest uppercase ${
                                                            statusStyles[
                                                                rs.status
                                                            ] ||
                                                            statusStyles.draft
                                                        }`}
                                                    >
                                                        {humanize(rs.status)}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-black tracking-wide text-brand-primary">
                                                    {distStr}
                                                </span>
                                            </div>

                                            {/* Area Name */}
                                            <h4 className="mb-0.5 font-serif text-base leading-snug font-bold text-brand-text transition-colors group-hover:text-brand-secondary">
                                                {rs.area_description}
                                            </h4>

                                            {rs.coords && (
                                                <p
                                                    className="truncate text-[11px] font-medium text-brand-text-light"
                                                    title={rs.coords.label}
                                                >
                                                    Stop: {rs.coords.label}
                                                </p>
                                            )}

                                            {/* Date */}
                                            <div className="mt-1 flex items-center gap-1.5 text-xs text-brand-text-mid">
                                                <Calendar className="size-3.5 text-brand-secondary" />
                                                <span>
                                                    {new Date(
                                                        rs.scheduled_date,
                                                    ).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </span>
                                            </div>

                                            {/* Stats Row */}
                                            <div className="mt-2.5 flex items-center gap-4 border-t border-brand-warm/40 pt-2.5">
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-mid">
                                                    <Package className="size-4 text-brand-rust" />
                                                    <span className="font-bold text-brand-text">
                                                        {rs.totalBoxes}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-brand-text-light uppercase tracking-wider">
                                                        Boxes
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-mid">
                                                    <PlayCircle className="size-4 text-brand-rust" />
                                                    <span className="font-bold text-brand-text">
                                                        {rs.bookings.length}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-brand-text-light uppercase tracking-wider">
                                                        Bookings
                                                    </span>
                                                </div>

                                                {/* Open Button */}
                                                <Link
                                                    href={`/picker/runsheet/${rs.id}`}
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                    className="btn-primary ml-auto flex h-8 shrink-0 items-center gap-1.5 px-3 py-0 text-[10px] font-bold tracking-widest uppercase shadow-xs transition-all active:scale-95 sm:px-4"
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

                {/* Right Panel — Map */}
                <div className={`relative order-1 min-h-0 flex-none overflow-hidden bg-brand-warm/20 lg:order-2 lg:h-full lg:flex-1 ${
                    showMap ? 'h-[32%] block' : 'h-0 hidden'
                }`}>
                    <PickerRunsheetMap
                        markers={mapMarkers}
                        userLocation={
                            userLocation
                                ? {
                                      lat: userLocation.lat,
                                      lng: userLocation.lng,
                                  }
                                : null
                        }
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
