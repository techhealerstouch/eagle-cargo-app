
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Save, ArrowLeft, Check, Calendar, ChevronDown, ExternalLink, MapPin, Phone, User, ShieldCheck, Box, RefreshCw, Search, Plus, Trash2, X } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';

import Heading from '@/components/common/heading';
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
    };
}

interface Runsheet {
    id: number;
    picker_id: number | null;
    scheduled_date: string;
    timeslot?: string;
    area_description: string;
    status: string;
    bookings?: Booking[];
}

export default function PickupRunsheetsEdit({
    runsheet,
    pickers = [],
    pickupZones = [],
    pickupEligibleBookings = [],
}: {
    runsheet: Runsheet;
    pickers?: Picker[];
    pickupZones?: PickupZone[];
    pickupEligibleBookings?: Booking[];
}) {
    const { t } = useTranslations();
    const { admin_return_url } = usePage<any>().props;

    const { data, setData, put, processing, errors } = useForm({
        picker_id: runsheet.picker_id?.toString() ?? '',
        scheduled_date: runsheet.scheduled_date ? runsheet.scheduled_date.substring(0, 10) : '',
        timeslot: runsheet.timeslot ?? '',
        area_description: runsheet.area_description,
        status: runsheet.status,
        booking_ids: runsheet.bookings?.map(b => b.id) ?? [] as number[],
        stop_sequence: runsheet.bookings?.map(b => b.id) ?? [] as number[],
    });

    const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');
    const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);

    // Ensure area_description is always a valid PickupZone or empty
    useEffect(() => {
        if (data.area_description && pickupZones.length > 0) {
            const isValid = pickupZones.some(z => z.name.toLowerCase() === data.area_description.toLowerCase());
            if (!isValid) {
                const foundBySuburb = pickupZones.find(z =>
                    z.suburbs?.some(s => s.name.toLowerCase() === data.area_description.toLowerCase())
                );
                if (foundBySuburb) {
                    setData('area_description', foundBySuburb.name);
                } else {
                    setData('area_description', '');
                }
            }
        }
    }, [pickupZones, data.area_description]);

    const selectedPicker = useMemo(() => {
        return pickers.find(p => String(p.id) === String(data.picker_id));
    }, [pickers, data.picker_id]);

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

    const requiresBookingSelection = (data.status === 'assigned' || data.status === 'in_progress');
    const hasSelectedBookings = data.booking_ids.length > 0;
    const isSubmitDisabled = processing || (requiresBookingSelection && !hasSelectedBookings);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('ui.common.dashboard', 'Dashboard'), href: '/dashboard' },
        { title: t('ui.runsheets.breadcrumbs.runsheets', 'Runsheets'), href: admin_return_url || '/admin/runsheets' },
        { title: 'Edit Pickup Dispatch', href: '#' },
    ];

    const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
        e.preventDefault();
        put(`/admin/runsheets/${runsheet.id}`);
    };

    const toggleBooking = (bookingId: number) => {
        const isSelected = data.booking_ids.includes(bookingId);
        const nextBookingIds = isSelected
            ? data.booking_ids.filter((id) => id !== bookingId)
            : [...data.booking_ids, bookingId];

        setData({
            ...data,
            booking_ids: nextBookingIds,
            stop_sequence: nextBookingIds,
        });
    };

    const moveStop = (bookingId: number, direction: -1 | 1) => {
        const currentIndex = data.booking_ids.indexOf(bookingId);
        const nextIndex = currentIndex + direction;

        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= data.booking_ids.length) {
            return;
        }

        const nextBookingIds = [...data.booking_ids];
        [nextBookingIds[currentIndex], nextBookingIds[nextIndex]] = [nextBookingIds[nextIndex], nextBookingIds[currentIndex]];

        setData({
            ...data,
            booking_ids: nextBookingIds,
            stop_sequence: nextBookingIds,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Pickup Dispatch | Admin" />
            <div className="flex h-full flex-1 flex-col gap-4 p-6 sm:p-8 font-sans">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                    <div className="flex items-center gap-3">
                        <Link
                            href={admin_return_url || "/admin/runsheets"}
                            className="flex items-center justify-center size-8.5 rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:border-brand-rust hover:text-brand-rust hover:bg-brand-rust/5 shadow-2xs cursor-pointer"
                            title="Back to Runsheets"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                        <div className="flex items-center gap-3 flex-wrap">
                            <Heading
                                eyebrow="Origin Operations"
                                title="Update Pickup Dispatch"
                                description="Adjust collection schedule or assigned picker for this route."
                            />
                            <span className="rounded-lg bg-brand-warm/30 px-3 py-1 font-mono text-xs font-bold text-brand-rust tracking-tight border border-brand-rust/20 shadow-2xs flex items-center gap-1.5">
                                <RefreshCw className="size-3" />
                                ID: {runsheet.id.toString().padStart(4, '0')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-4 max-w-4xl mx-auto w-full flex-1 card border-slate-200/80 shadow-xs rounded-xl bg-white overflow-hidden font-sans">
                    <div className="bg-slate-50/70 p-6 border-b border-slate-200/70 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-brand-rust/10 flex items-center justify-center text-brand-rust">
                                <Calendar className="size-4" />
                            </div>
                            <div>
                                <h2 className="font-sans text-sm font-bold text-slate-800 uppercase tracking-wider">Pickup Dispatch Details</h2>
                                <p className="text-[11px] text-slate-500 font-normal">Configure collection schedule, status, and route territory</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                            <ShieldCheck className="size-3.5 text-brand-secondary" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Updating Dispatch</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="scheduled_date" className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Collection Date <span className="text-red-500">*</span></Label>
                                <div className="relative group">
                                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-brand-rust pointer-events-none transition-colors" />
                                    <Input
                                        id="scheduled_date"
                                        type="date"
                                        required
                                        min={runsheet.scheduled_date && runsheet.scheduled_date.substring(0, 10) < new Date().toLocaleDateString('en-CA') ? runsheet.scheduled_date.substring(0, 10) : new Date().toLocaleDateString('en-CA')}
                                        className="h-10 rounded-lg border-slate-200 bg-white pl-10 pr-3 font-sans text-xs font-semibold text-slate-800 focus:border-brand-rust focus:ring-1 focus:ring-brand-rust/20 transition-all cursor-pointer [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                        value={data.scheduled_date}
                                        onChange={(e) =>
                                            setData('scheduled_date', e.target.value)
                                        }
                                    />
                                </div>
                                {errors.scheduled_date && (
                                    <p className="text-[10px] font-bold text-red-500 ml-1">{errors.scheduled_date}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="timeslot" className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">
                                    Time Slot <span className="text-[10px] font-normal text-slate-400 lowercase">(optional)</span>
                                </Label>
                                <div className="relative group">
                                    <select
                                        id="timeslot"
                                        title="Time Slot"
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

                            <div className="space-y-1.5 md:col-span-2">
                                <Label htmlFor="status" className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Status <span className="text-red-500">*</span></Label>
                                <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200/80">
                                    {[
                                        { id: 'draft', label: 'Draft' },
                                        { id: 'assigned', label: 'Assigned' },
                                        { id: 'in_progress', label: 'In Progress' },
                                        { id: 'completed', label: 'Completed' },
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
                                {errors.status && (
                                    <p className="text-[10px] font-bold text-red-500 ml-1">{errors.status}</p>
                                )}
                            </div>

                            <div className="space-y-1.5 md:col-span-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="area_description" className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">
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
                                        id="area_description"
                                        required
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 font-sans text-xs font-semibold text-slate-800 focus:border-brand-rust focus:ring-1 focus:ring-brand-rust/20 transition-all appearance-none cursor-pointer truncate"
                                        value={data.area_description}
                                        onChange={(e) =>
                                            setData('area_description', e.target.value)
                                        }
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
                                {errors.area_description && (
                                    <p className="text-[10px] font-bold text-red-500 ml-1">{errors.area_description}</p>
                                )}
                            </div>

                             <div className="space-y-3 md:col-span-2 pt-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-6 rounded-md bg-brand-rust/10 flex items-center justify-center text-brand-rust">
                                            <User className="size-3.5" />
                                        </div>
                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                            Assigned Picker <span className="text-red-500">*</span>
                                        </Label>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                                        {pickers.length} Available
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {selectedPicker ? (
                                        (() => {
                                            const activeCount = (selectedPicker as any).active_runsheet_count ?? 0;
                                            const initials = selectedPicker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                                            const mobile = selectedPicker.picker?.mobile || '';

                                            return (
                                                <div className="p-3.5 rounded-lg border border-brand-rust/30 bg-brand-rust/5 flex items-center gap-3 relative">
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
                                                            {mobile && (
                                                                <>
                                                                    <span className="text-[10px] text-slate-300">•</span>
                                                                    <p className="text-[10px] font-medium text-slate-500 truncate">📱 {mobile}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 z-10">
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
                                    <div className="flex justify-end pt-1">
                                        <Link
                                            href="/admin/users/create"
                                            className="text-[10px] font-bold text-brand-rust hover:underline flex items-center gap-1 uppercase tracking-wider"
                                        >
                                            <Plus className="size-3" />
                                            Add New Picker
                                        </Link>
                                    </div>
                                </div>

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
                                                    const mobile = u.picker?.mobile || '';

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
                                                                    {mobile && (
                                                                        <>
                                                                            <span className="text-slate-300 text-xs">•</span>
                                                                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                                                                <Phone className="size-2.5 text-slate-400" />
                                                                                {mobile}
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

                            <div className="space-y-6 md:col-span-2 pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-brand-warm/10 rounded-xl border border-brand-warm/20 text-brand-rust shadow-sm">
                                        <Box className="size-5" />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-rust">Included Bookings</Label>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">Manage bookings assigned to this collection route.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    {/* Existing Bookings */}
                                    {runsheet.bookings?.map((booking) => (
                                        <div key={booking.id} className="flex items-center gap-5 p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden border-brand-rust bg-brand-rust/3 ring-2 ring-brand-rust/20"
                                            onClick={() => toggleBooking(booking.id)}>
                                            <div className={`size-6 rounded-lg border-2 flex items-center justify-center transition-all ${data.booking_ids.includes(booking.id) ? 'bg-brand-rust border-brand-rust shadow-lg' : 'border-brand-warm/20 bg-brand-warm/5'}`}>
                                                {data.booking_ids.includes(booking.id) && <Check className="size-4 text-white stroke-[4px]" />}
                                            </div>
                                            <div className="flex size-8 items-center justify-center rounded-full bg-brand-rust/10 font-mono text-[10px] font-black text-brand-rust">
                                                {(data.booking_ids.indexOf(booking.id) + 1) || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-brand-rust tracking-tight uppercase font-mono">{booking.reference_number}</p>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate">{booking.sender.first_name} {booking.sender.last_name}</p>
                                            </div>
                                            <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                                                <Button type="button" variant="outline" disabled={data.booking_ids.indexOf(booking.id) <= 0} onClick={() => moveStop(booking.id, -1)} className="h-8 px-2 text-[9px] font-black uppercase tracking-widest">
                                                    Up
                                                </Button>
                                                <Button type="button" variant="outline" disabled={data.booking_ids.indexOf(booking.id) === data.booking_ids.length - 1} onClick={() => moveStop(booking.id, 1)} className="h-8 px-2 text-[9px] font-black uppercase tracking-widest">
                                                    Down
                                                </Button>
                                            </div>
                                            <span className="absolute top-3 right-5 text-[8px] font-black text-brand-rust/50 uppercase tracking-widest">Included</span>
                                        </div>
                                    ))}

                                    {/* Available Bookings */}
                                    {pickupEligibleBookings.filter(pb => !runsheet.bookings?.some(b => b.id === pb.id)).map((booking) => (
                                        <div key={booking.id} className={`flex items-center gap-5 p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden ${data.booking_ids.includes(booking.id) ? 'border-brand-rust bg-brand-rust/3 ring-2 ring-brand-rust/20' : 'border-brand-warm/10 bg-white hover:border-brand-rust/40'}`}
                                            onClick={() => toggleBooking(booking.id)}>
                                            <div className={`size-6 rounded-lg border-2 flex items-center justify-center transition-all ${data.booking_ids.includes(booking.id) ? 'bg-brand-rust border-brand-rust shadow-lg' : 'border-brand-warm/20 bg-brand-warm/5'}`}>
                                                {data.booking_ids.includes(booking.id) && <Check className="size-4 text-white stroke-[4px]" />}
                                            </div>
                                            {data.booking_ids.includes(booking.id) && (
                                                <div className="flex size-8 items-center justify-center rounded-full bg-brand-rust/10 font-mono text-[10px] font-black text-brand-rust">
                                                    {data.booking_ids.indexOf(booking.id) + 1}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-brand-rust tracking-tight uppercase font-mono">{booking.reference_number}</p>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate">{booking.sender.first_name} {booking.sender.last_name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-5 pt-10 border-t border-brand-warm/10">
                            <Link href={admin_return_url || "/admin/runsheets"} className="px-10 h-14 flex items-center justify-center rounded-2xl border-2 border-brand-warm/20 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-brand-warm/5">Cancel</Link>
                            <Button type="submit" disabled={isSubmitDisabled} variant="success" className="px-14 h-14 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-4 shadow-2xl disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none">
                                <Save className="size-4" />
                                {processing ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
