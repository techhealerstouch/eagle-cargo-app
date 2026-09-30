import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Box, Calendar, Check, ChevronDown, ArrowLeft, RefreshCw, Save, Search, Truck, User, MapPin, Plus, Trash2, Phone, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Courier {
    id: number;
    name: string;
    email?: string;
    active_runsheet_count?: number;
    courier?: { id: number; user_id: number; mobile?: string; email?: string; area?: { id: number; name: string } } | null;
}

interface Booking {
    id: number;
    reference_number: string;
    sender: {
        first_name: string;
        last_name: string;
    };
    boxes: Array<{
        id: number;
        recipient: {
            first_name: string;
            last_name: string;
            area?: {
                name: string;
            } | null;
        } | null;
    }>;
}

interface Runsheet {
    id: number;
    courier_id: number | null;
    scheduled_date: string;
    timeslot?: string;
    area_description: string;
    status: string;
    boxes?: any[];
}

export default function DeliveryRunsheetsEdit({
    runsheet,
    couriers = [],
    deliveryEligibleBoxes = [],
}: {
    runsheet: Runsheet;
    couriers?: Courier[];
    deliveryEligibleBoxes?: any[];
}) {
    const { t } = useTranslations();
    const { admin_return_url } = usePage<any>().props;

    const { data, setData, put, processing, errors } = useForm({
        courier_id: runsheet.courier_id?.toString() ?? '',
        scheduled_date: runsheet.scheduled_date ? runsheet.scheduled_date.substring(0, 10) : '',
        timeslot: runsheet.timeslot ?? '',
        area_description: runsheet.area_description,
        status: runsheet.status,
        box_ids: runsheet.boxes?.map(b => b.id) ?? [] as number[],
        stop_sequence: runsheet.boxes?.map(b => b.id) ?? [] as number[],
    });

    const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');
    const [isCourierModalOpen, setIsCourierModalOpen] = useState(false);

    const selectedCourier = useMemo(() => {
        return couriers.find(c => String(c.id) === String(data.courier_id));
    }, [couriers, data.courier_id]);

    const activeAreaName = useMemo(() => {
        if (data.box_ids.length > 0) {
            const box = runsheet.boxes?.find(b => b.id === data.box_ids[0]) 
                         || deliveryEligibleBoxes.find(b => b.id === data.box_ids[0]);

            return box?.recipient?.area?.name;
        }

        return null;
    }, [data.box_ids, runsheet.boxes, deliveryEligibleBoxes]);

    const filteredCouriers = useMemo(() => {
        const matches = couriers.filter((u) => {
            const matchesSearch = u.name.toLowerCase().includes(assigneeSearchTerm.toLowerCase()) ||
                u.email?.toLowerCase().includes(assigneeSearchTerm.toLowerCase()) ||
                u.courier?.mobile?.includes(assigneeSearchTerm);
                
            const matchesArea = !activeAreaName || !u.courier?.area?.name || u.courier?.area?.name === activeAreaName;

            return matchesSearch && matchesArea;
        });

        if (!data.courier_id) return matches;

        return [...matches].sort((a, b) => {
            if (String(a.id) === String(data.courier_id)) return -1;
            if (String(b.id) === String(data.courier_id)) return 1;
            return 0;
        });
    }, [couriers, assigneeSearchTerm, activeAreaName, data.courier_id]);

    // Limit displayed items in the modal to avoid DOM overload
    const displayedCouriers = useMemo(() => {
        return filteredCouriers.slice(0, 30);
    }, [filteredCouriers]);

    const filteredAvailableBoxes = useMemo(() => {
        const selectedCourier = data.courier_id ? couriers.find(u => String(u.id) === String(data.courier_id)) : null;
        const courierArea = selectedCourier?.courier?.area?.name;

        return deliveryEligibleBoxes.filter(pb => {
            const notAlreadyInRunsheet = !runsheet.boxes?.some(b => b.id === pb.id);

            if (!notAlreadyInRunsheet) {
return false;
}

            if (courierArea && pb.recipient?.area?.name && pb.recipient?.area?.name !== courierArea) {
                return false;
            }

            return true;
        });
    }, [deliveryEligibleBoxes, runsheet.boxes, data.courier_id, couriers]);

    const isSubmitDisabled = processing;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('ui.common.dashboard', 'Dashboard'), href: '/dashboard' },
        { title: t('ui.runsheets.breadcrumbs.runsheets', 'Runsheets'), href: admin_return_url || '/admin/runsheets' },
        { title: 'Edit Delivery Dispatch', href: '#' },
    ];

    const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
        e.preventDefault();
        put(`/admin/runsheets/${runsheet.id}`);
    };

    const toggleBox = (bookingId: number) => {
        const isSelected = data.box_ids.includes(bookingId);
        const nextBookingIds = isSelected
            ? data.box_ids.filter((id) => id !== bookingId)
            : [...data.box_ids, bookingId];

        setData({
            ...data,
            box_ids: nextBookingIds,
            stop_sequence: nextBookingIds,
        });
    };

    const moveStop = (bookingId: number, direction: -1 | 1) => {
        const currentIndex = data.box_ids.indexOf(bookingId);
        const nextIndex = currentIndex + direction;

        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= data.box_ids.length) {
            return;
        }

        const nextBookingIds = [...data.box_ids];
        [nextBookingIds[currentIndex], nextBookingIds[nextIndex]] = [nextBookingIds[nextIndex], nextBookingIds[currentIndex]];

        setData({
            ...data,
            box_ids: nextBookingIds,
            stop_sequence: nextBookingIds,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Delivery Dispatch | Admin" />
            <div className="flex h-full flex-1 flex-col gap-4 p-6 sm:p-8 font-sans">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                    <div className="flex items-center gap-3">
                        <Link
                            href={admin_return_url || "/admin/runsheets"}
                            className="flex items-center justify-center size-8.5 rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:border-rose-500 hover:text-rose-600 hover:bg-rose-50/50 shadow-2xs cursor-pointer"
                            title="Back to Runsheets"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                        <div className="flex items-center gap-3 flex-wrap">
                            <Heading
                                eyebrow="Logistics & Dispatch"
                                title="Update Delivery Dispatch"
                                description="Adjust delivery schedule or assigned courier for this route."
                            />
                            <span className="rounded-lg bg-rose-50 px-3 py-1 font-mono text-xs font-bold text-rose-700 tracking-tight border border-rose-200/60 shadow-2xs flex items-center gap-1.5">
                                <RefreshCw className="size-3" />
                                ID: {runsheet.id.toString().padStart(4, '0')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-4 max-w-4xl mx-auto w-full flex-1 card border-slate-200/80 shadow-xs rounded-xl bg-white overflow-hidden font-sans">
                    <div className="bg-slate-50/70 p-6 border-b border-slate-200/70 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600">
                                <Truck className="size-4" />
                            </div>
                            <div>
                                <h2 className="font-sans text-sm font-bold text-slate-800 uppercase tracking-wider">Delivery Dispatch Details</h2>
                                <p className="text-[11px] text-slate-500 font-normal">Configure final-mile delivery date, route status, and courier assignment</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                            <Truck className="size-3.5 text-rose-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Updating Dispatch</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="scheduled_date" className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Delivery Date <span className="text-red-500">*</span></Label>
                                <div className="relative group">
                                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-rose-500 pointer-events-none transition-colors" />
                                    <Input
                                        id="scheduled_date"
                                        type="date"
                                        required
                                        min={runsheet.scheduled_date && runsheet.scheduled_date.substring(0, 10) < new Date().toLocaleDateString('en-CA') ? runsheet.scheduled_date.substring(0, 10) : new Date().toLocaleDateString('en-CA')}
                                        className="h-10 rounded-lg border-slate-200 bg-white pl-10 pr-3 font-sans text-xs font-semibold text-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 transition-all cursor-pointer [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
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
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-9 font-sans text-xs font-semibold text-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 transition-all appearance-none cursor-pointer"
                                        value={data.timeslot}
                                        onChange={(e) => setData('timeslot', e.target.value)}
                                    >
                                        <option value="">Anytime</option>
                                        <option value="Morning (9AM - 12PM)">Morning (9AM - 12PM)</option>
                                        <option value="Afternoon (1PM - 5PM)">Afternoon (1PM - 5PM)</option>
                                        <option value="Evening (6PM - 9PM)">Evening (6PM - 9PM)</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none group-focus-within:text-rose-500 transition-colors" />
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
                                                    ? 'bg-white shadow-xs font-bold text-rose-600 ring-1 ring-black/5'
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
                                <Label htmlFor="area_description" className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">
                                    Delivery Hub / Area <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative group">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-rose-500 transition-colors pointer-events-none" />
                                    <Input
                                        id="area_description"
                                        placeholder="e.g. Manila Hub"
                                        required
                                        className="h-10 rounded-lg border-slate-200 bg-white pl-9 pr-3 font-sans text-xs font-semibold text-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 transition-all"
                                        value={data.area_description}
                                        onChange={(e) =>
                                            setData('area_description', e.target.value)
                                        }
                                    />
                                </div>
                                {errors.area_description && (
                                    <p className="text-[10px] font-bold text-red-500 ml-1">{errors.area_description}</p>
                                )}
                            </div>

                             <div className="space-y-3 md:col-span-2 pt-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-6 rounded-md bg-rose-500/10 flex items-center justify-center text-rose-600">
                                            <Truck className="size-3.5" />
                                        </div>
                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                            Assigned Courier <span className="text-red-500">*</span>
                                        </Label>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                                        {couriers.length} Available
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {selectedCourier ? (
                                        (() => {
                                            const activeCount = (selectedCourier as any).active_runsheet_count ?? 0;
                                            const initials = selectedCourier.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                                            const mobile = selectedCourier.courier?.mobile || '';

                                            return (
                                                <div className="p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/5 flex items-center gap-3 relative">
                                                    <div className="size-10 rounded-lg bg-rose-500 text-white flex items-center justify-center text-xs font-bold">
                                                        {initials}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-slate-900 truncate font-sans">{selectedCourier.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                            <p className="text-[10px] font-medium text-slate-500">
                                                                {activeCount} active {activeCount === 1 ? 'runsheet' : 'runsheets'}
                                                            </p>
                                                            {selectedCourier.courier?.area && (
                                                                <>
                                                                    <span className="text-[10px] text-slate-300">•</span>
                                                                    <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider">
                                                                        {selectedCourier.courier.area.name} Hub
                                                                    </p>
                                                                </>
                                                            )}
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
                                                            onClick={() => setIsCourierModalOpen(true)}
                                                            className="h-7 px-2.5 rounded-md text-[10px] font-semibold text-slate-700 hover:text-rose-600 hover:bg-white border-slate-200 shadow-2xs"
                                                        >
                                                            Change
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setData('courier_id', '')}
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
                                            onClick={() => setIsCourierModalOpen(true)}
                                            className="w-full p-4 border-2 border-dashed border-slate-200 hover:border-rose-500/50 rounded-lg hover:bg-rose-500/5 transition-all text-center flex items-center justify-center gap-3 group cursor-pointer"
                                        >
                                            <div className="size-8 rounded-md bg-slate-100 group-hover:bg-rose-500/10 flex items-center justify-center text-slate-500 group-hover:text-rose-600 transition-colors">
                                                <Plus className="size-4" />
                                            </div>
                                            <div className="text-left">
                                                <span className="text-xs font-bold text-slate-800 block font-sans">Choose Courier</span>
                                                <span className="text-[10px] text-slate-400 block font-normal">Click to search and assign</span>
                                            </div>
                                        </button>
                                    )}
                                </div>

                                <Dialog open={isCourierModalOpen} onOpenChange={setIsCourierModalOpen}>
                                    <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 rounded-xl border border-slate-200/80 shadow-2xl">
                                        <div className="p-5 pb-4 border-b border-slate-100 bg-white">
                                            <div className="flex items-start justify-between pr-8">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8.5 rounded-lg bg-brand-secondary/10 border border-brand-secondary/20 flex items-center justify-center text-brand-secondary shrink-0">
                                                        <Truck className="size-4" />
                                                    </div>
                                                    <div>
                                                        <DialogTitle className="text-sm font-bold text-slate-900 font-sans tracking-tight">
                                                            Select Courier
                                                        </DialogTitle>
                                                        <DialogDescription className="text-xs text-slate-500 font-sans mt-0.5">
                                                            Assign an authorized courier for this delivery runsheet
                                                        </DialogDescription>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Search Input */}
                                            <div className="relative mt-3.5">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                                                <Input
                                                    placeholder="Search by name, phone or email..."
                                                    className="h-9 rounded-lg border-slate-200 bg-slate-50/70 pl-8.5 pr-8 text-xs font-sans text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/10 transition-all"
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
                                            {displayedCouriers.length > 0 ? (
                                                displayedCouriers.map((u) => {
                                                    const isSelected = String(data.courier_id) === String(u.id);
                                                    const activeCount = (u as any).active_runsheet_count ?? 0;
                                                    const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                                                    const mobile = u.courier?.mobile || '';

                                                    return (
                                                        <div
                                                            key={u.id}
                                                            onClick={() => {
                                                                setData('courier_id', String(u.id));
                                                                setIsCourierModalOpen(false);
                                                            }}
                                                            className={`group relative p-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${isSelected
                                                                    ? 'border-brand-secondary bg-brand-secondary/[0.04] ring-1 ring-brand-secondary/20 shadow-2xs'
                                                                    : 'border-slate-200/80 bg-white hover:border-brand-secondary/40 hover:bg-slate-50 hover:shadow-2xs'
                                                                }`}
                                                        >
                                                            <div className={`size-8 rounded-md flex items-center justify-center text-xs font-bold font-sans transition-colors shrink-0 ${isSelected
                                                                    ? 'bg-brand-secondary text-white shadow-2xs'
                                                                    : 'bg-slate-100 text-slate-700 border border-slate-200/80 group-hover:bg-brand-secondary/10 group-hover:text-brand-secondary'
                                                                }`}>
                                                                {initials}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className={`text-xs font-semibold truncate font-sans transition-colors ${isSelected ? 'text-brand-secondary' : 'text-slate-900 group-hover:text-brand-secondary'}`}>
                                                                        {u.name}
                                                                    </p>
                                                                    {isSelected && (
                                                                        <span className="text-[10px] font-semibold text-brand-secondary bg-brand-secondary/10 px-1.5 py-0.2 rounded shrink-0">
                                                                            Selected
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2.5 mt-0.5">
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium font-sans ${activeCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                                        <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                        {activeCount === 0 ? '0 active runsheets' : `${activeCount} active ${activeCount === 1 ? 'runsheet' : 'runsheets'}`}
                                                                    </span>
                                                                    {u.courier?.area && (
                                                                        <>
                                                                            <span className="text-slate-300 text-xs">•</span>
                                                                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                                                                                {u.courier.area.name} Hub
                                                                            </span>
                                                                        </>
                                                                    )}
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
                                                                    ? 'bg-brand-secondary border-brand-secondary text-white shadow-2xs'
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
                                                    <p className="text-xs font-semibold text-slate-700 font-sans">No matching couriers</p>
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
                                                    Showing {displayedCouriers.length} of {filteredCouriers.length} {filteredCouriers.length === 1 ? 'courier' : 'couriers'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href="/admin/users/create"
                                                    target="_blank"
                                                    className="text-[11px] font-semibold text-brand-secondary hover:underline inline-flex items-center gap-1 font-sans"
                                                >
                                                    <Plus className="size-3" />
                                                    Add new courier
                                                </Link>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setIsCourierModalOpen(false)}
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
                                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-500 shadow-sm">
                                        <Box className="size-5" />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-900">Included Boxes</Label>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">Manage boxes assigned to this delivery dispatch.</p>
                                    </div>
                                </div>

                                {/* Guidance Banner */}
                                {data.courier_id && (() => {
                                    const selectedCourier = couriers.find(c => String(c.id) === String(data.courier_id));
                                    const courierArea = selectedCourier?.courier?.area?.name;

                                    return courierArea && (
                                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200/50 flex items-start gap-4">
                                            <div className="p-2 bg-white rounded-xl shadow-sm shrink-0">
                                                <MapPin className="size-5 text-rose-500" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-rose-900">Hub-Specific Inventory Active</h4>
                                                <p className="text-xs mt-1 text-rose-900/70 leading-relaxed">
                                                    Because you assigned <strong>{selectedCourier?.name}</strong>, we are only showing eligible bookings for their assigned hub: <strong className="text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">{courierArea}</strong>.
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    {/* Currently Included */}
                                    {runsheet.boxes?.map((box: any) => {
                                        const recipient = box.recipient;
                                        const areaName = recipient?.area?.name || 'No Area';

                                        return (
                                            <div key={box.id} className="flex items-start gap-5 p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/20"
                                                onClick={() => toggleBox(box.id)}>
                                                <div className={`mt-1 size-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${data.box_ids.includes(box.id) ? 'bg-rose-500 border-rose-500 shadow-lg' : 'border-rose-100 bg-rose-50/30'}`}>
                                                    {data.box_ids.includes(box.id) && <Check className="size-4 text-white stroke-[4px]" />}
                                                </div>
                                                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-100 font-mono text-[10px] font-black text-rose-700">
                                                    {(data.box_ids.indexOf(box.id) + 1) || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <p className="text-sm font-black text-rose-900 tracking-tight uppercase font-mono">{box.tracking_number}</p>
                                                        <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">Included</span>
                                                    </div>
                                                    {recipient && (
                                                        <div className="space-y-0.5">
                                                            <p className="text-[10px] font-black text-rose-900/70 uppercase tracking-widest truncate">TO: {recipient.first_name} {recipient.last_name}</p>
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1"><MapPin className="size-2.5 text-rose-400" /> {areaName}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                                                    <Button type="button" variant="outline" disabled={data.box_ids.indexOf(box.id) <= 0} onClick={() => moveStop(box.id, -1)} className="h-8 px-2 text-[9px] font-black uppercase tracking-widest">
                                                        Up
                                                    </Button>
                                                    <Button type="button" variant="outline" disabled={data.box_ids.indexOf(box.id) === data.box_ids.length - 1} onClick={() => moveStop(box.id, 1)} className="h-8 px-2 text-[9px] font-black uppercase tracking-widest">
                                                        Down
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {filteredAvailableBoxes.length > 0 ? (
                                        filteredAvailableBoxes.map((box) => {
                                            const recipient = box.recipient;
                                            const areaName = recipient?.area?.name || 'No Area';
                                            const boxCount = 1;

                                            return (
                                                <div key={box.id} className={`flex items-start gap-5 p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden ${data.box_ids.includes(box.id) ? 'border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/20' : 'border-rose-100 bg-white hover:border-rose-500/40'}`}
                                                    onClick={() => toggleBox(box.id)}>
                                                    <div className={`mt-1 size-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${data.box_ids.includes(box.id) ? 'bg-rose-500 border-rose-500 shadow-lg' : 'border-rose-100 bg-rose-50/30'}`}>
                                                        {data.box_ids.includes(box.id) && <Check className="size-4 text-white stroke-[4px]" />}
                                                    </div>
                                                    {data.box_ids.includes(box.id) && (
                                                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-100 font-mono text-[10px] font-black text-rose-700">
                                                            {data.box_ids.indexOf(box.id) + 1}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <p className="text-sm font-black text-rose-900 tracking-tight uppercase font-mono">{box.tracking_number}</p>
                                                            <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">{boxCount} {boxCount === 1 ? 'Box' : 'Boxes'}</span>
                                                        </div>
                                                        {recipient && (
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] font-black text-rose-900/70 uppercase tracking-widest truncate">TO: {recipient.first_name} {recipient.last_name}</p>
                                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1"><MapPin className="size-2.5 text-rose-400" /> {areaName}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-rose-100 rounded-xl bg-rose-50/30 text-center h-full min-h-[160px]">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                {data.courier_id 
                                                    ? "No available boxes found for this courier's hub area." 
                                                    : "No more bookings available."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-5 pt-10 border-t border-rose-100">
                            <Link href={admin_return_url || "/admin/runsheets"} className="px-10 h-14 flex items-center justify-center rounded-2xl border-2 border-rose-100 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-rose-50 transition-all active:scale-95 text-muted-foreground">Cancel</Link>
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
