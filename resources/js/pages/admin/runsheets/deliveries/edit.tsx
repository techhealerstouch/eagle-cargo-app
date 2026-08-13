import { Head, Link, useForm } from '@inertiajs/react';
import { Box, Calendar, Check, ArrowLeft, RefreshCw, Save, Search, Truck, User, MapPin, Plus, Trash2 } from 'lucide-react';
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
        { title: t('ui.runsheets.breadcrumbs.runsheets', 'Runsheets'), href: '/admin/runsheets' },
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
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-rose-200/40 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/runsheets"
                            className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Heading
                                eyebrow="Logistics & Dispatch"
                                title="Update Delivery Dispatch"
                                description="Adjust delivery schedule or assigned courier for this route."
                            />
                            <span className="rounded-xl bg-rose-50 px-5 py-2 font-mono text-xs font-black text-rose-900 tracking-tight border border-rose-200/20 shadow-sm flex items-center gap-2">
                                <RefreshCw className="size-3.5" />
                                ID: {runsheet.id.toString().padStart(4, '0')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 max-w-4xl mx-auto w-full flex-1 card border-rose-200/40 shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <div className="bg-rose-50/50 p-8 border-b border-rose-100 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="h-10 w-1 bg-rose-500 rounded-full"></div>
                            <h2 className="font-serif text-xl font-bold text-rose-900 uppercase tracking-tight">Delivery Details</h2>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-rose-100 shadow-sm">
                            <Truck className="size-4 text-rose-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-900">Updating Dispatch</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                            <div className="space-y-3">
                                <Label htmlFor="scheduled_date" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Delivery Date <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-rose-500/40" />
                                    <Input
                                        id="scheduled_date"
                                        type="date"
                                        required
                                        min={runsheet.scheduled_date && runsheet.scheduled_date.substring(0, 10) < new Date().toLocaleDateString('en-CA') ? runsheet.scheduled_date.substring(0, 10) : new Date().toLocaleDateString('en-CA')}
                                        className="h-12 rounded-xl border-rose-100 bg-white pl-11 pr-4 font-bold focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-sm"
                                        value={data.scheduled_date}
                                        onChange={(e) =>
                                            setData('scheduled_date', e.target.value)
                                        }
                                    />
                                </div>
                                {errors.scheduled_date && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.scheduled_date}</p>
                                )}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="timeslot" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Time Slot (Optional)</Label>
                                <select
                                    id="timeslot"
                                    title="Time Slot"
                                    className="flex h-12 w-full rounded-xl border border-rose-100 bg-rose-50/30 px-4 text-[11px] font-black uppercase tracking-widest text-rose-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-sm appearance-none cursor-pointer"
                                    value={data.timeslot}
                                    onChange={(e) => setData('timeslot', e.target.value)}
                                >
                                    <option value="">Anytime</option>
                                    <option value="Morning (9AM - 12PM)">Morning (9AM - 12PM)</option>
                                    <option value="Afternoon (1PM - 5PM)">Afternoon (1PM - 5PM)</option>
                                    <option value="Evening (6PM - 9PM)">Evening (6PM - 9PM)</option>
                                </select>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="status" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Status <span className="text-red-500">*</span></Label>
                                <select
                                    id="status"
                                    title="Status"
                                    required
                                    className="flex h-12 w-full rounded-xl border border-rose-100 bg-rose-50/30 px-4 text-[11px] font-black uppercase tracking-widest text-rose-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-sm appearance-none cursor-pointer"
                                    value={data.status}
                                    onChange={(e) =>
                                        setData('status', e.target.value)
                                    }
                                >
                                    <option value="draft">Draft</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                </select>
                                {errors.status && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.status}</p>
                                )}
                            </div>

                            <div className="space-y-3 md:col-span-2">
                                <Label htmlFor="area_description" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Delivery Hub / Area <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-rose-500/40" />
                                    <Input
                                        id="area_description"
                                        required
                                        className="h-12 rounded-xl border-rose-100 bg-white pl-11 pr-4 font-bold focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-sm"
                                        value={data.area_description}
                                        onChange={(e) =>
                                            setData('area_description', e.target.value)
                                        }
                                    />
                                </div>
                                {errors.area_description && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.area_description}</p>
                                )}
                            </div>

                             <div className="space-y-6 md:col-span-2 pt-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-500 shadow-sm">
                                            <User className="size-5" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-900">
                                                Assigned Courier <span className="text-red-500">*</span>
                                            </Label>
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                                                Select a local courier to deliver these boxes.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {selectedCourier ? (
                                        (() => {
                                            const activeCount = (selectedCourier as any).active_runsheet_count ?? 0;
                                            const initials = selectedCourier.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                                            const mobile = selectedCourier.courier?.mobile || '';

                                            return (
                                                <div className="p-5 rounded-2xl border-2 border-rose-500 bg-rose-50/50 flex items-center gap-4 relative">
                                                    <div className="size-12 rounded-xl bg-rose-500 text-white flex items-center justify-center text-xs font-black">
                                                        {initials}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black text-rose-900 tracking-tight truncate">{selectedCourier.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                {activeCount} active runsheets
                                                            </p>
                                                            {selectedCourier.courier?.area && (
                                                                <>
                                                                    <span className="text-[9px] text-rose-200 mx-1">•</span>
                                                                    <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest bg-rose-500/10 px-1.5 py-0.5 rounded">
                                                                        {selectedCourier.courier.area.name} Hub
                                                                    </p>
                                                                </>
                                                            )}
                                                            {mobile && (
                                                                <>
                                                                    <span className="text-[9px] text-rose-200 mx-1">•</span>
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">📱 {mobile}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 z-10">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => setIsCourierModalOpen(true)}
                                                            className="h-9 px-4 rounded-xl text-xs font-bold uppercase hover:bg-rose-50 transition-colors border-rose-100 text-rose-950"
                                                        >
                                                            Change
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() => setData('courier_id', '')}
                                                            className="size-9 p-0 text-red-500 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                                                            title="Remove assignment"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setIsCourierModalOpen(true)}
                                            className="w-full p-6 border-2 border-dashed border-rose-100 rounded-2xl hover:border-rose-500/50 hover:bg-rose-50/50 transition-all text-center flex flex-col items-center justify-center gap-2 group"
                                        >
                                            <div className="size-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                                                <Plus className="size-5" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-wider text-rose-900">Select Courier</span>
                                            <span className="text-[10px] text-muted-foreground font-medium">Click to search and assign a courier</span>
                                        </button>
                                    )}
                                </div>

                                <Dialog open={isCourierModalOpen} onOpenChange={setIsCourierModalOpen}>
                                    <DialogContent className="sm:max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase tracking-widest text-rose-900">
                                                <Truck className="size-4 text-rose-500" />
                                                Select Courier
                                            </DialogTitle>
                                            <DialogDescription className="text-xs">
                                                Select a local courier to deliver these boxes.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div className="relative group">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-rose-500/40 group-focus-within:text-rose-500 transition-colors" />
                                                <Input
                                                    placeholder="Search courier name..."
                                                    className="h-11 rounded-xl border-rose-100 bg-rose-50/30 pl-11 pr-4 font-bold text-xs focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all"
                                                    value={assigneeSearchTerm}
                                                    onChange={(e) => setAssigneeSearchTerm(e.target.value)}
                                                />
                                            </div>

                                            <div className="grid max-h-[350px] gap-3 overflow-y-auto pr-1 custom-scrollbar">
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
                                                                className={`group relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${isSelected
                                                                        ? 'border-rose-500 bg-rose-50/50 ring-4 ring-rose-500/5'
                                                                        : 'border-rose-100 bg-white hover:border-rose-500/40 hover:shadow-md'
                                                                    }`}
                                                            >
                                                                <div className={`size-12 rounded-xl flex items-center justify-center text-xs font-black transition-all ${isSelected ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500'
                                                                    }`}>
                                                                    {initials}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-black text-rose-900 truncate">{u.name}</p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                            {activeCount} active runsheets
                                                                        </p>
                                                                        {u.courier?.area && (
                                                                            <>
                                                                                <span className="text-[9px] text-rose-200 mx-1">•</span>
                                                                                <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest bg-rose-500/10 px-1.5 py-0.5 rounded">
                                                                                    {u.courier.area.name} Hub
                                                                                </p>
                                                                            </>
                                                                        )}
                                                                        {mobile && (
                                                                            <>
                                                                                <span className="text-[9px] text-rose-200 mx-1">•</span>
                                                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">📱 {mobile}</p>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-rose-500 border-rose-500' : 'border-rose-100 bg-white'
                                                                    }`}>
                                                                    {isSelected && <Check className="size-3 text-white stroke-[4px]" />}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="p-8 text-center border-2 border-dashed border-rose-100 rounded-2xl">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No couriers found</p>
                                                    </div>
                                                )}
                                            </div>
                                            {filteredCouriers.length > 30 && (
                                                <p className="text-[10px] text-rose-900/60 text-center font-bold uppercase tracking-wider mt-2">
                                                    Showing first 30 of {filteredCouriers.length} couriers. Please search to refine.
                                                </p>
                                            )}
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
                                            <div key={box.id} className="flex items-start gap-5 p-5 rounded-4xl border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/20"
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
                                                <div key={box.id} className={`flex items-start gap-5 p-5 rounded-4xl border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden ${data.box_ids.includes(box.id) ? 'border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/20' : 'border-rose-100 bg-white hover:border-rose-500/40'}`}
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
                                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-rose-100 rounded-[2rem] bg-rose-50/30 text-center h-full min-h-[160px]">
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
                            <Link href="/admin/runsheets" className="px-10 h-14 flex items-center justify-center rounded-2xl border-2 border-rose-100 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-rose-50 transition-all active:scale-95 text-muted-foreground">Cancel</Link>
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
