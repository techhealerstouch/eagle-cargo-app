import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowUpCircle,
    Banknote,
    Camera,
    CheckCircle,
    CheckSquare,
    Clock,
    Compass,
    CreditCard,
    ExternalLink,
    FileText,
    MapPin,
    MessageCircle,
    Navigation,
    Package,
    Phone,
    PlayCircle,
    QrCode,
    Sparkles,
    Square,
    Truck,
    Warehouse,
    WifiOff,
    Sun,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PickerMapMarkerData } from '@/components/ui/PickerRunsheetMap';
import PickerRunsheetMap from '@/components/ui/PickerRunsheetMap';
import type { MapMarkerData } from '@/components/ui/RunsheetMap';
import RunsheetMap from '@/components/ui/RunsheetMap';
import StartRunModal from '@/components/ui/StartRunModal';
import CollectBoxesModal from '@/components/ui/CollectBoxesModal';
import WarehouseDropModal from '@/components/picker/WarehouseDropModal';
import type { StartRunStop } from '@/components/ui/StartRunModal';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';
import { buildOsmDirectionsUrl, geocodeWithNominatim } from '@/lib/nominatim';

import type { BreadcrumbItem } from '@/types';

const statusConfig: Record<
    string,
    { label: string; style: string; icon: any }
> = {
    pending: {
        label: 'Pending',
        style: 'border-amber-400 bg-amber-100 text-amber-950 font-black dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200',
        icon: Clock,
    },
    collected: {
        label: 'Collected',
        style: 'border-indigo-400 bg-indigo-100 text-indigo-950 font-black dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200',
        icon: ArrowUpCircle,
    },
    received_by_branch: {
        label: 'At Warehouse',
        style: 'border-blue-400 bg-blue-100 text-blue-950 font-black dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-200',
        icon: Warehouse,
    },
    in_transit: {
        label: 'In Transit',
        style: 'border-purple-400 bg-purple-100 text-purple-950 font-black dark:border-purple-700 dark:bg-purple-950/60 dark:text-purple-200',
        icon: Truck,
    },
    delivered: {
        label: 'Delivered',
        style: 'border-emerald-400 bg-emerald-100 text-emerald-950 font-black dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200',
        icon: CheckCircle,
    },
    arrived: {
        label: 'Arrived',
        style: 'border-cyan-400 bg-cyan-100 text-cyan-950 font-black dark:border-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200',
        icon: MapPin,
    },
    cancelled: {
        label: 'Cancelled',
        style: 'border-rose-400 bg-rose-100 text-rose-950 font-black dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200',
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

const isDateInFuture = (dateVal?: string | null): boolean => {
    if (!dateVal) return false;
    const clean = dateVal.split('T')[0].split(' ')[0];
    const today = new Date().toLocaleDateString('en-CA');
    return clean > today;
};

const formatPickupDate = (dateVal?: string | null): string => {
    if (!dateVal) return '';
    const clean = dateVal.split('T')[0].split(' ')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
        const d = new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2]),
        );
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
        });
    }
    return dateVal;
};

const formatPaymentMethod = (method?: string | null): string => {
    if (!method) return '';
    const labels: Record<string, string> = {
        cash_on_pickup: 'Cash on Pickup',
        cash: 'Cash on Pickup',
        bank_transfer: 'Bank Transfer',
        stripe: 'Card (Stripe)',
        stripe_card: 'Card (Stripe)',
        pay_id: 'PayID',
        payid: 'PayID',
        square: 'Square',
        afterpay: 'Afterpay',
        cheque: 'Cheque',
    };
    return (
        labels[method.toLowerCase()] ||
        method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    );
};

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

/** Build a Waze driving directions URL */
const wazeDirectionsUrl = (destination: { lat: number; lng: number }) => {
    return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
};

