
import { Head, Link, useForm } from '@inertiajs/react';
import { Save, ArrowLeft, Check, Calendar, MapPin, User, ShieldCheck, Box, RefreshCw, Search, Plus, Trash2 } from 'lucide-react';
import { useState, useMemo } from 'react';

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
    pickupEligibleBookings = [],
}: {
    runsheet: Runsheet;
    pickers?: Picker[];
    pickupEligibleBookings?: Booking[];
}) {
    const { t } = useTranslations();

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
        { title: t('ui.runsheets.breadcrumbs.runsheets', 'Runsheets'), href: '/admin/runsheets' },
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
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-brand-warm/20 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/runsheets"
                            className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Heading
                                eyebrow="Origin Operations"
                                title="Update Pickup Dispatch"
                                description="Adjust collection schedule or assigned picker for this route."
                            />
                            <span className="rounded-xl bg-brand-warm/30 px-5 py-2 font-mono text-xs font-black text-brand-rust tracking-tight border border-brand-rust/10 shadow-sm flex items-center gap-2">
                                <RefreshCw className="size-3.5" />
                                ID: {runsheet.id.toString().padStart(4, '0')}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 max-w-4xl mx-auto w-full flex-1 card border-brand-warm/20 shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                    <div className="bg-brand-warm/5 p-8 border-b border-brand-warm/10 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <div className="h-10 w-1 bg-brand-rust rounded-full"></div>
                            <h2 className="font-serif text-xl font-bold text-brand-rust uppercase tracking-tight">Pickup Details</h2>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-brand-warm/20 shadow-sm">
                            <ShieldCheck className="size-4 text-brand-secondary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-rust">Updating Run</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                            <div className="space-y-3">
                                <Label htmlFor="scheduled_date" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Collection Date <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="scheduled_date"
                                        type="date"
                                        required
                                        min={runsheet.scheduled_date && runsheet.scheduled_date.substring(0, 10) < new Date().toLocaleDateString('en-CA') ? runsheet.scheduled_date.substring(0, 10) : new Date().toLocaleDateString('en-CA')}
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
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
                                    className="flex h-12 w-full rounded-xl border border-brand-warm/20 bg-brand-warm/5 px-4 text-[11px] font-black uppercase tracking-widest text-brand-rust focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm appearance-none cursor-pointer"
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
                                    className="flex h-12 w-full rounded-xl border border-brand-warm/20 bg-brand-warm/5 px-4 text-[11px] font-black uppercase tracking-widest text-brand-rust focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm appearance-none cursor-pointer"
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
                                <Label htmlFor="area_description" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Pickup Area <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="area_description"
                                        required
                                        className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
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
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-brand-warm/10 rounded-xl border border-brand-warm/20 text-brand-rust shadow-sm">
                                        <User className="size-5" />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-rust">Assigned Picker <span className="text-red-500">*</span></Label>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">Select a picker to handle this pickup runsheet.</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {selectedPicker ? (
                                        (() => {
                                            const activeCount = (selectedPicker as any).active_runsheet_count ?? 0;
                                            const initials = selectedPicker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                                            const mobile = selectedPicker.picker?.mobile || '';

                                            return (
                                                <div className="p-5 rounded-2xl border-2 border-brand-rust bg-brand-rust/5 flex items-center gap-4 relative">
                                                    <div className="size-12 rounded-xl bg-brand-rust text-white flex items-center justify-center text-xs font-black">
                                                        {initials}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black text-brand-rust tracking-tight truncate">{selectedPicker.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                {activeCount} active tasks
                                                            </p>
                                                            {mobile && (
                                                                <>
                                                                    <span className="text-[9px] text-brand-sand mx-1">•</span>
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">📱 {mobile}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 z-10">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => setIsPickerModalOpen(true)}
                                                            className="h-9 px-4 rounded-xl text-xs font-bold uppercase hover:bg-brand-rust/5 transition-colors border-brand-warm/20 text-brand-rust"
                                                        >
                                                            Change
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() => setData('picker_id', '')}
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
                                            onClick={() => setIsPickerModalOpen(true)}
                                            className="w-full p-6 border-2 border-dashed border-brand-warm/20 rounded-2xl hover:border-brand-rust/50 hover:bg-brand-rust/5 transition-all text-center flex flex-col items-center justify-center gap-2 group"
                                        >
                                            <div className="size-10 rounded-full bg-brand-warm flex items-center justify-center text-brand-rust group-hover:scale-110 transition-transform">
                                                <Plus className="size-5" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-wider text-brand-rust">Select Picker</span>
                                            <span className="text-[10px] text-muted-foreground font-medium">Click to search and assign a picker</span>
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
                                    <DialogContent className="sm:max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase tracking-widest text-brand-rust">
                                                <User className="size-4" />
                                                Select Picker
                                            </DialogTitle>
                                            <DialogDescription className="text-xs">
                                                Select a picker to handle this pickup runsheet.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div className="relative group">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40 group-focus-within:text-brand-rust transition-colors" />
                                                <Input
                                                    placeholder="Search picker name..."
                                                    className="h-11 rounded-xl border-brand-warm/20 bg-brand-warm/5 pl-11 pr-4 font-bold text-xs focus:ring-brand-rust/20 focus:border-brand-rust focus:bg-white transition-all"
                                                    value={assigneeSearchTerm}
                                                    onChange={(e) => setAssigneeSearchTerm(e.target.value)}
                                                />
                                            </div>

                                            <div className="grid max-h-[350px] gap-3 overflow-y-auto pr-1 custom-scrollbar">
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
                                                                className={`group relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${isSelected
                                                                        ? 'border-brand-rust bg-brand-rust/5 ring-4 ring-brand-rust/5'
                                                                        : 'border-brand-warm/10 bg-white hover:border-brand-rust/30 hover:bg-brand-rust/5'
                                                                    }`}
                                                            >
                                                                <div className={`size-12 rounded-xl flex items-center justify-center text-xs font-black transition-all ${isSelected ? 'bg-brand-rust text-white' : 'bg-brand-warm/10 text-brand-rust/60'
                                                                    }`}>
                                                                    {initials}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-black text-brand-rust truncate">{u.name}</p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                            {activeCount} active tasks
                                                                        </p>
                                                                        {mobile && (
                                                                            <>
                                                                                <span className="text-[9px] text-brand-sand mx-1">•</span>
                                                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">📱 {mobile}</p>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-brand-rust border-brand-rust' : 'border-brand-sand bg-white'
                                                                    }`}>
                                                                    {isSelected && <Check className="size-3 text-white stroke-[4px]" />}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="p-8 text-center border-2 border-dashed border-brand-warm/20 rounded-2xl flex flex-col items-center gap-3">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No pickers found</p>
                                                        <Link 
                                                            href="/admin/users/create" 
                                                            className="text-[10px] font-bold text-brand-rust uppercase tracking-widest hover:underline flex items-center gap-1"
                                                        >
                                                            <Plus className="size-3" />
                                                            Add New Picker
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>
                                            {filteredPickers.length > 30 && (
                                                <p className="text-[10px] text-muted-foreground text-center font-bold uppercase tracking-wider mt-2">
                                                    Showing first 30 of {filteredPickers.length} pickers. Please search to refine.
                                                </p>
                                            )}
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
                                        <div key={booking.id} className="flex items-center gap-5 p-5 rounded-4xl border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden border-brand-rust bg-brand-rust/3 ring-2 ring-brand-rust/20"
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
                                        <div key={booking.id} className={`flex items-center gap-5 p-5 rounded-4xl border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden ${data.booking_ids.includes(booking.id) ? 'border-brand-rust bg-brand-rust/3 ring-2 ring-brand-rust/20' : 'border-brand-warm/10 bg-white hover:border-brand-rust/40'}`}
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
                            <Link href="/admin/runsheets" className="px-10 h-14 flex items-center justify-center rounded-2xl border-2 border-brand-warm/20 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-brand-warm/5">Cancel</Link>
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
