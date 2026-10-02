import React, { useState, useMemo } from 'react';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Clock,
    Check,
    X,
    CalendarOff,
    RotateCcw,
    Sparkles,
    CheckCircle2,
    Ban,
    Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface PickupWindow {
    id: string;
    label?: string;
    days?: number[];
    time_start: string;
    time_end: string;
    weeks_of_month?: number[];
    enabled?: boolean;
    date?: string; // YYYY-MM-DD for date-specific overrides
    available?: boolean;
}

interface PickupScheduleCalendarProps {
    zoneName: string;
    windows: PickupWindow[];
    blackoutDates: string[];
    leadTimeDays: number;
    onChangeWindows: (newWindows: PickupWindow[]) => void;
    onChangeBlackoutDates: (newDates: string[]) => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PickupScheduleCalendar({
    zoneName,
    windows = [],
    blackoutDates = [],
    leadTimeDays = 2,
    onChangeWindows,
    onChangeBlackoutDates,
}: PickupScheduleCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [actionStatus, setActionStatus] = useState<'available' | 'unavailable'>('available');
    const [timeStart, setTimeStart] = useState('08:00');
    const [timeEnd, setTimeEnd] = useState('17:00');

    // Split windows into specific date overrides and recurring weekly rules
    const { specificDateMap, recurringWindows } = useMemo(() => {
        const specific: Record<string, PickupWindow> = {};
        const recurring: PickupWindow[] = [];

        windows.forEach((w) => {
            if (w.date) {
                specific[w.date] = w;
            } else if (Array.isArray(w.days) && w.days.length > 0) {
                recurring.push(w);
            }
        });

        return { specificDateMap: specific, recurringWindows: recurring };
    }, [windows]);

    // Calendar grid calculations
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun

    const prevMonthDays = new Date(year, month, 0).getDate();

    // Helper to format date string
    const formatDateStr = (y: number, m: number, d: number) => {
        const mm = String(m + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        return `${y}-${mm}-${dd}`;
    };

    // Calculate lead time threshold
    const leadTimeThreshold = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + (leadTimeDays || 2));
        return d;
    }, [leadTimeDays]);

    // Navigate months
    const prevMonth = () => {
        setCurrentMonth(new Date(year, month - 1, 1));
        setSelectedDates([]);
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(year, month + 1, 1));
        setSelectedDates([]);
    };

    const jumpToToday = () => {
        const now = new Date();
        setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDates([]);
    };

    // Evaluate status of any date
    const getDateInfo = (dateStr: string, dayOfWeek: number, dayOfMonth: number) => {
        const isBlackout = blackoutDates.includes(dateStr);
        const specific = specificDateMap[dateStr];

        if (isBlackout) {
            return {
                status: 'blackout' as const,
                label: 'Blackout / Closed',
                badgeClass: 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
                time: null,
            };
        }

        if (specific) {
            const isAvail = specific.available ?? specific.enabled ?? true;
            return {
                status: (isAvail ? 'available' : 'unavailable') as 'available' | 'unavailable',
                label: isAvail ? 'Available' : 'Closed',
                badgeClass: isAvail
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20',
                time: isAvail ? `${specific.time_start} - ${specific.time_end}` : null,
                isOverride: true,
            };
        }

        // Check recurring weekly rules
        const weekOfMonth = Math.ceil(dayOfMonth / 7);
        const matchingWeekly = recurringWindows.find((w) => {
            if (w.enabled === false) return false;
            if (!w.days?.includes(dayOfWeek)) return false;
            if (w.weeks_of_month && w.weeks_of_month.length > 0 && !w.weeks_of_month.includes(weekOfMonth)) return false;
            return true;
        });

        if (matchingWeekly) {
            return {
                status: 'recurring' as const,
                label: 'Available (Weekly)',
                badgeClass: 'bg-brand-rust/10 text-brand-rust border border-brand-rust/20',
                time: `${matchingWeekly.time_start || '08:00'} - ${matchingWeekly.time_end || '17:00'}`,
                isOverride: false,
            };
        }

        return {
            status: 'unavailable' as const,
            label: 'No Pickup',
            badgeClass: 'text-brand-text-light/50',
            time: null,
            isOverride: false,
        };
    };

    // Date selection handling
    const toggleDateSelection = (dateStr: string) => {
        setSelectedDates((prev) => {
            if (prev.includes(dateStr)) {
                return prev.filter((d) => d !== dateStr);
            }
            return [...prev, dateStr].sort();
        });
    };

    const selectAllDayOfWeek = (dayIndex: number) => {
        const dates: string[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            if (dateObj.getDay() === dayIndex) {
                dates.push(formatDateStr(year, month, d));
            }
        }
        setSelectedDates((prev) => Array.from(new Set([...prev, ...dates])).sort());
    };

    const clearSelection = () => {
        setSelectedDates([]);
    };

    // Apply schedule changes to selected dates
    const handleApplySchedule = () => {
        if (selectedDates.length === 0) return;

        let updatedWindows = [...windows];

        selectedDates.forEach((dateStr) => {
            // Remove existing specific override for this date if present
            updatedWindows = updatedWindows.filter((w) => w.date !== dateStr);

            // Add new specific date override
            const newWindow: PickupWindow = {
                id: `date_${dateStr}`,
                date: dateStr,
                label: `${zoneName} (${dateStr})`,
                available: actionStatus === 'available',
                enabled: actionStatus === 'available',
                time_start: timeStart,
                time_end: timeEnd,
            };

            updatedWindows.push(newWindow);
        });

        onChangeWindows(updatedWindows);
        setSelectedDates([]);
    };

    // Reset override (revert selected dates to weekly baseline)
    const handleResetOverride = () => {
        if (selectedDates.length === 0) return;

        const updatedWindows = windows.filter((w) => !w.date || !selectedDates.includes(w.date));
        onChangeWindows(updatedWindows);
        setSelectedDates([]);
    };

    // Quick toggle for a single date
    const handleQuickToggleDate = (dateStr: string, currentStatus: string) => {
        let updatedWindows = [...windows];
        updatedWindows = updatedWindows.filter((w) => w.date !== dateStr);

        const newAvailable = currentStatus !== 'available' && currentStatus !== 'recurring';

        updatedWindows.push({
            id: `date_${dateStr}`,
            date: dateStr,
            label: `${zoneName} (${dateStr})`,
            available: newAvailable,
            enabled: newAvailable,
            time_start: timeStart,
            time_end: timeEnd,
        });

        onChangeWindows(updatedWindows);
    };

    return (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-6 shadow-2xs">
            {/* Header: Area title and Month Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="size-4 text-brand-rust" />
                        <h3 className="text-sm font-semibold text-brand-text">
                            Pickup Schedule Calendar &mdash; {zoneName}
                        </h3>
                    </div>
                    <p className="text-xs text-brand-text-light mt-0.5">
                        Click date(s) on the calendar to set pickup availability and operating hours.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={jumpToToday}
                        className="h-8 px-2.5 rounded-lg border border-border bg-brand-warm/10 text-xs font-semibold text-brand-text hover:bg-brand-warm/20 transition-all cursor-pointer"
                    >
                        Today
                    </button>
                    <div className="flex items-center rounded-xl border border-border bg-card p-0.5 shadow-2xs">
                        <button
                            type="button"
                            onClick={prevMonth}
                            className="p-1.5 rounded-lg text-brand-text hover:bg-brand-warm/20 transition-all cursor-pointer"
                            title="Previous Month"
                        >
                            <ChevronLeft className="size-4" />
                        </button>
                        <span className="px-3 text-xs font-bold text-brand-text min-w-32 text-center">
                            {monthName}
                        </span>
                        <button
                            type="button"
                            onClick={nextMonth}
                            className="p-1.5 rounded-lg text-brand-text hover:bg-brand-warm/20 transition-all cursor-pointer"
                            title="Next Month"
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Helper Tips */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-brand-text-mid bg-brand-warm/5 p-3 rounded-xl border border-border/60">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-emerald-500" />
                        <span className="font-medium text-xs">Date Override (Open)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-brand-rust" />
                        <span className="font-medium text-xs">Recurring Weekly</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-zinc-400" />
                        <span className="font-medium text-xs">Closed / Unavailable</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-rose-500" />
                        <span className="font-medium text-xs">Blackout Date</span>
                    </div>
                </div>
                <div className="text-[11px] text-brand-text-light flex items-center gap-1">
                    <Info className="size-3" />
                    <span>Click dates to multi-select or use day buttons below.</span>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-border rounded-xl overflow-hidden bg-card">
                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 border-b border-border bg-brand-warm/10 text-center">
                    {DAYS_OF_WEEK.map((day, idx) => (
                        <div key={day} className="py-2.5 px-1 border-r last:border-r-0 border-border">
                            <button
                                type="button"
                                onClick={() => selectAllDayOfWeek(idx)}
                                title={`Select all ${day}s in ${monthName}`}
                                className="text-xs font-bold text-brand-text-mid hover:text-brand-rust transition-colors cursor-pointer"
                            >
                                {day}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 auto-rows-fr divide-y divide-border">
                    {/* Previous month padding */}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => {
                        const prevDay = prevMonthDays - firstDayOfWeek + i + 1;
                        return (
                            <div
                                key={`prev-${i}`}
                                className="min-h-24 p-2 bg-brand-warm/5 border-r last:border-r-0 border-border opacity-40 select-none"
                            >
                                <span className="text-xs font-semibold text-brand-text-light">{prevDay}</span>
                            </div>
                        );
                    })}

                    {/* Current Month Days */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const dayNum = i + 1;
                        const dateStr = formatDateStr(year, month, dayNum);
                        const dateObj = new Date(year, month, dayNum);
                        const dayOfWeek = dateObj.getDay();

                        const isSelected = selectedDates.includes(dateStr);
                        const isPast = dateObj < leadTimeThreshold;
                        const info = getDateInfo(dateStr, dayOfWeek, dayNum);

                        return (
                            <div
                                key={dateStr}
                                onClick={() => toggleDateSelection(dateStr)}
                                className={`min-h-24 p-2.5 border-r last:border-r-0 border-border transition-all cursor-pointer relative flex flex-col justify-between ${
                                    isSelected
                                        ? 'bg-brand-rust/10 ring-2 ring-inset ring-brand-rust z-10'
                                        : 'hover:bg-brand-warm/10'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span
                                        className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                            isSelected
                                                ? 'bg-brand-rust text-white'
                                                : isPast
                                                ? 'text-brand-text-light/60'
                                                : 'text-brand-text'
                                        }`}
                                    >
                                        {dayNum}
                                    </span>

                                    {info.isOverride && (
                                        <span className="text-[10px] font-semibold text-brand-rust flex items-center gap-0.5" title="Custom Date Override">
                                            <Sparkles className="size-2.5" />
                                        </span>
                                    )}
                                </div>

                                <div className="mt-2 space-y-1">
                                    <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-block max-w-full truncate ${info.badgeClass}`}>
                                        {info.label}
                                    </div>
                                    {info.time && (
                                        <div className="text-[10px] text-brand-text-mid font-medium flex items-center gap-1">
                                            <Clock className="size-2.5 text-brand-text-light shrink-0" />
                                            <span className="truncate">{info.time}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Selection & Schedule Action Panel */}
            {selectedDates.length > 0 ? (
                <div className="p-4 rounded-xl border border-brand-rust/30 bg-brand-rust/5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-rust/20 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="flex size-6 items-center justify-center rounded-full bg-brand-rust text-white text-xs font-bold">
                                {selectedDates.length}
                            </span>
                            <div>
                                <h4 className="text-xs font-bold text-brand-text">
                                    {selectedDates.length === 1
                                        ? `Date Selected: ${selectedDates[0]}`
                                        : `${selectedDates.length} Dates Selected`}
                                </h4>
                                <p className="text-[11px] text-brand-text-light">
                                    Apply availability status and pickup hours to the selected date(s).
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={clearSelection}
                            className="text-xs font-semibold text-brand-text-light hover:text-brand-text flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                        >
                            <X className="size-3.5" /> Clear Selection
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                        {/* Status Toggle */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-brand-text-mid">Availability</Label>
                            <div className="flex rounded-xl border border-border bg-card p-1">
                                <button
                                    type="button"
                                    onClick={() => setActionStatus('available')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                        actionStatus === 'available'
                                            ? 'bg-emerald-600 text-white shadow-2xs'
                                            : 'text-brand-text-mid hover:text-brand-text'
                                    }`}
                                >
                                    <CheckCircle2 className="size-3.5" /> Available
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActionStatus('unavailable')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                        actionStatus === 'unavailable'
                                            ? 'bg-zinc-700 text-white shadow-2xs'
                                            : 'text-brand-text-mid hover:text-brand-text'
                                    }`}
                                >
                                    <Ban className="size-3.5" /> Closed
                                </button>
                            </div>
                        </div>

                        {/* Time Slot (if available) */}
                        {actionStatus === 'available' ? (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-brand-text-mid">Pickup Time Window</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="time"
                                        value={timeStart}
                                        onChange={(e) => setTimeStart(e.target.value)}
                                        className="h-9 rounded-xl border border-border bg-card text-xs font-semibold text-brand-text px-2.5"
                                    />
                                    <span className="text-xs text-brand-text-light">to</span>
                                    <Input
                                        type="time"
                                        value={timeEnd}
                                        onChange={(e) => setTimeEnd(e.target.value)}
                                        className="h-9 rounded-xl border border-border bg-card text-xs font-semibold text-brand-text px-2.5"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-brand-text-light italic self-center">
                                Pickups will be disabled for these date(s).
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                onClick={handleApplySchedule}
                                className="h-9 flex-1 rounded-xl bg-brand-rust text-white text-xs font-semibold hover:bg-brand-rust/90 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                                <Check className="size-3.5" /> Apply Schedule
                            </Button>
                            <button
                                type="button"
                                onClick={handleResetOverride}
                                title="Revert to baseline weekly schedule"
                                className="h-9 px-3 rounded-xl border border-border bg-card text-xs font-semibold text-brand-text-light hover:text-brand-text hover:bg-brand-warm/20 flex items-center gap-1 cursor-pointer"
                            >
                                <RotateCcw className="size-3" /> Reset
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-3 bg-brand-warm/5 rounded-xl border border-dashed border-border flex items-center justify-between text-xs text-brand-text-light">
                    <span className="italic">Click any date above to set its pickup schedule or override hours.</span>
                    <span className="font-semibold text-brand-text">Tip: Click day headers (e.g. &apos;Tue&apos;) to batch-select all dates of that day.</span>
                </div>
            )}
        </div>
    );
}
