import { Head, useForm } from '@inertiajs/react';
import { Calendar, Clock, CalendarOff, Trash2, X, Plus, Save, MapPin, Building2, ChevronDown } from 'lucide-react';
import type { FormEventHandler, ChangeEvent } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import UnsavedChangesBar from '@/components/settings/UnsavedChangesBar';
import PickupScheduleCalendar from '@/components/logistics/pickup-schedule-calendar';
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
    label?: string;
    days?: number[];
    time_start: string;
    time_end: string;
    weeks_of_month?: number[];
    enabled?: boolean;
    date?: string;
    available?: boolean;
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
    const [showRecurringBaseline, setShowRecurringBaseline] = useState(false);

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
            {
                key: 'logistics_depot_address',
                value: getValue('logistics_depot_address', '6 Ivan St, Arundel QLD 4214'),
            },
            {
                key: 'logistics_depot_instructions',
                value: getValue('logistics_depot_instructions', ''),
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
    const depotAddressIndex = data.settings.findIndex(
        (s) => s.key === 'logistics_depot_address',
    );
    const depotInstructionsIndex = data.settings.findIndex(
        (s) => s.key === 'logistics_depot_instructions',
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
        let zoneWindows = zone?.pickup_windows;
        if (zoneWindows && typeof zoneWindows === 'object' && !Array.isArray(zoneWindows)) {
            zoneWindows = Object.values(zoneWindows);
        }
        if (zoneWindows && Array.isArray(zoneWindows) && zoneWindows.length > 0) return zoneWindows as PickupWindow[];
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
        let zoneDates = zone?.blackout_dates;
        if (zoneDates && typeof zoneDates === 'object' && !Array.isArray(zoneDates)) {
            zoneDates = Object.values(zoneDates);
        }
        if (zoneDates && Array.isArray(zoneDates) && zoneDates.length > 0) return zoneDates as string[];
        // Fallback to global
        return Array.isArray(data.settings[blackoutDatesIndex].value)
            ? data.settings[blackoutDatesIndex].value
            : [];
    };

    const zoneHasOverrides = (zoneIdx: number): boolean => {
        const zone = data.zone_schedules[zoneIdx];
        if (!zone) return false;
        
        let pw = zone.pickup_windows;
        if (pw && typeof pw === 'object' && !Array.isArray(pw)) pw = Object.values(pw);
        
        let bd = zone.blackout_dates;
        if (bd && typeof bd === 'object' && !Array.isArray(bd)) bd = Object.values(bd);
        
        return (
            (pw && Array.isArray(pw) && pw.length > 0) ||
            (bd && Array.isArray(bd) && bd.length > 0) ||
            (zone.lead_time_days !== null && zone.lead_time_days !== undefined)
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

    const handleCalendarWindowsChange = (newWindows: PickupWindow[]) => {
        if (isGlobal) {
            const newSettings = [...data.settings];
            newSettings[pickupWindowsIndex].value = newWindows;
            setData('settings', newSettings);
        } else {
            const newZones = [...data.zone_schedules];
            newZones[activeZoneIndex] = {
                ...newZones[activeZoneIndex],
                pickup_windows: newWindows,
            };
            setData('zone_schedules', newZones);
        }
    };

    const handleCalendarBlackoutDatesChange = (newDates: string[]) => {
        if (isGlobal) {
            const newSettings = [...data.settings];
            newSettings[blackoutDatesIndex].value = newDates;
            setData('settings', newSettings);
        } else {
            const newZones = [...data.zone_schedules];
            newZones[activeZoneIndex] = {
                ...newZones[activeZoneIndex],
                blackout_dates: newDates,
            };
            setData('zone_schedules', newZones);
        }
    };

    const getDepotAddress = (): string => {
        return depotAddressIndex >= 0 ? data.settings[depotAddressIndex].value : '6 Ivan St, Arundel QLD 4214';
    };

    const getDepotInstructions = (): string => {
        return depotInstructionsIndex >= 0 ? data.settings[depotInstructionsIndex].value : '';
    };

    const handleDepotAddressChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (depotAddressIndex < 0) return;
        const newSettings = [...data.settings];
        newSettings[depotAddressIndex].value = e.target.value;
        setData('settings', newSettings);
    };

    const handleDepotInstructionsChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        if (depotInstructionsIndex < 0) return;
        const newSettings = [...data.settings];
        newSettings[depotInstructionsIndex].value = e.target.value;
        setData('settings', newSettings);
    };

    const addPickupWindow = () => {
        const newWindow: PickupWindow = {
            id: `pw_${Date.now()}`,
            label: 'Weekly Window',
            days: [1, 2, 3, 4, 5],
            time_start: '08:00',
            time_end: '17:00',
            weeks_of_month: [1, 2, 3, 4, 5],
            enabled: true,
        };
        const current = getPickupWindows();
        handleCalendarWindowsChange([...current, newWindow]);
    };

    const removePickupWindow = (id: string) => {
        const current = getPickupWindows();
        handleCalendarWindowsChange(current.filter((w) => w.id !== id));
    };

    const updatePickupWindow = (id: string, updates: Partial<PickupWindow>) => {
        const current = getPickupWindows();
        handleCalendarWindowsChange(
            current.map((w) => (w.id === id ? { ...w, ...updates } : w))
        );
    };

    const [newDate, setNewDate] = useState('');
    const addBlackoutDate = () => {
        const currentDates = getBlackoutDates();
        if (!newDate || currentDates.includes(newDate)) {
            return;
        }
        const sorted = [...currentDates, newDate].sort();
        handleCalendarBlackoutDatesChange(sorted);
        setNewDate('');
    };

    const removeBlackoutDate = (dateToRemove: string) => {
        const currentDates = getBlackoutDates();
        handleCalendarBlackoutDatesChange(currentDates.filter((d: string) => d !== dateToRemove));
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
    const recurringWindows = pickupWindows.filter((w) => !w.date && Array.isArray(w.days));

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
                        className="h-10 px-5 rounded-xl bg-brand-rust text-white text-xs font-semibold hover:bg-brand-rust/90 flex items-center gap-2 shadow-2xs cursor-pointer"
                    >
                        <Save className="size-3.5" />
                        {processing ? 'Saving...' : 'Save Changes'}
                    </Button>
                }
            >
                <form onSubmit={submit} className="w-full space-y-6">
                    {/* Zone Tab Selector */}
                    {pickupZones.length > 0 && (
                        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
                            <div className="flex items-center gap-2 mb-3">
                                <MapPin className="size-4 text-brand-text-light" />
                                <span className="text-xs font-semibold text-brand-text uppercase tracking-wider">Pickup Area</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('global')}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                        isGlobal
                                            ? 'bg-brand-rust text-white shadow-2xs'
                                            : 'bg-brand-warm/10 text-brand-text-mid hover:bg-brand-warm/20 border border-border'
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
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                                                activeTab === zone.id
                                                    ? 'bg-brand-rust text-white shadow-2xs'
                                                    : 'bg-brand-warm/10 text-brand-text-mid hover:bg-brand-warm/20 border border-border'
                                            }`}
                                        >
                                            {zone.name}
                                            {hasOverrides && (
                                                <span className={`inline-block size-1.5 rounded-full ${
                                                    activeTab === zone.id ? 'bg-white/80' : 'bg-amber-400'
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
                        <div className={`rounded-xl border px-4 py-3 flex items-center justify-between shadow-2xs ${
                            isShowingGlobalFallback
                                ? 'border-amber-500/30 bg-amber-500/10'
                                : 'border-sky-500/30 bg-sky-500/10'
                        }`}>
                            <div className="flex items-center gap-2">
                                <MapPin className={`size-3.5 ${isShowingGlobalFallback ? 'text-amber-400' : 'text-sky-400'}`} />
                                <span className={`text-xs font-medium ${isShowingGlobalFallback ? 'text-amber-300' : 'text-sky-300'}`}>
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
                                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                                >
                                    Reset to Global Defaults
                                </button>
                            )}
                        </div>
                    )}

                    {/* Minimum Lead Time */}
                    <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-2xs">
                        <div className="border-b border-border pb-3">
                            <h3 className="text-sm font-semibold text-brand-text">Minimum Advance Notice</h3>
                            <p className="text-xs text-brand-text-light">
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
                                className="h-10 rounded-xl border border-border bg-card text-xs font-semibold text-brand-text focus-visible:ring-2 focus-visible:ring-ring focus:border-brand-rust"
                            />
                            <span className="text-xs font-semibold text-brand-text-mid">Days Notice</span>
                        </div>
                    </div>

                    {/* Warehouse Depot Drop-Off Location (Global) */}
                    {isGlobal && (
                        <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-2xs">
                            <div className="border-b border-border pb-3">
                                <h3 className="text-sm font-semibold text-brand-text flex items-center gap-2">
                                    <Building2 className="size-4 text-brand-rust" />
                                    Warehouse / Depot Drop-Off Location
                                </h3>
                                <p className="text-xs text-brand-text-light">
                                    The warehouse address where customers can drop off their balikbayan boxes when choosing "Drop-Off at Depot".
                                </p>
                            </div>

                            <div className="space-y-4 max-w-xl">
                                <div className="space-y-1.5">
                                    <Label htmlFor="depot-address" className="text-xs font-semibold text-brand-text">
                                        Depot Address
                                    </Label>
                                    <Input
                                        id="depot-address"
                                        type="text"
                                        value={getDepotAddress()}
                                        onChange={handleDepotAddressChange}
                                        placeholder="e.g. 6 Ivan St, Arundel QLD 4214"
                                        className="h-10 rounded-xl border border-border bg-card text-xs font-medium text-brand-text focus-visible:ring-2 focus-visible:ring-ring focus:border-brand-rust"
                                    />
                                    <p className="text-[11px] text-brand-text-light">
                                        This address is shown to customers during booking and on their booking review summary.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="depot-instructions" className="text-xs font-semibold text-brand-text">
                                        Drop-Off Hours / Instructions (Optional)
                                    </Label>
                                    <textarea
                                        id="depot-instructions"
                                        rows={3}
                                        value={getDepotInstructions()}
                                        onChange={handleDepotInstructionsChange}
                                        placeholder="e.g. Mon–Fri 8:00 AM – 4:30 PM. Please check in with warehouse staff upon arrival."
                                        className="w-full rounded-xl border border-border bg-card p-3 text-xs font-medium text-brand-text placeholder:text-brand-text-light/50 focus-visible:ring-2 focus-visible:ring-ring focus:border-brand-rust outline-none transition-all resize-y"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Monthly Pickup Schedule Calendar View */}
                    <PickupScheduleCalendar
                        zoneName={
                            isGlobal
                                ? 'All Zones (Global Default)'
                                : pickupZones.find((z) => z.id === activeTab)?.name || 'Selected Area'
                        }
                        windows={pickupWindows}
                        blackoutDates={blackoutDates}
                        leadTimeDays={leadTime}
                        onChangeWindows={handleCalendarWindowsChange}
                        onChangeBlackoutDates={handleCalendarBlackoutDatesChange}
                    />

                    {/* Recurring Weekly Baseline Windows (Collapsible Accordion) */}
                    <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowRecurringBaseline(!showRecurringBaseline)}
                                    className="flex items-center gap-2 text-left group cursor-pointer"
                                >
                                    <h3 className="text-sm font-semibold text-brand-text group-hover:text-brand-rust transition-colors">
                                        Recurring Weekly Baseline (Optional)
                                    </h3>
                                    <ChevronDown
                                        className={`size-4 text-brand-text-light transition-transform duration-200 ${
                                            showRecurringBaseline ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>
                                <p className="text-xs text-brand-text-light mt-0.5">
                                    Set recurring weekly days & times. Dates explicitly clicked on the calendar above will override these rules.
                                </p>
                            </div>
                            {showRecurringBaseline && (
                                <button
                                    type="button"
                                    onClick={addPickupWindow}
                                    className="h-9 px-3.5 rounded-xl border border-border bg-card text-xs font-semibold text-brand-text hover:bg-brand-warm/20 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                >
                                    <Plus className="size-3.5 text-brand-rust" /> Add Weekly Rule
                                </button>
                            )}
                        </div>

                        {showRecurringBaseline && (
                            <>
                                {recurringWindows.length === 0 ? (
                                    <p className="text-xs text-brand-text-light italic py-4 text-center">
                                        No recurring weekly baseline configured. Only dates marked available in the calendar will be bookable.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {recurringWindows.map((window) => (
                                            <div
                                                key={window.id}
                                                className="p-4 rounded-xl border border-border bg-brand-warm/5 space-y-3"
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <Input
                                                        className="h-9 border border-border bg-card px-3 font-semibold text-xs text-brand-text rounded-xl max-w-xs focus-visible:ring-2 focus-visible:ring-ring focus:border-brand-rust"
                                                        value={window.label || ''}
                                                        onChange={(e) =>
                                                            updatePickupWindow(window.id, { label: e.target.value })
                                                        }
                                                        placeholder="Window Name (e.g. Regular Weekdays)"
                                                    />
                                                    <div className="flex items-center gap-3">
                                                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-brand-text">
                                                            <input
                                                                type="checkbox"
                                                                className="size-3.5 rounded border-border text-brand-rust focus:ring-brand-rust"
                                                                checked={window.enabled !== false}
                                                                onChange={(e) =>
                                                                    updatePickupWindow(window.id, { enabled: e.target.checked })
                                                                }
                                                            />
                                                            Enabled
                                                        </label>
                                                        <button
                                                            type="button"
                                                            title="Remove rule"
                                                            className="p-1.5 rounded-lg text-brand-text-light hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                                            onClick={() => removePickupWindow(window.id)}
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                                    {/* Active Days */}
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-semibold text-brand-text-mid">Active Days</Label>
                                                        <div className="flex flex-wrap gap-1">
                                                            {daysOfWeek.map((day, idx) => {
                                                                const isSelected = (window.days || []).includes(idx);
                                                                return (
                                                                    <button
                                                                        key={idx}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const currentDays = window.days || [];
                                                                            const days = isSelected
                                                                                ? currentDays.filter((d) => d !== idx)
                                                                                : [...currentDays, idx].sort();
                                                                            updatePickupWindow(window.id, { days });
                                                                        }}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                                                            isSelected
                                                                                ? 'bg-brand-rust text-white shadow-2xs'
                                                                                : 'bg-card border border-border text-brand-text-mid hover:bg-brand-warm/20'
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
                                                        <Label className="text-xs font-semibold text-brand-text-mid">Daily Time Slot</Label>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="time"
                                                                className="h-9 w-28 rounded-xl border border-border bg-card text-xs font-medium text-brand-text"
                                                                value={window.time_start || '08:00'}
                                                                onChange={(e) =>
                                                                    updatePickupWindow(window.id, { time_start: e.target.value })
                                                                }
                                                            />
                                                            <span className="text-xs text-brand-text-light">to</span>
                                                            <Input
                                                                type="time"
                                                                className="h-9 w-28 rounded-xl border border-border bg-card text-xs font-medium text-brand-text"
                                                                value={window.time_end || '17:00'}
                                                                onChange={(e) =>
                                                                    updatePickupWindow(window.id, { time_end: e.target.value })
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Active Weeks of Month */}
                                                <div className="pt-3 border-t border-border mt-3 space-y-1.5">
                                                    <Label className="text-xs font-semibold text-brand-text-mid">Active Weeks of Month</Label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {weeksOfMonth.map((week) => {
                                                            const isSelected = (window.weeks_of_month ?? [1, 2, 3, 4, 5]).includes(week.value);
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
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                                                        isSelected
                                                                            ? 'bg-brand-rust text-white shadow-2xs'
                                                                            : 'bg-card border border-border text-brand-text-mid hover:bg-brand-warm/20'
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
                            </>
                        )}
                    </div>

                    {/* Blackout Dates */}
                    <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-2xs">
                        <div className="border-b border-border pb-3">
                            <h3 className="text-sm font-semibold text-brand-text">Blackout & Holiday Dates</h3>
                            <p className="text-xs text-brand-text-light">
                                Dates when pickups and operational dispatch are closed.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 max-w-sm">
                            <Input
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="h-10 rounded-xl border border-border bg-card text-xs font-medium text-brand-text focus-visible:ring-2 focus-visible:ring-ring focus:border-brand-rust"
                            />
                            <Button
                                type="button"
                                onClick={addBlackoutDate}
                                disabled={!newDate}
                                className="h-10 px-5 rounded-xl bg-brand-rust text-white text-xs font-semibold hover:bg-brand-rust/90 disabled:opacity-50 cursor-pointer shadow-2xs"
                            >
                                Add Date
                            </Button>
                        </div>

                        {blackoutDates.length > 0 ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {blackoutDates.map((date) => (
                                    <div
                                        key={date}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-warm/10 text-brand-text border border-border text-xs font-semibold"
                                    >
                                        <span>{date}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeBlackoutDate(date)}
                                            className="p-0.5 rounded text-brand-text-light hover:text-rose-400 cursor-pointer"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-brand-text-light italic">No blackout dates added.</p>
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