export default function RunsheetDetail({ runsheet }: { runsheet: any }) {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true,
    );
    const [isOutdoorMode, setIsOutdoorMode] = useState(false);
    const [selectedBoxIds, setSelectedBoxIds] = useState<number[]>([]);
    const [collectModalOpen, setCollectModalOpen] = useState(false);
    const [warehouseDropModalOpen, setWarehouseDropModalOpen] = useState(false);
    const [dynamicCoords, setDynamicCoords] = useState<
        Record<number, { lat: number; lng: number }>
    >({});
    const [pickupNotes, setPickupNotes] = useState<Record<number, string>>({});
    const [submittingNoteFor, setSubmittingNoteFor] = useState<number | null>(
        null,
    );

    const submitPickupNote = (bookingId: number) => {
        const note = pickupNotes[bookingId]?.trim();
        if (!note) {
            toast.error('Enter a note before sending it to dispatch.');
            return;
        }

        setSubmittingNoteFor(bookingId);
        router.post(
            `/picker/runsheet/${runsheet.id}/notes`,
            { booking_id: bookingId, note },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setPickupNotes((current) => ({
                        ...current,
                        [bookingId]: '',
                    }));
                    toast.success('Pickup note sent to dispatch.');
                },
                onError: (errors) =>
                    toast.error(
                        errors.note ??
                            errors.booking_id ??
                            'Unable to send pickup note.',
                    ),
                onFinish: () => setSubmittingNoteFor(null),
            },
        );
    };

    // Automatically geocode missing sender addresses using free OpenStreetMap Nominatim
    useEffect(() => {
        let isMounted = true;
        const geocodeMissing = async () => {
            for (const booking of runsheet.bookings || []) {
                const s = booking.sender;
                const hasLat = Number(s?.latitude);
                const hasLng = Number(s?.longitude);
                if (
                    (!hasLat || !hasLng || isNaN(hasLat) || isNaN(hasLng)) &&
                    s &&
                    !dynamicCoords[booking.id]
                ) {
                    const addressParts = [
                        s.address,
                        s.suburb,
                        s.city,
                        s.state,
                        s.country || 'Australia',
                    ]
                        .filter(Boolean)
                        .join(', ');

                    if (addressParts) {
                        const res = await geocodeWithNominatim(addressParts);
                        if (res && isMounted) {
                            setDynamicCoords((prev) => ({
                                ...prev,
                                [booking.id]: { lat: res.lat, lng: res.lng },
                            }));
                        }
                    }
                }
            }
        };

        geocodeMissing();
        return () => {
            isMounted = false;
        };
    }, [runsheet.bookings]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            router.reload({ only: ['runsheet'] });
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
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
    const nextStopLat =
        Number(nextStop?.sender?.latitude) ||
        (nextStop ? dynamicCoords[nextStop.id]?.lat : null);
    const nextStopLng =
        Number(nextStop?.sender?.longitude) ||
        (nextStop ? dynamicCoords[nextStop.id]?.lng : null);
    const nextStopHasCoords = Boolean(
        nextStopLat &&
        nextStopLng &&
        !isNaN(nextStopLat) &&
        !isNaN(nextStopLng),
    );

    // Map markers for PickerRunsheetMap (in_progress mode)
    const pickerMapMarkers: PickerMapMarkerData[] = sortedBookings
        .map((booking: any, idx: number) => {
            const lat =
                Number(booking.sender?.latitude) ||
                dynamicCoords[booking.id]?.lat;
            const lng =
                Number(booking.sender?.longitude) ||
                dynamicCoords[booking.id]?.lng;

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

            const lat =
                Number(booking.sender?.latitude) ||
                dynamicCoords[booking.id]?.lat ||
                0;
            const lng =
                Number(booking.sender?.longitude) ||
                dynamicCoords[booking.id]?.lng ||
                0;

            return {
                id: booking.id,
                lat,
                lng,
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

    const collectedBoxesCount = allBoxes.filter((b: any) => b.status === 'collected').length;
    const hasDropInitiated = Boolean(runsheet.warehouse_drop_initiated_at);

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

        const isBeforeScheduled = Boolean(
            booking.is_before_scheduled_date ||
            (booking.payment_status === 'cash_on_pickup' &&
                isDateInFuture(
                    booking.preferred_date || runsheet.scheduled_date,
                )),
        );

        if (isBeforeScheduled) {
            const dateStr =
                booking.scheduled_pickup_date_formatted ||
                formatPickupDate(
                    booking.preferred_date || runsheet.scheduled_date,
                );
            toast.error(
                `Cash on pickup cannot be collected before the scheduled pickup date (${dateStr}).`,
            );
            return;
        }

        router.get(`/picker/runsheet/${runsheet.id}/payment/${booking.id}`);
    };

    const getEligibleBoxIdsForBooking = (booking: any): number[] => {
        return (booking.boxes || [])
            .filter((box: any) => {
                return (
                    box.status === 'pending' &&
                    ['paid', 'cash_collected'].includes(
                        booking.payment_status,
                    ) &&
                    booking.declaration_form_status !== 'missing'
                );
            })
            .map((b: any) => b.id);
    };

    const toggleAllBookingBoxes = (booking: any) => {
        const eligibleBoxIds = getEligibleBoxIdsForBooking(booking);

        if (eligibleBoxIds.length === 0) return;

        const allSelected = eligibleBoxIds.every((id: number) =>
            selectedBoxIds.includes(id),
        );

        if (allSelected) {
            setSelectedBoxIds((current) =>
                current.filter((id) => !eligibleBoxIds.includes(id)),
            );
        } else {
            setSelectedBoxIds((current) =>
                Array.from(new Set([...current, ...eligibleBoxIds])),
            );
        }
    };

    const toggleSelectedBox = (boxId: number) => {
        setSelectedBoxIds((current) =>
            current.includes(boxId)
                ? current.filter((id) => id !== boxId)
                : [...current, boxId],
        );
    };

    const collectSelectedBoxes = () => {
        if (selectedBoxIds.length === 0) {
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
            <Head title={`Runsheet ${runsheet.runsheet_number} | Picker`} />

            <div
                className={`space-y-6 p-4 pb-28 sm:p-6 md:pb-8 lg:p-8 ${isOutdoorMode ? 'outdoor-contrast' : ''}`}
            >
                {!isOnline && (
                    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-xs font-bold text-white">
                        <WifiOff className="size-4" />
                        Offline mode: this runsheet remains viewable, but
                        collection and payment actions are paused.
                    </div>
                )}

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
                    boxes={allBoxes.filter((b: any) =>
                        selectedBoxIds.includes(b.id),
                    )}
                    runsheetId={runsheet.id}
                />

                <WarehouseDropModal
                    open={warehouseDropModalOpen}
                    onClose={() => setWarehouseDropModalOpen(false)}
                    runsheetId={runsheet.id}
                    runsheetNumber={runsheet.runsheet_number}
                    collectedCount={collectedBoxesCount}
                    totalStopsCount={enrichedBookings.filter((b: any) => b.isCompleted).length}
                />

                {/* Header with quick stats & Outdoor Mode */}
                <div className="flex flex-col gap-4 border-b border-brand-sand/60 pb-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="eyebrow">Driver Run</span>
                            <span className="font-mono text-xs text-brand-text-mid dark:text-white/60">
                                {runsheet.runsheet_number}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsOutdoorMode(!isOutdoorMode)}
                                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                                    isOutdoorMode
                                        ? 'border-2 border-black bg-amber-400 font-black text-black shadow-md'
                                        : 'border border-border bg-brand-warm/60 text-brand-text-mid hover:bg-brand-warm'
                                }`}
                                title="Toggle High-Contrast Sunlight Mode for Outdoor Field Operations"
                            >
                                <Sun className="size-3.5" />
                                <span>
                                    {isOutdoorMode
                                        ? 'Sunlight Mode ON'
                                        : 'Sunlight Mode'}
                                </span>
                            </button>
                        </div>
                        <h2 className="mt-2 flex items-center gap-3 font-serif text-3xl font-bold tracking-tight text-brand-text">
                            <Truck className="size-8 text-brand-secondary" />
                            {runsheet.area_description}
                        </h2>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:items-end">
                        <Link
                            id="btn-runsheet-message-dispatch"
                            href={`/picker/messages?runsheet_id=${runsheet.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-brand-sand/80 bg-white px-3.5 py-1.5 text-xs font-bold text-brand-text shadow-xs hover:bg-brand-warm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 transition-colors"
                        >
                            <MessageCircle className="size-3.5 text-brand-primary" />
                            <span>Message Dispatch</span>
                        </Link>

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
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Warehouse Drop-off Button */}
                                    {!hasDropInitiated && collectedBoxesCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setWarehouseDropModalOpen(true)}
                                            className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95"
                                        >
                                            <Warehouse className="size-4" />
                                            <span>Drop Off at Warehouse</span>
                                        </button>
                                    )}

                                    {/* If drop already initiated */}
                                    {hasDropInitiated && !isReadyToComplete && (
                                        <div className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-900 shadow-2xs dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                                            <Warehouse className="size-3.5 text-blue-600 dark:text-blue-400" />
                                            <span>Drop-Off Initialized ({runsheet.warehouse_drop_bay || 'Depot'})</span>
                                        </div>
                                    )}

                                    {/* Complete Run Button */}
                                    <button
                                        disabled={!isReadyToComplete}
                                        onClick={() =>
                                            router.post(
                                                `/picker/runsheet/${runsheet.id}/complete`,
                                            )
                                        }
                                        className={`btn-navy flex items-center gap-2 px-5 py-2 shadow-md transition-all ${
                                            !isReadyToComplete
                                                ? 'cursor-not-allowed opacity-50 grayscale'
                                                : 'active:scale-95'
                                        }`}
                                    >
                                        <CheckCircle className="size-4" />
                                        <span>Complete Run</span>
                                    </button>
                                </div>

                                {!isReadyToComplete && !hasDropInitiated && (
                                    <p className="text-right text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                                        Collect all stops, then drop off at warehouse
                                    </p>
                                )}
                                {!isReadyToComplete && hasDropInitiated && (
                                    <p className="animate-pulse text-right text-[10px] font-bold tracking-wide text-blue-700 dark:text-blue-400 uppercase">
                                        Awaiting warehouse staff intake verification
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Warehouse Drop-Off Initialized Banner */}
                {hasDropInitiated && runsheet.status !== 'completed' && (
                    <div className="flex flex-col gap-2 rounded-3xl border border-blue-200 bg-blue-50/90 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-blue-900/60 dark:bg-blue-950/30">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xs">
                                <Warehouse className="size-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-blue-950 dark:text-blue-100">
                                    Warehouse Drop-Off Initialized at {runsheet.warehouse_drop_bay || 'Depot'}
                                </h3>
                                <p className="mt-0.5 text-xs text-blue-800/80 dark:text-blue-300">
                                    Freight handed over to warehouse intake. Your shift is safely recorded while depot staff inspects and verifies the inventory.
                                </p>
                                {runsheet.warehouse_drop_notes && (
                                    <p className="mt-1 text-[11px] font-medium italic text-blue-700 dark:text-blue-400">
                                        Notes: "{runsheet.warehouse_drop_notes}"
                                    </p>
                                )}
                            </div>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-blue-300 bg-white px-3 py-1 text-[11px] font-black text-blue-800 uppercase tracking-wider dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200">
                            <Clock className="size-3.5" />
                            <span>Awaiting Intake Verification</span>
                        </span>
                    </div>
                )}

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
                                        className="card flex min-w-0 flex-1 flex-col items-center justify-center border border-brand-sand/40 bg-white p-3 text-center shadow-xs transition-transform hover:scale-105 sm:min-w-32.5 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900"
                                    >
                                        <div
                                            className={`mb-2 rounded-full border p-2 ${config.style}`}
                                        >
                                            <StatusIcon className="size-4" />
                                        </div>
                                        <div className="text-xl font-bold text-brand-text sm:text-2xl dark:text-white">
                                            {statusCounts[key] || 0}
                                        </div>
                                        <div className="text-[9px] font-bold tracking-widest text-brand-text-light uppercase sm:text-[10px] dark:text-zinc-400">
                                            {config.label}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}

                {/* Map Section — GPS-aware when in progress, route preview when assigned */}
                <div className="mb-2">
                    <div className="relative h-80 w-full overflow-hidden rounded-2xl border border-brand-warm/50 bg-slate-100 shadow-sm dark:bg-slate-900">
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
                            userAccuracy={userLocation?.accuracy ?? null}
                            isDemo={false}
                            activeCenter={activeCenter}
                            selectedMarkerId={selectedMarkerId}
                            onMarkerClick={handleMarkerClick}
                            onCenterOnUser={handleCenterOnUser}
                            showHud={false}
                        />
                        {pickerMapMarkers.length === 0 && (
                            <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center bg-black/40 p-6 text-center text-white backdrop-blur-xs">
                                <MapPin className="mb-2 size-8 animate-bounce text-brand-secondary" />
                                <p className="text-sm font-bold">
                                    Resolving Pickup Addresses on
                                    OpenStreetMap...
                                </p>
                                <p className="mt-1 max-w-sm text-xs text-white/80">
                                    Customer addresses are being geocoded
                                    automatically.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation HUD — only shown when in progress */}
                {isInProgress && nextStop && (
                    <div className="overflow-hidden rounded-2xl border border-brand-navy/20 bg-brand-navy text-white shadow-xl">
                        <div className="flex items-center gap-4 px-5 py-4">
                            <div className="relative flex size-10 shrink-0 items-center justify-center">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-primary opacity-40" />
                                <span className="relative flex size-5 items-center justify-center rounded-full bg-brand-primary">
                                    <Navigation className="size-3 text-white" />
                                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] font-bold tracking-widest text-white/50 uppercase">
                                    Next Pickup Stop
                                </p>
                                <p className="truncate text-sm font-bold">
                                    {nextStop.sender?.first_name}{' '}
                                    {nextStop.sender?.last_name}
                                </p>
                            </div>
                            {nextStopHasCoords && (
                                <div className="flex shrink-0 items-center gap-2">
                                    <a
                                        href={buildOsmDirectionsUrl(
                                            userLocation,
                                            {
                                                lat: nextStopLat!,
                                                lng: nextStopLng!,
                                            },
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-[10px] font-black tracking-widest text-white uppercase shadow-lg transition-all hover:bg-emerald-700 active:scale-95"
                                        title="Navigate via OpenStreetMap"
                                    >
                                        <Navigation className="size-3.5" />
                                        OSM Route
                                    </a>
                                    <a
                                        href={googleMapsDirectionsUrl(
                                            userLocation,
                                            {
                                                lat: nextStopLat!,
                                                lng: nextStopLng!,
                                            },
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hidden items-center gap-1.5 rounded-xl bg-brand-primary px-3 py-2.5 text-[10px] font-bold tracking-widest text-white uppercase shadow-lg transition-all hover:bg-brand-rust active:scale-95 sm:flex"
                                        title="Navigate via Google Maps"
                                    >
                                        Google Maps
                                    </a>
                                </div>
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
                    <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
                        <button
                            type="button"
                            disabled={!isOnline || selectedBoxIds.length === 0}
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

                                const senderLat =
                                    Number(booking.sender?.latitude) ||
                                    dynamicCoords[booking.id]?.lat;
                                const senderLng =
                                    Number(booking.sender?.longitude) ||
                                    dynamicCoords[booking.id]?.lng;
                                const hasCoords = Boolean(
                                    senderLat &&
                                    senderLng &&
                                    !isNaN(senderLat) &&
                                    !isNaN(senderLng),
                                );
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
                                        } ${booking.isCompleted ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/15' : ''} ${booking.isCancelled ? 'opacity-40 grayscale' : ''}`}
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

                                        <div className="flex flex-col items-start justify-between gap-4 border-b border-brand-warm/60 bg-brand-warm/30 p-5 sm:flex-row sm:items-center sm:gap-0">
                                            <div className="flex w-full items-start gap-4 sm:flex-1">
                                                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-navy font-mono text-sm font-black text-white shadow-sm">
                                                    {bookingIndex + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="font-serif text-xl font-black text-brand-navy">
                                                            {
                                                                booking.sender
                                                                    ?.first_name
                                                            }{' '}
                                                            {
                                                                booking.sender
                                                                    ?.last_name
                                                            }
                                                        </h4>
                                                        {booking.isCompleted && (
                                                            <span className="flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-0.5 text-[10px] font-black tracking-widest text-white uppercase shadow-xs">
                                                                <CheckCircle className="size-3" />
                                                                STOP COMPLETED (COLLECTED)
                                                            </span>
                                                        )}
                                                        {booking.payment_status ===
                                                        'paid' ? (
                                                            <span className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-black tracking-widest text-white uppercase shadow-xs">
                                                                PAID
                                                            </span>
                                                        ) : booking.payment_status ===
                                                          'cash_collected' ? (
                                                            <span className="flex items-center gap-1 rounded-md bg-teal-600 px-2 py-0.5 text-[10px] font-black tracking-widest text-white uppercase shadow-xs">
                                                                CASH PENDING
                                                            </span>
                                                        ) : booking.payment_status ===
                                                          'cash_on_pickup' ? (
                                                            <span className="flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-black tracking-widest text-slate-950 uppercase shadow-xs">
                                                                CASH DUE
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-black tracking-widest text-white uppercase shadow-xs">
                                                                UNPAID
                                                            </span>
                                                        )}
                                                        {/* Customer Selected Payment Method */}
                                                        {(() => {
                                                            const rawMethod =
                                                                booking.payment_method ||
                                                                (['cash_on_pickup', 'cash_collected'].includes(
                                                                    booking.payment_status,
                                                                )
                                                                    ? 'cash_on_pickup'
                                                                    : null);
                                                            if (!rawMethod)
                                                                return null;
                                                            const isCash =
                                                                [
                                                                    'cash',
                                                                    'cash_on_pickup',
                                                                ].includes(
                                                                    rawMethod,
                                                                );
                                                            return (
                                                                <span
                                                                    className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase shadow-2xs ${
                                                                        isCash
                                                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                                            : 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700/60 dark:bg-blue-950/40 dark:text-blue-300'
                                                                    }`}
                                                                    title={`Customer Payment Method: ${formatPaymentMethod(rawMethod)}`}
                                                                >
                                                                    {isCash ? (
                                                                        <Banknote className="size-3 text-emerald-600 dark:text-emerald-400" />
                                                                    ) : (
                                                                        <CreditCard className="size-3 text-blue-600 dark:text-blue-400" />
                                                                    )}
                                                                    <span>
                                                                        {formatPaymentMethod(
                                                                            rawMethod,
                                                                        )}
                                                                    </span>
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-brand-text">
                                                        <MapPin className="size-3.5 shrink-0 text-brand-primary" />
                                                        <span className="font-medium text-brand-text">
                                                            {booking.sender
                                                                ?.address ||
                                                                booking.destination}
                                                        </span>
                                                        <span className="font-bold text-brand-sand">
                                                            •
                                                        </span>
                                                        <span className="font-mono text-[11px] font-bold text-brand-text-mid uppercase">
                                                            Ref:{' '}
                                                            {
                                                                booking.reference_number
                                                            }
                                                        </span>
                                                        <span className="font-bold text-brand-sand">
                                                            •
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            {booking.declaration_form_status ===
                                                            'missing' ? (
                                                                <span className="rounded border border-rose-300 bg-rose-100 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-rose-900 uppercase">
                                                                    NO
                                                                    DECLARATION
                                                                </span>
                                                            ) : (
                                                                <a
                                                                    href={`/track/declaration/${booking.id}/view`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1 rounded border border-blue-300 bg-blue-100 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-blue-900 uppercase transition-colors hover:bg-blue-200"
                                                                >
                                                                    <FileText className="size-2.5" />
                                                                    DECLARATION
                                                                </a>
                                                            )}

                                                            {booking.invoice && (
                                                                <Link
                                                                    href={`/admin/invoices/${booking.invoice.id}`}
                                                                    className="flex items-center gap-1 rounded border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-emerald-900 uppercase transition-colors hover:bg-emerald-200"
                                                                >
                                                                    <FileText className="size-2.5" />
                                                                    INVOICE
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action buttons: Navigate (Google & Waze) + Call + SMS */}
                                            <div className="mt-3 flex w-full flex-wrap items-center gap-1.5 sm:mt-0 sm:ml-3 sm:w-auto sm:shrink-0">
                                                {hasCoords && (
                                                    <>
                                                        <a
                                                            href={buildOsmDirectionsUrl(
                                                                userLocation,
                                                                {
                                                                    lat: senderLat!,
                                                                    lng: senderLng!,
                                                                },
                                                            )}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black tracking-wider text-white uppercase shadow-sm transition-all hover:bg-emerald-700 active:scale-95 sm:flex-initial"
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                            title="Navigate via OpenStreetMap"
                                                        >
                                                            <Navigation className="size-3" />
                                                            OSM
                                                        </a>
                                                        <a
                                                            href={googleMapsDirectionsUrl(
                                                                userLocation,
                                                                {
                                                                    lat: senderLat!,
                                                                    lng: senderLng!,
                                                                },
                                                            )}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand-primary px-3 py-2 text-[10px] font-black tracking-wider text-white uppercase shadow-sm transition-all hover:bg-brand-rust active:scale-95 sm:flex-initial"
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                            title="Navigate via Google Maps"
                                                        >
                                                            <Navigation className="size-3" />
                                                            Maps
                                                        </a>
                                                        <a
                                                            href={wazeDirectionsUrl(
                                                                {
                                                                    lat: senderLat!,
                                                                    lng: senderLng!,
                                                                },
                                                            )}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-cyan-600 px-3 py-2 text-[10px] font-black tracking-wider text-white uppercase shadow-sm transition-all hover:bg-cyan-700 active:scale-95 sm:flex-initial"
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                            title="Navigate via Waze"
                                                        >
                                                            <Compass className="size-3" />
                                                            Waze
                                                        </a>
                                                    </>
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
                                                                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black tracking-wider text-white uppercase shadow-sm transition-all hover:bg-emerald-700 active:scale-95 sm:flex-initial"
                                                                    onClick={(
                                                                        e,
                                                                    ) =>
                                                                        e.stopPropagation()
                                                                    }
                                                                >
                                                                    <Phone className="size-3" />
                                                                    Call
                                                                </a>
                                                                <a
                                                                    href={`sms:${mobile}`}
                                                                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-black tracking-wider text-white uppercase shadow-sm transition-all hover:bg-blue-700 active:scale-95 sm:flex-initial"
                                                                    onClick={(
                                                                        e,
                                                                    ) =>
                                                                        e.stopPropagation()
                                                                    }
                                                                >
                                                                    <MessageCircle className="size-3" />
                                                                    SMS
                                                                </a>
                                                            </>
                                                        );
                                                    })()}
                                            </div>
                                        </div>

                                        <div className="border-b border-brand-warm/50 bg-amber-50/70 p-4 dark:bg-amber-950/20">
                                            <div className="mb-2 flex items-center gap-2 text-amber-950 dark:text-amber-100">
                                                <MessageCircle className="size-4" />
                                                <span className="text-[10px] font-black tracking-widest uppercase">
                                                    Dispatch notes
                                                </span>
                                            </div>
                                            {(runsheet.pickup_notes ?? [])
                                                .filter(
                                                    (note: {
                                                        booking_id: number;
                                                    }) =>
                                                        note.booking_id ===
                                                        booking.id,
                                                )
                                                .map(
                                                    (note: {
                                                        id: number;
                                                        note: string;
                                                        created_at: string;
                                                    }) => (
                                                        <p
                                                            key={note.id}
                                                            className="mb-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-brand-text shadow-xs dark:border-amber-900/60 dark:bg-zinc-900 dark:text-zinc-100"
                                                        >
                                                            {note.note}
                                                        </p>
                                                    ),
                                                )}
                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <textarea
                                                    value={
                                                        pickupNotes[
                                                            booking.id
                                                        ] ?? ''
                                                    }
                                                    onChange={(event) =>
                                                        setPickupNotes(
                                                            (current) => ({
                                                                ...current,
                                                                [booking.id]:
                                                                    event.target
                                                                        .value,
                                                            }),
                                                        )
                                                    }
                                                    maxLength={2000}
                                                    rows={2}
                                                    placeholder="Report a pickup issue, special instruction, or unsuccessful visit to dispatch…"
                                                    className="min-h-16 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-brand-text transition outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-amber-900/60 dark:bg-zinc-900 dark:text-zinc-100"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={
                                                        submittingNoteFor ===
                                                            booking.id ||
                                                        !(
                                                            pickupNotes[
                                                                booking.id
                                                            ] ?? ''
                                                        ).trim()
                                                    }
                                                    onClick={() =>
                                                        submitPickupNote(
                                                            booking.id,
                                                        )
                                                    }
                                                    className="rounded-xl bg-amber-700 px-4 py-2 text-[10px] font-black tracking-widest text-white uppercase transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {submittingNoteFor ===
                                                    booking.id
                                                        ? 'Sending…'
                                                        : 'Send note'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Multi-box select-all quick action on stop */}
                                        {(() => {
                                            const eligibleBoxIds =
                                                getEligibleBoxIdsForBooking(
                                                    booking,
                                                );
                                            const isAllSelected =
                                                eligibleBoxIds.length > 0 &&
                                                eligibleBoxIds.every(
                                                    (id: number) =>
                                                        selectedBoxIds.includes(
                                                            id,
                                                        ),
                                                );

                                            if (eligibleBoxIds.length > 1) {
                                                return (
                                                    <div className="flex items-center justify-between border-b border-brand-warm/50 bg-brand-sand/15 px-4 py-2">
                                                        <span className="text-[11px] font-bold text-brand-navy">
                                                            {
                                                                booking.boxes
                                                                    ?.length
                                                            }{' '}
                                                            boxes at this stop (
                                                            {
                                                                eligibleBoxIds.length
                                                            }{' '}
                                                            ready for
                                                            collection)
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                toggleAllBookingBoxes(
                                                                    booking,
                                                                );
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-brand-sand/60 bg-white px-2.5 py-1 text-[10px] font-black tracking-wider text-brand-navy uppercase shadow-xs transition-all hover:bg-brand-warm/30 active:scale-95"
                                                        >
                                                            {isAllSelected ? (
                                                                <>
                                                                    <CheckSquare className="size-3 text-brand-primary" />
                                                                    Deselect All
                                                                    (
                                                                    {
                                                                        eligibleBoxIds.length
                                                                    }
                                                                    )
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Square className="size-3 text-brand-text-light" />
                                                                    Select All (
                                                                    {
                                                                        eligibleBoxIds.length
                                                                    }
                                                                    )
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}

                                        <div className="flex flex-1 flex-col divide-y divide-brand-warm/50">
                                            {booking.boxes?.map((box: any) => {
                                                const config =
                                                    statusConfig[box.status] ||
                                                    statusConfig.pending;
                                                const StatusIcon = config.icon;
                                                const canBatchCollect =
                                                    box.status === 'pending' &&
                                                    [
                                                        'paid',
                                                        'cash_collected',
                                                    ].includes(
                                                        booking.payment_status,
                                                    ) &&
                                                    booking.declaration_form_status !==
                                                        'missing';

                                                return (
                                                    <Link
                                                        key={box.id}
                                                        href={`/picker/box/${box.tracking_number}`}
                                                        className="group flex items-center justify-between p-4 transition-colors hover:bg-brand-warm/30"
                                                    >
                                                        <div className="flex items-center gap-3">
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
                                                                className="size-5 cursor-pointer rounded border-2 border-brand-sand text-brand-primary disabled:opacity-30"
                                                            />
                                                            <div className="flex flex-col">
                                                                <div className="inline-flex items-center gap-1 rounded-lg border border-brand-warm/80 bg-white px-2.5 py-1 font-mono text-xs font-black tracking-wider text-brand-navy shadow-xs">
                                                                    {
                                                                        box.tracking_number
                                                                    }
                                                                </div>
                                                                {box.serial_number && (
                                                                    <span className="mt-0.5 font-mono text-[10px] font-bold text-brand-primary">
                                                                        SN:{' '}
                                                                        {
                                                                            box.serial_number
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2.5">
                                                            <span
                                                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black tracking-wider uppercase shadow-xs ${config.style}`}
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

                                        {!['paid', 'cash_collected'].includes(
                                            booking.payment_status,
                                        ) &&
                                            (() => {
                                                const isBeforeScheduled =
                                                    Boolean(
                                                        booking.is_before_scheduled_date ||
                                                        (booking.payment_status ===
                                                            'cash_on_pickup' &&
                                                            isDateInFuture(
                                                                booking.preferred_date ||
                                                                    runsheet.scheduled_date,
                                                            )),
                                                    );
                                                const scheduledDateDisplay =
                                                    booking.scheduled_pickup_date_formatted ||
                                                    formatPickupDate(
                                                        booking.preferred_date ||
                                                            runsheet.scheduled_date,
                                                    );

                                                return (
                                                    <div className="mt-auto flex flex-col items-start justify-between gap-3 border-t border-amber-300/80 bg-amber-100/60 p-4 sm:flex-row sm:items-center">
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black tracking-widest text-amber-950 uppercase">
                                                                <span>
                                                                    {booking.payment_status ===
                                                                    'cash_on_pickup'
                                                                        ? 'Payment Required on Pickup'
                                                                        : 'Payment Outstanding'}
                                                                </span>
                                                                {(booking.payment_method ||
                                                                    booking.payment_status ===
                                                                        'cash_on_pickup') && (
                                                                    <span className="inline-flex items-center gap-1 font-bold text-amber-900 dark:text-amber-200">
                                                                        • Method:{' '}
                                                                        {formatPaymentMethod(
                                                                            booking.payment_method ||
                                                                                'cash_on_pickup',
                                                                        )}
                                                                    </span>
                                                                )}
                                                                {isBeforeScheduled &&
                                                                    scheduledDateDisplay && (
                                                                        <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-200/90 px-2 py-0.5 text-[9px] font-black text-amber-950">
                                                                            Scheduled:{' '}
                                                                            {
                                                                                scheduledDateDisplay
                                                                            }
                                                                        </span>
                                                                    )}
                                                            </div>
                                                            <div className="text-xl font-black text-amber-950">
                                                                $
                                                                {totalAmount.toFixed(
                                                                    2,
                                                                )}
                                                            </div>
                                                            {isBeforeScheduled &&
                                                                scheduledDateDisplay && (
                                                                    <p className="mt-0.5 text-[11px] font-medium text-amber-900">
                                                                        Cash
                                                                        collection
                                                                        unlocks
                                                                        on
                                                                        pickup
                                                                        date (
                                                                        {
                                                                            scheduledDateDisplay
                                                                        }
                                                                        ).
                                                                    </p>
                                                                )}
                                                        </div>
                                                        <button
                                                            disabled={
                                                                isBeforeScheduled
                                                            }
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (
                                                                    isBeforeScheduled
                                                                ) {
                                                                    toast.error(
                                                                        `Cash on pickup cannot be collected before the scheduled pickup date (${scheduledDateDisplay}).`,
                                                                    );
                                                                    return;
                                                                }
                                                                handleRecordPayment(
                                                                    booking,
                                                                );
                                                            }}
                                                            title={
                                                                isBeforeScheduled
                                                                    ? `Cash on pickup cannot be collected before the scheduled pickup date (${scheduledDateDisplay})`
                                                                    : 'Collect Payment'
                                                            }
                                                            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black tracking-widest uppercase shadow-md transition-all ${
                                                                isBeforeScheduled
                                                                    ? 'cursor-not-allowed bg-zinc-300 text-zinc-500 opacity-60 shadow-none dark:bg-zinc-800 dark:text-zinc-500'
                                                                    : 'btn-primary bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                                                            }`}
                                                        >
                                                            <CheckCircle className="size-4" />
                                                            {booking.payment_status ===
                                                            'cash_on_pickup'
                                                                ? isBeforeScheduled
                                                                    ? 'Locked Until Pickup'
                                                                    : 'Collect Cash'
                                                                : 'Record Payment'}
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                    </div>
                                );
                            },
                        )
                    )}
                </div>
            </div>

            {/* Persistent Mobile Field Driver Action Bar */}
            <div className="fixed right-0 bottom-0 left-0 z-50 animate-fade-in border-t border-brand-warm bg-white/95 px-4 py-3 shadow-2xl backdrop-blur-md sm:right-6 sm:bottom-6 sm:left-auto sm:w-96 sm:rounded-3xl sm:border dark:border-brand-sand/15 dark:bg-brand-navy/95">
                {selectedBoxIds.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black tracking-widest text-brand-navy uppercase dark:text-white">
                                Selected: {selectedBoxIds.length}{' '}
                                {selectedBoxIds.length === 1 ? 'Box' : 'Boxes'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSelectedBoxIds([])}
                                className="text-xs font-black tracking-wider text-rose-600 uppercase transition-all hover:text-rose-500 active:scale-95"
                            >
                                Clear
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={collectSelectedBoxes}
                            className={`btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-xs font-black tracking-widest uppercase shadow-lg ${
                                !isOnline
                                    ? 'bg-amber-600 hover:bg-amber-500'
                                    : ''
                            } cursor-pointer`}
                        >
                            <Camera className="size-4" />
                            {isOnline
                                ? `Collect Selected (${selectedBoxIds.length})`
                                : `Collect Selected Offline (${selectedBoxIds.length})`}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black tracking-wider text-brand-text-mid uppercase dark:text-white/60">
                                Run Progress
                            </span>
                            <span className="text-sm font-black text-brand-navy dark:text-white">
                                {statusCounts.collected || 0} /{' '}
                                {allBoxes.length} Boxes
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                href="/picker/scan"
                                className="inline-flex items-center gap-2 rounded-2xl bg-brand-navy px-4 py-2.5 text-xs font-black tracking-wider text-white uppercase shadow-md transition-all hover:bg-brand-primary active:scale-95"
                            >
                                <QrCode className="size-4 text-brand-warm" />
                                Scan Box
                            </Link>
                            {isReadyToComplete && isInProgress && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            `/picker/runsheet/${runsheet.id}/complete`,
                                        )
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3.5 py-2.5 text-xs font-black tracking-wider text-white uppercase shadow-md transition-all hover:bg-emerald-700 active:scale-95"
                                >
                                    <CheckCircle className="size-4" />
                                    Finish
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
