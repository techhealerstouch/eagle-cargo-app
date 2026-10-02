import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Box, Calendar, Check, CheckSquare, ChevronDown, ExternalLink, LayoutGrid, List, MapPin, Phone, Plus, Save, Search, Square, Trash2, User, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Picker {
    id: number;
    name: string;
    email?: string;
    active_runsheet_count?: number;
    picker?: { id: number; user_id: number; mobile?: string; email?: string } | null;
}

interface PickupZone {
    id: number;
    name: string;
    code?: string;
    is_active?: boolean;
    suburbs?: Array<{ id: number; name: string }>;
}

interface Booking {
    id: number;
    reference_number: string;
    sender: {
        first_name: string;
        last_name: string;
        suburb?: string;
        state?: string;
        pickup_zone?: {
            id: number;
            name: string;
            code?: string;
        } | null;
        pickupZone?: {
            id: number;
            name: string;
            code?: string;
        } | null;
    };
    payment_status: string;
    preferred_date?: string;
    boxes_without_serial_count?: number;
}

export default function PickupRunsheetsCreate({
    pickers = [],
    pickupEligibleBookings = [],
    pickupZones = [],
    recommendedStartingSerial,
}: {
    pickers?: Picker[];
    pickupEligibleBookings?: Booking[];
    pickupZones?: PickupZone[];
    recommendedStartingSerial?: string;
}) {
    const { t } = useTranslations();

    const { data, setData, post, processing, errors, wasSuccessful } = useForm({
        picker_id: '',
        scheduled_date: '',
        timeslot: '',
        area_description: '',
        type: 'pickup',
        status: 'assigned',
        booking_ids: [] as number[],
        starting_serial_number: recommendedStartingSerial || '',
    });

    const [hasLoadedUrlParams, setHasLoadedUrlParams] = useState(false);

    const findZoneForSender = (sender?: Booking['sender']) => {
        if (!sender) return null;

        // 1. Direct pickupZone relationship if present
        const directZoneName = sender.pickup_zone?.name || sender.pickupZone?.name;
        if (directZoneName) {
            const found = pickupZones.find(z => z.name.toLowerCase() === directZoneName.toLowerCase());
            if (found) return found.name;
        }

        // 2. Match sender suburb against covered suburbs in pickupZones
        if (sender.suburb) {
            const subLower = sender.suburb.trim().toLowerCase();
            const foundBySuburb = pickupZones.find(z =>
                z.suburbs?.some(s => s.name.toLowerCase() === subLower)
            );
            if (foundBySuburb) return foundBySuburb.name;

            // 3. Fallback: match by zone name itself
            const foundByName = pickupZones.find(z =>
                z.name.toLowerCase() === subLower || z.name.toLowerCase().includes(subLower)
            );
            if (foundByName) return foundByName.name;
        }

        return null;
    };

    // Ensure area_description is always a valid PickupZone or empty
    useEffect(() => {
        if (data.area_description && pickupZones.length > 0) {
            const isValid = pickupZones.some(z => z.name.toLowerCase() === data.area_description.toLowerCase());
            if (!isValid) {
                setData('area_description', '');
            }
        }
    }, [pickupZones, data.area_description]);

    useEffect(() => {
        if (hasLoadedUrlParams) return;

        const urlParams = new URLSearchParams(window.location.search);
        const bookingId = urlParams.get('booking_id');
        const bookingIdsStr = urlParams.get('booking_ids');
        const explicitDate = urlParams.get('scheduled_date');
        const explicitPickerId = urlParams.get('picker_id');

        let updatedIds: number[] = [];
        let firstBooking: Booking | undefined;

        if (bookingIdsStr) {
            const ids = bookingIdsStr.split(',')
                .map(id => parseInt(id))
                .filter(id => !isNaN(id));

            updatedIds = ids;
            firstBooking = pickupEligibleBookings.find(b => ids.includes(b.id));
        } else if (bookingId) {
            const id = parseInt(bookingId);
            if (!isNaN(id)) {
                updatedIds = [id];
                firstBooking = pickupEligibleBookings.find(b => b.id === id);
            }
        }

        const newData: any = {};

        if (updatedIds.length > 0) {
            newData.booking_ids = updatedIds;

            if (firstBooking) {
                if (firstBooking.preferred_date) {
                    newData.scheduled_date = firstBooking.preferred_date.substring(0, 10);
                }
                const matchedZone = findZoneForSender(firstBooking.sender);
                if (matchedZone) {
                    newData.area_description = matchedZone;
                }
            }
        }

        if (explicitDate) {
            newData.scheduled_date = explicitDate;
        }

        if (explicitPickerId) {
            newData.picker_id = explicitPickerId;
        }

        if (Object.keys(newData).length > 0) {
            setData(data => ({ ...data, ...newData }));
        }

        setHasLoadedUrlParams(true);
    }, [pickupEligibleBookings, hasLoadedUrlParams, setData, pickupZones]);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
    const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');
    const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    const selectedPicker = useMemo(() => {
        return pickers.find(p => String(p.id) === String(data.picker_id));
    }, [pickers, data.picker_id]);

    // Helper to determine Pickup Area for a booking
    const getBookingPickupArea = (booking: Booking): string => {
        const directZone = booking.sender?.pickup_zone?.name || booking.sender?.pickupZone?.name;
        if (directZone) return directZone;

        const matchedZone = findZoneForSender(booking.sender);
        if (matchedZone) return matchedZone;

        return 'Unassigned';
    };

    // Helper to determine Pickup Date for a booking (YYYY-MM-DD or Unscheduled)
    const getBookingPickupDate = (booking: Booking): string => {
        if (!booking.preferred_date) return 'Unscheduled';
        return booking.preferred_date.substring(0, 10);
    };

    // Compute unique Pickup Areas with counts for filter chips
    const pickupAreaOptions = useMemo(() => {
        const counts: Record<string, number> = {};
        pickupEligibleBookings.forEach((booking) => {
            const area = getBookingPickupArea(booking);
            counts[area] = (counts[area] || 0) + 1;
        });

        return Object.entries(counts).map(([name, count]) => ({
            name,
            count,
        })).sort((a, b) => {
            if (a.name === 'Unassigned') return 1;
            if (b.name === 'Unassigned') return -1;
            return a.name.localeCompare(b.name);
        });
    }, [pickupEligibleBookings, pickupZones]);

    // Compute unique Pickup Dates with counts & readable labels
    const pickupDateOptions = useMemo(() => {
        const counts: Record<string, number> = {};
        pickupEligibleBookings.forEach((booking) => {
            const dateStr = getBookingPickupDate(booking);
            counts[dateStr] = (counts[dateStr] || 0) + 1;
        });

        return Object.entries(counts).map(([value, count]) => {
            let label = value;
            if (value === 'Unscheduled') {
                label = 'Unscheduled';
            } else {
                try {
                    const parsed = new Date(value + 'T00:00:00');
                    if (!isNaN(parsed.getTime())) {
                        label = parsed.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' });
                    }
                } catch {
                    label = value;
                }
            }
            return { value, label, count };
        }).sort((a, b) => {
            if (a.value === 'Unscheduled') return 1;
            if (b.value === 'Unscheduled') return -1;
            return a.value.localeCompare(b.value);
        });
    }, [pickupEligibleBookings]);

    // Filter logic for pickers
    const filteredPickers = useMemo(() => {
        const matches = pickers.filter((u) =>
            u.name.toLowerCase().includes(assigneeSearchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(assigneeSearchTerm.toLowerCase()) ||
            u.picker?.mobile?.includes(assigneeSearchTerm)
        );

        if (!data.picker_id) return matches;

        return [...matches].sort((a, b) => {
            if (String(a.id) === String(data.picker_id)) return -1;
            if (String(b.id) === String(data.picker_id)) return 1;
            return 0;
        });
    }, [pickers, assigneeSearchTerm, data.picker_id]);

    // Limit displayed items in the modal to avoid DOM overload
    const displayedPickers = useMemo(() => {
        return filteredPickers.slice(0, 30);
    }, [filteredPickers]);

    // Filter logic for pickup bookings (search + Pickup Area + Pickup Date)
    const filteredBookings = useMemo(() => {
        return pickupEligibleBookings.filter((booking) => {
            const matchesSearch =
                booking.reference_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                booking.sender.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                booking.sender.last_name.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (selectedAreaFilter !== 'all') {
                const area = getBookingPickupArea(booking);
                if (area.toLowerCase() !== selectedAreaFilter.toLowerCase()) return false;
            }

            if (selectedDateFilter !== 'all') {
                const dateStr = getBookingPickupDate(booking);
                if (dateStr !== selectedDateFilter) return false;
            }

            return true;
        });
    }, [pickupEligibleBookings, searchTerm, selectedAreaFilter, selectedDateFilter, pickupZones]);

    const handleSelectAll = () => {
        const filteredIds = filteredBookings.map(b => b.id);
        const allFilteredSelected = filteredIds.every(id => data.booking_ids.includes(id));

        if (allFilteredSelected) {
            setData('booking_ids', data.booking_ids.filter(id => !filteredIds.includes(id)));
        } else {
            const newIds = Array.from(new Set([...data.booking_ids, ...filteredIds]));
            const newData: any = { booking_ids: newIds };

            if (data.booking_ids.length === 0 && filteredBookings.length > 0) {
                const firstBooking = filteredBookings[0];

                if (!data.scheduled_date && firstBooking.preferred_date) {
                    newData.scheduled_date = firstBooking.preferred_date.substring(0, 10);
                }

                if (!data.area_description && firstBooking.sender) {
                    const matchedZone = findZoneForSender(firstBooking.sender);
                    if (matchedZone) {
                        newData.area_description = matchedZone;
                    }
                }
            }

            setData(current => ({ ...current, ...newData }));
        }
    };

    const handleToggleBooking = (booking: Booking) => {
        const ids = [...data.booking_ids];
        const isSelecting = !ids.includes(booking.id);

        const newData: any = {
            booking_ids: isSelecting ? [...ids, booking.id] : ids.filter(id => id !== booking.id)
        };

        if (isSelecting && ids.length === 0) {
            if (!data.area_description && booking.sender) {
                const matchedZone = findZoneForSender(booking.sender);
                if (matchedZone) {
                    newData.area_description = matchedZone;
                }
            }

            if (!data.scheduled_date && booking.preferred_date) {
                newData.scheduled_date = booking.preferred_date.substring(0, 10);
            }
        }

        setData(current => ({ ...current, ...newData }));
    };

    const isAllFilteredSelected = filteredBookings.length > 0 && filteredBookings.every(b => data.booking_ids.includes(b.id));
    const isSubmitDisabled = processing || wasSuccessful || !data.picker_id || data.booking_ids.length === 0;

    const selectedBookingsData = useMemo(() => {
        return pickupEligibleBookings.filter(b => data.booking_ids.includes(b.id));
    }, [pickupEligibleBookings, data.booking_ids]);

    const totalNeededBoxes = selectedBookingsData.reduce((sum, b) => sum + (b.boxes_without_serial_count || 0), 0);

    const selectedSuburbsCount = useMemo(() => {
        const suburbs = new Set(selectedBookingsData.map(b => b.sender.suburb).filter(Boolean));
        return suburbs.size;
    }, [selectedBookingsData]);

    // Keyboard Shortcuts Hook ('/', Cmd+A, Cmd+Enter)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeElement = document.activeElement;
            const isInputActive = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');

            if (e.key === '/' && !isInputActive) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && !isInputActive) {
                e.preventDefault();
                handleSelectAll();
            }

            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                if (!isSubmitDisabled) {
                    e.preventDefault();
                    post('/admin/runsheets');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSubmitDisabled, filteredBookings, data.booking_ids]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('ui.common.dashboard', 'Dashboard'), href: '/dashboard' },
        { title: t('ui.runsheets.breadcrumbs.runsheets', 'Runsheets'), href: '/admin/runsheets' },
        { title: 'New Pickup Dispatch', href: '#' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/runsheets');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dispatch Pickup Run | Love Balikbayan" />

            <div className="flex flex-col h-screen overflow-hidden bg-brand-warm/10">
                {/* Compact Top Header Bar */}
                <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200/80 shadow-2xs z-10 shrink-0 font-sans">
                    <div className="flex items-center gap-3.5">
                        <Link
                            href="/admin/runsheets"
                            className="group flex items-center justify-center size-8.5 rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:border-brand-rust hover:text-brand-rust hover:bg-brand-rust/5 shadow-2xs cursor-pointer"
                            title="Back to Runsheets"
                        >
                            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
                        </Link>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-rust leading-none mb-1">
                                Operations • Origin Collection Run
                            </div>
                            <h1 className="font-sans text-base font-bold text-slate-900 tracking-tight leading-none m-0">
                                Create Pickup Dispatch
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Summary:</span>
                            <span className="font-bold text-slate-800 font-mono">
                                {data.booking_ids.length} Bookings ({totalNeededBoxes} Boxes)
                            </span>
                            {selectedSuburbsCount > 0 && (
                                <span className="text-[10px] font-medium text-slate-500">
                                    • {selectedSuburbsCount} {selectedSuburbsCount === 1 ? 'Area' : 'Areas'}
                                </span>
                            )}
                            {!data.picker_id ? (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 ml-1">
                                    Select Picker
                                </span>
                            ) : data.booking_ids.length === 0 ? (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 ml-1">
                                    Select Booking
                                </span>
                            ) : null}
                        </div>

                        <Button
                            form="pickup-dispatch-form"
                            type="submit"
                            disabled={isSubmitDisabled}
                            variant="success"
                            className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed font-sans cursor-pointer"
                        >
                            {processing ? <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="size-3.5" />}
                            {processing ? 'Processing...' : 'Confirm Pickup Run'}
                        </Button>
                    </div>
                </div>

                {/* Main Content Area - Split Layout */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar: Dispatch Configuration */}
                    <div className="w-full md:w-[420px] bg-slate-50/60 border-r border-slate-200/80 overflow-y-auto p-6 space-y-6 custom-scrollbar font-sans">
                        <form id="pickup-dispatch-form" onSubmit={handleSubmit} className="space-y-5">
                            {/* Card 1: Dispatch Settings */}
                            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200/70 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-6 rounded-md bg-brand-rust/10 flex items-center justify-center text-brand-rust">
                                            <Calendar className="size-3.5" />
                                        </div>
                                        <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800 m-0">
                                            Dispatch Settings
                                        </h2>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Schedule</span>
                                </div>

                                <div className="p-4 space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Collection Date <span className="text-red-500">*</span></Label>
                                        <div className="relative group">
                                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-brand-rust pointer-events-none transition-colors" />
                                            <Input
                                                type="date"
                                                required
                                                min={new Date().toLocaleDateString('en-CA')}
                                                className="h-10 rounded-lg border-slate-200 bg-white pl-10 pr-3 font-sans text-xs font-semibold text-slate-800 focus:border-brand-rust focus:ring-1 focus:ring-brand-rust/20 transition-all cursor-pointer [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                                value={data.scheduled_date}
                                                onChange={(e) => setData('scheduled_date', e.target.value)}
                                            />
                                        </div>
                                        {errors.scheduled_date && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.scheduled_date}</p>}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">
                                            Time Slot <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                                        </Label>
                                        <div className="relative group">
                                            <select
                                                title="Time Slot"
                                                aria-label="Time Slot"
                                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-9 font-sans text-xs font-semibold text-slate-800 focus:border-brand-rust focus:ring-1 focus:ring-brand-rust/20 transition-all appearance-none cursor-pointer"
                                                value={data.timeslot}
                                                onChange={(e) => setData('timeslot', e.target.value)}
                                            >
                                                <option value="">Anytime</option>
                                                <option value="Morning (9AM - 12PM)">Morning (9AM - 12PM)</option>
                                                <option value="Afternoon (1PM - 5PM)">Afternoon (1PM - 5PM)</option>
                                                <option value="Evening (6PM - 9PM)">Evening (6PM - 9PM)</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none group-focus-within:text-brand-rust transition-colors" />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Status</Label>
                                        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200/80">
                                            {[
                                                { id: 'draft', label: 'Draft' },
                                                { id: 'assigned', label: 'Assigned' },
                                                { id: 'in_progress', label: 'In Progress' },
                                            ].map((s) => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => setData('status', s.id)}
                                                    className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                                        data.status === s.id
                                                            ? 'bg-white shadow-xs font-bold text-brand-rust ring-1 ring-black/5'
                                                            : 'text-slate-600 hover:text-slate-900'
                                                    }`}
                                                >
                                                    {s.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">
                                                Pickup Area / Region <span className="text-red-500">*</span>
                                            </Label>
                                            <a
                                                href="/admin/pickup-zones"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] font-semibold text-brand-rust hover:underline inline-flex items-center gap-1"
                                                title="Manage pickup areas in Settings"
                                            >
                                                Settings <ExternalLink className="size-2.5" />
                                            </a>
                                        </div>
                                        <div className="relative group">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-brand-rust transition-colors pointer-events-none" />
                                            <select
                                                title="Pickup Area / Region"
                                                aria-label="Pickup Area / Region"
                                                required
                                                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 font-sans text-xs font-semibold text-slate-800 focus:border-brand-rust focus:ring-1 focus:ring-brand-rust/20 transition-all appearance-none cursor-pointer truncate"
                                                value={data.area_description}
                                                onChange={(e) => setData('area_description', e.target.value)}
                                            >
                                                <option value="" disabled>
                                                    {pickupZones.length === 0 ? 'No pickup areas configured in Settings' : 'Select Pickup Area...'}
                                                </option>
                                                {pickupZones.map((zone) => (
                                                    <option key={zone.id} value={zone.name}>
                                                        {zone.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none group-focus-within:text-brand-rust transition-colors" />
                                        </div>
                                        {errors.area_description && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.area_description}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Serial Number Allocation */}
                            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200/70 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-6 rounded-md bg-brand-rust/10 flex items-center justify-center text-brand-rust">
                                            <Box className="size-3.5" />
                                        </div>
                                        <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800 m-0">
                                            Serial Number Allocation
                                        </h2>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Inventory</span>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/70 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="size-7 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-700">
                                                <Box className="size-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-emerald-950 font-sans">
                                                    {totalNeededBoxes} {totalNeededBoxes === 1 ? 'Box' : 'Boxes'} Selected
                                                </p>
                                                <p className="text-[10px] text-emerald-700 font-medium">
                                                    {totalNeededBoxes > 0
                                                        ? `${data.booking_ids.length} booking(s) require ${totalNeededBoxes} sequential serials`
                                                        : 'Select bookings to allocate serial numbers'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
                                            {totalNeededBoxes} SN
                                        </span>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">
                                                Starting Serial Number <span className="text-red-500">*</span>
                                            </Label>
                                            {recommendedStartingSerial && data.starting_serial_number !== recommendedStartingSerial && (
                                                <button
                                                    type="button"
                                                    onClick={() => setData('starting_serial_number', recommendedStartingSerial)}
                                                    className="text-[10px] font-bold text-brand-rust hover:underline cursor-pointer"
                                                >
                                                    Use lowest ({recommendedStartingSerial})
                                                </button>
                                            )}
                                        </div>
                                        <Input
                                            placeholder="e.g. SR-00008"
                                            required
                                            className="h-10 rounded-lg border-slate-200 bg-white px-3 font-mono text-xs font-bold tracking-wider text-slate-900 focus:border-brand-rust focus:ring-1 focus:ring-brand-rust/20 transition-all uppercase"
                                            value={data.starting_serial_number}
                                            onChange={(e) => setData('starting_serial_number', e.target.value.toUpperCase())}
                                        />
                                        <p className="text-[10px] font-medium text-slate-500">
                                            {recommendedStartingSerial ? `Lowest available in inventory: ${recommendedStartingSerial}` : 'No available serial numbers'}
                                        </p>
                                        {errors.starting_serial_number && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.starting_serial_number}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Assign Picker */}
                            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200/70 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-6 rounded-md bg-brand-rust/10 flex items-center justify-center text-brand-rust">
                                            <User className="size-3.5" />
                                        </div>
                                        <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800 m-0">
                                            Assign Picker
                                        </h2>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                                        {pickers.length} Available
                                    </span>
                                </div>

                                <div className="p-4 space-y-3">
                                    {selectedPicker ? (
                                        (() => {
                                            const activeCount = (selectedPicker as any).active_runsheet_count ?? 0;
                                            const initials = selectedPicker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                                            return (
                                                <div className="p-3 rounded-lg border border-brand-rust/30 bg-brand-rust/5 flex items-center gap-3 relative">
                                                    <div className="size-10 rounded-lg bg-brand-rust text-white flex items-center justify-center text-xs font-bold">
                                                        {initials}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-slate-900 truncate font-sans">{selectedPicker.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                            <p className="text-[10px] font-medium text-slate-500">
                                                                {activeCount} active {activeCount === 1 ? 'runsheet' : 'runsheets'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setIsPickerModalOpen(true)}
                                                            className="h-7 px-2.5 rounded-md text-[10px] font-semibold text-slate-700 hover:text-brand-rust hover:bg-white border-slate-200 shadow-2xs"
                                                        >
                                                            Change
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setData('picker_id', '')}
                                                            className="size-7 p-0 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                                                            title="Remove assignment"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setIsPickerModalOpen(true)}
                                            className="w-full p-4 border-2 border-dashed border-slate-200 hover:border-brand-rust/50 rounded-lg hover:bg-brand-warm/5 transition-all text-center flex items-center justify-center gap-3 group cursor-pointer"
                                        >
                                            <div className="size-8 rounded-md bg-slate-100 group-hover:bg-brand-rust/10 flex items-center justify-center text-slate-500 group-hover:text-brand-rust transition-colors">
                                                <Plus className="size-4" />
                                            </div>
                                            <div className="text-left">
                                                <span className="text-xs font-bold text-slate-800 block font-sans">Choose Driver / Picker</span>
                                                <span className="text-[10px] text-slate-400 block font-normal">Click to search and assign</span>
                                            </div>
                                        </button>
                                    )}
                                    <div className="flex justify-end pt-0.5">
                                        <Link
                                            href="/admin/users/create"
                                            target="_blank"
                                            className="text-[10px] font-semibold text-brand-rust hover:underline inline-flex items-center gap-1"
                                        >
                                            Create new picker <ExternalLink className="size-2.5" />
                                        </Link>
                                    </div>
                                    {errors.picker_id && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.picker_id}</p>}
                                </div>
                            </div>
                        </form>

                        <Dialog open={isPickerModalOpen} onOpenChange={setIsPickerModalOpen}>
                            <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 rounded-xl border border-slate-200/80 shadow-2xl">
                                <div className="p-5 pb-4 border-b border-slate-100 bg-white">
                                    <div className="flex items-start justify-between pr-8">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8.5 rounded-lg bg-brand-rust/10 border border-brand-rust/20 flex items-center justify-center text-brand-rust shrink-0">
                                                <User className="size-4" />
                                            </div>
                                            <div>
                                                <DialogTitle className="text-sm font-bold text-slate-900 font-sans tracking-tight">
                                                    Select Picker
                                                </DialogTitle>
                                                <DialogDescription className="text-xs text-slate-500 font-sans mt-0.5">
                                                    Assign an authorized driver for this collection runsheet
                                                </DialogDescription>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Search Input */}
                                    <div className="relative mt-3.5">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                                        <Input
                                            placeholder="Search by name, phone or email..."
                                            className="h-9 rounded-lg border-slate-200 bg-slate-50/70 pl-8.5 pr-8 text-xs font-sans text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-brand-rust focus:ring-2 focus:ring-brand-rust/10 transition-all"
                                            value={assigneeSearchTerm}
                                            onChange={(e) => setAssigneeSearchTerm(e.target.value)}
                                            autoFocus
                                        />
                                        {assigneeSearchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => setAssigneeSearchTerm('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* List Body */}
                                <div className="p-3 bg-slate-50/60 max-h-[340px] overflow-y-auto space-y-1.5 custom-scrollbar">
                                    {displayedPickers.length > 0 ? (
                                        displayedPickers.map((u) => {
                                            const isSelected = String(data.picker_id) === String(u.id);
                                            const activeCount = (u as any).active_runsheet_count ?? 0;
                                            const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                                            return (
                                                <div
                                                    key={u.id}
                                                    onClick={() => {
                                                        setData('picker_id', String(u.id));
                                                        setIsPickerModalOpen(false);
                                                    }}
                                                    className={`group relative p-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${isSelected
                                                            ? 'border-brand-rust bg-brand-rust/[0.04] ring-1 ring-brand-rust/20 shadow-2xs'
                                                            : 'border-slate-200/80 bg-white hover:border-brand-rust/40 hover:bg-slate-50 hover:shadow-2xs'
                                                        }`}
                                                >
                                                    <div className={`size-8 rounded-md flex items-center justify-center text-xs font-bold font-sans transition-colors shrink-0 ${isSelected
                                                            ? 'bg-brand-rust text-white shadow-2xs'
                                                            : 'bg-slate-100 text-slate-700 border border-slate-200/80 group-hover:bg-brand-rust/10 group-hover:text-brand-rust'
                                                        }`}>
                                                        {initials}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className={`text-xs font-semibold truncate font-sans transition-colors ${isSelected ? 'text-brand-rust' : 'text-slate-900 group-hover:text-brand-rust'}`}>
                                                                {u.name}
                                                            </p>
                                                            {isSelected && (
                                                                <span className="text-[10px] font-semibold text-brand-rust bg-brand-rust/10 px-1.5 py-0.2 rounded shrink-0">
                                                                    Selected
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2.5 mt-0.5">
                                                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium font-sans ${activeCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                                <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                {activeCount === 0 ? '0 active tasks' : `${activeCount} active ${activeCount === 1 ? 'task' : 'tasks'}`}
                                                            </span>
                                                            {u.picker?.mobile && (
                                                                <>
                                                                    <span className="text-slate-300 text-xs">•</span>
                                                                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                                                        <Phone className="size-2.5 text-slate-400" />
                                                                        {u.picker.mobile}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={`size-5 rounded-full border flex items-center justify-center transition-all shrink-0 ${isSelected
                                                            ? 'bg-brand-rust border-brand-rust text-white shadow-2xs'
                                                            : 'border-slate-300 bg-white group-hover:border-slate-400'
                                                        }`}>
                                                        {isSelected && <Check className="size-2.5 stroke-[3]" />}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-8 px-4 text-center border border-dashed border-slate-200 bg-white rounded-lg flex flex-col items-center justify-center gap-2">
                                            <div className="size-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                <Search className="size-4" />
                                            </div>
                                            <p className="text-xs font-semibold text-slate-700 font-sans">No matching pickers</p>
                                            <p className="text-[11px] text-slate-400 font-sans max-w-xs">
                                                Try searching with a different name or phone number.
                                            </p>
                                            {assigneeSearchTerm && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setAssigneeSearchTerm('')}
                                                    className="mt-1 h-7 text-xs font-semibold text-slate-700"
                                                >
                                                    Clear search
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div className="px-4 py-2.5 border-t border-slate-100 bg-white flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-slate-400 font-sans">
                                            Showing {displayedPickers.length} of {filteredPickers.length} {filteredPickers.length === 1 ? 'picker' : 'pickers'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href="/admin/users/create"
                                            target="_blank"
                                            className="text-[11px] font-semibold text-brand-rust hover:underline inline-flex items-center gap-1 font-sans"
                                        >
                                            <Plus className="size-3" />
                                            Add new picker
                                        </Link>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsPickerModalOpen(false)}
                                            className="h-7 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 font-sans"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Right Pane: Inventory / Booking Selection */}
                    <div className="flex-1 flex flex-col bg-brand-warm/10 p-8 overflow-hidden">
                        {/* Pickup Area & Pickup Date Filters */}
                        <div className="space-y-2 mb-3 bg-white/70 p-3 rounded-xl border border-brand-sand/40 shadow-2xs">
                            {/* Filter 1: Pickup Area */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 custom-scrollbar">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 shrink-0 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80 shadow-2xs font-sans">
                                    <MapPin className="size-3 text-brand-rust" /> Pickup Area:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedAreaFilter('all')}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap font-sans ${
                                        selectedAreaFilter === 'all'
                                            ? 'bg-brand-rust text-white shadow-xs'
                                            : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                    }`}
                                >
                                    All Areas ({pickupEligibleBookings.length})
                                </button>
                                {pickupAreaOptions.map((area) => (
                                    <button
                                        key={area.name}
                                        type="button"
                                        onClick={() => setSelectedAreaFilter(area.name)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap font-sans flex items-center gap-1.5 ${
                                            selectedAreaFilter.toLowerCase() === area.name.toLowerCase()
                                                ? 'bg-brand-rust text-white shadow-xs'
                                                : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                    >
                                        <MapPin className={`size-3 shrink-0 ${
                                            selectedAreaFilter.toLowerCase() === area.name.toLowerCase() ? 'text-white' : 'text-brand-rust'
                                        }`} />
                                        <span>{area.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                            selectedAreaFilter.toLowerCase() === area.name.toLowerCase()
                                                ? 'bg-white/20 text-white'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {area.count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Filter 2: Pickup Date */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 custom-scrollbar">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 shrink-0 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80 shadow-2xs font-sans">
                                    <Calendar className="size-3 text-brand-rust" /> Pickup Date:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDateFilter('all')}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap font-sans ${
                                        selectedDateFilter === 'all'
                                            ? 'bg-brand-rust text-white shadow-xs'
                                            : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                    }`}
                                >
                                    All Dates ({pickupEligibleBookings.length})
                                </button>
                                {pickupDateOptions.map((date) => (
                                    <button
                                        key={date.value}
                                        type="button"
                                        onClick={() => setSelectedDateFilter(date.value)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap font-sans flex items-center gap-1.5 ${
                                            selectedDateFilter === date.value
                                                ? 'bg-brand-rust text-white shadow-xs'
                                                : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                    >
                                        <Calendar className={`size-3 shrink-0 ${
                                            selectedDateFilter === date.value ? 'text-white' : 'text-brand-rust'
                                        }`} />
                                        <span>{date.label}</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                            selectedDateFilter === date.value
                                                ? 'bg-white/20 text-white'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {date.count}
                                        </span>
                                    </button>
                                ))}
                                {(selectedAreaFilter !== 'all' || selectedDateFilter !== 'all') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedAreaFilter('all');
                                            setSelectedDateFilter('all');
                                        }}
                                        className="text-[11px] text-brand-rust hover:underline font-semibold whitespace-nowrap ml-2 font-sans"
                                    >
                                        Reset Filters
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Search & Toolbar */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 bg-white p-3 sm:p-3.5 rounded-xl border border-brand-sand/50 shadow-xs">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40 group-focus-within:text-brand-rust transition-colors" />
                                <Input
                                    ref={searchInputRef}
                                    placeholder="Search by Reference # or Sender Name... (Press '/' to search)"
                                    className="h-10 rounded-lg border-brand-sand/50 bg-brand-warm/5 pl-10 pr-4 font-medium text-xs focus:ring-brand-rust/10 focus:border-brand-rust transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                {/* View Mode Switcher */}
                                <div className="inline-flex rounded-lg bg-brand-warm/40 p-0.5 border border-brand-sand/50 shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('table')}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                            viewMode === 'table'
                                                ? 'bg-white text-brand-rust shadow-xs'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <List className="size-3.5" />
                                        <span>Table View</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid')}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                            viewMode === 'grid'
                                                ? 'bg-white text-brand-rust shadow-xs'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <LayoutGrid className="size-3.5" />
                                        <span>Cards View</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className={`flex items-center justify-center gap-2 px-4 h-10 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${isAllFilteredSelected
                                            ? 'bg-brand-rust text-white shadow-xs'
                                            : 'bg-white border border-brand-sand text-brand-rust hover:border-brand-rust hover:bg-brand-rust/5'
                                        }`}
                                >
                                    {isAllFilteredSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                                    <span>{isAllFilteredSelected ? 'Deselect All' : 'Select All'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Results Container */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                            {filteredBookings.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-white/60 p-8 text-center">
                                    <div className="size-12 rounded-xl bg-brand-warm/30 flex items-center justify-center text-brand-rust/60 mb-3">
                                        <Search className="size-6" />
                                    </div>
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                                        {searchTerm || selectedAreaFilter !== 'all' || selectedDateFilter !== 'all'
                                            ? 'No matching bookings found'
                                            : 'No Eligible Bookings'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-sans mt-1 max-w-sm">
                                        {searchTerm || selectedAreaFilter !== 'all' || selectedDateFilter !== 'all'
                                            ? 'Try adjusting your search query, pickup area, or pickup date filters.'
                                            : "We couldn't find any paid bookings ready for collection. Check the confirmation status of your pending orders."}
                                    </p>
                                    {(searchTerm || selectedAreaFilter !== 'all' || selectedDateFilter !== 'all') && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchTerm('');
                                                setSelectedAreaFilter('all');
                                                setSelectedDateFilter('all');
                                            }}
                                            className="mt-3.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-brand-rust hover:bg-slate-50 font-sans shadow-2xs"
                                        >
                                            Clear All Filters
                                        </button>
                                    )}
                                </div>
                            ) : viewMode === 'table' ? (
                                <div className="card overflow-hidden shadow-xs border border-brand-sand/40 bg-white">
                                    <div className="overflow-x-auto w-full">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-border bg-brand-warm/15 text-xs font-semibold text-brand-text-mid">
                                                    <th className="w-12 px-4 py-3.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={handleSelectAll}
                                                            className="inline-flex items-center justify-center text-brand-rust"
                                                            title={isAllFilteredSelected ? 'Deselect All' : 'Select All'}
                                                        >
                                                            {isAllFilteredSelected ? (
                                                                <CheckSquare className="size-4" />
                                                            ) : (
                                                                <Square className="size-4 text-muted-foreground" />
                                                            )}
                                                        </button>
                                                    </th>
                                                    <th className="px-4 py-3.5 font-semibold">Stop #</th>
                                                    <th className="px-4 py-3.5 font-semibold">Booking Ref</th>
                                                    <th className="px-4 py-3.5 font-semibold">Sender Name</th>
                                                    <th className="px-4 py-3.5 font-semibold">Pickup Area</th>
                                                    <th className="px-4 py-3.5 font-semibold text-center">Boxes</th>
                                                    <th className="px-4 py-3.5 font-semibold">Status</th>
                                                    <th className="px-4 py-3.5 font-semibold">Pickup Date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border text-xs font-normal">
                                                {filteredBookings.map((booking) => {
                                                    const isSelected = data.booking_ids.includes(booking.id);
                                                    const stopIndex = data.booking_ids.indexOf(booking.id);

                                                    return (
                                                        <tr
                                                            key={booking.id}
                                                            onClick={() => handleToggleBooking(booking)}
                                                            className={`cursor-pointer transition-colors ${
                                                                isSelected
                                                                    ? 'bg-brand-rust/5 font-medium'
                                                                    : 'hover:bg-brand-cream/20'
                                                            }`}
                                                        >
                                                            <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleBooking(booking)}
                                                                    className="inline-flex items-center justify-center text-brand-rust"
                                                                >
                                                                    {isSelected ? (
                                                                        <CheckSquare className="size-4" />
                                                                    ) : (
                                                                        <Square className="size-4 text-muted-foreground" />
                                                                    )}
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-3.5">
                                                                {isSelected ? (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-rust text-white text-[10px] font-black uppercase tracking-wider">
                                                                        Stop #{stopIndex + 1}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground text-[11px]">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 font-mono font-bold text-brand-text">
                                                                {booking.reference_number}
                                                            </td>
                                                            <td className="px-4 py-3.5">
                                                                <div className="font-semibold text-brand-text">
                                                                    {booking.sender.first_name} {booking.sender.last_name}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-slate-700">
                                                                <div className="flex items-center gap-1.5">
                                                                    <MapPin className="size-3 text-brand-rust shrink-0" />
                                                                    <span className="font-semibold text-xs text-slate-800 font-sans">{getBookingPickupArea(booking)}</span>
                                                                </div>
                                                                {[booking.sender.suburb, booking.sender.state].filter(Boolean).length > 0 && (
                                                                    <div className="text-[10px] text-slate-400 mt-0.5 ml-4.5 font-sans">
                                                                        {[booking.sender.suburb, booking.sender.state].filter(Boolean).join(', ')}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-center">
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-brand-warm/60 border border-brand-sand/50 text-brand-rust font-bold text-[11px]">
                                                                    {booking.boxes_without_serial_count} {booking.boxes_without_serial_count === 1 ? 'Box' : 'Boxes'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3.5">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    {booking.payment_status}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-brand-text-mid font-mono text-[11px]">
                                                                {booking.preferred_date ? booking.preferred_date.substring(0, 10) : '—'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                                    {filteredBookings.map((booking) => {
                                        const isSelected = data.booking_ids.includes(booking.id);

                                        return (
                                            <div
                                                key={booking.id}
                                                onClick={() => handleToggleBooking(booking)}
                                                className={`group flex flex-col p-5 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden ${isSelected
                                                        ? 'border-brand-rust bg-white ring-4 ring-brand-rust/10'
                                                        : 'border-brand-sand/30 bg-white/60 hover:bg-white hover:border-brand-rust/40'
                                                    }`}
                                            >
                                                {/* Stop Sequence Badge */}
                                                {isSelected && (
                                                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-brand-rust text-white text-[9px] font-black uppercase tracking-widest shadow-xs flex items-center gap-1 z-10 animate-in fade-in zoom-in-95">
                                                        <span>Stop #{data.booking_ids.indexOf(booking.id) + 1}</span>
                                                    </div>
                                                )}

                                                {/* Selection Checkmark Badge */}
                                                <div className={`absolute top-3 right-3 size-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-brand-rust border-brand-rust text-white shadow-xs' : 'border-brand-sand/40 bg-white group-hover:border-brand-rust/40'
                                                    }`}>
                                                    {isSelected && <Check className="size-3.5 stroke-[3px]" />}
                                                </div>

                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="p-2.5 rounded-lg bg-brand-warm text-brand-rust">
                                                        <Box className="size-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-brand-text tracking-tighter uppercase font-mono">{booking.reference_number}</p>
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Booking Status: {booking.payment_status}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 flex-1 pb-2">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-black text-brand-rust uppercase tracking-widest bg-brand-warm px-2 py-0.5 rounded">Sender</span>
                                                            <p className="text-xs font-black text-brand-text uppercase truncate">
                                                                 {booking.sender.first_name} {booking.sender.last_name}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Pickup Area & Pickup Date in Grid Card */}
                                                    <div className="space-y-1 pt-1">
                                                        <div className="flex items-center gap-1.5 text-slate-700">
                                                            <MapPin className="size-3 text-brand-rust shrink-0" />
                                                            <span className="font-semibold text-xs text-slate-800 font-sans">{getBookingPickupArea(booking)}</span>
                                                            {[booking.sender.suburb, booking.sender.state].filter(Boolean).length > 0 && (
                                                                <span className="text-[10px] text-slate-400 font-sans truncate">
                                                                    ({[booking.sender.suburb, booking.sender.state].filter(Boolean).join(', ')})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-slate-600">
                                                            <Calendar className="size-3 text-brand-rust shrink-0" />
                                                            <span className="text-[11px] font-medium text-slate-600 font-sans">
                                                                {booking.preferred_date ? booking.preferred_date.substring(0, 10) : 'Unscheduled'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="pt-3 border-t border-brand-sand/40 flex justify-between items-center relative z-10">
                                                        <p className="text-[10px] font-black text-brand-text/60 uppercase tracking-tighter">
                                                            Ready for pickup
                                                        </p>
                                                        <span className="text-[9px] font-bold text-brand-rust uppercase tracking-widest bg-white/90 backdrop-blur-sm border border-brand-rust/20 px-2.5 py-1 rounded-md shadow-xs">
                                                            {booking.boxes_without_serial_count} Box(es)
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Decorative backdrop */}
                                                <div className="absolute -bottom-4 -right-2 text-[60px] font-black text-brand-rust/5 pointer-events-none select-none italic font-serif">
                                                    PICKUP
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
