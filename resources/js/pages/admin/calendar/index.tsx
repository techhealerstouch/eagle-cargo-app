import React, { useState, useEffect, useCallback } from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/common/heading';
import { EventCalendar } from '@/components/calendar/EventCalendar';
import { EventModal } from '@/components/calendar/EventModal';
import { EventDetailModal } from '@/components/calendar/EventDetailModal';
import type {
    CalendarEvent,
    PickupZoneOption,
    AreaOption,
    BatchOption,
    CalendarMetrics,
} from '@/types/calendar';
import type { BreadcrumbItem } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Layers,
    Calendar as CalendarIcon,
    AlertOctagon,
    Truck,
    Plus,
    Download,
    Ship,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays, addDays } from 'date-fns';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Event Calendar', href: '/admin/calendar' },
];

interface AdminCalendarProps {
    initialEvents: CalendarEvent[];
    pickupZones: PickupZoneOption[];
    areas: AreaOption[];
    batches: BatchOption[];
    metrics?: CalendarMetrics;
    categories: { value: string; label: string }[];
    eventTypes: { value: string; label: string; defaultColor: string }[];
    visibilities: { value: string; label: string }[];
    filters?: {
        start_date?: string;
        end_date?: string;
        pickup_zone_id?: string | number;
        category?: string;
        event_type?: string;
    };
}

export default function AdminCalendarIndex({
    initialEvents = [],
    pickupZones = [],
    areas = [],
    batches = [],
    metrics,
    categories = [],
    eventTypes = [],
    visibilities = [],
}: AdminCalendarProps) {
    const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
    const [currentMetrics, setCurrentMetrics] = useState<CalendarMetrics | undefined>(metrics);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedZone, setSelectedZone] = useState<string>('all');
    const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());

    useEffect(() => {
        setEvents(initialEvents);
    }, [initialEvents]);

    useEffect(() => {
        setCurrentMetrics(metrics);
    }, [metrics]);

    const fetchEventsForRange = useCallback(async (date: Date, zone: string) => {
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        const startStr = format(subDays(monthStart, 7), 'yyyy-MM-dd');
        const endStr = format(addDays(monthEnd, 7), 'yyyy-MM-dd');

        try {
            const params = new URLSearchParams({
                start: startStr,
                end: endStr,
                target_date: format(date, 'yyyy-MM-dd'),
            });
            if (zone && zone !== 'all') {
                params.append('pickup_zone_id', zone);
            }
            const res = await fetch(`/admin/calendar/feed?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (data.events) {
                    setEvents(data.events);
                }
                if (data.metrics) {
                    setCurrentMetrics(data.metrics);
                }
            }
        } catch (err) {
            console.error('Failed to fetch calendar feed:', err);
        }
    }, []);

    const handleMonthChange = (date: Date) => {
        setCurrentMonthDate(date);
        fetchEventsForRange(date, selectedZone);
    };

    const handleZoneChange = (zone: string) => {
        setSelectedZone(zone);
        fetchEventsForRange(currentMonthDate, zone);
    };

    const handleAddEvent = (date?: Date) => {
        setEditingEvent(null);
        setSelectedDate(date || new Date());
        setIsModalOpen(true);
    };

    const handleSelectEvent = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setIsDetailOpen(true);
    };

    const handleEditFromDetail = (event: CalendarEvent) => {
        setEditingEvent(event);
        setIsModalOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Operations & Event Calendar | Admin" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 w-full">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
                    <Heading
                        eyebrow="Operations & Logistics"
                        title="Event & Schedule Calendar"
                        description="Monitor batch cut-offs, vessel movements, driver pickup runs, operational blackout dates, and marketing campaigns."
                    />

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <Link href="/admin/runsheets/pickups/calendar">
                            <Button variant="outline" size="sm" className="gap-1.5 h-9 shadow-xs text-xs font-semibold">
                                <Truck className="w-4 h-4 text-brand-rust" />
                                <span>Pickup Dispatch Calendar</span>
                            </Button>
                        </Link>

                        <a href="/admin/calendar/export.ics" download="operations_calendar.ics">
                            <Button variant="outline" size="sm" className="gap-1.5 h-9 shadow-xs">
                                <Download className="w-4 h-4" />
                                <span>Export iCal (.ics)</span>
                            </Button>
                        </a>

                        <Button
                            size="sm"
                            onClick={() => handleAddEvent()}
                            className="gap-1.5 h-9 shadow-xs"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Custom Event</span>
                        </Button>
                    </div>
                </div>

                {/* Operations Metric Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
                    <Card className="border border-border/80 shadow-xs bg-card hover:border-indigo-500/40 hover:shadow-sm transition-all relative overflow-hidden group">
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-indigo-600" />
                        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Batches</p>
                                <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                                    {currentMetrics?.active_batches_count ?? 0}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-medium">In transit & loading</p>
                            </div>
                            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-2xs group-hover:scale-105 transition-transform">
                                <Ship className="w-5 h-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/80 shadow-xs bg-card hover:border-blue-500/40 hover:shadow-sm transition-all relative overflow-hidden group">
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Upcoming Cut-offs</p>
                                <p className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                                    {currentMetrics?.upcoming_cutoffs_count ?? 0}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-medium">Through month end</p>
                            </div>
                            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-2xs group-hover:scale-105 transition-transform">
                                <Layers className="w-5 h-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/80 shadow-xs bg-card hover:border-emerald-500/40 hover:shadow-sm transition-all relative overflow-hidden group">
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
                        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Monthly Runsheets</p>
                                <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                                    {currentMetrics?.monthly_runsheets_count ?? 0}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-medium">Pickups & deliveries</p>
                            </div>
                            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-2xs group-hover:scale-105 transition-transform">
                                <Truck className="w-5 h-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/80 shadow-xs bg-card hover:border-amber-500/40 hover:shadow-sm transition-all relative overflow-hidden group">
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                        <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Blackout Days</p>
                                <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                                    {currentMetrics?.active_blackouts_count ?? 0}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-medium">Bookings restricted</p>
                            </div>
                            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shadow-2xs group-hover:scale-105 transition-transform">
                                <AlertOctagon className="w-5 h-5" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Calendar Component */}
                <EventCalendar
                    events={events}
                    pickupZones={pickupZones}
                    canManage={true}
                    onAddEvent={handleAddEvent}
                    onSelectEvent={handleSelectEvent}
                    selectedZoneId={selectedZone}
                    onZoneChange={handleZoneChange}
                    onMonthChange={handleMonthChange}
                />

                {/* Create / Edit Modal */}
                <EventModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingEvent(null);
                        setSelectedDate(null);
                    }}
                    event={editingEvent}
                    initialDate={selectedDate}
                    pickupZones={pickupZones}
                    areas={areas}
                    batches={batches}
                    categories={categories}
                    eventTypes={eventTypes}
                    visibilities={visibilities}
                />

                {/* View Event Detail Modal */}
                <EventDetailModal
                    isOpen={isDetailOpen}
                    onClose={() => {
                        setIsDetailOpen(false);
                        setSelectedEvent(null);
                    }}
                    event={selectedEvent}
                    onEdit={handleEditFromDetail}
                    canManage={true}
                />
            </div>
        </AppLayout>
    );
}
