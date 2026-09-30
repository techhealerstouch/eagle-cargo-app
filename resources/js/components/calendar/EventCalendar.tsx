import React, { useState, useMemo } from 'react';
import type { CalendarEvent, PickupZoneOption } from '@/types/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Plus,
    Search,
    AlertTriangle,
    Layers,
    Truck,
    Gift,
    CalendarDays,
    List,
    Clock,
    MapPin,
    Ship,
    Anchor,
    Sparkles,
    Filter,
    X,
    CalendarRange,
    Clock3,
    PanelLeftClose,
    PanelLeft,
    Check,
    ArrowUpRight,
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
    isSameDay,
    isToday,
    parseISO,
    differenceInDays,
    startOfDay,
} from 'date-fns';

interface EventCalendarProps {
    events: CalendarEvent[];
    pickupZones?: PickupZoneOption[];
    onAddEvent?: (date?: Date) => void;
    onSelectEvent: (event: CalendarEvent) => void;
    canManage?: boolean;
    initialDate?: Date;
    selectedZoneId?: number | string;
    onZoneChange?: (zoneId: string) => void;
    onMonthChange?: (date: Date) => void;
}

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

const getHourLabel = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h} ${period}`;
};

interface LayerItem {
    id: 'logistics' | 'operations' | 'marketing' | 'holiday';
    label: string;
    sublabel: string;
    color: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
}

const LAYERS: LayerItem[] = [
    {
        id: 'logistics',
        label: 'Vessels & Cut-offs',
        sublabel: 'Batches, sailings & arrivals',
        color: '#2563EB',
        textColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
        borderColor: 'border-blue-500/40',
    },
    {
        id: 'operations',
        label: 'Driver Runsheets',
        sublabel: 'Pickups & delivery runs',
        color: '#059669',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        borderColor: 'border-emerald-500/40',
    },
    {
        id: 'marketing',
        label: 'Promos & Campaigns',
        sublabel: 'Special discounts & flash deals',
        color: '#D97706',
        textColor: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
        borderColor: 'border-amber-500/40',
    },
    {
        id: 'holiday',
        label: 'Blackouts & Holidays',
        sublabel: 'Closures & blackout dates',
        color: '#E11D48',
        textColor: 'text-rose-600 dark:text-rose-400',
        bgColor: 'bg-rose-500/10 dark:bg-rose-500/20',
        borderColor: 'border-rose-500/40',
    },
];

export function EventCalendar({
    events = [],
    pickupZones = [],
    onAddEvent,
    onSelectEvent,
    canManage = false,
    initialDate = new Date(),
    selectedZoneId = 'all',
    onZoneChange,
    onMonthChange,
}: EventCalendarProps) {
    const [currentDate, setCurrentDate] = useState<Date>(initialDate);
    const [miniMonthDate, setMiniMonthDate] = useState<Date>(initialDate);
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

    // Active layer toggles
    const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
        logistics: true,
        operations: true,
        marketing: true,
        holiday: true,
    });

    const toggleLayer = (layerId: string) => {
        setActiveLayers((prev) => ({
            ...prev,
            [layerId]: !prev[layerId],
        }));
    };

    const toggleAllLayers = () => {
        const anyDisabled = Object.values(activeLayers).some((v) => !v);
        setActiveLayers({
            logistics: anyDisabled,
            operations: anyDisabled,
            marketing: anyDisabled,
            holiday: anyDisabled,
        });
    };

    // Navigation
    const handlePrev = () => {
        let next: Date;
        if (viewMode === 'month') {
            next = subMonths(currentDate, 1);
        } else if (viewMode === 'week') {
            next = subWeeks(currentDate, 1);
        } else {
            next = subDays(currentDate, 1);
        }
        setCurrentDate(next);
        setMiniMonthDate(next);
        if (!isSameMonth(next, currentDate)) {
            onMonthChange?.(next);
        }
    };

    const handleNext = () => {
        let next: Date;
        if (viewMode === 'month') {
            next = addMonths(currentDate, 1);
        } else if (viewMode === 'week') {
            next = addWeeks(currentDate, 1);
        } else {
            next = addDays(currentDate, 1);
        }
        setCurrentDate(next);
        setMiniMonthDate(next);
        if (!isSameMonth(next, currentDate)) {
            onMonthChange?.(next);
        }
    };

    const handleToday = () => {
        const next = new Date();
        setCurrentDate(next);
        setMiniMonthDate(next);
        if (!isSameMonth(next, currentDate)) {
            onMonthChange?.(next);
        }
    };

    const handleSelectDay = (date: Date) => {
        setCurrentDate(date);
        if (!isSameMonth(date, currentDate)) {
            onMonthChange?.(date);
        }
    };

    // Filter events
    const filteredEvents = useMemo(() => {
        return events.filter((event) => {
            const cat = event.category || 'operations';
            if (activeLayers[cat] === false) {
                return false;
            }

            if (selectedZoneId && selectedZoneId !== 'all') {
                if (event.pickup_zone_id && String(event.pickup_zone_id) !== String(selectedZoneId)) {
                    return false;
                }
            }

            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const matchesTitle = event.title.toLowerCase().includes(query);
                const matchesDesc = event.description?.toLowerCase().includes(query) ?? false;
                const matchesLoc = event.location?.toLowerCase().includes(query) ?? false;
                const matchesZone = event.pickup_zone?.name.toLowerCase().includes(query) ?? false;
                if (!matchesTitle && !matchesDesc && !matchesLoc && !matchesZone) {
                    return false;
                }
            }

            return true;
        });
    }, [events, activeLayers, selectedZoneId, searchQuery]);

    // Layer counts
    const layerCounts = useMemo(() => {
        const counts: Record<string, number> = {
            logistics: 0,
            operations: 0,
            marketing: 0,
            holiday: 0,
        };
        events.forEach((e) => {
            if (counts[e.category] !== undefined) {
                counts[e.category]++;
            }
        });
        return counts;
    }, [events]);

    // Mini-calendar dots map
    const eventDatesMap = useMemo(() => {
        const map = new Map<string, Set<string>>();
        events.forEach((e) => {
            try {
                const dateStr = format(parseISO(e.start_date), 'yyyy-MM-dd');
                if (!map.has(dateStr)) {
                    map.set(dateStr, new Set());
                }
                map.get(dateStr)!.add(e.category);
            } catch {}
        });
        return map;
    }, [events]);

    // Upcoming milestones
    const upcomingMilestones = useMemo(() => {
        const today = startOfDay(new Date());

        return [...events]
            .filter((e) => {
                try {
                    const start = parseISO(e.start_date);
                    return start >= today;
                } catch {
                    return false;
                }
            })
            .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
            .slice(0, 4);
    }, [events]);

    // Main calendar intervals
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentDate]);

    const weekDays = useMemo(() => {
        const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
        const endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentDate]);

    // Mini calendar intervals
    const miniCalendarDays = useMemo(() => {
        const monthStart = startOfMonth(miniMonthDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [miniMonthDate]);

    const getEventsForDay = (day: Date) => {
        return filteredEvents.filter((event) => {
            try {
                const eventStart = parseISO(event.start_date);
                if (isSameDay(eventStart, day)) return true;

                if (event.end_date) {
                    const eventEnd = parseISO(event.end_date);
                    return day >= eventStart && day <= eventEnd;
                }
                return false;
            } catch {
                return false;
            }
        });
    };

    const renderEventIcon = (type: string, className = 'w-3 h-3 shrink-0') => {
        switch (type) {
            case 'cutoff':
            case 'sailing':
                return <Ship className={className} />;
            case 'arrival':
                return <Anchor className={className} />;
            case 'pickup_run':
            case 'delivery_run':
                return <Truck className={className} />;
            case 'promo':
                return <Sparkles className={className} />;
            case 'community':
                return <Gift className={className} />;
            case 'holiday':
            case 'maintenance':
                return <AlertTriangle className={className} />;
            default:
                return <CalendarIcon className={className} />;
        }
    };

    const renderLayerIcon = (layerId: string, className = 'w-3.5 h-3.5') => {
        switch (layerId) {
            case 'logistics':
                return <Ship className={className} />;
            case 'operations':
                return <Truck className={className} />;
            case 'marketing':
                return <Sparkles className={className} />;
            case 'holiday':
                return <AlertTriangle className={className} />;
            default:
                return <CalendarIcon className={className} />;
        }
    };

    const getCategoryStyles = (category: string, eventHex?: string) => {
        if (eventHex) {
            return {
                badgeBg: `${eventHex}18`,
                border: `${eventHex}45`,
                text: eventHex,
                dot: eventHex,
            };
        }

        switch (category) {
            case 'logistics':
                return {
                    badgeBg: 'rgba(37, 99, 235, 0.12)',
                    border: 'rgba(37, 99, 235, 0.4)',
                    text: '#2563EB',
                    dot: '#2563EB',
                };
            case 'operations':
                return {
                    badgeBg: 'rgba(5, 150, 105, 0.12)',
                    border: 'rgba(5, 150, 105, 0.4)',
                    text: '#059669',
                    dot: '#10B981',
                };
            case 'marketing':
                return {
                    badgeBg: 'rgba(217, 119, 6, 0.12)',
                    border: 'rgba(217, 119, 6, 0.4)',
                    text: '#D97706',
                    dot: '#F59E0B',
                };
            case 'holiday':
            case 'disruption':
                return {
                    badgeBg: 'rgba(225, 29, 72, 0.12)',
                    border: 'rgba(225, 29, 72, 0.4)',
                    text: '#E11D48',
                    dot: '#E11D48',
                };
            default:
                return {
                    badgeBg: 'rgba(99, 102, 241, 0.12)',
                    border: 'rgba(99, 102, 241, 0.4)',
                    text: '#6366F1',
                    dot: '#6366F1',
                };
        }
    };

    const headerTitle = useMemo(() => {
        if (viewMode === 'month') {
            return format(currentDate, 'MMMM yyyy');
        }
        if (viewMode === 'week') {
            const start = weekDays[0];
            const end = weekDays[weekDays.length - 1];
            if (isSameMonth(start, end)) {
                return `${format(start, 'MMMM d')} - ${format(end, 'd, yyyy')}`;
            }
            return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
        }
        if (viewMode === 'day') {
            return format(currentDate, 'EEEE, MMMM d, yyyy');
        }
        return format(currentDate, 'MMMM yyyy');
    }, [currentDate, viewMode, weekDays]);

    return (
        <div className="bg-card rounded-2xl border border-border/80 shadow-xs overflow-hidden flex flex-col transition-all">
            {/* Split View Container */}
            <div className="flex flex-col lg:flex-row min-h-[750px]">
                {/* ================= LEFT COMMAND SIDEBAR ================= */}
                {isSidebarOpen && (
                    <aside className="w-full lg:w-[280px] xl:w-[310px] shrink-0 border-b lg:border-b-0 lg:border-r border-border/70 bg-muted/15 dark:bg-card/40 p-4 sm:p-5 flex flex-col gap-5 justify-between">
                        <div className="space-y-5">
                            {/* Mini Interactive Month Calendar */}
                            <div className="bg-card/90 dark:bg-muted/20 border border-border/70 rounded-xl p-3.5 shadow-2xs">
                                <div className="flex items-center justify-between mb-2.5">
                                    <span className="text-xs font-bold text-foreground">
                                        {format(miniMonthDate, 'MMMM yyyy')}
                                    </span>
                                    <div className="flex items-center gap-0.5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setMiniMonthDate(subMonths(miniMonthDate, 1))}
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setMiniMonthDate(addMonths(miniMonthDate, 1))}
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        >
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Mini Day of Week labels */}
                                <div className="grid grid-cols-7 text-center text-[10.5px] font-semibold text-muted-foreground/70 mb-1">
                                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                                        <span key={d} className="py-0.5">{d}</span>
                                    ))}
                                </div>

                                {/* Mini Day Grid */}
                                <div className="grid grid-cols-7 gap-0.5 text-center">
                                    {miniCalendarDays.map((day, idx) => {
                                        const isCurrentMonth = isSameMonth(day, miniMonthDate);
                                        const isSelected = isSameDay(day, currentDate);
                                        const isDayToday = isToday(day);
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        const categoriesOnDate = eventDatesMap.get(dateKey);

                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleSelectDay(day)}
                                                className={`relative h-7 w-full rounded-md text-[11px] font-medium transition-all flex flex-col items-center justify-center ${
                                                    isSelected
                                                        ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                                                        : isDayToday
                                                        ? 'border border-primary/40 text-primary font-bold bg-primary/5'
                                                        : !isCurrentMonth
                                                        ? 'text-muted-foreground/30 hover:text-muted-foreground/60'
                                                        : 'text-foreground hover:bg-muted/70'
                                                }`}
                                            >
                                                <span>{format(day, 'd')}</span>
                                                {categoriesOnDate && categoriesOnDate.size > 0 && !isSelected && (
                                                    <span className="absolute bottom-0.5 flex items-center justify-center gap-0.5">
                                                        {Array.from(categoriesOnDate).slice(0, 3).map((cat) => {
                                                            const styling = getCategoryStyles(cat);
                                                            return (
                                                                <span
                                                                    key={cat}
                                                                    className="w-1 h-1 rounded-full"
                                                                    style={{ backgroundColor: styling.dot }}
                                                                />
                                                            );
                                                        })}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Calendar Layer Switches */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-0.5">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Calendar Layers
                                    </span>
                                    <button
                                        type="button"
                                        onClick={toggleAllLayers}
                                        className="text-[11px] text-primary hover:underline font-medium"
                                    >
                                        {Object.values(activeLayers).every((v) => v) ? 'Hide All' : 'Show All'}
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    {LAYERS.map((layer) => {
                                        const isActive = activeLayers[layer.id];
                                        const count = layerCounts[layer.id] || 0;

                                        return (
                                            <button
                                                key={layer.id}
                                                type="button"
                                                onClick={() => toggleLayer(layer.id)}
                                                className={`w-full flex items-center justify-between p-2 rounded-xl text-left border transition-all ${
                                                    isActive
                                                        ? 'bg-card border-border/80 shadow-2xs text-foreground'
                                                        : 'bg-transparent border-transparent text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted/30'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                                                            isActive ? layer.bgColor : 'bg-muted'
                                                        } ${isActive ? layer.borderColor : 'border-border'}`}
                                                    >
                                                        {renderLayerIcon(
                                                            layer.id,
                                                            `w-3.5 h-3.5 ${isActive ? layer.textColor : 'text-muted-foreground'}`
                                                        )}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold truncate leading-tight">
                                                            {layer.label}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                                                            {layer.sublabel}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0 pl-1">
                                                    <span className="text-[10.5px] font-bold text-muted-foreground font-mono">
                                                        {count}
                                                    </span>
                                                    <span
                                                        className={`w-2 h-2 rounded-full transition-opacity ${
                                                            isActive ? 'opacity-100' : 'opacity-20'
                                                        }`}
                                                        style={{ backgroundColor: layer.color }}
                                                    />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Upcoming Key Milestones */}
                            <div className="space-y-2 pt-2 border-t border-border/60">
                                <div className="flex items-center justify-between px-0.5">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Key Milestones
                                    </span>
                                    <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                                        Next 4
                                    </Badge>
                                </div>

                                {upcomingMilestones.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground p-2 italic">
                                        No upcoming scheduled events
                                    </p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {upcomingMilestones.map((evt) => {
                                            const start = parseISO(evt.start_date);
                                            const daysDiff = differenceInDays(start, startOfDay(new Date()));
                                            const styling = getCategoryStyles(evt.category, evt.color_hex);

                                            return (
                                                <button
                                                    key={evt.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setCurrentDate(start);
                                                        onSelectEvent(evt);
                                                    }}
                                                    className="w-full text-left p-2 rounded-xl bg-card border border-border/70 hover:border-primary/40 hover:shadow-2xs transition-all flex items-start gap-2.5 group"
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex flex-col items-center justify-center text-white shrink-0 shadow-2xs"
                                                        style={{ backgroundColor: styling.text }}
                                                    >
                                                        <span className="text-[8.5px] font-bold uppercase leading-none">
                                                            {format(start, 'MMM')}
                                                        </span>
                                                        <span className="text-xs font-black leading-none mt-0.5">
                                                            {format(start, 'd')}
                                                        </span>
                                                    </div>

                                                    <div className="min-w-0 flex-1 space-y-0.5">
                                                        <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                                            {evt.title}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                            <span className="font-medium">
                                                                {daysDiff === 0 ? (
                                                                    <span className="text-emerald-600 font-bold">Today</span>
                                                                ) : daysDiff === 1 ? (
                                                                    <span className="text-amber-600 font-bold">Tomorrow</span>
                                                                ) : (
                                                                    `In ${daysDiff} days`
                                                                )}
                                                            </span>
                                                            {evt.pickup_zone && (
                                                                <>
                                                                    <span>-</span>
                                                                    <span className="truncate">{evt.pickup_zone.name}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Add at bottom of sidebar for Admins */}
                        {canManage && onAddEvent && (
                            <div className="pt-3 border-t border-border/60">
                                <Button
                                    onClick={() => onAddEvent(currentDate)}
                                    className="w-full h-9 text-xs font-bold gap-1.5 shadow-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Create New Event</span>
                                </Button>
                            </div>
                        )}
                    </aside>
                )}

                {/* ================= RIGHT CALENDAR CANVAS ================= */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Top Control Bar */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 p-4 sm:p-5 border-b border-border/70 bg-card/60 backdrop-blur-xs">
                        {/* Title & Navigation */}
                        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                                title={isSidebarOpen ? 'Collapse Command Sidebar' : 'Expand Command Sidebar'}
                            >
                                {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
                            </Button>

                            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground font-sans">
                                {headerTitle}
                            </h2>

                            {/* Nav Buttons */}
                            <div className="flex items-center gap-1 bg-muted/60 dark:bg-muted/30 p-1 rounded-xl border border-border/60 shadow-2xs">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handlePrev}
                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background"
                                    title="Previous"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleToday}
                                    className="h-7 px-2.5 text-xs font-semibold text-foreground hover:bg-background rounded-lg"
                                >
                                    Today
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleNext}
                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background"
                                    title="Next"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Search, Zone Selector, & View Switchers */}
                        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-start lg:justify-end">
                            {/* Search */}
                            <div className="relative w-36 sm:w-44 shrink-0">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Filter events..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-7 h-8.5 text-xs bg-muted/30 hover:bg-muted/50 focus:bg-background transition-colors rounded-lg"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            {/* Zone Selector */}
                            {pickupZones.length > 0 && onZoneChange && (
                                <div className="w-[130px] sm:w-[155px] shrink-0">
                                    <Select value={String(selectedZoneId)} onValueChange={onZoneChange}>
                                        <SelectTrigger className="h-8.5 w-full text-xs bg-muted/30 hover:bg-muted/50 rounded-lg">
                                            <SelectValue placeholder="All Zones" />
                                        </SelectTrigger>
                                        <SelectContent className="z-50">
                                            <SelectItem value="all">All Pickup Zones</SelectItem>
                                            {pickupZones.map((z) => (
                                                <SelectItem key={z.id} value={String(z.id)}>
                                                    {z.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* View Switcher */}
                            <div className="flex items-center bg-muted/60 dark:bg-muted/30 p-1 rounded-xl border border-border/60 shadow-2xs shrink-0">
                                <Button
                                    variant={viewMode === 'month' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('month')}
                                    className={`h-7 px-2.5 text-xs rounded-lg font-medium transition-all ${
                                        viewMode === 'month' ? 'bg-background shadow-xs text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <CalendarDays className="w-3.5 h-3.5 mr-1" />
                                    <span>Month</span>
                                </Button>
                                <Button
                                    variant={viewMode === 'week' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('week')}
                                    className={`h-7 px-2.5 text-xs rounded-lg font-medium transition-all ${
                                        viewMode === 'week' ? 'bg-background shadow-xs text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <CalendarRange className="w-3.5 h-3.5 mr-1" />
                                    <span>Week</span>
                                </Button>
                                <Button
                                    variant={viewMode === 'day' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('day')}
                                    className={`h-7 px-2.5 text-xs rounded-lg font-medium transition-all ${
                                        viewMode === 'day' ? 'bg-background shadow-xs text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Clock3 className="w-3.5 h-3.5 mr-1" />
                                    <span>Day</span>
                                </Button>
                                <Button
                                    variant={viewMode === 'agenda' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('agenda')}
                                    className={`h-7 px-2.5 text-xs rounded-lg font-medium transition-all ${
                                        viewMode === 'agenda' ? 'bg-background shadow-xs text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <List className="w-3.5 h-3.5 mr-1" />
                                    <span>Agenda</span>
                                </Button>
                            </div>

                            {/* Header Add Event Button */}
                            {canManage && onAddEvent && (
                                <Button
                                    size="sm"
                                    onClick={() => onAddEvent()}
                                    className="h-8.5 px-3.5 text-xs flex items-center gap-1.5 font-bold shadow-xs rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all shrink-0"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Add Event</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* ================= VIEW: MONTH GRID ================= */}
                    {viewMode === 'month' && (
                        <div className="flex-1 flex flex-col">
                            {/* Day Header */}
                            <div className="grid grid-cols-7 border-b border-border/70 bg-muted/40 text-center py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                                    <div key={d} className="py-0.5">{d}</div>
                                ))}
                            </div>

                            {/* Grid Days */}
                            <div className="flex-1 grid grid-cols-7 divide-x divide-y divide-border/60 border-b border-border/60 auto-rows-fr bg-muted/5">
                                {calendarDays.map((day, idx) => {
                                    const isCurrentMonth = isSameMonth(day, currentDate);
                                    const dayEvents = getEventsForDay(day);
                                    const isDayToday = isToday(day);
                                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                    const hasBlackout = dayEvents.some((e) => e.is_blocking);

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => canManage && onAddEvent && onAddEvent(day)}
                                            className={`min-h-[115px] sm:min-h-[135px] p-2 flex flex-col justify-between transition-colors relative group ${
                                                !isCurrentMonth
                                                    ? 'bg-muted/30 text-muted-foreground/40'
                                                    : isWeekend
                                                    ? 'bg-muted/10'
                                                    : 'bg-card'
                                            } ${
                                                hasBlackout
                                                    ? 'bg-amber-500/5 dark:bg-amber-500/10 border-l-2 border-l-amber-500/80'
                                                    : ''
                                            } ${canManage ? 'cursor-pointer hover:bg-accent/40' : ''}`}
                                        >
                                            {/* Date Number & Top Meta */}
                                            <div className="flex items-center justify-between gap-1">
                                                <span
                                                    className={`text-xs font-black rounded-full w-6 h-6 flex items-center justify-center transition-all ${
                                                        isDayToday
                                                            ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30'
                                                            : !isCurrentMonth
                                                            ? 'text-muted-foreground/40'
                                                            : 'text-foreground group-hover:text-primary'
                                                    }`}
                                                >
                                                    {format(day, 'd')}
                                                </span>

                                                <div className="flex items-center gap-1">
                                                    {hasBlackout && (
                                                        <span
                                                            title="Booking Blackout Date"
                                                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-0.5"
                                                        >
                                                            <AlertTriangle className="w-2.5 h-2.5" />
                                                            <span className="hidden xl:inline">Blackout</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Event Pills */}
                                            <div className="space-y-1.5 my-1.5 flex-1 overflow-hidden">
                                                {dayEvents.slice(0, 3).map((event) => {
                                                    const eventDate = parseISO(event.start_date);
                                                    const timeString = !event.is_all_day ? format(eventDate, 'h:mma').toLowerCase() : null;
                                                    const styling = getCategoryStyles(event.category, event.color_hex);
                                                    const isMultiDay = event.end_date && differenceInDays(parseISO(event.end_date), eventDate) >= 1;

                                                    return (
                                                        <button
                                                            key={event.id}
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onSelectEvent(event);
                                                            }}
                                                            className="w-full text-left px-2 py-1 rounded-md text-[11px] font-medium truncate flex items-center gap-1.5 transition-all hover:scale-[1.01] active:scale-[0.99] border shadow-2xs group/pill"
                                                            style={{
                                                                backgroundColor: styling.badgeBg,
                                                                borderColor: styling.border,
                                                                borderLeftWidth: '3px',
                                                                borderLeftColor: styling.text,
                                                                color: styling.text,
                                                            }}
                                                        >
                                                            {renderEventIcon(event.event_type, 'w-3 h-3 shrink-0 opacity-90')}
                                                            {timeString && (
                                                                <span className="text-[9.5px] font-mono font-bold opacity-90 shrink-0">
                                                                    {timeString}
                                                                </span>
                                                            )}
                                                            <span className="truncate font-bold tracking-tight">{event.title}</span>
                                                            {isMultiDay && (
                                                                <span className="ml-auto text-[9px] px-1 rounded bg-black/10 dark:bg-white/10 shrink-0 uppercase font-mono">
                                                                    Multi
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}

                                                {dayEvents.length > 3 && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCurrentDate(day);
                                                            setViewMode('day');
                                                        }}
                                                        className="text-[10px] text-primary font-bold hover:underline pl-1 block text-left"
                                                    >
                                                        +{dayEvents.length - 3} more events...
                                                    </button>
                                                )}
                                            </div>

                                            {/* Hover Quick Add Indicator */}
                                            {canManage && (
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground flex items-center justify-end">
                                                    <span className="bg-muted px-1.5 py-0.5 rounded-md font-mono text-muted-foreground flex items-center gap-0.5 border border-border/60">
                                                        <Plus className="w-2.5 h-2.5" />
                                                        <span>Add</span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ================= VIEW: WEEK TIMELINE ================= */}
                    {viewMode === 'week' && (
                        <div className="flex-1 overflow-x-auto">
                            <div className="min-w-[760px]">
                                {/* Week Days Header */}
                                <div className="grid grid-cols-7 border-b border-border/70 bg-muted/40 divide-x divide-border/60">
                                    {weekDays.map((day, idx) => {
                                        const dayEvents = getEventsForDay(day);
                                        const isDayToday = isToday(day);
                                        const hasBlackout = dayEvents.some((e) => e.is_blocking);

                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    setCurrentDate(day);
                                                    setViewMode('day');
                                                }}
                                                className={`p-3 text-center cursor-pointer transition-colors hover:bg-muted/60 ${
                                                    isDayToday ? 'bg-primary/5' : ''
                                                }`}
                                            >
                                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    {format(day, 'EEE')}
                                                </p>
                                                <div className="mt-1 flex items-center justify-center gap-1.5">
                                                    <span
                                                        className={`text-base font-black rounded-full w-8 h-8 flex items-center justify-center ${
                                                            isDayToday
                                                                ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20'
                                                                : 'text-foreground'
                                                        }`}
                                                    >
                                                        {format(day, 'd')}
                                                    </span>
                                                </div>
                                                {hasBlackout && (
                                                    <Badge variant="destructive" className="mt-1 text-[9px] py-0 px-1 font-bold uppercase">
                                                        Blackout
                                                    </Badge>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* All-Day Events Strip */}
                                <div className="grid grid-cols-7 divide-x divide-border/60 border-b border-border/70 bg-muted/15 min-h-[48px]">
                                    {weekDays.map((day, idx) => {
                                        const allDayEvents = getEventsForDay(day).filter((e) => e.is_all_day || e.category === 'logistics');
                                        return (
                                            <div key={idx} className="p-1.5 space-y-1">
                                                {allDayEvents.map((event) => {
                                                    const styling = getCategoryStyles(event.category, event.color_hex);
                                                    return (
                                                        <button
                                                            key={event.id}
                                                            type="button"
                                                            onClick={() => onSelectEvent(event)}
                                                            className="w-full text-left p-1.5 rounded text-[11px] font-bold truncate flex items-center gap-1.5 border shadow-2xs transition-all hover:scale-[1.01]"
                                                            style={{
                                                                backgroundColor: styling.badgeBg,
                                                                borderColor: styling.border,
                                                                borderLeftWidth: '3px',
                                                                borderLeftColor: styling.text,
                                                                color: styling.text,
                                                            }}
                                                        >
                                                            {renderEventIcon(event.event_type, 'w-3 h-3 shrink-0')}
                                                            <span className="truncate">{event.title}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Hourly Rows */}
                                <div className="divide-y divide-border/50">
                                    {HOURS.map((hour) => {
                                        const timeDisplay = getHourLabel(hour);
                                        return (
                                            <div key={hour} className="grid grid-cols-7 divide-x divide-border/50 min-h-[64px]">
                                                {weekDays.map((day, dIdx) => {
                                                    const eventsAtHour = getEventsForDay(day).filter((e) => {
                                                        if (e.is_all_day) return false;
                                                        const eventHour = parseISO(e.start_date).getHours();
                                                        return eventHour === hour;
                                                    });

                                                    return (
                                                        <div
                                                            key={dIdx}
                                                            onClick={() => {
                                                                if (canManage && onAddEvent) {
                                                                    const newDate = new Date(day);
                                                                    newDate.setHours(hour, 0, 0, 0);
                                                                    onAddEvent(newDate);
                                                                }
                                                            }}
                                                            className="p-1 relative group hover:bg-muted/30 transition-colors cursor-pointer flex flex-col justify-start"
                                                        >
                                                            {dIdx === 0 && (
                                                                <span className="text-[10px] font-mono text-muted-foreground/60 select-none">
                                                                    {timeDisplay}
                                                                </span>
                                                            )}

                                                            {eventsAtHour.map((event) => {
                                                                const styling = getCategoryStyles(event.category, event.color_hex);
                                                                return (
                                                                    <button
                                                                        key={event.id}
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onSelectEvent(event);
                                                                        }}
                                                                        className="w-full text-left p-1.5 mb-1 rounded-md text-[11px] font-medium truncate flex flex-col gap-0.5 border shadow-2xs transition-all hover:scale-[1.01]"
                                                                        style={{
                                                                            backgroundColor: styling.badgeBg,
                                                                            borderColor: styling.border,
                                                                            borderLeftWidth: '3px',
                                                                            borderLeftColor: styling.text,
                                                                            color: styling.text,
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-1 font-bold truncate">
                                                                            {renderEventIcon(event.event_type, 'w-3 h-3 shrink-0')}
                                                                            <span className="truncate">{event.title}</span>
                                                                        </div>
                                                                        <span className="text-[9.5px] font-mono opacity-85">
                                                                            {format(parseISO(event.start_date), 'h:mm a')}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ================= VIEW: DAY TIMELINE ================= */}
                    {viewMode === 'day' && (
                        <div className="flex-1 p-4 sm:p-6 space-y-4">
                            {/* Day Overview Banner */}
                            <div className="p-4 rounded-xl bg-muted/30 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-lg font-black text-foreground">
                                            {format(currentDate, 'EEEE, MMMM d, yyyy')}
                                        </h3>
                                        {isToday(currentDate) && (
                                            <Badge className="bg-primary text-primary-foreground font-bold text-xs">
                                                Today
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {getEventsForDay(currentDate).length} scheduled {getEventsForDay(currentDate).length === 1 ? 'event' : 'events'} on this day.
                                    </p>
                                </div>

                                {canManage && onAddEvent && (
                                    <Button
                                        size="sm"
                                        onClick={() => onAddEvent(currentDate)}
                                        className="gap-1.5 text-xs h-8 font-bold self-start sm:self-auto"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Event for Today</span>
                                    </Button>
                                )}
                            </div>

                            {/* Events List */}
                            {getEventsForDay(currentDate).length === 0 ? (
                                <div className="p-16 text-center text-muted-foreground space-y-3 bg-muted/10 rounded-xl border border-dashed border-border/80">
                                    <CalendarIcon className="w-10 h-10 mx-auto text-muted-foreground/40" />
                                    <div>
                                        <p className="text-sm font-bold text-foreground">No events scheduled for this day</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Click the button above to create an operational or marketing event.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {getEventsForDay(currentDate).map((event) => {
                                        const eventStart = parseISO(event.start_date);
                                        const styling = getCategoryStyles(event.category, event.color_hex);

                                        return (
                                            <div
                                                key={event.id}
                                                onClick={() => onSelectEvent(event)}
                                                className="p-4 rounded-xl border border-border/80 bg-card hover:bg-accent/40 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs group"
                                                style={{ borderLeftWidth: '4px', borderLeftColor: styling.text }}
                                            >
                                                <div className="flex items-start gap-3.5">
                                                    <div
                                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                                                        style={{ backgroundColor: styling.text }}
                                                    >
                                                        {renderEventIcon(event.event_type, 'w-5 h-5')}
                                                    </div>

                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                                                                {event.title}
                                                            </h4>
                                                            <Badge variant="outline" className="text-[10px] capitalize py-0 font-semibold">
                                                                {event.category}
                                                            </Badge>
                                                            {event.is_blocking && (
                                                                <Badge variant="destructive" className="text-[10px] py-0 font-bold uppercase">
                                                                    Blackout
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap font-medium">
                                                            <span className="flex items-center gap-1 text-foreground font-semibold">
                                                                <Clock className="w-3.5 h-3.5 text-primary" />
                                                                {event.is_all_day
                                                                    ? 'All Day'
                                                                    : event.end_date
                                                                    ? `${format(eventStart, 'h:mm a')} - ${format(parseISO(event.end_date), 'h:mm a')}`
                                                                    : format(eventStart, 'h:mm a')}
                                                            </span>

                                                            {event.pickup_zone && (
                                                                <span className="flex items-center gap-1">
                                                                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                                                    <span>Zone: {event.pickup_zone.name}</span>
                                                                </span>
                                                            )}

                                                            {event.batch && (
                                                                <span className="flex items-center gap-1 font-mono text-primary font-bold">
                                                                    <Ship className="w-3.5 h-3.5" />
                                                                    <span>Batch #{event.batch.batch_number}</span>
                                                                </span>
                                                            )}
                                                        </div>

                                                        {event.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-2 pt-1">
                                                                {event.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <Button variant="outline" size="sm" className="h-8 text-xs font-bold shrink-0 self-end md:self-auto">
                                                    View Details
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ================= VIEW: AGENDA / LIST ================= */}
                    {viewMode === 'agenda' && (
                        <div className="flex-1 divide-y divide-border/60">
                            {filteredEvents.length === 0 ? (
                                <div className="p-16 text-center text-muted-foreground space-y-3">
                                    <CalendarIcon className="w-10 h-10 mx-auto text-muted-foreground/40" />
                                    <div>
                                        <p className="text-sm font-bold text-foreground">No events found</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Try toggling layers in the sidebar or changing keywords.</p>
                                    </div>
                                </div>
                            ) : (
                                filteredEvents.map((event) => {
                                    const eventStart = parseISO(event.start_date);
                                    const styling = getCategoryStyles(event.category, event.color_hex);

                                    return (
                                        <div
                                            key={event.id}
                                            onClick={() => onSelectEvent(event)}
                                            className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-muted/40 transition-colors cursor-pointer group"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div
                                                    className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white shrink-0 shadow-xs"
                                                    style={{ backgroundColor: styling.text }}
                                                >
                                                    <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                                                        {format(eventStart, 'MMM')}
                                                    </span>
                                                    <span className="text-base font-black leading-none mt-1">
                                                        {format(eventStart, 'd')}
                                                    </span>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                                                            {event.title}
                                                        </h3>
                                                        <Badge variant="outline" className="text-[10px] capitalize py-0 font-bold">
                                                            {event.category}
                                                        </Badge>
                                                        {event.is_blocking && (
                                                            <Badge variant="destructive" className="text-[10px] py-0 font-bold uppercase">
                                                                Blackout
                                                            </Badge>
                                                        )}
                                                        {event.badge_label && (
                                                            <Badge variant="secondary" className="text-[10px] py-0 font-semibold">
                                                                {event.badge_label}
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                                        <span className="flex items-center gap-1 font-semibold text-foreground">
                                                            <Clock className="w-3.5 h-3.5 text-primary" />
                                                            {event.is_all_day
                                                                ? 'All Day Event'
                                                                : event.end_date
                                                                ? `${format(eventStart, 'h:mm a')} - ${format(parseISO(event.end_date), 'h:mm a')}`
                                                                : format(eventStart, 'h:mm a')}
                                                        </span>

                                                        {event.location && (
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                                                {event.location}
                                                            </span>
                                                        )}

                                                        {event.pickup_zone && (
                                                            <span className="bg-muted px-2 py-0.5 rounded-md text-[11px] font-medium text-foreground">
                                                                Zone: {event.pickup_zone.name}
                                                            </span>
                                                        )}

                                                        {event.batch && (
                                                            <span className="flex items-center gap-1 font-mono text-primary font-bold">
                                                                <Ship className="w-3.5 h-3.5" />
                                                                <span>Batch #{event.batch.batch_number}</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {event.description && (
                                                        <p className="text-xs text-muted-foreground line-clamp-2 pt-0.5">
                                                            {event.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <Button variant="ghost" size="sm" className="text-xs shrink-0 font-bold group-hover:bg-background">
                                                Details
                                            </Button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
