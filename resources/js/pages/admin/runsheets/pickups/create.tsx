import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Box, Calendar, Check, CheckSquare, MapPin, Plus, Save, Search, Square, Trash2, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

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
        suburb?: string;
        state?: string;
    };
    payment_status: string;
    preferred_date?: string;
    boxes_without_serial_count?: number;
}

export default function PickupRunsheetsCreate({
    pickers = [],
    pickupEligibleBookings = [],
    recommendedStartingSerial,
}: {
    pickers?: Picker[];
    pickupEligibleBookings?: Booking[];
    recommendedStartingSerial?: string;
}) {
    const { t } = useTranslations();

    const { data, setData, post, processing, errors, wasSuccessful } = useForm({
        picker_id: '',
        scheduled_date: '',
        timeslot: '',
        area_description: '',
        type: 'pickup',
        status: 'assigned',
        booking_ids: [] as number[],
        starting_serial_number: recommendedStartingSerial || '',
    });

    const [hasLoadedUrlParams, setHasLoadedUrlParams] = useState(false);

    useEffect(() => {
        if (hasLoadedUrlParams) return;

        const urlParams = new URLSearchParams(window.location.search);
        const bookingId = urlParams.get('booking_id');
        const bookingIdsStr = urlParams.get('booking_ids');

        let updatedIds: number[] = [];
        let firstBooking: Booking | undefined;

        if (bookingIdsStr) {
            const ids = bookingIdsStr.split(',')
                .map(id => parseInt(id))
                .filter(id => !isNaN(id));

            updatedIds = ids;
            firstBooking = pickupEligibleBookings.find(b => ids.includes(b.id));
        } else if (bookingId) {
            const id = parseInt(bookingId);
            if (!isNaN(id)) {
                updatedIds = [id];
                firstBooking = pickupEligibleBookings.find(b => b.id === id);
            }
        }

        if (updatedIds.length > 0) {
            const newData: any = { booking_ids: updatedIds };

            if (firstBooking) {
                if (firstBooking.preferred_date) {
                    newData.scheduled_date = firstBooking.preferred_date.substring(0, 10);
                }
                if (firstBooking.sender) {
                    const area = [firstBooking.sender.suburb, firstBooking.sender.state].filter(Boolean).join(', ');
                    if (area) {
                        newData.area_description = area;
                    }
                }
            }

            setData(data => ({ ...data, ...newData }));
        }

        setHasLoadedUrlParams(true);
    }, [pickupEligibleBookings, hasLoadedUrlParams, setData]);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
    const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');
    const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);

    const selectedPicker = useMemo(() => {
        return pickers.find(p => String(p.id) === String(data.picker_id));
    }, [pickers, data.picker_id]);

    // Compute unique suburbs / area counts for filter chips
    const areaCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        pickupEligibleBookings.forEach((booking) => {
            const area = [booking.sender.suburb, booking.sender.state].filter(Boolean).join(', ') || 'Unspecified';
            counts[area] = (counts[area] || 0) + 1;
        });
        return counts;
    }, [pickupEligibleBookings]);

    // Filter logic for pickers
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

    // Filter logic for pickup bookings (search + area filter chips)
    const filteredBookings = useMemo(() => {
        return pickupEligibleBookings.filter((booking) => {
            const matchesSearch =
                booking.reference_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                booking.sender.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                booking.sender.last_name.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;
            if (selectedAreaFilter === 'all') return true;

            const area = [booking.sender.suburb, booking.sender.state].filter(Boolean).join(', ') || 'Unspecified';
            return area.toLowerCase() === selectedAreaFilter.toLowerCase();
        });
    }, [pickupEligibleBookings, searchTerm, selectedAreaFilter]);

    const handleSelectAll = () => {
        const filteredIds = filteredBookings.map(b => b.id);
        const allFilteredSelected = filteredIds.every(id => data.booking_ids.includes(id));

        if (allFilteredSelected) {
            setData('booking_ids', data.booking_ids.filter(id => !filteredIds.includes(id)));
        } else {
            const newIds = Array.from(new Set([...data.booking_ids, ...filteredIds]));
            const newData: any = { booking_ids: newIds };

            if (data.booking_ids.length === 0 && filteredBookings.length > 0) {
                const firstBooking = filteredBookings[0];

                if (!data.scheduled_date && firstBooking.preferred_date) {
                    newData.scheduled_date = firstBooking.preferred_date.substring(0, 10);
                }

                if (!data.area_description && firstBooking.sender) {
                    const area = [firstBooking.sender.suburb, firstBooking.sender.state].filter(Boolean).join(', ');

                    if (area) {
                        newData.area_description = area;
                    }
                }
            }

            setData(current => ({ ...current, ...newData }));
        }
    };

    const isAllFilteredSelected = filteredBookings.length > 0 && filteredBookings.every(b => data.booking_ids.includes(b.id));
    const isSubmitDisabled = processing || wasSuccessful || !data.picker_id || data.booking_ids.length === 0;

    const selectedBookingsData = useMemo(() => {
        return pickupEligibleBookings.filter(b => data.booking_ids.includes(b.id));
    }, [pickupEligibleBookings, data.booking_ids]);

    const totalNeededBoxes = selectedBookingsData.reduce((sum, b) => sum + (b.boxes_without_serial_count || 0), 0);

    const selectedSuburbsCount = useMemo(() => {
        const suburbs = new Set(selectedBookingsData.map(b => b.sender.suburb).filter(Boolean));
        return suburbs.size;
    }, [selectedBookingsData]);

    // Keyboard Shortcuts Hook ('/', Cmd+A, Cmd+Enter)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeElement = document.activeElement;
            const isInputActive = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');

            if (e.key === '/' && !isInputActive) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && !isInputActive) {
                e.preventDefault();
                handleSelectAll();
            }

            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                if (!isSubmitDisabled) {
                    e.preventDefault();
                    post('/admin/runsheets');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSubmitDisabled, filteredBookings, data.booking_ids]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: t('ui.common.dashboard', 'Dashboard'), href: '/dashboard' },
        { title: t('ui.runsheets.breadcrumbs.runsheets', 'Runsheets'), href: '/admin/runsheets' },
        { title: 'New Pickup Dispatch', href: '#' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/runsheets');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dispatch Pickup Run | Love Balikbayan" />

            <div className="flex flex-col h-screen overflow-hidden bg-brand-warm/10">
                {/* Fixed Header */}
                <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-brand-sand/50 shadow-sm z-10">
                    <div className="flex items-center gap-6">
                        <Link
                            href="/admin/runsheets"
                            className="group flex items-center justify-center size-11 rounded-2xl bg-brand-warm/30 border border-brand-sand text-brand-rust transition-all hover:bg-brand-rust hover:text-white"
                        >
                            <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-1" />
                        </Link>
                        <div>
                            <h1 className="font-serif text-2xl font-bold text-brand-text leading-tight">Create Pickup Dispatch</h1>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
                                <span className="text-brand-rust">Operations</span> • Origin Collection Run
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden xl:flex flex-col items-end mr-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selection Summary</span>
                            <p className="text-sm font-black text-brand-text">
                                {data.booking_ids.length} Bookings ({totalNeededBoxes} Boxes) {selectedSuburbsCount > 0 ? `• ${selectedSuburbsCount} ${selectedSuburbsCount === 1 ? 'Area' : 'Areas'}` : ''}
                            </p>
                            {!data.picker_id && (
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">
                                    ⚠️ Select a picker to confirm
                                </span>
                            )}
                            {data.picker_id && data.booking_ids.length === 0 && (
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">
                                    ⚠️ Select at least 1 booking
                                </span>
                            )}
                        </div>
                        <Button
                            form="pickup-dispatch-form"
                            type="submit"
                            disabled={isSubmitDisabled}
                            variant="success"
                            className="flex items-center gap-3 px-8 h-12 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {processing ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="size-4" />}
                            {processing ? 'Processing...' : 'Confirm Pickup Run'}
                        </Button>
                    </div>
                </div>

                {/* Main Content Area - Split Layout */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar: Dispatch Configuration */}
                    <div className="w-full md:w-100 bg-white border-r border-brand-sand/40 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                        <form id="pickup-dispatch-form" onSubmit={handleSubmit} className="space-y-10">
                            {/* Date & Area Section */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-lg bg-brand-warm flex items-center justify-center text-brand-rust">
                                        <Calendar className="size-4" />
                                    </div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-brand-text">Dispatch Settings</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Collection Date</Label>
                                        <div className="relative group">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40 group-focus-within:text-brand-rust transition-colors" />
                                            <Input
                                                type="date"
                                                required
                                                min={new Date().toLocaleDateString('en-CA')}
                                                className="h-12 rounded-xl border-brand-sand bg-brand-warm/10 pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust focus:bg-white transition-all"
                                                value={data.scheduled_date}
                                                onChange={(e) => setData('scheduled_date', e.target.value)}
                                            />
                                        </div>
                                        {errors.scheduled_date && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.scheduled_date}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Time Slot (Optional)</Label>
                                        <select
                                            title="Time Slot"
                                            className="h-12 w-full rounded-xl border border-brand-sand bg-brand-warm/10 px-4 text-[11px] font-bold text-brand-text focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all appearance-none cursor-pointer"
                                            value={data.timeslot}
                                            onChange={(e) => setData('timeslot', e.target.value)}
                                        >
                                            <option value="">Anytime</option>
                                            <option value="Morning (9AM - 12PM)">Morning (9AM - 12PM)</option>
                                            <option value="Afternoon (1PM - 5PM)">Afternoon (1PM - 5PM)</option>
                                            <option value="Evening (6PM - 9PM)">Evening (6PM - 9PM)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Status</Label>
                                        <select
                                            title="Status"
                                            className="h-12 w-full rounded-xl border border-brand-sand bg-brand-warm/10 px-4 text-[11px] font-bold text-brand-text focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all appearance-none cursor-pointer"
                                            value={data.status}
                                            onChange={(e) => setData('status', e.target.value)}
                                        >
                                            <option value="draft">Draft</option>
                                            <option value="assigned">Assigned</option>
                                            <option value="in_progress">In Progress</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Pickup Area / Region</Label>
                                        <div className="relative group">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40 group-focus-within:text-brand-rust transition-colors" />
                                            <Input
                                                placeholder="e.g. Sydney North"
                                                required
                                                className="h-12 rounded-xl border-brand-sand bg-brand-warm/10 pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust focus:bg-white transition-all"
                                                value={data.area_description}
                                                onChange={(e) => setData('area_description', e.target.value)}
                                            />
                                        </div>
                                        {errors.area_description && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.area_description}</p>}
                                    </div>
                                </div>
                            </section>

                            {/* Serial Number Allocation Section */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-lg bg-brand-warm flex items-center justify-center text-brand-rust">
                                        <Box className="size-4" />
                                    </div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-brand-text">Serial Number Allocation</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl border border-brand-sand/50 bg-white">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Selected Boxes</span>
                                            <span className="text-sm font-black text-brand-text">{totalNeededBoxes}</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-medium">
                                            {totalNeededBoxes > 0 
                                                ? `You selected ${data.booking_ids.length} booking(s) requiring a total of ${totalNeededBoxes} serial numbers.` 
                                                : `No serial numbers will be allocated yet (select bookings).`}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Starting Serial Number</Label>
                                        <Input
                                            placeholder="e.g. LBB-0001"
                                            required
                                            className="h-12 rounded-xl border-brand-sand bg-brand-warm/10 px-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust focus:bg-white transition-all uppercase"
                                            value={data.starting_serial_number}
                                            onChange={(e) => setData('starting_serial_number', e.target.value.toUpperCase())}
                                        />
                                        <p className="text-[10px] font-bold text-brand-rust/80 ml-1">
                                            {recommendedStartingSerial ? `Lowest available: ${recommendedStartingSerial}` : 'No available serial numbers'}
                                        </p>
                                        {errors.starting_serial_number && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.starting_serial_number}</p>}
                                    </div>
                                </div>
                            </section>

                            {/* Picker Selection Section */}
                            <section className="space-y-6 pb-20">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-lg bg-brand-warm flex items-center justify-center text-brand-rust">
                                            <User className="size-4" />
                                        </div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-brand-text">Assign Picker</h3>
                                    </div>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-2 py-1 rounded-md">
                                        {pickers.length} Available
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    {selectedPicker ? (
                                        (() => {
                                            const activeCount = (selectedPicker as any).active_runsheet_count ?? 0;
                                            const initials = selectedPicker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                                            return (
                                                <div className="p-4 rounded-2xl border-2 border-brand-rust bg-brand-rust/5 flex items-center gap-4 relative">
                                                    <div className="size-12 rounded-xl bg-brand-rust text-white flex items-center justify-center text-xs font-black">
                                                        {initials}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black text-brand-text truncate">{selectedPicker.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                {activeCount} active tasks
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => setIsPickerModalOpen(true)}
                                                            className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase hover:bg-brand-rust/5 transition-colors border-brand-sand text-brand-rust"
                                                        >
                                                            Change
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() => setData('picker_id', '')}
                                                            className="size-8 p-0 text-red-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
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
                                            className="w-full p-6 border-2 border-dashed border-brand-sand/50 rounded-2xl hover:border-brand-rust/50 hover:bg-brand-rust/5 transition-all text-center flex flex-col items-center justify-center gap-2 group"
                                        >
                                            <div className="size-10 rounded-full bg-brand-warm flex items-center justify-center text-brand-rust group-hover:scale-110 transition-transform">
                                                <Plus className="size-5" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-wider text-brand-text">Select Picker</span>
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
                                {errors.picker_id && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.picker_id}</p>}

                                <Dialog open={isPickerModalOpen} onOpenChange={setIsPickerModalOpen}>
                                    <DialogContent className="sm:max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase tracking-widest text-brand-rust">
                                                <User className="size-4" />
                                                Select Picker
                                            </DialogTitle>
                                            <DialogDescription className="text-xs">
                                                Select a picker to handle this origin collection runsheet.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div className="relative group">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40 group-focus-within:text-brand-rust transition-colors" />
                                                <Input
                                                    placeholder="Search picker name..."
                                                    className="h-11 rounded-xl border-brand-sand bg-brand-warm/10 pl-11 pr-4 font-bold text-xs focus:ring-brand-rust/20 focus:border-brand-rust focus:bg-white transition-all"
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

                                                        return (
                                                            <div
                                                                key={u.id}
                                                                onClick={() => {
                                                                    setData('picker_id', String(u.id));
                                                                    setIsPickerModalOpen(false);
                                                                }}
                                                                className={`group relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${isSelected
                                                                        ? 'border-brand-rust bg-brand-rust/5 ring-4 ring-brand-rust/5'
                                                                        : 'border-brand-sand/50 bg-white hover:border-brand-rust/30 hover:bg-brand-rust/5'
                                                                    }`}
                                                            >
                                                                <div className={`size-12 rounded-xl flex items-center justify-center text-xs font-black transition-all ${isSelected ? 'bg-brand-rust text-white' : 'bg-brand-warm/50 text-brand-rust'
                                                                    }`}>
                                                                    {initials}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-black text-brand-text truncate">{u.name}</p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                            {activeCount} active tasks
                                                                        </p>
                                                                        {u.picker?.mobile && (
                                                                            <>
                                                                                <span className="text-[9px] text-brand-sand mx-1">•</span>
                                                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">📱 {u.picker.mobile}</p>
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
                                                    <div className="p-8 text-center border-2 border-dashed border-brand-sand/30 rounded-2xl flex flex-col items-center gap-3">
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
                            </section>
                        </form>
                    </div>

                    {/* Right Pane: Inventory / Booking Selection */}
                    <div className="flex-1 flex flex-col bg-brand-warm/10 p-8 overflow-hidden">
                        {/* Area Filter Chips */}
                        {Object.keys(areaCounts).length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto pb-3 custom-scrollbar mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-brand-rust/80 shrink-0 flex items-center gap-1.5 bg-brand-warm/40 px-3 py-1.5 rounded-xl border border-brand-sand/50">
                                    <MapPin className="size-3 text-brand-rust" /> Filter Area:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedAreaFilter('all')}
                                    className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                        selectedAreaFilter === 'all'
                                            ? 'bg-brand-rust text-white shadow-md'
                                            : 'bg-white border border-brand-sand/60 text-brand-text hover:bg-brand-warm/40'
                                    }`}
                                >
                                    All ({pickupEligibleBookings.length})
                                </button>
                                {Object.entries(areaCounts).map(([areaName, count]) => (
                                    <button
                                        key={areaName}
                                        type="button"
                                        onClick={() => setSelectedAreaFilter(areaName)}
                                        className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                            selectedAreaFilter.toLowerCase() === areaName.toLowerCase()
                                                ? 'bg-brand-rust text-white shadow-md'
                                                : 'bg-white border border-brand-sand/60 text-brand-text hover:bg-brand-warm/40'
                                        }`}
                                    >
                                        📍 {areaName} ({count})
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Search & Toolbar */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-4 rounded-4xl border border-brand-sand/40 shadow-sm">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40 group-focus-within:text-brand-rust transition-colors" />
                                <Input
                                    ref={searchInputRef}
                                    placeholder="Search by Reference # or Sender Name... (Press '/' to search)"
                                    className="h-12 rounded-[1.25rem] border-brand-sand/50 bg-brand-warm/5 pl-11 pr-4 font-bold text-xs focus:ring-brand-rust/10 focus:border-brand-rust transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className={`flex items-center justify-center gap-3 px-8 h-12 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${isAllFilteredSelected
                                        ? 'bg-brand-rust text-white shadow-lg'
                                        : 'bg-white border border-brand-sand text-brand-rust hover:border-brand-rust hover:bg-brand-rust/5'
                                    }`}
                            >
                                {isAllFilteredSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                                {isAllFilteredSelected ? 'Deselect All' : 'Select All Result'}
                            </button>
                        </div>

                        {/* Results Grid */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                                {filteredBookings.length > 0 ? (
                                    filteredBookings.map((booking) => {
                                        const isSelected = data.booking_ids.includes(booking.id);

                                        return (
                                            <div
                                                key={booking.id}
                                                onClick={() => {
                                                    const ids = [...data.booking_ids];
                                                    const isSelecting = !ids.includes(booking.id);

                                                    const newData: any = {
                                                        booking_ids: isSelecting ? [...ids, booking.id] : ids.filter(id => id !== booking.id)
                                                    };

                                                    if (isSelecting && ids.length === 0) {
                                                        if (!data.area_description && booking.sender) {
                                                            const area = [booking.sender.suburb, booking.sender.state].filter(Boolean).join(', ');

                                                            if (area) {
                                                                newData.area_description = area;
                                                            }
                                                        }

                                                        if (!data.scheduled_date && booking.preferred_date) {
                                                            newData.scheduled_date = booking.preferred_date.substring(0, 10);
                                                        }
                                                    }

                                                    setData(current => ({ ...current, ...newData }));
                                                }}
                                                className={`group flex flex-col p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer relative overflow-hidden ${isSelected
                                                        ? 'border-brand-rust bg-white ring-8 ring-brand-rust/5'
                                                        : 'border-brand-sand/30 bg-white/60 hover:bg-white hover:border-brand-rust/40'
                                                    }`}
                                            >
                                                {/* Stop Sequence Badge */}
                                                {isSelected && (
                                                    <div className="absolute top-4 left-4 px-2.5 py-1 rounded-xl bg-brand-rust text-white text-[9px] font-black uppercase tracking-widest shadow-md flex items-center gap-1 z-10 animate-in fade-in zoom-in-95">
                                                        <span>Stop #{data.booking_ids.indexOf(booking.id) + 1}</span>
                                                    </div>
                                                )}

                                                {/* Selection Checkmark Badge */}
                                                <div className={`absolute top-4 right-4 size-7 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-brand-rust border-brand-rust scale-110 shadow-lg shadow-brand-rust/30' : 'border-brand-sand/40 bg-white group-hover:border-brand-rust/40'
                                                    }`}>
                                                    {isSelected && <Check className="size-4 text-white stroke-[4px]" />}
                                                </div>

                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="p-3 rounded-2xl bg-brand-warm text-brand-rust">
                                                        <Box className="size-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-brand-text tracking-tighter uppercase font-mono">{booking.reference_number}</p>
                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Booking Status: {booking.payment_status}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 flex-1 pb-2">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-black text-brand-rust uppercase tracking-widest bg-brand-warm px-2 py-0.5 rounded">Sender</span>
                                                            <p className="text-xs font-black text-brand-text uppercase truncate">
                                                                {booking.sender.first_name} {booking.sender.last_name}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-brand-sand/40 flex justify-between items-center relative z-10">
                                                        <p className="text-[10px] font-black text-brand-text/60 uppercase tracking-tighter">
                                                            Ready for pickup
                                                        </p>
                                                        <span className="text-[9px] font-bold text-brand-rust uppercase tracking-widest bg-white/90 backdrop-blur-sm border border-brand-rust/20 px-2.5 py-1 rounded-md shadow-xs">
                                                            {booking.boxes_without_serial_count} Box(es)
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Decorative backdrop */}
                                                <div className="absolute -bottom-4 -right-2 text-[60px] font-black text-brand-rust/5 pointer-events-none select-none italic font-serif">
                                                    PICKUP
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="col-span-full py-32 flex flex-col items-center justify-center border-4 border-dashed border-brand-sand/50 rounded-[3rem] bg-white/40 backdrop-blur-sm">
                                        <div className="size-24 rounded-3xl bg-brand-warm flex items-center justify-center text-brand-rust/40 mb-8 animate-pulse">
                                            <Search className="size-10" />
                                        </div>
                                        <h3 className="text-sm font-black text-brand-text uppercase tracking-[0.3em]">No Eligible Bookings</h3>
                                        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-3 text-center max-w-sm px-8">
                                            We couldn't find any paid bookings ready for collection. Check the confirmation status of your pending orders.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
