import { Head, Link, useForm } from '@inertiajs/react';
import { Save, ArrowLeft, Check, Calendar, MapPin, Box, Truck, Search, Filter, CheckSquare, Square, Plus, Trash2 } from 'lucide-react';
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

    const selectedCourier = useMemo(() => {
        return couriers.find(c => String(c.id) === String(data.courier_id));
    }, [couriers, data.courier_id]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const boxId = urlParams.get('box_id');

        if (boxId) {
            const id = parseInt(boxId);

            if (!isNaN(id) && !data.box_ids.includes(id)) {
                setData('box_ids', [id]);
            }
        }
    }, [data.box_ids, setData]);

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
                {/* Fixed Header */}
                <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-brand-sand/50 shadow-sm z-10">
                    <div className="flex items-center gap-6">
                        <Link
                            href="/admin/runsheets"
                            className="group flex items-center justify-center size-11 rounded-2xl bg-brand-warm/30 border border-brand-sand text-brand-secondary transition-all hover:bg-brand-secondary hover:text-white"
                        >
                            <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-1" />
                        </Link>
                        <div>
                            <h1 className="font-serif text-2xl font-bold text-brand-text leading-tight">Create Delivery Dispatch</h1>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
                                <span className="text-brand-secondary">Logistics</span> • Final Mile Assignment
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden xl:flex flex-col items-end mr-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selection Summary</span>
                            <p className="text-sm font-black text-brand-text">
                                {data.box_ids.length} Boxes Selected
                            </p>
                        </div>
                        <Button
                            form="dispatch-form"
                            type="submit"
                            disabled={isSubmitDisabled}
                            variant="success"
                            className="flex items-center gap-3 px-8 h-12 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {processing ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="size-4" />}
                            {processing ? 'Processing...' : 'Confirm Dispatch'}
                        </Button>
                    </div>
                </div>

                {/* Main Content Area - Split Layout */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar: Dispatch Configuration */}
                    <div className="w-full md:w-100 bg-white border-r border-brand-sand/40 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                        <form id="dispatch-form" onSubmit={handleSubmit} className="space-y-10">
                            {/* Date & Area Section */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-lg bg-brand-warm flex items-center justify-center text-brand-secondary">
                                        <Calendar className="size-4" />
                                    </div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-brand-text">General Settings</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Delivery Date</Label>
                                        <div className="relative group">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-secondary/40 group-focus-within:text-brand-secondary transition-colors" />
                                            <Input
                                                type="date"
                                                required
                                                min={new Date().toLocaleDateString('en-CA')}
                                                className="h-12 rounded-xl border-brand-sand bg-brand-warm/10 pl-11 pr-4 font-bold focus:ring-brand-secondary/20 focus:border-brand-secondary focus:bg-white transition-all"
                                                value={data.scheduled_date}
                                                onChange={(e) => setData('scheduled_date', e.target.value)}
                                            />
                                        </div>
                                        {errors.scheduled_date && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.scheduled_date}</p>}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Time Slot (Optional)</Label>
                                        <select
                                            aria-label="Time Slot"
                                            className="h-12 w-full rounded-xl border border-brand-sand bg-brand-warm/10 px-4 text-[11px] font-bold text-brand-text focus:ring-2 focus:ring-brand-secondary/20 focus:border-brand-secondary transition-all appearance-none cursor-pointer"
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
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Dispatch Hub / Area</Label>
                                        <div className="relative group">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-secondary/40 group-focus-within:text-brand-secondary transition-colors" />
                                            <Input
                                                placeholder="e.g. Manila Hub"
                                                required
                                                className="h-12 rounded-xl border-brand-sand bg-brand-warm/10 pl-11 pr-4 font-bold focus:ring-brand-secondary/20 focus:border-brand-secondary focus:bg-white transition-all"
                                                value={data.area_description}
                                                onChange={(e) => setData('area_description', e.target.value)}
                                            />
                                        </div>
                                        {errors.area_description && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.area_description}</p>}
                                    </div>
                                </div>
                            </section>

                            {/* Courier Selection Section */}
                            <section className="space-y-6 pb-20">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-lg bg-brand-warm flex items-center justify-center text-brand-secondary">
                                            <Truck className="size-4" />
                                        </div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-brand-text">Assign Courier</h3>
                                    </div>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase bg-muted px-2 py-1 rounded-md">
                                        {filteredCouriers.length} Available
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    {selectedCourier ? (
                                        (() => {
                                            const activeCount = (selectedCourier as any).active_runsheet_count ?? 0;
                                            const initials = selectedCourier.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                                            return (
                                                <div className="p-4 rounded-2xl border-2 border-brand-secondary bg-brand-warm/50 flex items-center gap-4 relative">
                                                    <div className="size-12 rounded-xl bg-brand-secondary text-white flex items-center justify-center text-xs font-black">
                                                        {initials}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black text-brand-text truncate">{selectedCourier.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                {activeCount} active runsheets
                                                            </p>
                                                            {selectedCourier.courier?.area && (
                                                                <>
                                                                    <span className="text-[9px] text-brand-sand mx-1">•</span>
                                                                    <p className="text-[9px] font-bold text-brand-rust uppercase tracking-widest bg-brand-warm/50 px-1.5 py-0.5 rounded">
                                                                        {selectedCourier.courier.area.name} Hub
                                                                    </p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => setIsCourierModalOpen(true)}
                                                            className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase hover:bg-brand-secondary/5 transition-colors border-brand-sand text-brand-secondary"
                                                        >
                                                            Change
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                setData('courier_id', '');
                                                                setSelectedArea('all');
                                                            }}
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
                                            onClick={() => setIsCourierModalOpen(true)}
                                            className="w-full p-6 border-2 border-dashed border-brand-sand/50 rounded-2xl hover:border-brand-secondary/50 hover:bg-brand-warm/10 transition-all text-center flex flex-col items-center justify-center gap-2 group"
                                        >
                                            <div className="size-10 rounded-full bg-brand-warm flex items-center justify-center text-brand-secondary group-hover:scale-110 transition-transform">
                                                <Plus className="size-5" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-wider text-brand-text">Select Courier</span>
                                            <span className="text-[10px] text-muted-foreground font-medium">Click to search and assign a courier</span>
                                        </button>
                                    )}
                                </div>
                                {errors.courier_id && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.courier_id}</p>}

                                <Dialog open={isCourierModalOpen} onOpenChange={setIsCourierModalOpen}>
                                    <DialogContent className="sm:max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase tracking-widest text-brand-secondary">
                                                <Truck className="size-4" />
                                                Select Courier
                                            </DialogTitle>
                                            <DialogDescription className="text-xs">
                                                Select a courier to handle this final mile delivery runsheet.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div className="relative group">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-secondary/40 group-focus-within:text-brand-secondary transition-colors" />
                                                <Input
                                                    placeholder="Search courier name..."
                                                    className="h-11 rounded-xl border-brand-sand bg-brand-warm/10 pl-11 pr-4 font-bold text-xs focus:ring-brand-secondary/20 focus:border-brand-secondary focus:bg-white transition-all"
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

                                                        return (
                                                            <div
                                                                key={u.id}
                                                                onClick={() => {
                                                                    setData('courier_id', String(u.id));
                                                                    setIsCourierModalOpen(false);
                                                                }}
                                                                className={`group relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4 ${isSelected
                                                                        ? 'border-brand-secondary bg-brand-warm/50 ring-4 ring-brand-secondary/5'
                                                                        : 'border-brand-sand/50 bg-white hover:border-brand-secondary/30 hover:bg-brand-warm/10'
                                                                    }`}
                                                            >
                                                                <div className={`size-12 rounded-xl flex items-center justify-center text-xs font-black transition-all ${isSelected ? 'bg-brand-secondary text-white' : 'bg-brand-warm/50 text-brand-secondary'
                                                                    }`}>
                                                                    {initials}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-black text-brand-text truncate">{u.name}</p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                            {activeCount} active runsheets
                                                                        </p>
                                                                        {u.courier?.area && (
                                                                            <>
                                                                                <span className="text-[9px] text-brand-sand mx-1">•</span>
                                                                                <p className="text-[9px] font-bold text-brand-rust uppercase tracking-widest bg-brand-warm/50 px-1.5 py-0.5 rounded">
                                                                                    {u.courier.area.name} Hub
                                                                                </p>
                                                                            </>
                                                                        )}
                                                                        {u.courier?.mobile && (
                                                                            <>
                                                                                <span className="text-[9px] text-brand-sand mx-1">•</span>
                                                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">📱 {u.courier.mobile}</p>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-brand-secondary border-brand-secondary' : 'border-brand-sand bg-white'
                                                                    }`}>
                                                                    {isSelected && <Check className="size-3 text-white stroke-[4px]" />}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="p-8 text-center border-2 border-dashed border-brand-sand/30 rounded-2xl">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No couriers found</p>
                                                    </div>
                                                )}
                                            </div>
                                            {filteredCouriers.length > 30 && (
                                                <p className="text-[10px] text-muted-foreground text-center font-bold uppercase tracking-wider mt-2">
                                                    Showing first 30 of {filteredCouriers.length} couriers. Please search to refine.
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
                        <div className="flex flex-col md:flex-row gap-4 mb-8 bg-white p-4 rounded-4xl border border-brand-sand/40 shadow-sm">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-secondary/40 group-focus-within:text-brand-secondary transition-colors" />
                                <Input
                                    placeholder="Search tracking #, sender or recipient..."
                                    className="h-12 rounded-[1.25rem] border-brand-sand/50 bg-brand-warm/5 pl-11 pr-4 font-bold text-xs focus:ring-brand-secondary/10 focus:border-brand-secondary transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="relative w-full md:w-64">
                                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-secondary/40" />
                                <select
                                    title="Filter by service area"
                                    aria-label="Filter by service area"
                                    className={`h-12 w-full rounded-[1.25rem] border border-brand-sand/50 pl-11 pr-4 text-[11px] font-bold text-brand-text focus:ring-brand-secondary/10 focus:border-brand-secondary transition-all appearance-none ${(data.courier_id || data.box_ids.length > 0) ? 'bg-brand-warm/20 opacity-60 cursor-not-allowed' : 'bg-brand-warm/5 cursor-pointer'}`}
                                    value={selectedArea}
                                    onChange={(e) => setSelectedArea(e.target.value)}
                                    disabled={!!data.courier_id || data.box_ids.length > 0}
                                >
                                    <option value="all">All Service Areas</option>
                                    {uniqueAreas.map(area => <option key={area} value={area}>{area}</option>)}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className={`flex items-center justify-center gap-3 px-8 h-12 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${isAllFilteredSelected
                                        ? 'bg-brand-secondary text-white shadow-lg'
                                        : 'bg-white border border-brand-sand text-brand-secondary hover:border-brand-secondary hover:bg-brand-warm/10'
                                    }`}
                            >
                                {isAllFilteredSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                                {isAllFilteredSelected ? 'Deselect All' : 'Select All Result'}
                            </button>
                        </div>

                        {/* Results Grid */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                                {filteredBoxes.length > 0 ? (
                                    filteredBoxes.map((box) => {
                                        const isSelected = data.box_ids.includes(box.id);
                                        const recipient = box.recipient;
                                        const boxCount = 1;

                                        return (
                                            <div
                                                key={box.id}
                                                onClick={() => {
                                                    const ids = [...data.box_ids];
                                                    setData('box_ids', ids.includes(box.id) ? ids.filter(id => id !== box.id) : [...ids, box.id]);
                                                }}
                                                className={`group flex flex-col p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer relative overflow-hidden ${isSelected
                                                        ? 'border-brand-secondary bg-white ring-8 ring-brand-secondary/5'
                                                        : 'border-brand-sand/30 bg-white/60 hover:bg-white hover:border-brand-secondary/40'
                                                    }`}
                                            >
                                                {/* Selection Badge */}
                                                <div className={`absolute top-4 right-4 size-7 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-brand-secondary border-brand-secondary scale-110 shadow-lg shadow-brand-secondary/30' : 'border-brand-sand/40 bg-white group-hover:border-brand-secondary/40'
                                                    }`}>
                                                    {isSelected && <Check className="size-4 text-white stroke-[4px]" />}
                                                </div>

                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="p-3 rounded-2xl bg-brand-warm text-brand-secondary">
                                                        <Box className="size-5" />
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

                                                    <div className="pt-4 border-t border-brand-sand/40 flex items-center justify-between">
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
                                    })
                                ) : (
                                    <div className="col-span-full py-32 flex flex-col items-center justify-center border-4 border-dashed border-brand-sand/50 rounded-[3rem] bg-white/40 backdrop-blur-sm">
                                        <div className="size-24 rounded-3xl bg-brand-warm flex items-center justify-center text-brand-secondary/40 mb-8 animate-pulse">
                                            <Search className="size-10" />
                                        </div>
                                        <h3 className="text-sm font-black text-brand-text uppercase tracking-[0.3em]">No Match Found</h3>
                                        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-3 text-center max-w-sm px-8">
                                            {data.courier_id 
                                                ? "No boxes found for this courier's hub area. Try clearing the courier selection to view other areas."
                                                : "We couldn't find any boxes matching your criteria. Try adjusting your filters or checking the warehouse status."}
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
