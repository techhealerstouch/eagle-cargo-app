import { Head, Link, useForm } from '@inertiajs/react';
import { Save, ArrowLeft, Check, Calendar, ChevronDown, MapPin, Box, Truck, Search, Filter, CheckSquare, Square, Plus, Trash2, LayoutGrid, List, Phone, X } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
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

export default function DeliveryRunsheetsCreate({
    couriers = [],
    deliveryEligibleBoxes = [],
}: {
    couriers?: Courier[];
    deliveryEligibleBoxes?: any[];
}) {
    const { t } = useTranslations();

    const { data, setData, post, processing, errors, wasSuccessful } = useForm({
        courier_id: '',
        scheduled_date: '',
        timeslot: '',
        area_description: '',
        type: 'delivery',
        status: 'assigned',
        box_ids: [] as number[],
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');
    const [selectedArea, setSelectedArea] = useState('all');
    const [isCourierModalOpen, setIsCourierModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    const selectedCourier = useMemo(() => {
        return couriers.find(c => String(c.id) === String(data.courier_id));
    }, [couriers, data.courier_id]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const boxId = urlParams.get('box_id');
        const boxIdsStr = urlParams.get('box_ids');
        const explicitDate = urlParams.get('scheduled_date');
        const explicitCourierId = urlParams.get('courier_id');

        let updatedIds: number[] = [];

        if (boxIdsStr) {
            updatedIds = boxIdsStr.split(',')
                .map(id => parseInt(id))
                .filter(id => !isNaN(id));
        } else if (boxId) {
            const id = parseInt(boxId);
            if (!isNaN(id)) {
                updatedIds = [id];
            }
        }

        const newData: any = {};

        if (updatedIds.length > 0) {
            newData.box_ids = updatedIds;
        }

        if (explicitDate) {
            newData.scheduled_date = explicitDate;
        }

        if (explicitCourierId) {
            newData.courier_id = explicitCourierId;
        }

        if (Object.keys(newData).length > 0) {
            setData(data => ({ ...data, ...newData }));
        }
    }, [setData]);

    useEffect(() => {
        if (data.courier_id) {
            const selectedCourier = couriers.find(c => String(c.id) === String(data.courier_id));
            const areaName = selectedCourier?.courier?.area?.name;

            if (areaName) {
                setSelectedArea(areaName);
            }
        }
    }, [data.courier_id, couriers]);

    // Extract the active area based on the first selected booking (if any)
    const activeBookingArea = useMemo(() => {
        if (data.box_ids.length > 0) {
            const firstBox = deliveryEligibleBoxes.find(b => b.id === data.box_ids[0]);

            return firstBox?.recipient?.area?.name;
        }

        return null;
    }, [data.box_ids, deliveryEligibleBoxes]);

    // Auto-set the area filter when a booking is selected
    useEffect(() => {
        if (activeBookingArea && selectedArea === 'all') {
            setSelectedArea(activeBookingArea);
        }
    }, [activeBookingArea, selectedArea]);

    // Extract unique areas for the filter
    const uniqueAreas = useMemo(() => {
        const areas = new Set<string>();
        deliveryEligibleBoxes.forEach(b => {
            const areaName = b.recipient?.area?.name;

            if (areaName) {
                areas.add(areaName);
            }
        });

        return Array.from(areas).sort();
    }, [deliveryEligibleBoxes]);

    // Filter logic for couriers
    const filteredCouriers = useMemo(() => {
        const matches = couriers.filter((u) => {
            const matchesSearch = u.name.toLowerCase().includes(assigneeSearchTerm.toLowerCase()) ||
                u.email?.toLowerCase().includes(assigneeSearchTerm.toLowerCase()) ||
                u.courier?.mobile?.includes(assigneeSearchTerm);
                
            const matchesArea = selectedArea === 'all' || !u.courier?.area?.name || u.courier?.area?.name === selectedArea;

            return matchesSearch && matchesArea;
        });

        if (!data.courier_id) return matches;

        return [...matches].sort((a, b) => {
            if (String(a.id) === String(data.courier_id)) return -1;
            if (String(b.id) === String(data.courier_id)) return 1;
            return 0;
        });
    }, [couriers, assigneeSearchTerm, selectedArea, data.courier_id]);

    // Limit displayed items in the modal to avoid DOM overload
    const displayedCouriers = useMemo(() => {
        return filteredCouriers.slice(0, 30);
    }, [filteredCouriers]);

    // Filter logic for bookings
    const filteredBoxes = useMemo(() => {
        const selectedCourier = data.courier_id ? couriers.find(u => String(u.id) === String(data.courier_id)) : null;
        const courierArea = selectedCourier?.courier?.area?.name;

        return deliveryEligibleBoxes.filter((box) => {
            const matchesSearch =
                box.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                box.booking?.sender?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                box.booking?.sender?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                box.recipient?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                box.recipient?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesArea = selectedArea === 'all' || box.recipient?.area?.name === selectedArea;

            if (courierArea && box.recipient?.area?.name && box.recipient?.area?.name !== courierArea) {
                return false;
            }

            return matchesSearch && matchesArea;
        });
    }, [deliveryEligibleBoxes, searchTerm, selectedArea, data.courier_id, couriers]);

    const handleSelectAll = () => {
        const filteredIds = filteredBoxes.map(b => b.id);
        const allFilteredSelected = filteredIds.every(id => data.box_ids.includes(id));

        if (allFilteredSelected) {
            setData('box_ids', data.box_ids.filter(id => !filteredIds.includes(id)));
        } else {
            const newIds = Array.from(new Set([...data.box_ids, ...filteredIds]));
            setData('box_ids', newIds);
        }
    };

    const handleToggleBox = (boxId: number) => {
        const ids = [...data.box_ids];
        setData('box_ids', ids.includes(boxId) ? ids.filter(id => id !== boxId) : [...ids, boxId]);
    };

    const isAllFilteredSelected = filteredBoxes.length > 0 && filteredBoxes.every(b => data.box_ids.includes(b.id));
    const isSubmitDisabled = processing || wasSuccessful || !data.courier_id || data.box_ids.length === 0;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('ui.common.dashboard', 'Dashboard'), href: '/dashboard' },
        { title: t('ui.runsheets.breadcrumbs.runsheets', 'Runsheets'), href: '/admin/runsheets' },
        { title: 'New Delivery Dispatch', href: '#' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/runsheets');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dispatch Delivery Run | Love Balikbayan" />

            <div className="flex flex-col h-screen overflow-hidden bg-brand-warm/10">
                {/* Compact Top Header Bar */}
                <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200/80 shadow-2xs z-10 shrink-0 font-sans">
                    <div className="flex items-center gap-3.5">
                        <Link
                            href="/admin/runsheets"
                            className="group flex items-center justify-center size-8.5 rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:border-brand-secondary hover:text-brand-secondary hover:bg-brand-secondary/5 shadow-2xs cursor-pointer"
                            title="Back to Runsheets"
                        >
                            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
                        </Link>
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary leading-none mb-1">
                                Logistics • Final Mile Assignment
                            </div>
                            <h1 className="font-sans text-base font-bold text-slate-900 tracking-tight leading-none m-0">
                                Create Delivery Dispatch
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Summary:</span>
                            <span className="font-bold text-slate-800 font-mono">
                                {data.box_ids.length} Boxes Selected
                            </span>
                            {!data.courier_id ? (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 ml-1">
                                    Select Courier
                                </span>
                            ) : data.box_ids.length === 0 ? (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 ml-1">
                                    Select Boxes
                                </span>
                            ) : null}
                        </div>

                        <Button
                            form="dispatch-form"
                            type="submit"
                            disabled={isSubmitDisabled}
                            variant="success"
                            className="flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed font-sans cursor-pointer"
                        >
                            {processing ? <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="size-3.5" />}
                            {processing ? 'Processing...' : 'Confirm Dispatch'}
                        </Button>
                    </div>
                </div>

                {/* Main Content Area - Split Layout */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar: Dispatch Configuration */}
                    <div className="w-full md:w-[420px] bg-slate-50/60 border-r border-slate-200/80 overflow-y-auto p-6 space-y-6 custom-scrollbar font-sans">
                        <form id="dispatch-form" onSubmit={handleSubmit} className="space-y-5">
                            {/* Card 1: Delivery Settings */}
                            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200/70 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-6 rounded-md bg-brand-secondary/15 flex items-center justify-center text-brand-secondary">
                                            <Calendar className="size-3.5" />
                                        </div>
                                        <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800 m-0">
                                            Delivery Settings
                                        </h2>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Schedule</span>
                                </div>

                                <div className="p-4 space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Delivery Date <span className="text-red-500">*</span></Label>
                                        <div className="relative group">
                                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-brand-secondary pointer-events-none transition-colors" />
                                            <Input
                                                type="date"
                                                required
                                                min={new Date().toLocaleDateString('en-CA')}
                                                className="h-10 rounded-lg border-slate-200 bg-white pl-10 pr-3 font-sans text-xs font-semibold text-slate-800 focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/20 transition-all cursor-pointer [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
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
                                                aria-label="Time Slot"
                                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-9 font-sans text-xs font-semibold text-slate-800 focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/20 transition-all appearance-none cursor-pointer"
                                                value={data.timeslot}
                                                onChange={(e) => setData('timeslot', e.target.value)}
                                            >
                                                <option value="">Anytime</option>
                                                <option value="Morning (9AM - 12PM)">Morning (9AM - 12PM)</option>
                                                <option value="Afternoon (1PM - 5PM)">Afternoon (1PM - 5PM)</option>
                                                <option value="Evening (6PM - 9PM)">Evening (6PM - 9PM)</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none group-focus-within:text-brand-secondary transition-colors" />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider ml-0.5">Dispatch Hub / Area <span className="text-red-500">*</span></Label>
                                        <div className="relative group">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-brand-secondary transition-colors pointer-events-none" />
                                            <Input
                                                placeholder="e.g. Manila Hub"
                                                required
                                                className="h-10 rounded-lg border-slate-200 bg-white pl-9 pr-3 font-sans text-xs font-semibold text-slate-800 focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/20 transition-all"
                                                value={data.area_description}
                                                onChange={(e) => setData('area_description', e.target.value)}
                                            />
                                        </div>
                                        {errors.area_description && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.area_description}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Assign Courier */}
                            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200/70 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-6 rounded-md bg-brand-secondary/15 flex items-center justify-center text-brand-secondary">
                                            <Truck className="size-3.5" />
                                        </div>
                                        <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800 m-0">
                                            Assign Courier
                                        </h2>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                                        {filteredCouriers.length} Available
                                    </span>
                                </div>

                                <div className="p-4 space-y-3">
                                    {selectedCourier ? (
                                        (() => {
                                            const activeCount = (selectedCourier as any).active_runsheet_count ?? 0;
                                            const initials = selectedCourier.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                                            return (
                                                <div className="p-3 rounded-lg border border-brand-secondary/30 bg-brand-warm/30 flex items-center gap-3 relative">
                                                    <div className="size-10 rounded-lg bg-brand-secondary text-white flex items-center justify-center text-xs font-bold">
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
                                                                    <p className="text-[10px] font-semibold text-brand-rust uppercase tracking-wider">
                                                                        {selectedCourier.courier.area.name} Hub
                                                                    </p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setIsCourierModalOpen(true)}
                                                            className="h-7 px-2.5 rounded-md text-[10px] font-semibold text-slate-700 hover:text-brand-secondary hover:bg-white border-slate-200 shadow-2xs"
                                                        >
                                                            Change
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setData('courier_id', '');
                                                                setSelectedArea('all');
                                                            }}
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
                                            className="w-full p-4 border-2 border-dashed border-slate-200 hover:border-brand-secondary/50 rounded-lg hover:bg-brand-warm/5 transition-all text-center flex items-center justify-center gap-3 group cursor-pointer"
                                        >
                                            <div className="size-8 rounded-md bg-slate-100 group-hover:bg-brand-secondary/15 flex items-center justify-center text-slate-500 group-hover:text-brand-secondary transition-colors">
                                                <Plus className="size-4" />
                                            </div>
                                            <div className="text-left">
                                                <span className="text-xs font-bold text-slate-800 block font-sans">Choose Courier</span>
                                                <span className="text-[10px] text-slate-400 block font-normal">Click to search and assign</span>
                                            </div>
                                        </button>
                                    )}
                                    {errors.courier_id && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.courier_id}</p>}
                                </div>
                            </div>
                        </form>

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
                                                            {u.courier?.mobile && (
                                                                <>
                                                                    <span className="text-slate-300 text-xs">•</span>
                                                                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                                                        <Phone className="size-2.5 text-slate-400" />
                                                                        {u.courier.mobile}
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

                    {/* Right Pane: Inventory / Booking Selection */}
                    <div className="flex-1 flex flex-col bg-brand-warm/10 p-8 overflow-hidden">
                        {/* Guidance Banner */}
                        {data.courier_id && (() => {
                            const selectedCourier = couriers.find(c => String(c.id) === String(data.courier_id));
                            const courierArea = selectedCourier?.courier?.area?.name;

                            return courierArea && (
                                <div className="mb-6 p-5 bg-white shadow-sm rounded-2xl border border-brand-secondary/20 flex items-start gap-4 ring-1 ring-brand-secondary/5">
                                    <div className="p-2 bg-brand-warm rounded-xl shrink-0">
                                        <Filter className="size-5 text-brand-secondary" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-brand-navy">Hub-Specific Inventory Active</h4>
                                        <p className="text-xs mt-1 text-brand-text-mid leading-relaxed">
                                            Because you assigned <strong>{selectedCourier?.name}</strong>, we are only showing eligible bookings for their assigned hub: <strong className="text-brand-secondary bg-brand-warm/50 px-1.5 py-0.5 rounded">{courierArea}</strong>.
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Search & Toolbar */}
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-6 bg-white p-3 sm:p-3.5 rounded-xl border border-brand-sand/50 shadow-xs">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-brand-secondary/40 group-focus-within:text-brand-secondary transition-colors" />
                                <Input
                                    placeholder="Search tracking #, sender or recipient..."
                                    className="h-10 rounded-lg border-brand-sand/50 bg-brand-warm/5 pl-10 pr-4 font-medium text-xs focus:ring-brand-secondary/10 focus:border-brand-secondary transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="relative w-full lg:w-56">
                                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-brand-secondary/40" />
                                <select
                                    title="Filter by service area"
                                    aria-label="Filter by service area"
                                    className={`h-10 w-full rounded-lg border border-brand-sand/50 pl-10 pr-4 text-xs font-medium text-brand-text focus:ring-brand-secondary/10 focus:border-brand-secondary transition-all appearance-none ${(data.courier_id || data.box_ids.length > 0) ? 'bg-brand-warm/20 opacity-60 cursor-not-allowed' : 'bg-brand-warm/5 cursor-pointer'}`}
                                    value={selectedArea}
                                    onChange={(e) => setSelectedArea(e.target.value)}
                                    disabled={!!data.courier_id || data.box_ids.length > 0}
                                >
                                    <option value="all">All Service Areas</option>
                                    {uniqueAreas.map(area => <option key={area} value={area}>{area}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* View Mode Switcher */}
                                <div className="inline-flex rounded-lg bg-brand-warm/40 p-0.5 border border-brand-sand/50 shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('table')}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                            viewMode === 'table'
                                                ? 'bg-white text-brand-secondary shadow-xs'
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
                                                ? 'bg-white text-brand-secondary shadow-xs'
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
                                            ? 'bg-brand-secondary text-white shadow-xs'
                                            : 'bg-white border border-brand-sand text-brand-secondary hover:border-brand-secondary hover:bg-brand-warm/10'
                                        }`}
                                >
                                    {isAllFilteredSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                                    <span>{isAllFilteredSelected ? 'Deselect All' : 'Select All'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Results Container */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                            {filteredBoxes.length === 0 ? (
                                <div className="py-24 flex flex-col items-center justify-center border-2 border-dashed border-brand-sand/60 rounded-xl bg-white/40 backdrop-blur-sm">
                                    <div className="size-16 rounded-xl bg-brand-warm flex items-center justify-center text-brand-secondary/50 mb-6">
                                        <Search className="size-8" />
                                    </div>
                                    <h3 className="text-xs font-black text-brand-text uppercase tracking-widest">No Match Found</h3>
                                    <p className="text-[11px] text-muted-foreground font-medium mt-2 text-center max-w-sm px-6">
                                        {data.courier_id 
                                            ? "No boxes found for this courier's hub area. Try clearing the courier selection to view other areas."
                                            : "We couldn't find any boxes matching your criteria. Try adjusting your filters or checking the warehouse status."}
                                    </p>
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
                                                            className="inline-flex items-center justify-center text-brand-secondary"
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
                                                    <th className="px-4 py-3.5 font-semibold">Tracking #</th>
                                                    <th className="px-4 py-3.5 font-semibold">Recipient</th>
                                                    <th className="px-4 py-3.5 font-semibold">Delivery Area</th>
                                                    <th className="px-4 py-3.5 font-semibold">Destination Address</th>
                                                    <th className="px-4 py-3.5 font-semibold">Sender Ref</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border text-xs font-normal">
                                                {filteredBoxes.map((box) => {
                                                    const isSelected = data.box_ids.includes(box.id);
                                                    const stopIndex = data.box_ids.indexOf(box.id);
                                                    const recipient = box.recipient;

                                                    return (
                                                        <tr
                                                            key={box.id}
                                                            onClick={() => handleToggleBox(box.id)}
                                                            className={`cursor-pointer transition-colors ${
                                                                isSelected
                                                                    ? 'bg-brand-secondary/5 font-medium'
                                                                    : 'hover:bg-brand-cream/20'
                                                            }`}
                                                        >
                                                            <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleBox(box.id)}
                                                                    className="inline-flex items-center justify-center text-brand-secondary"
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
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-secondary text-white text-[10px] font-black uppercase tracking-wider">
                                                                        Stop #{stopIndex + 1}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground text-[11px]">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 font-mono font-bold text-brand-text">
                                                                {box.tracking_number}
                                                            </td>
                                                            <td className="px-4 py-3.5">
                                                                <div className="font-semibold text-brand-text">
                                                                    {recipient ? `${recipient.first_name} ${recipient.last_name}` : 'Unknown Recipient'}
                                                                </div>
                                                                {recipient?.mobile && (
                                                                    <div className="text-[10px] text-muted-foreground font-mono">
                                                                        📱 {recipient.mobile}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-brand-text-mid">
                                                                <div className="flex items-center gap-1.5">
                                                                    <MapPin className="size-3 text-brand-secondary/70 shrink-0" />
                                                                    <span>{recipient?.area?.name || 'Local Delivery'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-brand-text-mid max-w-xs truncate">
                                                                {[recipient?.address, recipient?.city, recipient?.province].filter(Boolean).join(', ') || '—'}
                                                            </td>
                                                            <td className="px-4 py-3.5 font-mono text-[11px] text-muted-foreground">
                                                                {box.booking?.reference_number || '—'}
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
                                    {filteredBoxes.map((box) => {
                                        const isSelected = data.box_ids.includes(box.id);
                                        const recipient = box.recipient;
                                        const boxCount = 1;

                                        return (
                                            <div
                                                key={box.id}
                                                onClick={() => handleToggleBox(box.id)}
                                                className={`group flex flex-col p-5 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden ${isSelected
                                                        ? 'border-brand-secondary bg-white ring-4 ring-brand-secondary/10'
                                                        : 'border-brand-sand/30 bg-white/60 hover:bg-white hover:border-brand-secondary/40'
                                                    }`}
                                            >
                                                {/* Selection Badge */}
                                                <div className={`absolute top-3 right-3 size-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-brand-secondary border-brand-secondary text-white shadow-xs' : 'border-brand-sand/40 bg-white group-hover:border-brand-secondary/40'
                                                    }`}>
                                                    {isSelected && <Check className="size-3.5 stroke-[3px]" />}
                                                </div>

                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="p-2.5 rounded-lg bg-brand-warm text-brand-secondary">
                                                        <Box className="size-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-brand-text tracking-tighter uppercase font-mono">{box.tracking_number}</p>
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Package Info</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 flex-1">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-black text-brand-secondary uppercase tracking-widest bg-brand-warm px-2 py-0.5 rounded">To</span>
                                                            <p className="text-xs font-black text-brand-text uppercase truncate">
                                                                {box.recipient?.first_name} {box.recipient?.last_name}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2 pl-10">
                                                            <MapPin className="size-3 text-muted-foreground" />
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                {recipient?.area?.name || 'Local Delivery'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="pt-3 border-t border-brand-sand/40 flex items-center justify-between">
                                                        <div className="flex -space-x-2">
                                                            {[...Array(Math.min(boxCount, 3))].map((_, i) => (
                                                                <div key={i} className="size-6 rounded-lg bg-brand-warm border-2 border-white flex items-center justify-center text-[8px] font-black text-brand-secondary shadow-sm">
                                                                    {i === 2 && boxCount > 3 ? `+${boxCount - 2}` : <Box className="size-3" />}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <span className="text-[10px] font-black text-brand-text/60 uppercase tracking-tighter">
                                                            Box
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Decorative background number */}
                                                <div className="absolute -bottom-4 -right-2 text-[80px] font-black text-brand-sand/10 pointer-events-none select-none italic font-serif">
                                                    {boxCount}
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
