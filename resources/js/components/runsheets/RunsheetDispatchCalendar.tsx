import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, router } from '@inertiajs/react';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Plus,
    Truck,
    Package,
    AlertCircle,
    CheckCircle2,
    MapPin,
    Phone,
    Eye,
    Pencil,
    List,
    RefreshCw,
    Search,
    CheckSquare,
    Square,
    ArrowRight,
} from 'lucide-react';
import {
    format,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    addDays,
    subDays,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isToday,
    parseISO,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import Heading from '@/components/common/heading';

export interface RunsheetDriver {
    id: number;
    name: string;
    email?: string | null;
    mobile?: string | null;
    role: string;
}

export interface RunsheetItem {
    id: number;
    type: 'pickup' | 'delivery';
    scheduled_date: string | null;
    timeslot?: string | null;
    area_description: string;
    status: 'draft' | 'assigned' | 'in_progress' | 'completed';
    driver: RunsheetDriver | null;
    total_stops: number;
    total_boxes: number;
    completed_boxes: number;
    progress_pct: number;
    items?: Array<{
        id: number;
        reference_number: string;
        customer_name: string;
        phone?: string | null;
        address: string;
        suburb?: string | null;
        area?: string | null;
        box_count?: number;
        payment_status?: string;
        status?: string;
    }>;
}

export interface PendingDispatchItem {
    type: 'pickup' | 'delivery';
    id: number;
    reference_number: string;
    date: string | null;
    customer_name: string;
    phone?: string | null;
    address: string;
    suburb?: string | null;
    pickup_zone_id?: number | null;
    pickup_zone_name?: string | null;
    area_id?: number | null;
    area_name?: string | null;
    box_count: number;
    box_types: string[];
    payment_status: string;
    runsheet_id?: number | null;
    is_assigned: boolean;
    runsheet_status?: string | null;
}

export interface DailySummary {
    date: string;
    total_stops: number;
    total_boxes: number;
    unassigned_count: number;
    unassigned_boxes: number;
    active_runsheets_count: number;
    completed_runsheets_count: number;
    runsheets_count: number;
}

export interface CalendarMetrics {
    upcoming_stops: number;
    total_boxes: number;
    unassigned_count: number;
    active_runsheets_count: number;
    completed_runsheets_count: number;
    total_runsheets_count: number;
    completion_rate: number;
}

export interface DispatchCalendarData {
    type: 'pickup' | 'delivery' | 'all';
    start: string;
    end: string;
    runsheets: RunsheetItem[];
    pending_items: PendingDispatchItem[];
    daily_summaries: Record<string, DailySummary>;
    metrics: CalendarMetrics;
}

interface RunsheetDispatchCalendarProps {
    mode: 'pickup' | 'delivery' | 'all';
    initialData: DispatchCalendarData;
    pickers?: Array<{ id: number; name: string; email?: string; picker?: { mobile?: string } | null }>;
    couriers?: Array<{ id: number; name: string; email?: string; courier?: { mobile?: string } | null }>;
    pickupZones?: Array<{ id: number; name: string; code: string }>;
    areas?: Array<{ id: number; name: string }>;
    tableUrl: string;
    eyebrow?: string;
}

type ViewMode = 'month' | 'week' | 'day';

const STATUS_CONFIG: Record<string, { label: string; badge: string; border: string; bg: string }> = {
    draft: {
        label: 'Draft',
        badge: 'bg-muted text-muted-foreground border-border',
        border: 'border-border',
        bg: 'bg-muted/40',
    },
    assigned: {
        label: 'Assigned',
        badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
        border: 'border-blue-500/30',
        bg: 'bg-blue-500/5',
    },
    in_progress: {
        label: 'In Progress',
        badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/5',
    },
    completed: {
        label: 'Completed',
        badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        border: 'border-emerald-500/30',
        bg: 'bg-emerald-500/5',
    },
};

export function RunsheetDispatchCalendar({
    mode,
    initialData,
    pickers = [],
    couriers = [],
    pickupZones = [],
    areas = [],
    tableUrl,
    eyebrow = 'Logistics Workflow',
}: RunsheetDispatchCalendarProps) {
    const [data, setData] = useState<DispatchCalendarData>(initialData);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [selectedType, setSelectedType] = useState<'pickup' | 'delivery' | 'all'>(mode);
    const [selectedDriver, setSelectedDriver] = useState<string>('all');
    const [selectedLocation, setSelectedLocation] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Day Details Drawer / Modal State
    const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
    const [selectedBookingIds, setSelectedBookingIds] = useState<number[]>([]);
    const [selectedRunsheet, setSelectedRunsheet] = useState<RunsheetItem | null>(null);

    // Sync with initialData changes
    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    // Async Feed Fetcher
    const fetchCalendarFeed = useCallback(
        async (targetDate: Date, type: string, driver: string, location: string) => {
            setIsLoading(true);
            const monthStart = startOfMonth(targetDate);
            const monthEnd = endOfMonth(targetDate);
            const startStr = format(subDays(monthStart, 7), 'yyyy-MM-dd');
            const endStr = format(addDays(monthEnd, 7), 'yyyy-MM-dd');

            const params = new URLSearchParams({
                start: startStr,
                end: endStr,
                type: type,
            });

            if (driver && driver !== 'all') {
                params.append('driver_id', driver);
            }

            if (location && location !== 'all') {
                if (type === 'pickup') {
                    params.append('zone_id', location);
                } else if (type === 'delivery') {
                    params.append('area_id', location);
                }
            }

            try {
                const res = await fetch(`/admin/runsheets/calendar/feed?${params.toString()}`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error('Failed to fetch dispatch calendar feed:', err);
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    // Navigation Handlers
    const handlePrev = () => {
        let next: Date;
        if (viewMode === 'month') next = subMonths(currentDate, 1);
        else if (viewMode === 'week') next = subWeeks(currentDate, 1);
        else next = subDays(currentDate, 1);

        setCurrentDate(next);
        if (viewMode === 'month' || !isSameMonth(next, currentDate)) {
            fetchCalendarFeed(next, selectedType, selectedDriver, selectedLocation);
        }
    };

    const handleNext = () => {
        let next: Date;
        if (viewMode === 'month') next = addMonths(currentDate, 1);
        else if (viewMode === 'week') next = addWeeks(currentDate, 1);
        else next = addDays(currentDate, 1);

        setCurrentDate(next);
        if (viewMode === 'month' || !isSameMonth(next, currentDate)) {
            fetchCalendarFeed(next, selectedType, selectedDriver, selectedLocation);
        }
    };

    const handleToday = () => {
        const next = new Date();
        setCurrentDate(next);
        fetchCalendarFeed(next, selectedType, selectedDriver, selectedLocation);
    };

    // Filter Changes
    const handleTypeChange = (newType: 'pickup' | 'delivery' | 'all') => {
        setSelectedType(newType);
        fetchCalendarFeed(currentDate, newType, selectedDriver, selectedLocation);
    };

    const handleDriverChange = (driverId: string) => {
        setSelectedDriver(driverId);
        fetchCalendarFeed(currentDate, selectedType, driverId, selectedLocation);
    };

    const handleLocationChange = (locId: string) => {
        setSelectedLocation(locId);
        fetchCalendarFeed(currentDate, selectedType, selectedDriver, locId);
    };

    // Days for the view
    const daysInView = useMemo(() => {
        if (viewMode === 'month') {
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            const start = startOfWeek(monthStart, { weekStartsOn: 1 });
            const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end });
        } else if (viewMode === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end });
        } else {
            return [currentDate];
        }
    }, [currentDate, viewMode]);

    // Filtered runsheets and pending items based on status/search
    const filteredRunsheets = useMemo(() => {
        return (data.runsheets || []).filter((rs) => {
            if (selectedStatus !== 'all') {
                if (selectedStatus === 'unassigned') return false;
                if (rs.status !== selectedStatus) return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchArea = rs.area_description.toLowerCase().includes(q);
                const matchDriver = rs.driver?.name.toLowerCase().includes(q) ?? false;
                const matchItems = rs.items?.some((item) =>
                    item.reference_number.toLowerCase().includes(q) ||
                    item.customer_name.toLowerCase().includes(q)
                ) ?? false;
                if (!matchArea && !matchDriver && !matchItems) return false;
            }
            return true;
        });
    }, [data.runsheets, selectedStatus, searchQuery]);

    const filteredPendingItems = useMemo(() => {
        return (data.pending_items || []).filter((item) => {
            if (selectedStatus !== 'all') {
                if (selectedStatus === 'unassigned' && item.is_assigned) return false;
                if (selectedStatus !== 'unassigned' && !item.is_assigned) return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchRef = item.reference_number.toLowerCase().includes(q);
                const matchCust = item.customer_name.toLowerCase().includes(q);
                const matchAddr = item.address.toLowerCase().includes(q);
                if (!matchRef && !matchCust && !matchAddr) return false;
            }
            return true;
        });
    }, [data.pending_items, selectedStatus, searchQuery]);

    // Open Day Dispatch Drawer
    const handleOpenDay = (dateStr: string) => {
        setSelectedDayDate(dateStr);
        const dayPending = (data.pending_items || []).filter(
            (item) => item.date === dateStr && !item.is_assigned
        );
        setSelectedBookingIds(dayPending.map((p) => p.id));
    };

    // Toggle bulk item selection in Day Drawer
    const toggleSelectBooking = (id: number) => {
        setSelectedBookingIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    // One-click Assign Runsheet Action
    const handleAssignRunsheet = (targetDate: string, ids: number[]) => {
        const isDelivery = selectedType === 'delivery';
        const routeType = isDelivery ? 'delivery' : 'pickup';
        const idParam = isDelivery ? 'box_ids' : 'booking_ids';

        const params = new URLSearchParams({
            type: routeType,
            scheduled_date: targetDate,
        });

        if (ids.length > 0) {
            params.append(idParam, ids.join(','));
        }

        router.visit(`/admin/runsheets/create?${params.toString()}`);
    };

    const isPickupMode = selectedType === 'pickup';
    const isDeliveryMode = selectedType === 'delivery';

    return (
        <div className="flex h-full flex-1 flex-col gap-4 p-4 sm:p-5 md:p-6 min-w-0 w-full">
            {/* Page Header with Dual View Switcher */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-brand-warm/20 pb-4">
                <Heading
                    eyebrow={eyebrow}
                    title={
                        isPickupMode
                            ? 'Pickup Schedule Calendar'
                            : isDeliveryMode
                            ? 'Delivery Schedule Calendar'
                            : 'Dispatch & Fleet Calendar'
                    }
                    description={
                        isPickupMode
                            ? 'Track upcoming box collections, bundle customer requests into driver runsheets, and monitor pickup progress.'
                            : isDeliveryMode
                            ? 'Track devanned arrivals, assign recipient delivery routes, and monitor courier proof-of-delivery.'
                            : 'Unified calendar view to monitor both pickup collections and doorstep delivery runs.'
                    }
                />

                {/* View Switcher & Action Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* View Switcher: Table vs Calendar */}
                    <div className="inline-flex rounded-xl bg-muted/60 p-1 border shadow-xs">
                        <Link
                            href={tableUrl}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <List className="w-3.5 h-3.5" />
                            <span>Table View</span>
                        </Link>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-background text-foreground shadow-xs transition-all"
                        >
                            <CalendarIcon className="w-3.5 h-3.5 text-brand-rust" />
                            <span>Calendar View</span>
                        </button>
                    </div>

                    <Button
                        size="sm"
                        onClick={() =>
                            router.visit(
                                `/admin/runsheets/create?type=${isDeliveryMode ? 'delivery' : 'pickup'}`
                            )
                        }
                        className="bg-brand-rust text-white hover:bg-brand-rust/90 gap-1.5 h-9 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Runsheet</span>
                    </Button>
                </div>
            </div>

            {/* Operations KPI Metric Cards - Compact & Space-Efficient */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {/* 1. Upcoming Stops */}
                <Card className="border border-border/80 shadow-2xs hover:border-blue-500/40 transition-all relative overflow-hidden group bg-card">
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
                    <CardContent className="p-2.5 sm:px-3.5 sm:py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                                {isDeliveryMode ? 'Scheduled Deliveries' : 'Scheduled Collections'}
                            </p>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-none">
                                    {data.metrics?.upcoming_stops ?? 0}
                                </span>
                                <span className="text-[11px] text-muted-foreground font-medium truncate">
                                    {data.metrics?.total_boxes ?? 0} boxes
                                </span>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                            {isDeliveryMode ? <Truck className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Unassigned Needs Runsheet */}
                <Card
                    className={`border border-border/80 shadow-2xs transition-all relative overflow-hidden group bg-card ${
                        (data.metrics?.unassigned_count ?? 0) > 0
                            ? 'border-amber-500/40 bg-amber-500/5'
                            : 'hover:border-amber-500/40'
                    }`}
                >
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />
                    <CardContent className="p-2.5 sm:px-3.5 sm:py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                                Unassigned Items
                            </p>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight leading-none">
                                    {data.metrics?.unassigned_count ?? 0}
                                </span>
                                <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium truncate">
                                    {(data.metrics?.unassigned_count ?? 0) > 0
                                        ? 'Needs dispatch'
                                        : 'All assigned'}
                                </span>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                            <AlertCircle className="w-4 h-4" />
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Active Runsheets on Route */}
                <Card className="border border-border/80 shadow-2xs hover:border-emerald-500/40 transition-all relative overflow-hidden group bg-card">
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
                    <CardContent className="p-2.5 sm:px-3.5 sm:py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                                Active Runsheets
                            </p>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">
                                    {data.metrics?.active_runsheets_count ?? 0}
                                </span>
                                <span className="text-[11px] text-muted-foreground font-medium truncate">
                                    {data.metrics?.total_runsheets_count ?? 0} total
                                </span>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                            <Truck className="w-4 h-4" />
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Completion Rate */}
                <Card className="border border-border/80 shadow-2xs hover:border-indigo-500/40 transition-all relative overflow-hidden group bg-card">
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
                    <CardContent className="p-2.5 sm:px-3.5 sm:py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                                Completion Rate
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight leading-none">
                                    {data.metrics?.completion_rate ?? 0}%
                                </span>
                                <div className="flex-1 max-w-[80px] bg-muted rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className="bg-indigo-600 h-1.5 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, data.metrics?.completion_rate ?? 0)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter and Calendar Navigation Bar */}
            <div className="bg-card rounded-xl border shadow-xs p-3.5 sm:p-4 space-y-3.5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
                    {/* Date Navigation */}
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center rounded-xl border bg-background shadow-2xs">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handlePrev}
                                className="h-8 w-8 rounded-l-xl rounded-r-none text-muted-foreground hover:text-foreground"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleToday}
                                className="h-8 px-2.5 text-xs font-semibold rounded-none border-x hover:text-brand-rust"
                            >
                                Today
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleNext}
                                className="h-8 w-8 rounded-r-xl rounded-l-none text-muted-foreground hover:text-foreground"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>

                        <h2 className="text-base sm:text-lg font-bold text-foreground">
                            {format(currentDate, viewMode === 'day' ? 'EEEE, MMMM d, yyyy' : 'MMMM yyyy')}
                        </h2>

                        {isLoading && (
                            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin ml-1" />
                        )}
                    </div>

                    {/* View Granularity (Month / Week / Day) */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {mode === 'all' && (
                            <div className="inline-flex rounded-xl bg-muted/60 p-1 border text-xs">
                                <button
                                    onClick={() => handleTypeChange('all')}
                                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                                        selectedType === 'all'
                                            ? 'bg-background text-foreground shadow-xs font-semibold'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    All Runs
                                </button>
                                <button
                                    onClick={() => handleTypeChange('pickup')}
                                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                                        selectedType === 'pickup'
                                            ? 'bg-background text-foreground shadow-xs font-semibold'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    📦 Pickups
                                </button>
                                <button
                                    onClick={() => handleTypeChange('delivery')}
                                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                                        selectedType === 'delivery'
                                            ? 'bg-background text-foreground shadow-xs font-semibold'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    🚚 Deliveries
                                </button>
                            </div>
                        )}

                        <div className="inline-flex rounded-xl bg-muted/60 p-1 border text-xs">
                            <button
                                onClick={() => setViewMode('month')}
                                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                                    viewMode === 'month'
                                        ? 'bg-background text-foreground shadow-xs font-semibold'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Month
                            </button>
                            <button
                                onClick={() => setViewMode('week')}
                                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                                    viewMode === 'week'
                                        ? 'bg-background text-foreground shadow-xs font-semibold'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Week
                            </button>
                            <button
                                onClick={() => setViewMode('day')}
                                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                                    viewMode === 'day'
                                        ? 'bg-background text-foreground shadow-xs font-semibold'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Day
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter Controls Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t text-xs">
                    {/* Driver Filter */}
                    <div className="flex flex-col gap-1">
                        <label className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                            {isDeliveryMode ? 'Courier' : 'Picker (Driver)'}
                        </label>
                        <select
                            value={selectedDriver}
                            onChange={(e) => handleDriverChange(e.target.value)}
                            className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-rust"
                        >
                            <option value="all">All Drivers</option>
                            {(isDeliveryMode ? couriers : pickers).map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                    {driver.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Zone / Area Filter */}
                    <div className="flex flex-col gap-1">
                        <label className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                            {isDeliveryMode ? 'Destination Area' : 'Pickup Zone'}
                        </label>
                        <select
                            value={selectedLocation}
                            onChange={(e) => handleLocationChange(e.target.value)}
                            className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-rust"
                        >
                            <option value="all">All Locations</option>
                            {isDeliveryMode
                                ? areas.map((area) => (
                                      <option key={area.id} value={area.id}>
                                          {area.name}
                                      </option>
                                  ))
                                : pickupZones.map((zone) => (
                                      <option key={zone.id} value={zone.id}>
                                          {zone.name} ({zone.code})
                                      </option>
                                  ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex flex-col gap-1">
                        <label className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                            Status
                        </label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-rust"
                        >
                            <option value="all">All Statuses</option>
                            <option value="unassigned">⚠️ Unassigned Only</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>

                    {/* Quick Search */}
                    <div className="flex flex-col gap-1">
                        <label className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                            Search Stops
                        </label>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Ref, customer, suburb..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-rust"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar Grid View (Month / Week) or Day Dispatch View */}
            {viewMode === 'day' ? (
                (() => {
                    const dateStr = format(currentDate, 'yyyy-MM-dd');
                    const dayRunsheets = filteredRunsheets.filter((rs) => rs.scheduled_date === dateStr);
                    const dayPending = filteredPendingItems.filter((item) => item.date === dateStr);
                    const unassigned = dayPending.filter((item) => !item.is_assigned);

                    return (
                        <div className="bg-card rounded-xl border shadow-xs p-5 sm:p-6 space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                                <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-rust bg-brand-rust/10 px-2 py-0.5 rounded">
                                        Day Dispatch Board
                                    </span>
                                    <h2 className="text-xl sm:text-2xl font-bold text-foreground font-sans mt-1">
                                        {format(currentDate, 'EEEE, MMMM d, yyyy')}
                                    </h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {dayRunsheets.length} active runsheets • {dayPending.length} total scheduled stops ({unassigned.length} unassigned)
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => handleOpenDay(dateStr)}
                                        className="bg-brand-rust text-white hover:bg-brand-rust/90 gap-1.5 h-8 text-xs font-bold shadow-xs"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Assign Day Runsheet</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Column 1: Runsheets for Date */}
                                <div className="space-y-3">
                                    <h3 className="font-bold text-sm text-foreground flex items-center justify-between">
                                        <span>Assigned Driver Runsheets</span>
                                        <Badge variant="outline">{dayRunsheets.length}</Badge>
                                    </h3>

                                    {dayRunsheets.length === 0 ? (
                                        <div className="p-6 border rounded-xl bg-muted/20 text-center space-y-2">
                                            <Truck className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                                            <p className="text-xs font-semibold text-foreground">No runsheets scheduled for this date</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                Click Assign Day Runsheet to create a runsheet for this date.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {dayRunsheets.map((rs) => {
                                                const config = STATUS_CONFIG[rs.status] || STATUS_CONFIG.draft;
                                                return (
                                                    <div
                                                        key={rs.id}
                                                        className={`p-4 rounded-xl border space-y-3 ${config.bg} ${config.border}`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-sm text-foreground">
                                                                    {rs.type === 'delivery' ? '🚚 Delivery' : '📦 Pickup'} Runsheet #{rs.id}
                                                                </span>
                                                                <Badge variant="outline" className={`text-xs ${config.badge}`}>
                                                                    {config.label}
                                                                </Badge>
                                                            </div>

                                                            <div className="flex items-center gap-1.5">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => router.visit(`/admin/runsheets/${rs.id}`)}
                                                                    className="h-7 px-2 text-xs"
                                                                >
                                                                    <Eye className="w-3 h-3 mr-1" />
                                                                    View
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => router.visit(`/admin/runsheets/${rs.id}/edit`)}
                                                                    className="h-7 px-2 text-xs"
                                                                >
                                                                    <Pencil className="w-3 h-3 mr-1" />
                                                                    Edit
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-background/50 p-2.5 rounded-lg border">
                                                            <div>
                                                                <span className="font-semibold text-foreground">Driver:</span>{' '}
                                                                {rs.driver?.name ?? 'Unassigned'}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-foreground">Area:</span>{' '}
                                                                {rs.area_description}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-foreground">Stops:</span>{' '}
                                                                {rs.total_stops} stops
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-foreground">Boxes:</span>{' '}
                                                                {rs.completed_boxes} / {rs.total_boxes} completed
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                                                                <span>Execution Progress</span>
                                                                <span>{rs.progress_pct}%</span>
                                                            </div>
                                                            <div className="w-full bg-muted/80 rounded-full h-2 overflow-hidden">
                                                                <div
                                                                    className="bg-emerald-600 h-2 rounded-full transition-all"
                                                                    style={{ width: `${rs.progress_pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Column 2: Scheduled Stops / Collections */}
                                <div className="space-y-3">
                                    <h3 className="font-bold text-sm text-foreground flex items-center justify-between">
                                        <span>Scheduled Customer Stops</span>
                                        <div className="flex items-center gap-1.5">
                                            {unassigned.length > 0 && (
                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                                    {unassigned.length} Unassigned
                                                </Badge>
                                            )}
                                            <Badge variant="outline">{dayPending.length}</Badge>
                                        </div>
                                    </h3>

                                    {dayPending.length === 0 ? (
                                        <div className="p-6 border rounded-xl bg-muted/20 text-center space-y-2">
                                            <Package className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                                            <p className="text-xs font-semibold text-foreground">No stops scheduled for this date</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                                            {dayPending.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                                                        item.is_assigned ? 'bg-muted/30 border-border opacity-70' : 'bg-card border-border shadow-2xs'
                                                    }`}
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-foreground text-xs">{item.customer_name}</span>
                                                            <span className="font-mono text-[11px] text-muted-foreground">#{item.reference_number}</span>
                                                        </div>
                                                        <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
                                                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                            <span>{item.address}</span>
                                                        </p>
                                                        <div className="flex items-center gap-2 pt-0.5">
                                                            <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-semibold text-foreground">
                                                                📦 {item.box_count} {item.box_count === 1 ? 'box' : 'boxes'}
                                                            </span>
                                                            {item.is_assigned ? (
                                                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                                    Assigned to Runsheet #{item.runsheet_id}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                                    ⚠️ Unassigned
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {item.phone && (
                                                        <a
                                                            href={`tel:${item.phone}`}
                                                            className="p-2 rounded-lg bg-muted text-foreground hover:bg-brand-rust hover:text-white transition-colors"
                                                            title={`Call ${item.phone}`}
                                                        >
                                                            <Phone className="w-3.5 h-3.5" />
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()
            ) : (
                <div className="bg-card rounded-2xl border shadow-xs overflow-hidden">
                    {/* Weekday Header */}
                    <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold text-muted-foreground">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                            <div key={day} className="py-2.5 border-r last:border-r-0 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 auto-rows-fr divide-y divide-x divide-border">
                        {daysInView.map((dayDate) => {
                            const dateStr = format(dayDate, 'yyyy-MM-dd');
                            const isCurrentMonth = isSameMonth(dayDate, currentDate);
                            const isDayToday = isToday(dayDate);

                            const daySummary = data.daily_summaries?.[dateStr];
                            const dayRunsheets = filteredRunsheets.filter((rs) => rs.scheduled_date === dateStr);
                            const dayPending = filteredPendingItems.filter(
                                (item) => item.date === dateStr && !item.is_assigned
                            );

                            const unassignedCount = dayPending.length;
                            const hasActivity = dayRunsheets.length > 0 || unassignedCount > 0;

                            return (
                                <div
                                    key={dateStr}
                                    onClick={() => handleOpenDay(dateStr)}
                                    className={`min-h-[120px] p-2 flex flex-col justify-between cursor-pointer transition-colors relative group select-none ${
                                        !isCurrentMonth ? 'bg-muted/15 text-muted-foreground/60' : 'bg-card'
                                    } ${isDayToday ? 'ring-2 ring-brand-rust/30 bg-brand-rust/5' : ''} hover:bg-muted/30`}
                                >
                                    {/* Date Number & Top Chips */}
                                    <div className="flex items-center justify-between gap-1 mb-1.5">
                                        <span
                                            className={`inline-flex items-center justify-center text-xs font-semibold rounded-full w-6 h-6 ${
                                                isDayToday
                                                    ? 'bg-brand-rust text-white font-bold shadow-xs'
                                                    : isCurrentMonth
                                                    ? 'text-foreground'
                                                    : 'text-muted-foreground/60'
                                            }`}
                                        >
                                            {format(dayDate, 'd')}
                                        </span>

                                        {/* Workload Count Badge */}
                                        {hasActivity && (
                                            <span className="text-[10px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded border">
                                                {daySummary?.total_boxes ?? 0}b
                                            </span>
                                        )}
                                    </div>

                                    {/* Runsheets & Unassigned Chips Stack */}
                                    <div className="space-y-1 flex-1 overflow-hidden">
                                        {/* Unassigned Warning Chip */}
                                        {unassignedCount > 0 && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenDay(dateStr);
                                                }}
                                                className="bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-md px-1.5 py-0.5 text-[11px] font-bold flex items-center justify-between shadow-2xs hover:bg-amber-500/25 transition-colors"
                                            >
                                                <span className="truncate">
                                                    ⚠️ {unassignedCount} Unassigned
                                                </span>
                                                <span className="text-[9px] bg-amber-500/20 px-1 rounded uppercase">
                                                    Assign
                                                </span>
                                            </div>
                                        )}

                                        {/* Runsheets for this day */}
                                        {dayRunsheets.slice(0, 3).map((rs) => {
                                            const config = STATUS_CONFIG[rs.status] || STATUS_CONFIG.draft;
                                            return (
                                                <div
                                                    key={rs.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedRunsheet(rs);
                                                    }}
                                                    className={`rounded-md p-1.5 text-[11px] border shadow-2xs hover:shadow-xs transition-all ${config.bg} ${config.border}`}
                                                >
                                                    <div className="flex items-center justify-between gap-1 leading-none">
                                                        <span className="font-bold text-foreground truncate">
                                                            {rs.type === 'delivery' ? '🚚' : '📦'} #{rs.id}{' '}
                                                            {rs.driver ? rs.driver.name.split(' ')[0] : 'No Driver'}
                                                        </span>
                                                        <span
                                                            className={`text-[9px] font-semibold px-1 py-0.2 rounded border ${config.badge}`}
                                                        >
                                                            {config.label}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                                                        <span>{rs.total_stops} stops • {rs.total_boxes}b</span>
                                                        {rs.status === 'in_progress' && (
                                                            <span className="font-bold text-amber-600 dark:text-amber-400">
                                                                {rs.progress_pct}%
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Mini progress bar if in progress */}
                                                    {rs.status === 'in_progress' && (
                                                        <div className="w-full bg-muted/60 rounded-full h-1 mt-1 overflow-hidden">
                                                            <div
                                                                className="bg-amber-500 h-1 rounded-full transition-all"
                                                                style={{ width: `${rs.progress_pct}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {dayRunsheets.length > 3 && (
                                            <p className="text-[10px] text-muted-foreground font-semibold px-1">
                                                +{dayRunsheets.length - 3} more runsheets
                                            </p>
                                        )}
                                    </div>

                                    {/* Hover Prompt */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-[10px] text-brand-rust font-bold flex items-center justify-end gap-0.5">
                                        <span>Manage</span>
                                        <ArrowRight className="w-2.5 h-2.5" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* DAY DISPATCH DRAWER / MODAL */}
            <Dialog
                open={selectedDayDate !== null}
                onOpenChange={(open) => !open && setSelectedDayDate(null)}
            >
                <DialogContent className="sm:max-w-2xl p-0 overflow-hidden shadow-2xl border max-h-[85vh] flex flex-col">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b bg-card space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="eyebrow">
                                Dispatch Operations
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                                {selectedDayDate && format(parseISO(selectedDayDate), 'EEEE, MMMM d, yyyy')}
                            </span>
                        </div>
                        <DialogTitle className="text-xl font-bold tracking-tight text-foreground font-sans">
                            {isDeliveryMode ? 'Delivery Stops & Routes' : 'Collection Stops & Runsheets'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Assign pending stops into driver runsheets or monitor live progress for this date.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Modal Content Scroll Area */}
                    <div className="px-6 py-4 overflow-y-auto space-y-6 flex-1 text-xs">
                        {/* Section 1: Pending & Unassigned Stops */}
                        {(() => {
                            const dayPending = (data.pending_items || []).filter(
                                (item) => item.date === selectedDayDate
                            );
                            const unassigned = dayPending.filter((item) => !item.is_assigned);

                            return (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-sm text-foreground">
                                                {isDeliveryMode ? 'Ready Deliveries' : 'Pending Collections'} ({dayPending.length})
                                            </h3>
                                            {unassigned.length > 0 && (
                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                                    {unassigned.length} Unassigned
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Action: Select All / Assign Runsheet */}
                                        {unassigned.length > 0 && (
                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    handleAssignRunsheet(
                                                        selectedDayDate || '',
                                                        selectedBookingIds
                                                    )
                                                }
                                                disabled={selectedBookingIds.length === 0}
                                                className="bg-brand-rust text-white hover:bg-brand-rust/90 gap-1.5 text-xs font-bold shadow-xs h-8"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Assign Runsheet ({selectedBookingIds.length})</span>
                                            </Button>
                                        )}
                                    </div>

                                    {dayPending.length === 0 ? (
                                        <p className="text-xs text-muted-foreground p-3 border rounded-xl bg-muted/20 text-center">
                                            No pending {isDeliveryMode ? 'deliveries' : 'collections'} scheduled for this date.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {dayPending.map((item) => {
                                                const isSelected = selectedBookingIds.includes(item.id);
                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() =>
                                                            !item.is_assigned && toggleSelectBooking(item.id)
                                                        }
                                                        className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                                                            item.is_assigned
                                                                ? 'bg-muted/30 border-border opacity-70 cursor-default'
                                                                : isSelected
                                                                ? 'bg-brand-rust/5 border-brand-rust shadow-xs cursor-pointer'
                                                                : 'bg-card border-border hover:border-brand-rust/40 cursor-pointer'
                                                        }`}
                                                    >
                                                        {!item.is_assigned ? (
                                                            <div className="pt-0.5">
                                                                {isSelected ? (
                                                                    <CheckSquare className="w-4 h-4 text-brand-rust" />
                                                                ) : (
                                                                    <Square className="w-4 h-4 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="pt-0.5">
                                                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                            </div>
                                                        )}

                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-bold text-foreground text-xs">
                                                                    {item.customer_name}
                                                                </span>
                                                                <span className="font-mono text-[11px] text-muted-foreground">
                                                                    #{item.reference_number}
                                                                </span>
                                                            </div>

                                                            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                                                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                                <span>{item.address}</span>
                                                            </p>

                                                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                                                                <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-semibold text-foreground">
                                                                    📦 {item.box_count} {item.box_count === 1 ? 'box' : 'boxes'}
                                                                </span>
                                                                <span className="bg-muted px-2 py-0.5 rounded text-[10px] text-muted-foreground capitalize">
                                                                    {item.payment_status}
                                                                </span>
                                                                {item.is_assigned && (
                                                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                                        Assigned to Runsheet #{item.runsheet_id}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {item.phone && (
                                                            <a
                                                                href={`tel:${item.phone}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="p-2 rounded-lg bg-muted text-foreground hover:bg-brand-rust hover:text-white transition-colors"
                                                                title={`Call ${item.phone}`}
                                                            >
                                                                <Phone className="w-3.5 h-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Section 2: Active Runsheets for Date */}
                        {(() => {
                            const dayRunsheets = (data.runsheets || []).filter(
                                (rs) => rs.scheduled_date === selectedDayDate
                            );

                            return (
                                <div className="space-y-3 pt-3 border-t">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-sm text-foreground">
                                            Assigned Runsheets ({dayRunsheets.length})
                                        </h3>
                                    </div>

                                    {dayRunsheets.length === 0 ? (
                                        <p className="text-xs text-muted-foreground p-3 border rounded-xl bg-muted/20 text-center">
                                            No driver runsheets created yet for this date.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {dayRunsheets.map((rs) => {
                                                const config = STATUS_CONFIG[rs.status] || STATUS_CONFIG.draft;
                                                return (
                                                    <div
                                                        key={rs.id}
                                                        className={`p-3.5 rounded-xl border space-y-2.5 ${config.bg} ${config.border}`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-sm text-foreground">
                                                                    Runsheet #{rs.id}
                                                                </span>
                                                                <Badge variant="outline" className={`text-xs ${config.badge}`}>
                                                                    {config.label}
                                                                </Badge>
                                                            </div>

                                                            <div className="flex items-center gap-1.5">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => router.visit(`/admin/runsheets/${rs.id}`)}
                                                                    className="h-7 px-2 text-xs"
                                                                >
                                                                    <Eye className="w-3 h-3 mr-1" />
                                                                    View
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => router.visit(`/admin/runsheets/${rs.id}/edit`)}
                                                                    className="h-7 px-2 text-xs"
                                                                >
                                                                    <Pencil className="w-3 h-3 mr-1" />
                                                                    Edit
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Driver & Route Info */}
                                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                                            <div>
                                                                <span className="font-semibold text-foreground">Driver:</span>{' '}
                                                                {rs.driver?.name ?? 'Unassigned'}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-foreground">Area:</span>{' '}
                                                                {rs.area_description}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-foreground">Stops:</span>{' '}
                                                                {rs.total_stops} stops
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-foreground">Boxes:</span>{' '}
                                                                {rs.completed_boxes} of {rs.total_boxes} completed
                                                            </div>
                                                        </div>

                                                        {/* Live Progress Bar */}
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                                                                <span>Progress</span>
                                                                <span>{rs.progress_pct}%</span>
                                                            </div>
                                                            <div className="w-full bg-muted/80 rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className="bg-emerald-600 h-1.5 rounded-full transition-all"
                                                                    style={{ width: `${rs.progress_pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Individual Runsheet Detail Quick Modal */}
            <Dialog
                open={selectedRunsheet !== null}
                onOpenChange={(open) => !open && setSelectedRunsheet(null)}
            >
                <DialogContent className="sm:max-w-lg p-0 overflow-hidden shadow-2xl border">
                    {selectedRunsheet && (
                        <>
                            <DialogHeader className="px-6 pt-6 pb-4 border-b bg-card space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="outline"
                                            className={`text-xs ${
                                                STATUS_CONFIG[selectedRunsheet.status]?.badge || ''
                                            }`}
                                        >
                                            {STATUS_CONFIG[selectedRunsheet.status]?.label || selectedRunsheet.status}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {selectedRunsheet.scheduled_date}
                                        </span>
                                    </div>
                                    <span className="text-xs font-mono text-muted-foreground">
                                        ID #{selectedRunsheet.id}
                                    </span>
                                </div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-foreground font-sans">
                                    {selectedRunsheet.type === 'delivery' ? 'Delivery Runsheet' : 'Pickup Runsheet'} #{selectedRunsheet.id}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    {selectedRunsheet.area_description}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="px-6 py-5 space-y-4 text-xs">
                                {/* Driver Strip */}
                                <div className="p-3 bg-muted/30 border rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                                            {selectedRunsheet.driver?.name?.charAt(0) || 'D'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground">
                                                {selectedRunsheet.driver?.name || 'Unassigned Driver'}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {selectedRunsheet.driver?.mobile || 'No contact number'}
                                            </p>
                                        </div>
                                    </div>

                                    {selectedRunsheet.driver?.mobile && (
                                        <a
                                            href={`tel:${selectedRunsheet.driver.mobile}`}
                                            className="p-2 rounded-lg bg-background border hover:bg-brand-rust hover:text-white transition-colors"
                                            title="Call Driver"
                                        >
                                            <Phone className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>

                                {/* Stops & Completion */}
                                <div className="grid grid-cols-2 gap-3 p-3 border rounded-xl">
                                    <div>
                                        <p className="text-[11px] text-muted-foreground font-semibold">Total Stops</p>
                                        <p className="text-lg font-black text-foreground">
                                            {selectedRunsheet.total_stops}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-muted-foreground font-semibold">Boxes Collected/Delivered</p>
                                        <p className="text-lg font-black text-foreground">
                                            {selectedRunsheet.completed_boxes} / {selectedRunsheet.total_boxes}
                                        </p>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSelectedRunsheet(null)}
                                        className="text-xs"
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.visit(`/admin/runsheets/${selectedRunsheet.id}/edit`)}
                                        className="text-xs gap-1.5"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        <span>Edit Runsheet</span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => router.visit(`/admin/runsheets/${selectedRunsheet.id}`)}
                                        className="bg-brand-rust text-white hover:bg-brand-rust/90 text-xs gap-1.5"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Open Runsheet</span>
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
