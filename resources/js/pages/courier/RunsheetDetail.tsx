import { Head, Link, router } from '@inertiajs/react';
import { Navigation, Package, Truck, MapPin, CheckCircle, Clock, ArrowUpCircle, Warehouse, PlayCircle, Phone, MessageSquare, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PickerMapMarkerData } from '@/components/ui/PickerRunsheetMap';
import PickerRunsheetMap from '@/components/ui/PickerRunsheetMap';
import type { MapMarkerData } from '@/components/ui/RunsheetMap';
import RunsheetMap from '@/components/ui/RunsheetMap';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';

import type { BreadcrumbItem } from '@/types';

// Haversine formula
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

const GPS_SESSION_KEY = 'courier:runsheets:last-location';

/** Build a Google Maps driving directions URL */
const googleMapsDirectionsUrl = (
    origin: { lat: number; lng: number } | null,
    destination: { lat: number; lng: number },
) => {
    const dest = `${destination.lat},${destination.lng}`;

    if (origin) {
        return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest}&travelmode=driving`;
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
};

const statusConfig: Record<string, { label: string; style: string; icon: any }> = {
    pending: {
        label: 'Pending',
        style: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
        icon: Clock,
    },
    collected: {
        label: 'Collected',
        style: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
        icon: ArrowUpCircle,
    },
    received_by_branch: {
        label: 'Warehouse',
        style: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        icon: Warehouse,
    },
    in_transit: {
        label: 'In Transit',
        style: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
        icon: Truck,
    },
    delivered: {
        label: 'Delivered',
        style: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
        icon: CheckCircle,
    },
    arrived: {
        label: 'Arrived',
        style: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400',
        icon: MapPin,
    },
    out_for_delivery: {
        label: 'Out for Delivery',
        style: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
        icon: Truck,
    },
    cancelled: {
        label: 'Cancelled',
        style: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400',
        icon: Clock,
    },
    held: {
        label: 'Held',
        style: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/20 dark:text-slate-300',
        icon: Clock,
    },
    damaged: {
        label: 'Damaged',
        style: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400',
        icon: X,
    },
};

export default function RunsheetDetail({ runsheet }: { runsheet: any }) {
    /* ---------- GPS state ---------- */
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(() => {
        if (typeof window === 'undefined') {
return null;
}

        try {
            const saved = window.sessionStorage.getItem(GPS_SESSION_KEY);

            if (!saved) {
return null;
}

            const p = JSON.parse(saved);
            const lat = Number(p.lat);
            const lng = Number(p.lng);

            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
return null;
}

            return { lat, lng, accuracy: p.accuracy ?? null };
        } catch {
            return null;
        }
    });
    const watchIdRef = useRef<number | null>(null);

    const isInProgress = runsheet.status === 'in_progress';

    // Start GPS tracking when the run is in progress
    useEffect(() => {
        if (!isInProgress || !navigator.geolocation) {
return;
}

        // Get initial position if not already cached
        if (!userLocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
                    setUserLocation(loc);
                    window.sessionStorage.setItem(GPS_SESSION_KEY, JSON.stringify(loc));
                },
                () => {},
                { enableHighAccuracy: true, timeout: 10000 },
            );
        }

        // Continuous tracking
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
                setUserLocation(loc);
                window.sessionStorage.setItem(GPS_SESSION_KEY, JSON.stringify(loc));
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000 },
        );

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [isInProgress, userLocation]);

    /* ---------- Map active center (for PickerRunsheetMap) ---------- */
    const [activeCenter, setActiveCenter] = useState<[number, number] | null>(null);
    const [selectedMarkerId, setSelectedMarkerId] = useState<string | number | null>(null);

    const handleCenterOnUser = () => {
        if (userLocation) {
setActiveCenter([userLocation.lat, userLocation.lng]);
}
    };

    const handleMarkerClick = (id: string | number) => {
        setSelectedMarkerId(id);
        // Find the box/booking with matching id
        const box = allBoxes.find((b: any) => b.id === id);

        if (box?.recipient?.latitude && box?.recipient?.longitude) {
            setActiveCenter([Number(box.recipient.latitude), Number(box.recipient.longitude)]);
        }
    };

    /* ---------- Derived data ---------- */

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Courier Dashboard', href: '/courier/dashboard' },
        { title: 'My Runsheets', href: '/courier/runsheets' },
        {
            title: runsheet.area_description,
            href: `/courier/runsheet/${runsheet.id}`,
        },
    ];

    const directBoxes = Array.isArray(runsheet.boxes) ? runsheet.boxes : [];
    const allBoxes = directBoxes.length > 0
        ? directBoxes.map((box: any, boxIndex: number) => ({
            ...box,
            booking: box.booking ?? null,
            stopNumber: boxIndex + 1,
        }))
        : (runsheet.bookings ?? []).flatMap((booking: any, bookingIndex: number) =>
            (booking.boxes ?? []).map((box: any) => ({ ...box, booking, stopNumber: bookingIndex + 1 })),
        );

    const terminalStatusesForDelivery = ['delivered', 'cancelled', 'held', 'damaged'];

    // Group boxes by booking for stop-level markers (deduplicate by booking)
    const enrichedBoxes = allBoxes.map((box: any) => {
        const lat = Number(box.recipient?.latitude);
        const lng = Number(box.recipient?.longitude);
        let distance = 999999;

        if (userLocation && lat && lng && !isNaN(lat) && !isNaN(lng)) {
            distance = haversineDistance(userLocation.lat, userLocation.lng, lat, lng);
        }

        const isCompleted = box.status === 'delivered';
        const isCancelled = ['cancelled', 'held', 'damaged'].includes(box.status);

        return { ...box, distance, isCompleted, isCancelled };
    });

    // Sort by proximity when in progress and GPS available
    const sortedBoxes = isInProgress && userLocation
        ? [...enrichedBoxes].sort((a, b) => {
              if (a.isCompleted !== b.isCompleted) {
return a.isCompleted ? 1 : -1;
}

              if (a.isCancelled !== b.isCancelled) {
return a.isCancelled ? 1 : -1;
}

              return a.distance - b.distance;
          })
        : enrichedBoxes;

    // Find next delivery stop (nearest incomplete)
    const nextStop = sortedBoxes.find((b: any) => !b.isCompleted && !b.isCancelled);
    const nextStopLat = Number(nextStop?.recipient?.latitude);
    const nextStopLng = Number(nextStop?.recipient?.longitude);
    const nextStopHasCoords = nextStopLat && nextStopLng && !isNaN(nextStopLat) && !isNaN(nextStopLng);

    // Map markers for PickerRunsheetMap (in_progress mode)
    const pickerMapMarkers: PickerMapMarkerData[] = sortedBoxes
        .map((box: any, idx: number) => {
            const lat = Number(box.recipient?.latitude);
            const lng = Number(box.recipient?.longitude);

            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
return null;
}

            let markerStatus: PickerMapMarkerData['status'] = 'pending';

            if (box.isCancelled) {
markerStatus = 'cancelled';
} else if (box.isCompleted) {
markerStatus = 'completed';
} else if (isInProgress) {
markerStatus = 'in_progress';
}

            return {
                id: box.id,
                lat,
                lng,
                title: `${box.recipient?.first_name || ''} ${box.recipient?.last_name || ''}`.trim() || `Box ${box.tracking_number}`,
                subtitle: box.recipient?.address || box.booking?.destination,
                status: markerStatus,
                reference_number: box.tracking_number,
                boxesCount: 1,
                bookingsCount: 1,
                distance: box.distance < 999999 ? box.distance : undefined,
                stopIndex: idx + 1,
            };
        })
        .filter(Boolean) as PickerMapMarkerData[];

    // Map markers for basic RunsheetMap (assigned / completed mode)
    const basicMapMarkers: MapMarkerData[] = allBoxes.map((box: any) => {
        const isCompleted = ['delivered'].includes(box.status);
        const isCancelled = box.status === 'cancelled';
        let status: MapMarkerData['status'] = 'pending';

        if (isCancelled) {
            status = 'cancelled';
        } else if (isCompleted) {
            status = 'completed';
        }

        return {
            id: box.id,
            lat: Number(box.recipient?.latitude) || 0,
            lng: Number(box.recipient?.longitude) || 0,
            title: `${box.recipient?.first_name || ''} ${box.recipient?.last_name || ''}`.trim() || `Box ${box.tracking_number}`,
            subtitle: box.recipient?.address,
            status,
            reference_number: box.tracking_number,
        };
    }).filter((m: MapMarkerData) => m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng));

    const isReadyToComplete = allBoxes.length > 0 && allBoxes.every((box: any) =>
        terminalStatusesForDelivery.includes(box.status),
    );

    const statusCounts = allBoxes.reduce(
        (acc: Record<string, number>, box: any) => {
            acc[box.status] = (acc[box.status] || 0) + 1;

            return acc;
        },
        {} as Record<string, number>,
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Runsheet â€” ${runsheet.area_description}`} />

            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6 pb-24 lg:p-10">
                {/* Header */}
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link
                            href="/courier/runsheets"
                            className="mb-3 inline-flex items-center text-sm font-bold uppercase tracking-widest text-brand-secondary hover:text-brand-navy transition-colors"
                        >
                            â† Back to Runsheets
                        </Link>
                        <h2 className="font-serif text-3xl font-bold tracking-tight text-brand-text flex items-center gap-3">
                            <Truck className="size-8 text-brand-secondary" />
                            {runsheet.area_description}
                        </h2>
                        <p className="mt-1 text-brand-text-mid">
                            Scheduled for{' '}
                            <span className="font-semibold text-brand-text">
                                {new Date(runsheet.scheduled_date).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </span>
                        </p>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:items-end">
                        <span className={`inline-block rounded-full px-4 py-1.5 text-xs font-bold tracking-widest uppercase shadow-sm ${
                            runsheet.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800'
                                : runsheet.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-brand-warm text-brand-navy'
                        }`}>
                            {humanize(runsheet.status)}
                        </span>

                        {runsheet.status === 'assigned' && (
                            <button
                                onClick={() => router.post(`/courier/runsheet/${runsheet.id}/start`)}
                                className="btn-primary flex items-center gap-2 px-6 py-2.5 shadow-lg active:scale-95"
                            >
                                <PlayCircle className="size-5" />
                                Start Run
                            </button>
                        )}
                        {runsheet.status === 'in_progress' && (
                            <div className="flex flex-col items-start gap-2 sm:items-end">
                                <button
                                    disabled={!isReadyToComplete}
                                    onClick={() => router.post(`/courier/runsheet/${runsheet.id}/complete`)}
                                    className={`btn-navy flex items-center gap-2 px-6 py-2.5 shadow-lg transition-all ${
                                        !isReadyToComplete ? 'opacity-50 cursor-not-allowed grayscale' : 'active:scale-95'
                                    }`}
                                >
                                    <CheckCircle className="size-5" />
                                    Complete Run
                                </button>
                                {!isReadyToComplete && (
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 animate-pulse text-right">
                                        All boxes must be resolved
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Summary */}
                {allBoxes.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                        {Object.entries(statusConfig)
                            .filter(([key]) => ['received_by_branch', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'].includes(key) || (statusCounts[key] || 0) > 0)
                            .map(([key, config]) => {
                            const StatusIcon = config.icon;

                            return (
                                <div
                                    key={key}
                                    className={`card flex min-w-32.5 flex-1 flex-col items-center justify-center border-none p-4 text-center transition-all hover:scale-105 hover:shadow-lg ${
                                        statusCounts[key] > 0
                                            ? 'bg-white/80 backdrop-blur-md opacity-100 ring-1 ring-brand-warm/30'
                                            : 'bg-brand-warm/20 backdrop-blur-sm opacity-60'
                                    }`}
                                >
                                    <div className={`mb-2 rounded-full p-2 ${config.style.split(' ')[1]} ${config.style.split(' ')[2]}`}>
                                        <StatusIcon className="size-4" />
                                    </div>
                                    <div className="text-2xl font-bold text-brand-text">{statusCounts[key] || 0}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-text-light">{config.label}</div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-brand-warm"></div>
                    </div>
                </div>

                {/* Map Section â€” GPS-aware when in progress */}
                <div className="mb-2">
                    {isInProgress ? (
                        /* Enhanced GPS-aware map for driving mode */
                        allBoxes.length > 0 && allBoxes.some((b: any) => b.recipient?.latitude && b.recipient?.longitude) ? (
                            <div className="relative h-80 w-full overflow-hidden rounded-2xl border border-brand-warm/50 shadow-sm">
                                <PickerRunsheetMap
                                    markers={pickerMapMarkers}
                                    userLocation={userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null}
                                    userAccuracy={userLocation?.accuracy ?? null}
                                    isDemo={false}
                                    activeCenter={activeCenter}
                                    selectedMarkerId={selectedMarkerId}
                                    onMarkerClick={handleMarkerClick}
                                    onCenterOnUser={handleCenterOnUser}
                                />
                            </div>
                        ) : (
                            <div className="w-full h-80 rounded-2xl border-2 border-dashed border-brand-warm/50 bg-brand-warm/10 flex items-center justify-center">
                                <div className="text-center text-brand-text-mid p-6">
                                    <MapPin className="size-12 mx-auto mb-3 text-brand-sand" />
                                    <p className="text-base font-semibold mb-1">Map Unavailable</p>
                                    <p className="text-sm">Recipient addresses need to be geocoded with coordinates.</p>
                                    <p className="text-xs text-brand-text-light mt-2">Contact admin to update recipient locations.</p>
                                </div>
                            </div>
                        )
                    ) : (
                        /* Basic map for assigned/completed status */
                        allBoxes.length > 0 && allBoxes.some((b: any) => b.recipient?.latitude && b.recipient?.longitude) ? (
                            <RunsheetMap markers={basicMapMarkers} />
                        ) : (
                            <div className="w-full h-80 rounded-2xl border-2 border-dashed border-brand-warm/50 bg-brand-warm/10 flex items-center justify-center">
                                <div className="text-center text-brand-text-mid p-6">
                                    <MapPin className="size-12 mx-auto mb-3 text-brand-sand" />
                                    <p className="text-base font-semibold mb-1">Map Unavailable</p>
                                    <p className="text-sm">Recipient addresses need to be geocoded with coordinates.</p>
                                    <p className="text-xs text-brand-text-light mt-2">Contact admin to update recipient locations.</p>
                                </div>
                            </div>
                        )
                    )}
                </div>

                {/* Navigation HUD â€” only shown when in progress */}
                {isInProgress && nextStop && (
                    <div className="rounded-2xl border border-brand-navy/20 bg-brand-navy text-white shadow-xl overflow-hidden">
                        <div className="flex items-center gap-4 px-5 py-4">
                            {/* Pulsing dot */}
                            <div className="relative flex size-10 shrink-0 items-center justify-center">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-primary opacity-40" />
                                <span className="relative flex size-5 items-center justify-center rounded-full bg-brand-primary">
                                    <Navigation className="size-3 text-white" />
                                </span>
                            </div>

                            {/* Next stop info */}
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">Next Delivery Stop</p>
                                <p className="truncate text-sm font-bold">
                                    {nextStop.recipient?.first_name} {nextStop.recipient?.last_name}
                                </p>
                                <p className="truncate text-xs text-white/60">
                                    {nextStop.recipient?.address || nextStop.booking?.destination}
                                </p>
                            </div>

                            {/* Distance */}
                            <div className="shrink-0 text-right">
                                {nextStop.distance < 999999 && (
                                    <>
                                        <p className="text-lg font-black text-brand-secondary">{formatDistance(nextStop.distance)}</p>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">away</p>
                                    </>
                                )}
                            </div>

                            {/* Navigate button */}
                            {nextStopHasCoords && (
                                <a
                                    href={googleMapsDirectionsUrl(userLocation, { lat: nextStopLat, lng: nextStopLng })}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-brand-rust active:scale-95"
                                >
                                    <Navigation className="size-4" />
                                    Navigate
                                </a>
                            )}
                        </div>

                        {/* GPS status mini-bar */}
                        <div className="flex items-center gap-2 border-t border-white/10 bg-white/5 px-5 py-2">
                            <span className="relative flex size-1.5">
                                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${userLocation ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                <span className={`relative inline-flex size-1.5 rounded-full ${userLocation ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                                {userLocation
                                    ? `GPS Active${userLocation.accuracy ? ` Â· Â±${Math.round(userLocation.accuracy)} m` : ''}`
                                    : 'Acquiring GPSâ€¦'}
                            </span>
                            {isInProgress && userLocation && (
                                <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-white/30">
                                    Sorted by nearest stop
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <h3 className="font-serif text-xl font-bold text-brand-text flex items-center gap-2">
                        <Package className="size-6 text-brand-secondary" />
                        Boxes in this Run
                        <span className="ml-2 rounded-full bg-brand-warm px-2.5 py-0.5 text-sm font-bold text-brand-navy">
                            {allBoxes.length}
                        </span>
                    </h3>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {allBoxes.length === 0 ? (
                        <div className="card border-dashed border-2 py-16 text-center">
                            <Package className="mx-auto size-12 text-brand-sand mb-4" />
                            <p className="font-serif text-lg font-medium text-brand-text-mid">No boxes assigned yet</p>
                            <p className="mt-1 text-sm text-brand-text-light uppercase tracking-wider">Boxes will appear here once allocated</p>
                        </div>
                    ) : (
                        sortedBoxes.map((box: any) => {
                            const config = statusConfig[box.status] || statusConfig.pending;
                            const StatusIcon = config.icon;
                            const isNext = nextStop && box.id === nextStop.id;
                            const recipientAddress = [box.recipient?.address, box.recipient?.city, box.recipient?.province]
                                .filter(Boolean)
                                .join(', ') || box.booking?.destination || '';
                            const recipientPhone = box.recipient?.phone_number || '';

                            return (
                                <div key={box.id} className={`card relative flex flex-col transition-all overflow-hidden ${
                                    isNext && isInProgress
                                        ? 'border-brand-primary ring-2 ring-brand-primary/20 shadow-md'
                                        : 'hover:bg-brand-warm/10'
                                } ${box.isCompleted ? 'opacity-60' : ''} ${box.isCancelled ? 'opacity-40 grayscale' : ''}`}>

                                    {/* Next stop badge */}
                                    {isNext && isInProgress && (
                                        <div className="flex items-center gap-2 bg-brand-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">
                                            <Navigation className="size-3.5 animate-pulse" />
                                            Next Stop â€” {box.distance < 999999 ? formatDistance(box.distance) + ' away' : 'Distance unknown'}
                                        </div>
                                    )}

                                    <Link
                                        href={`/courier/box/${box.tracking_number}`}
                                        className="card group flex items-center justify-between p-5 transition-all hover:bg-brand-warm/10"
                                    >
                                        <div className="flex-1">
                                            <div className="mb-2 inline-flex items-center rounded-lg bg-brand-warm px-2.5 py-1 font-mono text-xs font-bold tracking-widest text-brand-navy">
                                                {box.tracking_number}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-secondary/10 font-mono text-[10px] font-black text-brand-secondary">
                                                    {box.stopNumber}
                                                </span>
                                                <h4 className="font-serif text-xl font-bold text-brand-text decoration-brand-secondary decoration-2 transition group-hover:underline">
                                                    {box.booking?.sender?.first_name}{' '}
                                                    {box.booking?.sender?.last_name}
                                                </h4>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2 text-sm text-brand-text-mid">
                                                <MapPin className="size-4 text-brand-primary" />
                                                <span>{recipientAddress}</span>
                                                <span className="mx-1 text-brand-sand">â€¢</span>
                                                <span className="text-xs font-bold uppercase tracking-widest text-brand-text-light">
                                                    Ref: {box.booking?.reference_number}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-3 shrink-0">
                                            <div className="flex gap-2">
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(recipientAddress)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="rounded-full bg-brand-warm/50 p-2 text-brand-navy transition-colors hover:bg-brand-warm"
                                                    onClick={(e) => e.stopPropagation()}
                                                    title="Navigate"
                                                >
                                                    <Navigation className="size-3.5" />
                                                </a>
                                                <a
                                                    href={`tel:${recipientPhone}`}
                                                    className="rounded-full bg-emerald-100 p-2 text-emerald-700 transition-colors hover:bg-emerald-200"
                                                    onClick={(e) => e.stopPropagation()}
                                                    title="Call"
                                                >
                                                    <Phone className="size-3.5" />
                                                </a>
                                                <a
                                                    href={`sms:${recipientPhone}`}
                                                    className="rounded-full bg-blue-100 p-2 text-blue-700 transition-colors hover:bg-blue-200"
                                                    onClick={(e) => e.stopPropagation()}
                                                    title="Message"
                                                >
                                                    <MessageSquare className="size-3.5" />
                                                </a>
                                            </div>
                                            <span
                                                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${config.style}`}
                                            >
                                                <StatusIcon className="size-3" />
                                                {config.label}
                                            </span>
                                        </div>
                                    </Link>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </AppLayout>
    );
}




