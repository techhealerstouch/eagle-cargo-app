import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/common/heading';
import { EventCalendar } from '@/components/calendar/EventCalendar';
import { EventDetailModal } from '@/components/calendar/EventDetailModal';
import type { CalendarEvent, PickupZoneOption, UpcomingCutoffInfo } from '@/types/calendar';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, addDays } from 'date-fns';
import {
    Ship,
    PlusCircle,
    Download,
    Calendar as CalendarIcon,
    ArrowRight,
    Sparkles,
    PackageCheck,
    Anchor,
} from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Schedules & Cut-offs', href: '/calendar' },
];

interface SenderCalendarProps {
    events: CalendarEvent[];
    pickupZones: PickupZoneOption[];
    selectedZoneId?: number | null;
    nextCutoff?: UpcomingCutoffInfo | null;
}

export default function SenderCalendar({
    events = [],
    pickupZones = [],
    selectedZoneId,
    nextCutoff,
}: SenderCalendarProps) {
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [currentZone, setCurrentZone] = useState<string>(
        selectedZoneId ? String(selectedZoneId) : 'all'
    );

    const handleSelectEvent = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setIsDetailOpen(true);
    };

    // Build Google Calendar Add Link for Next Cut-Off
    const buildGoogleCalendarUrl = (cutoff: UpcomingCutoffInfo) => {
        const title = encodeURIComponent(
            `Love Balikbayan Loading Cut-off (${cutoff.batch_number ? `Batch #${cutoff.batch_number}` : cutoff.title})`
        );
        const details = encodeURIComponent(
            `Final cargo loading cut-off for ${cutoff.vessel_name}.\nEstimated Philippine Delivery Window: ${cutoff.estimated_delivery_window || 'TBA'}.\nBook your box collection before this date at Love Balikbayan.`
        );
        const location = encodeURIComponent(cutoff.origin_port || 'Love Balikbayan Warehouse Hub');

        const cutoffDate = parseISO(cutoff.cutoff_date);
        const dateClean = format(cutoffDate, 'yyyyMMdd');
        const nextDayClean = format(addDays(cutoffDate, 1), 'yyyyMMdd');

        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${dateClean}/${nextDayClean}`;
    };

    const exportUrl = currentZone && currentZone !== 'all'
        ? `/calendar/export.ics?pickup_zone_id=${encodeURIComponent(currentZone)}`
        : '/calendar/export.ics';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Schedules & Shipping Cut-offs" />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8 w-full font-sans">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
                    <Heading
                        eyebrow="Shipping Schedules"
                        title="Schedules & Cargo Cut-offs"
                        description="View live container loading cut-offs, vessel departure dates, estimated Philippine delivery windows, and operational holidays."
                    />

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <a href={exportUrl} download="love_balikbayan_schedules.ics">
                            <Button variant="outline" size="sm" className="gap-1.5 h-9 shadow-2xs text-xs">
                                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>Subscribe / Export (.ics)</span>
                            </Button>
                        </a>

                        <Link href="/book">
                            <Button size="sm" className="gap-1.5 h-9 shadow-2xs bg-primary text-primary-foreground font-semibold text-xs">
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>Book Box Collection</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Streamlined Fresh Cut-off Highlight Banner */}
                {nextCutoff && (
                    <div className="rounded-xl bg-brand-warm/30 dark:bg-muted/20 border border-border/80 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Details */}
                        <div className="space-y-2">
                            {/* Top Meta Line */}
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-brand-primary text-white">
                                    <Sparkles className="w-3 h-3 text-amber-300" />
                                    Next Cut-Off
                                </span>

                                <span className="font-bold text-sm sm:text-base text-foreground">
                                    {nextCutoff.title}
                                </span>

                                {nextCutoff.urgency_level === 'last_day' ? (
                                    <Badge variant="destructive" className="animate-pulse font-bold text-[11px] py-0">
                                        CLOSING TODAY
                                    </Badge>
                                ) : nextCutoff.urgency_level === 'closing_soon' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/50">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                        Closing in {nextCutoff.days_remaining} {nextCutoff.days_remaining === 1 ? 'day' : 'days'}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        {nextCutoff.days_remaining} days remaining
                                    </span>
                                )}
                            </div>

                            {/* Minimal Voyage Meta */}
                            <div className="flex items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1.5">
                                    <span className="font-medium text-foreground">Cut-off:</span> {nextCutoff.formatted_cutoff}
                                </span>
                                <span className="hidden sm:inline text-muted-foreground/40">•</span>
                                <span className="flex items-center gap-1.5">
                                    <Ship className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                                    <span className="font-medium text-foreground">{nextCutoff.vessel_name}</span> (Sails: {nextCutoff.sailing_date})
                                </span>
                                <span className="hidden sm:inline text-muted-foreground/40">•</span>
                                <span className="flex items-center gap-1.5">
                                    <Anchor className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                    <span>{nextCutoff.destination_port}</span>
                                </span>
                                <span className="hidden sm:inline text-muted-foreground/40">•</span>
                                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                    <PackageCheck className="w-3.5 h-3.5" />
                                    <span>Est. Delivery: {nextCutoff.estimated_delivery_window || '4–6 Weeks'}</span>
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                            <a
                                href={buildGoogleCalendarUrl(nextCutoff)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Add to Google Calendar"
                            >
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2.5 text-xs gap-1.5 bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-medium"
                                >
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Google Cal</span>
                                </Button>
                            </a>

                            <a
                                href={`/calendar/${nextCutoff.id}/export.ics`}
                                download
                                title="Download iCal Event"
                            >
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2.5 text-xs gap-1.5 bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-medium"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">iCal (.ics)</span>
                                </Button>
                            </a>

                            <Link href="/book">
                                <Button
                                    size="sm"
                                    className="h-8 px-3.5 text-xs font-bold gap-1.5 bg-brand-primary text-white hover:bg-brand-primary/90 shadow-2xs"
                                >
                                    <span>Book for This Batch</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}

                {/* Unified Calendar Component */}
                <EventCalendar
                    events={events}
                    pickupZones={pickupZones}
                    canManage={false}
                    onSelectEvent={handleSelectEvent}
                    selectedZoneId={currentZone}
                    onZoneChange={setCurrentZone}
                />

                {/* Event Detail Modal */}
                <EventDetailModal
                    isOpen={isDetailOpen}
                    onClose={() => {
                        setIsDetailOpen(false);
                        setSelectedEvent(null);
                    }}
                    event={selectedEvent}
                    canManage={false}
                />
            </div>
        </AppLayout>
    );
}
