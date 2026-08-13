import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowUpCircle,
    Camera,
    CheckCircle,
    Clock,
    FileText,
    MapPin,
    MessageCircle,
    Navigation,
    Package,
    Phone,
    PlayCircle,
    Truck,
    Warehouse,
    WifiOff,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PickerMapMarkerData } from '@/components/ui/PickerRunsheetMap';
import PickerRunsheetMap from '@/components/ui/PickerRunsheetMap';
import type { MapMarkerData } from '@/components/ui/RunsheetMap';
import RunsheetMap from '@/components/ui/RunsheetMap';
import StartRunModal from '@/components/ui/StartRunModal';
import CollectBoxesModal from '@/components/ui/CollectBoxesModal';
import type { StartRunStop } from '@/components/ui/StartRunModal';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';

import type { BreadcrumbItem } from '@/types';

const statusConfig: Record<
    string,
    { label: string; style: string; icon: any }
> = {
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
    cancelled: {
        label: 'Cancelled',
        style: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400',
        icon: Clock,
    },
};

// Haversine formula
const haversineDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (km: number) =>
    km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

const GPS_SESSION_KEY = 'picker:runsheets:last-location';

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

export default function RunsheetDetail({ runsheet }: { runsheet: any }) {
    const [isOnline, setIsOnline] = useState(
        () => typeof navigator === 'undefined' || navigator.onLine,
    );
    const [selectedBoxIds, setSelectedBoxIds] = useState<number[]>([]);
    const [collectModalOpen, setCollectModalOpen] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            router.reload({ only: ['runsheet'] });
        };
        const handleOffline = () => setIsOnline(false);
        const handleFocus = () => {
            if (navigator.onLine) {
                router.reload({ only: ['runsheet'] });
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('focus', handleFocus);
        };
    }, [runsheet]);
    /* ---------- GPS state ---------- */
    const [userLocation, setUserLocation] = useState<{
        lat: number;
        lng: number;
        accuracy: number | null;
    } | null>(() => {
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
                    const loc = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                    };
                    setUserLocation(loc);
                    window.sessionStorage.setItem(
                        GPS_SESSION_KEY,
                        JSON.stringify(loc),
                    );
                },
                () => {},
                { enableHighAccuracy: true, timeout: 10000 },
            );
        }

        // Continuous tracking
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const loc = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                };
                setUserLocation(loc);
                window.sessionStorage.setItem(
                    GPS_SESSION_KEY,
                    JSON.stringify(loc),
                );
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000 },
        );

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [isInProgress]);

    /* ---------- Start Run Modal ---------- */
    const [startModalOpen, setStartModalOpen] = useState(false);
    const [startingRun, setStartingRun] = useState(false);

    const handleStartRun = useCallback(() => {
        setStartingRun(true);
        router.post(
            `/picker/runsheet/${runsheet.id}/start`,
            {},
            {
                onFinish: () => setStartingRun(false),
            },
        );
    }, [runsheet.id]);

    /* ---------- Map active center (for PickerRunsheetMap) ---------- */
    const [activeCenter, setActiveCenter] = useState<[number, number] | null>(
        null,
    );
    const [selectedMarkerId, setSelectedMarkerId] = useState<
        string | number | null
    >(null);

    const handleCenterOnUser = () => {
        if (userLocation) {
            setActiveCenter([userLocation.lat, userLocation.lng]);
        }
    };

    const handleMarkerClick = (id: string | number) => {
        setSelectedMarkerId(id);
        const booking = runsheet.bookings.find((b: any) => b.id === id);

        if (booking?.sender?.latitude && booking?.sender?.longitude) {
            setActiveCenter([
                Number(booking.sender.latitude),
                Number(booking.sender.longitude),
            ]);
        }
    };

    /* ---------- Derived data ---------- */

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Picker Dashboard', href: '/picker/dashboard' },
        { title: 'My Runsheets', href: '/picker/runsheets' },
        {
            title: runsheet.area_description,
            href: `/picker/runsheet/${runsheet.id}`,
        },
    ];

    const allBoxes = runsheet.bookings.flatMap(
        (booking: any, bookingIndex: number) =>
            booking.boxes.map((box: any) => ({
                ...box,
                booking,
                stopNumber: bookingIndex + 1,
            })),
    );

    const terminalStatusesForPickup = [
        'collected',
        'received_by_branch',
        'loaded_to_container',
        'in_transit',
        'arrived',
        'out_for_delivery',
        'delivered',
        'cancelled',
    ];

    // Enrich bookings with distance + completion status
    const enrichedBookings = runsheet.bookings.map((booking: any) => {
        const lat = Number(booking.sender?.latitude);
        const lng = Number(booking.sender?.longitude);
        let distance = 999999;

        if (userLocation && lat && lng && !isNaN(lat) && !isNaN(lng)) {
            distance = haversineDistance(
                userLocation.lat,
                userLocation.lng,
                lat,
                lng,
            );
        }

        const isCompleted =
            booking.boxes.length > 0 &&
            booking.boxes.every((box: any) =>
                [
                    'collected',
                    'received_by_branch',
                    'loaded_to_container',
                    'in_transit',
                    'arrived',
                    'out_for_delivery',
                    'delivered',
                ].includes(box.status),
            );
        const isCancelled =
            booking.boxes.length > 0 &&
            booking.boxes.every((box: any) => box.status === 'cancelled');

        return { ...booking, distance, isCompleted, isCancelled };
    });

    // Sort by proximity when in progress and GPS available
    const sortedBookings =
        isInProgress && userLocation
            ? [...enrichedBookings].sort((a, b) => {
                  // Completed/cancelled go to bottom
                  if (a.isCompleted !== b.isCompleted) {
                      return a.isCompleted ? 1 : -1;
                  }

                  if (a.isCancelled !== b.isCancelled) {
                      return a.isCancelled ? 1 : -1;
                  }

                  return a.distance - b.distance;
              })
            : enrichedBookings;

    // Find next pickup stop (nearest incomplete)
    const nextStop = sortedBookings.find(
        (b: any) => !b.isCompleted && !b.isCancelled,
    );
    const nextStopLat = Number(nextStop?.sender?.latitude);
    const nextStopLng = Number(nextStop?.sender?.longitude);
    const nextStopHasCoords =
        nextStopLat &&
        nextStopLng &&
        !isNaN(nextStopLat) &&
        !isNaN(nextStopLng);

    // Map markers for PickerRunsheetMap (in_progress mode)
    const pickerMapMarkers: PickerMapMarkerData[] = sortedBookings
        .map((booking: any, idx: number) => {
            const lat = Number(booking.sender?.latitude);
            const lng = Number(booking.sender?.longitude);

            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                return null;
            }

            let markerStatus: PickerMapMarkerData['status'] = 'pending';

            if (booking.isCancelled) {
                markerStatus = 'cancelled';
            } else if (booking.isCompleted) {
                markerStatus = 'completed';
            } else if (isInProgress) {
                markerStatus = 'in_progress';
            }

            return {
                id: booking.id,
                lat,
                lng,
                title: `${booking.sender?.first_name} ${booking.sender?.last_name}`,
                subtitle: booking.sender?.address,
                status: markerStatus,
                reference_number: booking.reference_number,
                boxesCount: booking.boxes?.length || 0,
                bookingsCount: 1,
                distance:
                    booking.distance < 999999 ? booking.distance : undefined,
                stopIndex: idx + 1,
            };
        })
        .filter(Boolean) as PickerMapMarkerData[];

    // Map markers for basic RunsheetMap (assigned mode)
    const basicMapMarkers: MapMarkerData[] = runsheet.bookings
        .map((booking: any) => {
            const isCompleted =
                booking.boxes.length > 0 &&
                booking.boxes.every((box: any) =>
                    [
                        'received_by_branch',
                        'loaded_to_container',
                        'in_transit',
                        'arrived',
                        'out_for_delivery',
                        'delivered',
                    ].includes(box.status),
                );
            const isCancelled =
                booking.boxes.length > 0 &&
                booking.boxes.every((box: any) => box.status === 'cancelled');
            let status: MapMarkerData['status'] = 'pending';

            if (isCancelled) {
                status = 'cancelled';
            } else if (isCompleted) {
                status = 'completed';
            }

            return {
                id: booking.id,
                lat: Number(booking.sender?.latitude) || 0,
                lng: Number(booking.sender?.longitude) || 0,
                title: `${booking.sender?.first_name} ${booking.sender?.last_name}`,
                subtitle: booking.sender?.address,
                status,
                reference_number: booking.reference_number,
            };
        })
        .filter(
            (m: MapMarkerData) =>
                m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng),
        );

    const isReadyToComplete =
        allBoxes.length > 0 &&
        allBoxes.every((box: any) =>
            terminalStatusesForPickup.includes(box.status),
        );

    const statusCounts = allBoxes.reduce(
        (acc: Record<string, number>, box: any) => {
            acc[box.status] = (acc[box.status] || 0) + 1;

            return acc;
        },
        {} as Record<string, number>,
    );

    const handleRecordPayment = (booking: any) => {
        if (!isOnline) {
            toast.error('Reconnect before recording payment.');

            return;
        }

        router.get(`/picker/runsheet/${runsheet.id}/payment/${booking.id}`);
    };

    const toggleSelectedBox = (boxId: number) => {
        setSelectedBoxIds((current) =>
            current.includes(boxId)
                ? current.filter((id) => id !== boxId)
                : [...current, boxId],
        );
    };

    const collectSelectedBoxes = () => {
        if (!isOnline || selectedBoxIds.length === 0) {
            return;
        }

        setCollectModalOpen(true);
    };

    // Build StartRunModal stop data
    const modalStops: StartRunStop[] = runsheet.bookings
        .map((booking: any) => {
            const lat = Number(booking.sender?.latitude);
            const lng = Number(booking.sender?.longitude);

            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                return null;
            }

            return {
                id: booking.id,
                lat,
                lng,
                senderName:
                    `${booking.sender?.first_name || ''} ${booking.sender?.last_name || ''}`.trim(),
                address: booking.sender?.address || booking.destination || '',
                boxCount: booking.boxes?.length || 0,
                bookingRef: booking.reference_number,
            };
        })
        .filter(Boolean) as StartRunStop[];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            {!isOnline && (
                <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-xs font-bold text-white">
                    <WifiOff className="size-4" />
                    Offline mode: this runsheet remains viewable, but collection
                    and payment actions are paused.
                </div>
            )}
            <Head title={`Runsheet — ${runsheet.area_description}`} />

            {/* Start Run Confirmation Modal */}
            <StartRunModal
                open={startModalOpen}
                onClose={() => setStartModalOpen(false)}
                onConfirm={handleStartRun}
                confirming={startingRun}
                stops={modalStops}
                runsheetName={runsheet.area_description}
                scheduledDate={runsheet.scheduled_date}
                totalBoxes={allBoxes.length}
            />

            <CollectBoxesModal
                open={collectModalOpen}
                onClose={() => {
                    setCollectModalOpen(false);
                    setSelectedBoxIds([]); // Clear selection on successful collection
                }}
                boxes={allBoxes.filter((b: any) => selectedBoxIds.includes(b.id))}
                runsheetId={runsheet.id}
            />

            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-6 pb-24 lg:p-10">
                {/* Header */}
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link
                            href="/picker/runsheets"
                            className="mb-3 inline-flex items-center text-sm font-bold tracking-widest text-brand-secondary uppercase transition-colors hover:text-brand-navy"
                        >
                            ← Back to Runsheets
                        </Link>
                        <h2 className="flex items-center gap-3 font-serif text-3xl font-bold tracking-tight text-brand-text">
                            <Truck className="size-8 text-brand-secondary" />
                            {runsheet.area_description}
                        </h2>
                        <p className="mt-1 text-brand-text-mid">
                            Scheduled for{' '}
                            <span className="font-semibold text-brand-text">
                                {new Date(
                                    runsheet.scheduled_date,
                                ).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}
                            </span>
                        </p>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:items-end">
                        <span
                            className={`inline-block rounded-full px-4 py-1.5 text-xs font-bold tracking-widest uppercase shadow-sm ${
                                runsheet.status === 'in_progress'
                                    ? 'bg-amber-100 text-amber-800'
                                    : runsheet.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-brand-warm text-brand-navy'
                            }`}
                        >
                            {humanize(runsheet.status)}
                        </span>

                        {runsheet.status === 'assigned' && (
                            <button
                                onClick={() => setStartModalOpen(true)}
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
                                    onClick={() =>
                                        router.post(
                                            `/picker/runsheet/${runsheet.id}/complete`,
                                        )
                                    }
                                    className={`btn-navy flex items-center gap-2 px-6 py-2.5 shadow-lg transition-all ${
                                        !isReadyToComplete
                                            ? 'cursor-not-allowed opacity-50 grayscale'
                                            : 'active:scale-95'
                                    }`}
                                >
                                    <CheckCircle className="size-5" />
                                    Complete Run
                                </button>
                                {!isReadyToComplete && (
                                    <p className="animate-pulse text-right text-[10px] font-bold tracking-widest text-red-600 uppercase">
                                        All boxes must be Received by Warehouse
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Summary */}
                {allBoxes.length > 0 && (
                    <div className="grid grid-cols-3 gap-2.5 sm:flex sm:flex-wrap">
                        {Object.entries(statusConfig)
                            .filter(
                                ([key]) =>
                                    [
                                        'pending',
                                        'collected',
                                        'cancelled',
                                    ].includes(key) ||
                                    (statusCounts[key] || 0) > 0,
                            )
                            .map(([key, config]) => {
                                const StatusIcon = config.icon;

                                return (
                                    <div
                                        key={key}
                                        className={`card flex min-w-0 sm:min-w-32.5 flex-1 flex-col items-center justify-center p-3 sm:p-4 text-center transition-transform hover:scale-105 ${
                                            statusCounts[key] > 0
                                                ? 'bg-white opacity-100'
                                                : 'bg-brand-warm/30 opacity-60'
                                        }`}
                                    >
                                        <div
                                            className={`mb-2 rounded-full p-2 ${config.style.split(' ')[1]} ${config.style.split(' ')[2]}`}
                                        >
                                            <StatusIcon className="size-4" />
                                        </div>
                                        <div className="text-xl sm:text-2xl font-bold text-brand-text">
                                            {statusCounts[key] || 0}
                                        </div>
                                        <div className="text-[9px] sm:text-[10px] font-bold tracking-widest text-brand-text-light uppercase">
                                            {config.label}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}

                <div className="relative">
                    <div
                        className="absolute inset-0 flex items-center"
                        aria-hidden="true"
                    >
                        <div className="w-full border-t border-brand-warm"></div>
                    </div>
                </div>

                {/* Map Section — GPS-aware when in progress */}
                <div className="mb-2">
                    {isInProgress ? (
                        /* Enhanced GPS-aware map for driving mode */
                        runsheet.bookings.length > 0 &&
                        runsheet.bookings.some(
                            (b: any) =>
                                b.sender?.latitude && b.sender?.longitude,
                        ) ? (
                            <div className="relative h-80 w-full overflow-hidden rounded-2xl border border-brand-warm/50 shadow-sm">
                                <PickerRunsheetMap
                                    markers={pickerMapMarkers}
                                    userLocation={
                                        userLocation
                                            ? {
                                                  lat: userLocation.lat,
                                                  lng: userLocation.lng,
                                              }
                                            : null
                                    }
                                    userAccuracy={
                                        userLocation?.accuracy ?? null
                                    }
                                    isDemo={false}
                                    activeCenter={activeCenter}
                                    selectedMarkerId={selectedMarkerId}
                                    onMarkerClick={handleMarkerClick}
                                    onCenterOnUser={handleCenterOnUser}
                                />
                            </div>
                        ) : (
                            <div className="flex h-80 w-full items-center justify-center rounded-2xl border-2 border-dashed border-brand-warm/50 bg-brand-warm/10">
                                <div className="p-6 text-center text-brand-text-mid">
                                    <MapPin className="mx-auto mb-3 size-12 text-brand-sand" />
                                    <p className="mb-1 text-base font-semibold">
                                        Map Unavailable
                                    </p>
                                    <p className="text-sm">
                                        Sender addresses need to be geocoded
                                        with coordinates.
                                    </p>
                                    <p className="mt-2 text-xs text-brand-text-light">
                                        Contact admin to update sender
                                        locations.
                                    </p>
                                </div>
                            </div>
                        )
                    ) : /* Basic map for assigned/completed status */
                    runsheet.bookings.length > 0 &&
                      runsheet.bookings.some(
                          (b: any) => b.sender?.latitude && b.sender?.longitude,
                      ) ? (
                        <RunsheetMap markers={basicMapMarkers} />
                    ) : (
                        <div className="flex h-80 w-full items-center justify-center rounded-2xl border-2 border-dashed border-brand-warm/50 bg-brand-warm/10">
                            <div className="p-6 text-center text-brand-text-mid">
                                <MapPin className="mx-auto mb-3 size-12 text-brand-sand" />
                                <p className="mb-1 text-base font-semibold">
                                    Map Unavailable
                                </p>
                                <p className="text-sm">
                                    Sender addresses need to be geocoded with
                                    coordinates.
                                </p>
                                <p className="mt-2 text-xs text-brand-text-light">
                                    Contact admin to update sender locations.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation HUD — only shown when in progress */}
                {isInProgress && nextStop && (
                    <div className="overflow-hidden rounded-2xl border border-brand-navy/20 bg-brand-navy text-white shadow-xl">
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
                                <p className="text-[9px] font-bold tracking-widest text-white/50 uppercase">
                                    Next Pickup Stop
                                </p>
                                <p className="truncate text-sm font-bold">
                                    {nextStop.sender?.first_name}{' '}
                                    {nextStop.sender?.last_name}
                                </p>
                                <p className="truncate text-xs text-white/60">
                                    {nextStop.sender?.address ||
                                        nextStop.destination}
                                </p>
                            </div>

                            {/* Distance */}
                            <div className="shrink-0 text-right">
                                {nextStop.distance < 999999 && (
                                    <>
                                        <p className="text-lg font-black text-brand-secondary">
                                            {formatDistance(nextStop.distance)}
                                        </p>
                                        <p className="text-[9px] font-bold tracking-widest text-white/40 uppercase">
                                            away
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Navigate button */}
                            {nextStopHasCoords && (
                                <a
                                    href={googleMapsDirectionsUrl(
                                        userLocation,
                                        { lat: nextStopLat, lng: nextStopLng },
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-[10px] font-bold tracking-widest text-white uppercase shadow-lg transition-all hover:bg-brand-rust active:scale-95"
                                >
                                    <Navigation className="size-4" />
                                    Navigate
                                </a>
                            )}
                        </div>

                        {/* GPS status mini-bar */}
                        <div className="flex items-center gap-2 border-t border-white/10 bg-white/5 px-5 py-2">
                            <span className="relative flex size-1.5">
                                <span
                                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${userLocation ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                />
                                <span
                                    className={`relative inline-flex size-1.5 rounded-full ${userLocation ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                />
                            </span>
                            <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">
                                {userLocation
                                    ? `GPS Active${userLocation.accuracy ? ` · ±${Math.round(userLocation.accuracy)} m` : ''}`
                                    : 'Acquiring GPS…'}
                            </span>
                            {isInProgress && userLocation && (
                                <span className="ml-auto text-[9px] font-bold tracking-widest text-white/30 uppercase">
                                    Sorted by nearest stop
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-brand-text">
                        <Package className="size-6 text-brand-secondary" />
                        Boxes in this Run
                        <span className="ml-2 rounded-full bg-brand-warm px-2.5 py-0.5 text-sm font-bold text-brand-navy">
                            {allBoxes.length}
                        </span>
                    </h3>
                    <div className="hidden sm:flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            disabled={
                                !isOnline ||
                                selectedBoxIds.length === 0
                            }
                            onClick={collectSelectedBoxes}
                            className="btn-primary px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Collect selected ({selectedBoxIds.length})
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {runsheet.bookings?.length === 0 ? (
                        <div className="card border-2 border-dashed py-16 text-center lg:col-span-2">
                            <Package className="mx-auto mb-4 size-12 text-brand-sand" />
                            <p className="font-serif text-lg font-medium text-brand-text-mid">
                                No boxes assigned yet
                            </p>
                            <p className="mt-1 text-sm tracking-wider text-brand-text-light uppercase">
                                Boxes will appear here once allocated
                            </p>
                        </div>
                    ) : (
                        sortedBookings.map(
                            (booking: any, bookingIndex: number) => {
                                const totalAmount =
                                    booking.boxes?.reduce(
                                        (sum: number, b: any) =>
                                            sum +
                                            parseFloat(b.price_charged || 0),
                                        0,
                                    ) || 0;

                                const senderLat = Number(
                                    booking.sender?.latitude,
                                );
                                const senderLng = Number(
                                    booking.sender?.longitude,
                                );
                                const hasCoords =
                                    senderLat &&
                                    senderLng &&
                                    !isNaN(senderLat) &&
                                    !isNaN(senderLng);
                                const isNext =
                                    nextStop && booking.id === nextStop.id;

                                return (
                                    <div
                                        key={`booking-${booking.id}`}
                                        className={`card relative flex flex-col overflow-hidden transition-all ${
                                            isNext && isInProgress
                                                ? 'border-brand-primary shadow-md ring-2 ring-brand-primary/20'
                                                : booking.payment_status ===
                                                    'cash_on_pickup'
                                                  ? 'border-amber-200 shadow-sm'
                                                  : 'hover:bg-brand-warm/10'
                                        } ${booking.isCompleted ? 'opacity-60' : ''} ${booking.isCancelled ? 'opacity-40 grayscale' : ''}`}
                                    >
                                        {/* Next stop badge */}
                                        {isNext && isInProgress && (
                                            <div className="flex items-center gap-2 bg-brand-primary px-4 py-2 text-[10px] font-black tracking-widest text-white uppercase">
                                                <Navigation className="size-3.5 animate-pulse" />
                                                Next Stop —{' '}
                                                {booking.distance < 999999
                                                    ? formatDistance(
                                                          booking.distance,
                                                      ) + ' away'
                                                    : 'Distance unknown'}
                                            </div>
                                        )}

                                        <div className="flex flex-col items-start justify-between gap-4 border-b border-brand-warm/50 bg-brand-warm/20 p-5 sm:flex-row sm:items-center sm:gap-0">
                                            <div className="flex w-full items-start gap-4 sm:flex-1">
                                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-secondary/10 font-mono text-xs font-black text-brand-secondary">
                                                    {bookingIndex + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-serif text-xl font-bold text-brand-text">
                                                        {
                                                            booking.sender
                                                                ?.first_name
                                                        }{' '}
                                                        {
                                                            booking.sender
                                                                ?.last_name
                                                        }
                                                    </h4>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-brand-text-mid">
                                                        <MapPin className="size-4 text-brand-primary" />
                                                        <span>
                                                            {
                                                                booking.destination
                                                            }
                                                        </span>
                                                        <span className="mx-1 text-brand-sand">
                                                            •
                                                        </span>
                                                        <span className="text-xs font-bold tracking-widest text-brand-text-light uppercase">
                                                            Ref:{' '}
                                                            {
                                                                booking.reference_number
                                                            }
                                                        </span>
                                                        <span className="mx-1 text-brand-sand">
                                                            •
                                                        </span>
                                                        {booking.payment_status ===
                                                        'paid' ? (
                                                            <span className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-emerald-800 uppercase">
                                                                PAID
                                                            </span>
                                                        ) : booking.payment_status ===
                                                          'cash_collected' ? (
                                                            <span className="flex items-center gap-1 rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-teal-800 uppercase">
                                                                CASH PENDING
                                                            </span>
                                                        ) : booking.payment_status ===
                                                          'cash_on_pickup' ? (
                                                            <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-amber-800 uppercase">
                                                                CASH DUE
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-red-800 uppercase">
                                                                UNPAID
                                                            </span>
                                                        )}
                                                        <span className="mx-1 text-brand-sand">
                                                            •
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            {booking.declaration_form_status ===
                                                            'missing' ? (
                                                                <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                                                                    NO
                                                                    DECLARATION
                                                                </span>
                                                            ) : (
                                                                <a
                                                                    href={`/track/declaration/${booking.id}/view`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-blue-800 uppercase transition-colors hover:bg-blue-200"
                                                                >
                                                                    <FileText className="size-3" />
                                                                    VIEW
                                                                    DECLARATION
                                                                </a>
                                                            )}

                                                            {booking.invoice && (
                                                                <Link
                                                                    href={`/admin/invoices/${booking.invoice.id}`}
                                                                    className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-emerald-800 uppercase transition-colors hover:bg-emerald-200"
                                                                >
                                                                    <FileText className="size-3" />
                                                                    INVOICE
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action buttons: Navigate + Call + SMS */}
                                            <div className="mt-3 flex w-full flex-row items-center gap-2 sm:mt-0 sm:ml-3 sm:w-auto sm:shrink-0 sm:flex-col sm:items-stretch sm:gap-1.5">
                                                {isInProgress && hasCoords && (
                                                    <a
                                                        href={googleMapsDirectionsUrl(
                                                            userLocation,
                                                            {
                                                                lat: senderLat,
                                                                lng: senderLng,
                                                            },
                                                        )}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-3 py-2.5 text-[9px] font-bold tracking-widest text-white uppercase shadow-sm transition-all hover:bg-brand-rust active:scale-95 sm:flex-initial"
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    >
                                                        <Navigation className="size-3.5" />
                                                        Navigate
                                                    </a>
                                                )}
                                                {booking.sender?.mobile &&
                                                    (() => {
                                                        const mobile =
                                                            booking.sender.mobile.replace(
                                                                /[^\d+]/g,
                                                                '',
                                                            );

                                                        return (
                                                            <>
                                                                <a
                                                                    href={`tel:${mobile}`}
                                                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-[9px] font-bold tracking-widest text-white uppercase shadow-sm transition-all hover:bg-emerald-700 active:scale-95 sm:flex-initial"
                                                                    onClick={(
                                                                        e,
                                                                    ) =>
                                                                        e.stopPropagation()
                                                                    }
                                                                >
                                                                    <Phone className="size-3.5" />
                                                                    Call
                                                                </a>
                                                                <a
                                                                    href={`sms:${mobile}`}
                                                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-[9px] font-bold tracking-widest text-white uppercase shadow-sm transition-all hover:bg-blue-700 active:scale-95 sm:flex-initial"
                                                                    onClick={(
                                                                        e,
                                                                    ) =>
                                                                        e.stopPropagation()
                                                                    }
                                                                >
                                                                    <MessageCircle className="size-3.5" />
                                                                    SMS
                                                                </a>
                                                            </>
                                                        );
                                                    })()}
                                            </div>
                                        </div>

                                        <div className="flex flex-1 flex-col divide-y divide-brand-warm/50">
                                            {booking.boxes?.map((box: any) => {
                                                const config =
                                                    statusConfig[box.status] ||
                                                    statusConfig.pending;
                                                const StatusIcon = config.icon;
                                                const canBatchCollect =
                                                    box.status === 'pending' &&
                                                    ['paid', 'cash_collected'].includes(booking.payment_status) &&
                                                    booking.declaration_form_status !==
                                                        'missing';

                                                return (
                                                    <Link
                                                        key={box.id}
                                                        href={`/picker/box/${box.tracking_number}`}
                                                        className="group flex items-center justify-between p-4 transition-colors hover:bg-brand-warm/30"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedBoxIds.includes(
                                                                    box.id,
                                                                )}
                                                                disabled={
                                                                    !canBatchCollect ||
                                                                    !isOnline
                                                                }
                                                                onClick={(
                                                                    event,
                                                                ) =>
                                                                    event.stopPropagation()
                                                                }
                                                                onChange={() =>
                                                                    toggleSelectedBox(
                                                                        box.id,
                                                                    )
                                                                }
                                                                title={
                                                                    canBatchCollect
                                                                        ? 'Select for batch collection'
                                                                        : 'Requires pending status, payment, and declaration'
                                                                }
                                                                className="size-4 rounded border-brand-sand text-brand-primary disabled:opacity-30"
                                                            />
                                                            <div className="inline-flex items-center rounded-lg border border-brand-warm/50 bg-white px-2.5 py-1.5 font-mono text-xs font-bold tracking-widest text-brand-navy shadow-xs">
                                                                {
                                                                    box.tracking_number
                                                                }
                                                            </div>

                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            <span
                                                                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-widest uppercase shadow-sm ${config.style}`}
                                                            >
                                                                <StatusIcon className="size-3" />
                                                                {config.label}
                                                            </span>
                                                            <div className="text-brand-secondary opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">
                                                                <PlayCircle className="size-5" />
                                                            </div>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>

                                        {!['paid', 'cash_collected'].includes(booking.payment_status) && (
                                            <div className="mt-auto flex items-center justify-between border-t border-amber-100/50 bg-amber-50/50 p-4">
                                                <div>
                                                    <div className="text-[10px] font-bold tracking-widest text-amber-800/70 uppercase">
                                                        {booking.payment_status ===
                                                        'cash_on_pickup'
                                                            ? 'Payment Required on Pickup'
                                                            : 'Payment Outstanding'}
                                                    </div>
                                                    <div className="text-lg font-black text-amber-900">
                                                        $
                                                        {totalAmount.toFixed(2)}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleRecordPayment(
                                                            booking,
                                                        );
                                                    }}
                                                    className="btn-primary flex items-center gap-2 bg-emerald-600 px-5 py-2.5 text-xs font-bold tracking-widest text-white uppercase shadow-md transition-all hover:bg-emerald-700 active:scale-95"
                                                >
                                                    <CheckCircle className="size-4" />
                                                    {booking.payment_status ===
                                                    'cash_on_pickup'
                                                        ? 'Cash Collected'
                                                        : 'Record Payment'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            },
                        )
                    )}
                </div>
            </div>

            {/* Sticky Bottom Batch Actions (Mobile/Desktop) */}
            {selectedBoxIds.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-brand-warm bg-white/95 px-6 py-4 shadow-2xl backdrop-blur-md dark:border-brand-sand/15 dark:bg-brand-navy/95 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 sm:rounded-2xl sm:border animate-fade-in">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-brand-text-light dark:text-white/60">
                                Selected: {selectedBoxIds.length} {selectedBoxIds.length === 1 ? 'Box' : 'Boxes'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedBoxIds([])}
                                className="text-xs font-bold uppercase tracking-widest text-red-600 hover:text-red-500"
                            >
                                Clear
                            </button>
                        </div>
                        
                        <button
                            type="button"
                            disabled={!isOnline}
                            onClick={collectSelectedBoxes}
                            className="btn-primary w-full px-4 py-3 text-xs font-bold tracking-widest uppercase disabled:opacity-40"
                        >
                            Collect Selected
                        </button>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
