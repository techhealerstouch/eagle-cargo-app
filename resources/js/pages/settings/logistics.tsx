import { Head, useForm } from '@inertiajs/react';
import { Calendar, Clock, CalendarOff, Trash2, X, Plus, Save, MapPin } from 'lucide-react';
import type { FormEventHandler, ChangeEvent } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import UnsavedChangesBar from '@/components/settings/UnsavedChangesBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Pickup Rules',
        href: '/settings/logistics',
    },
];

interface Setting {
    key: string;
    display_name: string;
    value: any;
}

interface PickupWindow {
    id: string;
    label: string;
    days: number[];
    time_start: string;
    time_end: string;
    weeks_of_month: number[];
    enabled: boolean;
}

interface PickupZone {
    id: number;
    name: string;
    code: string;
    pickup_windows: PickupWindow[] | null;
    blackout_dates: string[] | null;
    lead_time_days: number | null;
}

export default function LogisticsSettings({
    settingsList,
    pickupZones = [],
}: {
    settingsList: Setting[];
    pickupZones?: PickupZone[];
}) {
    const getValue = (key: string, defaultValue: any) => {
        const item = settingsList.find((s) => s.key === key);
        return item?.value !== undefined && item?.value !== ''
            ? item.value
            : defaultValue;
    };

    // activeTab: 'global' or a zone id number
    const [activeTab, setActiveTab] = useState<'global' | number>('global');

    const { data, setData, post, processing, isDirty, reset } = useForm({
        settings: [
            {
                key: 'logistics_lead_time_days',
                value: getValue('logistics_lead_time_days', 2),
            },
            {
                key: 'logistics_pickup_windows',
                value: getValue('logistics_pickup_windows', []),
            },
            {
                key: 'logistics_blackout_dates',
                value: getValue('logistics_blackout_dates', []),
            },
        ],
        zone_schedules: pickupZones.map((zone) => ({
            id: zone.id,
            pickup_windows: zone.pickup_windows || [],
            blackout_dates: zone.blackout_dates || [],
            lead_time_days: zone.lead_time_days,
        })),
    });

    const leadTimeIndex = data.settings.findIndex(
        (s) => s.key === 'logistics_lead_time_days',
    );
    const pickupWindowsIndex = data.settings.findIndex(
        (s) => s.key === 'logistics_pickup_windows',
    );
    const blackoutDatesIndex = data.settings.findIndex(
        (s) => s.key === 'logistics_blackout_dates',
    );

    // Current zone schedule data for the active tab
    const activeZoneIndex = typeof activeTab === 'number'
        ? data.zone_schedules.findIndex((z) => z.id === activeTab)
        : -1;

    const isGlobal = activeTab === 'global';

    // Getters: return the correct data source based on active tab
    const getLeadTime = (): number => {
        if (isGlobal) return parseInt(data.settings[leadTimeIndex].value) || 0;
        const zone = data.zone_schedules[activeZoneIndex];
        return zone?.lead_time_days ?? (parseInt(data.settings[leadTimeIndex].value) || 0);
    };

    const getPickupWindows = (): PickupWindow[] => {
        if (isGlobal) {
            return Array.isArray(data.settings[pickupWindowsIndex].value)
                ? data.settings[pickupWindowsIndex].value
                : [];
        }
        const zone = data.zone_schedules[activeZoneIndex];
        const zoneWindows = zone?.pickup_windows;
        if (zoneWindows && zoneWindows.length > 0) return zoneWindows;
        // Fallback to global
        return Array.isArray(data.settings[pickupWindowsIndex].value)
            ? data.settings[pickupWindowsIndex].value
            : [];
    };

    const getBlackoutDates = (): string[] => {
        if (isGlobal) {
            return Array.isArray(data.settings[blackoutDatesIndex].value)
                ? data.settings[blackoutDatesIndex].value
                : [];
        }
        const zone = data.zone_schedules[activeZoneIndex];
        const zoneDates = zone?.blackout_dates;
        if (zoneDates && zoneDates.length > 0) return zoneDates;
        // Fallback to global
        return Array.isArray(data.settings[blackoutDatesIndex].value)
            ? data.settings[blackoutDatesIndex].value
            : [];
    };

    const zoneHasOverrides = (zoneIdx: number): boolean => {
        const zone = data.zone_schedules[zoneIdx];
        if (!zone) return false;
        return (
            (zone.pickup_windows && zone.pickup_windows.length > 0) ||
            (zone.blackout_dates && zone.blackout_dates.length > 0) ||
            zone.lead_time_days !== null
        );
    };

    const isShowingGlobalFallback = !isGlobal && !zoneHasOverrides(activeZoneIndex);

    // Setters
    const handleLeadTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value) || 0;
        if (isGlobal) {
            const newSettings = [...data.settings];
            newSettings[leadTimeIndex].value = val;
            setData('settings', newSettings);
        } else {
            const newZones = [...data.zone_schedules];
            newZones[activeZoneIndex] = { ...newZones[activeZoneIndex], lead_time_days: val };
            setData('zone_schedules', newZones);
        }
    };

    const addPickupWindow = () => {
        const newWindow: PickupWindow = {
            id: `pw_${Date.now()}`,
            label: 'New Pickup Window',
            days: [1, 2, 3, 4, 5],
            time_start: '08:00',
            time_end: '17:00',
            weeks_of_month: [1, 2, 3, 4, 5],
            enabled: true,
        };
        if (isGlobal) {
            const newSettings = [...data.settings];
            const current = Array.isArray(newSettings[pickupWindowsIndex].value)
                ? newSettings[pickupWindowsIndex].value
                : [];
            newSettings[pickupWindowsIndex].value = [...current, newWindow];
            setData('settings', newSettings);
        } else {
            const newZones = [...data.zone_schedules];
            const current = newZones[activeZoneIndex].pickup_windows || [];
            newZones[activeZoneIndex] = { ...newZones[activeZoneIndex], pickup_windows: [...current, newWindow] };
            setData('zone_schedules', newZones);
        }
    };

    const removePickupWindow = (id: string) => {
        if (isGlobal) {
            const newSettings = [...data.settings];
            const current = Array.isArray(newSettings[pickupWindowsIndex].value)
                ? newSettings[pickupWindowsIndex].value
                : [];
            newSettings[pickupWindowsIndex].value = current.filter((w: PickupWindow) => w.id !== id);
            setData('settings', newSettings);
        } else {
            const newZones = [...data.zone_schedules];
            const current = newZones[activeZoneIndex].pickup_windows || [];
            newZones[activeZoneIndex] = { ...newZones[activeZoneIndex], pickup_windows: current.filter((w) => w.id !== id) };
            setData('zone_schedules', newZones);
        }
    };

    const updatePickupWindow = (id: string, updates: Partial<PickupWindow>) => {
        if (isGlobal) {
            const newSettings = [...data.settings];
            const current = Array.isArray(newSettings[pickupWindowsIndex].value)
                ? newSettings[pickupWindowsIndex].value
                : [];
            newSettings[pickupWindowsIndex].value = current.map((w: PickupWindow) =>
                w.id === id ? { ...w, ...updates } : w,
            );
            setData('settings', newSettings);
        } else {
            const newZones = [...data.zone_schedules];
            const current = newZones[activeZoneIndex].pickup_windows || [];
            newZones[activeZoneIndex] = {
                ...newZones[activeZoneIndex],
                pickup_windows: current.map((w) => w.id === id ? { ...w, ...updates } : w),
            };
            setData('zone_schedules', newZones);
        }
    };

    const [newDate, setNewDate] = useState('');
    const addBlackoutDate = () => {
        const currentDates = getBlackoutDates();
        if (!newDate || currentDates.includes(newDate)) {
            return;
        }
        const sorted = [...currentDates, newDate].sort();
        if (isGlobal) {
            const newSettings = [...data.settings];
            newSettings[blackoutDatesIndex].value = sorted;
            setData('settings', newSettings);
        } else {
            const newZones = [...data.zone_schedules];
            newZones[activeZoneIndex] = { ...newZones[activeZoneIndex], blackout_dates: sorted };
            setData('zone_schedules', newZones);
        }
        setNewDate('');
    };

    const removeBlackoutDate = (dateToRemove: string) => {
        if (isGlobal) {
            const newSettings = [...data.settings];
            const current = Array.isArray(newSettings[blackoutDatesIndex].value)
                ? newSettings[blackoutDatesIndex].value
                : [];
            newSettings[blackoutDatesIndex].value = current.filter((d: string) => d !== dateToRemove);
            setData('settings', newSettings);
        } else {
            const newZones = [...data.zone_schedules];
            const current = newZones[activeZoneIndex].blackout_dates || [];
            newZones[activeZoneIndex] = {
                ...newZones[activeZoneIndex],
                blackout_dates: current.filter((d) => d !== dateToRemove),
            };
            setData('zone_schedules', newZones);
        }
    };

    const resetZoneToGlobal = () => {
        if (isGlobal || activeZoneIndex < 0) return;
        const newZones = [...data.zone_schedules];
        newZones[activeZoneIndex] = {
            ...newZones[activeZoneIndex],
            pickup_windows: [],
            blackout_dates: [],
            lead_time_days: null,
        };
        setData('zone_schedules', newZones);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/settings/logistics', {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Pickup rules saved successfully');
            },
        });
    };

    const daysOfWeek = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
    ];

    const weeksOfMonth = [
        { value: 1, label: '1st Week (1-7)' },
        { value: 2, label: '2nd Week (8-14)' },
        { value: 3, label: '3rd Week (15-21)' },
        { value: 4, label: '4th Week (22-28)' },
        { value: 5, label: '5th Week (29+)' },
    ];

    const leadTime = getLeadTime();
    const pickupWindows = getPickupWindows();
    const blackoutDates = getBlackoutDates();

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pickup Rules" />
            <SettingsLayout
                eyebrow="Operations"
                title="Pickup Rules & Schedule"
                description="Configure pickup notice lead time, booking windows, and blackout dates."
                actions={
                    <Button
                        onClick={submit}
                        disabled={processing}
                        className="h-9 px-5 rounded-lg bg-brand-rust text-white text-xs font-medium hover:bg-brand-rust/90 flex items-center gap-2"
                    >
                        <Save className="size-3.5" />
                        {processing ? 'Saving...' : 'Save Changes'}
                    </Button>
                }
            >
                <form onSubmit={submit} className="max-w-3xl space-y-6">
                    {/* Zone Tab Selector */}
                    {pickupZones.length > 0 && (
                        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <div className="flex items-center gap-2 mb-3">
                                <MapPin className="size-4 text-zinc-500" />
                                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Pickup Area</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('global')}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        isGlobal
                                            ? 'bg-brand-rust text-white shadow-sm'
                                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200'
                                    }`}
                                >
                                    All Zones (Default)
                                </button>
                                {pickupZones.map((zone, idx) => {
                                    const hasOverrides = zoneHasOverrides(
                                        data.zone_schedules.findIndex((z) => z.id === zone.id)
                                    );
                                    return (
                                        <button
                                            key={zone.id}
                                            type="button"
                                            onClick={() => setActiveTab(zone.id)}
                                            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                                                activeTab === zone.id
                                                    ? 'bg-brand-rust text-white shadow-sm'
                                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200'
                                            }`}
                                        >
                                            {zone.name}
                                            {hasOverrides && (
                                                <span className={`inline-block size-1.5 rounded-full ${
                                                    activeTab === zone.id ? 'bg-white/80' : 'bg-amber-500'
                                                }`} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Global Fallback Banner for Zone Tabs */}
                    {!isGlobal && (
                        <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                            isShowingGlobalFallback
                                ? 'border-amber-200 bg-amber-50/60'
                                : 'border-sky-200 bg-sky-50/60'
                        }`}>
                            <div className="flex items-center gap-2">
                                <MapPin className={`size-3.5 ${isShowingGlobalFallback ? 'text-amber-600' : 'text-sky-600'}`} />
                                <span className="text-xs font-medium text-zinc-700">
                                    {isShowingGlobalFallback
                                        ? 'Using global defaults. Customize below to override for this zone.'
                                        : `Custom schedule active for ${pickupZones.find(z => z.id === activeTab)?.name ?? 'this zone'}.`
                                    }
                                </span>
                            </div>
                            {!isShowingGlobalFallback && (
                                <button
                                    type="button"
                                    onClick={resetZoneToGlobal}
                                    className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
                                >
                                    Reset to Global Defaults
                                </button>
                            )}
                        </div>
                    )}

                    {/* Minimum Lead Time */}
                    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-2xs">
                        <div className="border-b border-zinc-100 pb-3">
                            <h3 className="text-sm font-semibold text-zinc-900">Minimum Advance Notice</h3>
                            <p className="text-xs text-zinc-500">
                                Required lead time in days for booking a courier pickup slot.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 max-w-xs">
                            <Input
                                id="lead-time"
                                type="number"
                                min="0"
                                value={leadTime}
                                onChange={handleLeadTimeChange}
                                className="h-9 rounded-lg border-zinc-200 text-xs font-semibold"
                            />
                            <span className="text-xs font-medium text-zinc-600">Days Notice</span>
                        </div>
                    </div>

                    {/* Pickup Windows */}
                    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-900">Weekly Pickup Windows</h3>
                                <p className="text-xs text-zinc-500">
                                    Active days and time slots available during checkout.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addPickupWindow}
                                className="h-8 px-3 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5"
                            >
                                <Plus className="size-3.5 text-zinc-500" /> Add Window
                            </button>
                        </div>

                        {pickupWindows.length === 0 ? (
                            <p className="text-xs text-zinc-400 italic py-4 text-center">No pickup windows configured. Any day will be selectable by default.</p>
                        ) : (
                            <div className="space-y-4">
                                {pickupWindows.map((window) => (
                                    <div
                                        key={window.id}
                                        className="p-4 rounded-lg border border-zinc-200 bg-zinc-50/50 space-y-3"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <Input
                                                className="h-8 border-zinc-200 bg-white px-2.5 font-semibold text-xs text-zinc-900 rounded-md max-w-xs"
                                                value={window.label}
                                                onChange={(e) =>
                                                    updatePickupWindow(window.id, { label: e.target.value })
                                                }
                                                placeholder="Window Name"
                                            />
                                            <div className="flex items-center gap-3">
                                                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-zinc-600">
                                                    <input
                                                        type="checkbox"
                                                        className="size-3.5 rounded border-zinc-300 text-brand-rust focus:ring-brand-rust"
                                                        checked={window.enabled}
                                                        onChange={(e) =>
                                                            updatePickupWindow(window.id, { enabled: e.target.checked })
                                                        }
                                                    />
                                                    Enabled
                                                </label>
                                                <button
                                                    type="button"
                                                    title="Remove window"
                                                    className="p-1 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => removePickupWindow(window.id)}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                            {/* Active Days */}
                                            <div className="space-y-1.5">
                                                <Label className="text-[11px] font-semibold text-zinc-600">Active Days</Label>
                                                <div className="flex flex-wrap gap-1">
                                                    {daysOfWeek.map((day, idx) => {
                                                        const isSelected = window.days.includes(idx);
                                                        return (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                onClick={() => {
                                                                    const days = isSelected
                                                                        ? window.days.filter((d) => d !== idx)
                                                                        : [...window.days, idx].sort();
                                                                    updatePickupWindow(window.id, { days });
                                                                }}
                                                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                                                    isSelected
                                                                        ? 'bg-brand-rust text-white font-semibold'
                                                                        : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                                                                }`}
                                                            >
                                                                {day.slice(0, 3)}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Time Slot */}
                                            <div className="space-y-1.5">
                                                <Label className="text-[11px] font-semibold text-zinc-600">Daily Time Slot</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="time"
                                                        className="h-8 w-28 rounded-md border-zinc-200 bg-white text-xs"
                                                        value={window.time_start}
                                                        onChange={(e) =>
                                                            updatePickupWindow(window.id, { time_start: e.target.value })
                                                        }
                                                    />
                                                    <span className="text-xs text-zinc-400">to</span>
                                                    <Input
                                                        type="time"
                                                        className="h-8 w-28 rounded-md border-zinc-200 bg-white text-xs"
                                                        value={window.time_end}
                                                        onChange={(e) =>
                                                            updatePickupWindow(window.id, { time_end: e.target.value })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Active Weeks of Month */}
                                        <div className="pt-3 border-t border-zinc-100 mt-3 space-y-1.5">
                                            <Label className="text-[11px] font-semibold text-zinc-600">Active Weeks of Month</Label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {weeksOfMonth.map((week) => {
                                                    const isSelected = window.weeks_of_month?.includes(week.value) ?? true;
                                                    return (
                                                        <button
                                                            key={week.value}
                                                            type="button"
                                                            onClick={() => {
                                                                const currentWeeks = window.weeks_of_month ?? [1, 2, 3, 4, 5];
                                                                const newWeeks = isSelected
                                                                    ? currentWeeks.filter((w) => w !== week.value)
                                                                    : [...currentWeeks, week.value].sort();
                                                                updatePickupWindow(window.id, { weeks_of_month: newWeeks });
                                                            }}
                                                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                                                isSelected
                                                                    ? 'bg-brand-rust text-white font-semibold'
                                                                    : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                                                            }`}
                                                        >
                                                            {week.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Blackout Dates */}
                    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-2xs">
                        <div className="border-b border-zinc-100 pb-3">
                            <h3 className="text-sm font-semibold text-zinc-900">Blackout & Holiday Dates</h3>
                            <p className="text-xs text-zinc-500">
                                Dates when pickups and operational dispatch are closed.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 max-w-sm">
                            <Input
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="h-9 rounded-lg border-zinc-200 text-xs"
                            />
                            <Button
                                type="button"
                                onClick={addBlackoutDate}
                                disabled={!newDate}
                                className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-black disabled:opacity-50"
                            >
                                Add Date
                            </Button>
                        </div>

                        {blackoutDates.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {blackoutDates.map((date) => (
                                    <div
                                        key={date}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-medium"
                                    >
                                        <span>{date}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeBlackoutDate(date)}
                                            className="p-0.5 rounded text-zinc-400 hover:text-zinc-700"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-zinc-400 italic">No blackout dates added.</p>
                        )}
                    </div>

                    <UnsavedChangesBar
                        isDirty={isDirty}
                        processing={processing}
                        onReset={reset}
                    />
                </form>
            </SettingsLayout>
        </AppLayout>
    );
}
