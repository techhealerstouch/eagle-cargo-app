import React, { useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type {
    CalendarEvent,
    CalendarEventType,
    CalendarEventCategory,
    CalendarEventVisibility,
    PickupZoneOption,
    AreaOption,
    BatchOption,
} from '@/types/calendar';
import {
    Calendar as CalendarIcon,
    Clock,
    AlertOctagon,
    Tag,
    MapPin,
    Eye,
    Palette,
    Check,
    Loader2,
    Layers,
    Building2,
} from 'lucide-react';
import { format } from 'date-fns';

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    event?: CalendarEvent | null;
    initialDate?: Date | null;
    pickupZones?: PickupZoneOption[];
    areas?: AreaOption[];
    batches?: BatchOption[];
    categories: { value: string; label: string }[];
    eventTypes: { value: string; label: string; defaultColor: string }[];
    visibilities: { value: string; label: string }[];
}

const COLOR_PRESETS = [
    { name: 'Indigo', hex: '#6366F1' },
    { name: 'Blue', hex: '#2563EB' },
    { name: 'Sky', hex: '#0284C7' },
    { name: 'Teal', hex: '#0D9488' },
    { name: 'Emerald', hex: '#059669' },
    { name: 'Amber', hex: '#D97706' },
    { name: 'Rose', hex: '#E11D48' },
    { name: 'Red', hex: '#DC2626' },
    { name: 'Purple', hex: '#7C3AED' },
    { name: 'Slate', hex: '#475569' },
];

export function EventModal({
    isOpen,
    onClose,
    event,
    initialDate,
    pickupZones = [],
    areas = [],
    batches = [],
    categories,
    eventTypes,
    visibilities,
}: EventModalProps) {
    const isEditing = !!event?.id;

    const defaultStartDate = initialDate
        ? format(initialDate, "yyyy-MM-dd'T'09:00")
        : format(new Date(), "yyyy-MM-dd'T'09:00");

    const defaultEndDate = initialDate
        ? format(initialDate, "yyyy-MM-dd'T'17:00")
        : format(new Date(), "yyyy-MM-dd'T'17:00");

    const { data, setData, post, put, transform, processing, errors, reset, clearErrors } = useForm({
        title: '',
        description: '',
        event_type: 'custom' as CalendarEventType,
        category: 'operations' as CalendarEventCategory,
        visibility: 'public' as CalendarEventVisibility,
        start_date: defaultStartDate,
        end_date: defaultEndDate,
        is_all_day: true,
        is_blocking: false,
        color_hex: '#6366F1',
        badge_label: '',
        location: '',
        batch_id: '' as string | number,
        pickup_zone_id: '' as string | number,
        area_id: '' as string | number,
    });

    useEffect(() => {
        if (isOpen) {
            clearErrors();
            if (event) {
                setData({
                    title: event.title || '',
                    description: event.description || '',
                    event_type: event.event_type || 'custom',
                    category: event.category || 'operations',
                    visibility: event.visibility || 'public',
                    start_date: event.start_date
                        ? (event.is_all_day
                            ? format(new Date(event.start_date), 'yyyy-MM-dd')
                            : format(new Date(event.start_date), "yyyy-MM-dd'T'HH:mm"))
                        : defaultStartDate,
                    end_date: event.end_date
                        ? (event.is_all_day
                            ? format(new Date(event.end_date), 'yyyy-MM-dd')
                            : format(new Date(event.end_date), "yyyy-MM-dd'T'HH:mm"))
                        : defaultEndDate,
                    is_all_day: Boolean(event.is_all_day),
                    is_blocking: Boolean(event.is_blocking),
                    color_hex: event.color_hex || '#6366F1',
                    badge_label: event.badge_label || '',
                    location: event.location || '',
                    batch_id: event.batch_id ? String(event.batch_id) : '',
                    pickup_zone_id: event.pickup_zone_id ? String(event.pickup_zone_id) : '',
                    area_id: event.area_id ? String(event.area_id) : '',
                });
            } else {
                reset();
                if (initialDate) {
                    const formattedDate = format(initialDate, 'yyyy-MM-dd');
                    const formattedDateTime = format(initialDate, "yyyy-MM-dd'T'09:00");
                    setData((prev) => ({
                        ...prev,
                        start_date: formattedDate,
                        end_date: formattedDate,
                    }));
                }
            }
        }
    }, [isOpen, event, initialDate]);

    const handleEventTypeChange = (typeVal: CalendarEventType) => {
        const matched = eventTypes.find((t) => t.value === typeVal);
        setData((prev) => ({
            ...prev,
            event_type: typeVal,
            color_hex: matched ? matched.defaultColor : prev.color_hex,
        }));
    };

    const handleAllDayToggle = (checked: boolean) => {
        setData((prev) => {
            let start = prev.start_date;
            let end = prev.end_date;

            if (checked) {
                // Convert to YYYY-MM-DD
                if (start.includes('T')) start = start.split('T')[0];
                if (end.includes('T')) end = end.split('T')[0];
            } else {
                // Convert to YYYY-MM-DDTHH:mm
                if (!start.includes('T')) start = `${start}T09:00`;
                if (!end.includes('T')) end = `${end}T17:00`;
            }

            return {
                ...prev,
                is_all_day: checked,
                start_date: start,
                end_date: end,
            };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        transform((currentData) => {
            let start = currentData.start_date;
            let end = currentData.end_date;

            if (currentData.is_all_day) {
                if (!start.includes('T')) start = `${start} 00:00:00`;
                if (end && !end.includes('T')) end = `${end} 23:59:59`;
            }

            return {
                ...currentData,
                start_date: start,
                end_date: end || null,
                batch_id: currentData.batch_id ? Number(currentData.batch_id) : null,
                pickup_zone_id: currentData.pickup_zone_id ? Number(currentData.pickup_zone_id) : null,
                area_id: currentData.area_id ? Number(currentData.area_id) : null,
            };
        });

        if (isEditing && event) {
            put(`/admin/calendar/${event.id}`, {
                onSuccess: () => onClose(),
            });
        } else {
            post('/admin/calendar', {
                onSuccess: () => onClose(),
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl border">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b bg-card">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: data.color_hex }}
                        />
                        <DialogTitle className="text-xl font-bold tracking-tight">
                            {isEditing ? 'Edit Calendar Event' : 'Create Custom Event'}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-sm text-muted-foreground mt-1">
                        {isEditing
                            ? 'Update event details, scheduling, blackout constraints, or audience visibility.'
                            : 'Add a new schedule item, public holiday, marketing promotion, or operational closure.'}
                    </DialogDescription>
                </DialogHeader>

                {/* Form Body with Scroll Container */}
                <form id="calendar-event-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                    {/* Section 1: Title & Type */}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Event Title <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="title"
                                value={data.title}
                                onChange={(e) => setData('title', e.target.value)}
                                placeholder="e.g. Pasko Early Bird Promo / Good Friday Operations Closure"
                                className="h-10 text-sm font-medium"
                                required
                            />
                            {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5 min-w-0">
                                <Label htmlFor="event_type" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Event Type <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={data.event_type}
                                    onValueChange={(val) => handleEventTypeChange(val as CalendarEventType)}
                                >
                                    <SelectTrigger id="event_type" className="h-10 w-full min-w-0">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {eventTypes.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full"
                                                        style={{ backgroundColor: type.defaultColor }}
                                                    />
                                                    <span>{type.label}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.event_type && <p className="text-xs text-red-500">{errors.event_type}</p>}
                            </div>

                            <div className="space-y-1.5 min-w-0">
                                <Label htmlFor="category" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Category <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={data.category}
                                    onValueChange={(val) => setData('category', val as CalendarEventCategory)}
                                >
                                    <SelectTrigger id="category" className="h-10 w-full min-w-0">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Date & Operational Rules Card */}
                    <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
                        {/* Switches Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-border/60">
                            <div className="flex items-center justify-between p-2.5 bg-background rounded-lg border min-w-0">
                                <div className="space-y-0.5 pr-2">
                                    <Label htmlFor="is_all_day" className="cursor-pointer font-medium text-sm flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-primary" />
                                        All Day Event
                                    </Label>
                                    <p className="text-xs text-muted-foreground">Applies to the entire day</p>
                                </div>
                                <Switch
                                    id="is_all_day"
                                    checked={data.is_all_day}
                                    onCheckedChange={handleAllDayToggle}
                                />
                            </div>

                            <div className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors min-w-0 ${
                                data.is_blocking ? 'bg-amber-500/10 border-amber-500/30' : 'bg-background'
                            }`}>
                                <div className="space-y-0.5 pr-2">
                                    <Label htmlFor="is_blocking" className={`cursor-pointer font-medium text-sm flex items-center gap-1.5 ${
                                        data.is_blocking ? 'text-amber-700 dark:text-amber-400 font-semibold' : ''
                                    }`}>
                                        <AlertOctagon className={`w-4 h-4 ${data.is_blocking ? 'text-amber-600' : 'text-muted-foreground'}`} />
                                        Blackout (Block Pickups)
                                    </Label>
                                    <p className="text-xs text-muted-foreground">Disallows pickup bookings on this date</p>
                                </div>
                                <Switch
                                    id="is_blocking"
                                    checked={data.is_blocking}
                                    onCheckedChange={(checked) => setData('is_blocking', checked)}
                                />
                            </div>
                        </div>

                        {/* Date Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5 min-w-0">
                                <Label htmlFor="start_date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    {data.is_all_day ? 'Start Date' : 'Start Date & Time'} <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="start_date"
                                    type={data.is_all_day ? 'date' : 'datetime-local'}
                                    value={data.start_date}
                                    onChange={(e) => setData('start_date', e.target.value)}
                                    className="h-10 bg-background w-full"
                                    required
                                />
                                {errors.start_date && <p className="text-xs text-red-500">{errors.start_date}</p>}
                            </div>

                            <div className="space-y-1.5 min-w-0">
                                <Label htmlFor="end_date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    {data.is_all_day ? 'End Date (Optional)' : 'End Date & Time (Optional)'}
                                </Label>
                                <Input
                                    id="end_date"
                                    type={data.is_all_day ? 'date' : 'datetime-local'}
                                    value={data.end_date}
                                    onChange={(e) => setData('end_date', e.target.value)}
                                    className="h-10 bg-background w-full"
                                />
                                {errors.end_date && <p className="text-xs text-red-500">{errors.end_date}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Audience & Styling */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5 min-w-0">
                            <Label htmlFor="visibility" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5" />
                                Audience Visibility <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={data.visibility}
                                onValueChange={(val) => setData('visibility', val as CalendarEventVisibility)}
                            >
                                <SelectTrigger id="visibility" className="h-10 w-full min-w-0">
                                    <SelectValue placeholder="Select visibility" />
                                </SelectTrigger>
                                <SelectContent>
                                    {visibilities.map((vis) => (
                                        <SelectItem key={vis.value} value={vis.value}>
                                            {vis.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">
                                Controls which portal and user roles can view this calendar event.
                            </p>
                            {errors.visibility && <p className="text-xs text-red-500">{errors.visibility}</p>}
                        </div>

                        <div className="space-y-1.5 min-w-0">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5" />
                                Color Tag
                            </Label>
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                                {COLOR_PRESETS.map((col) => {
                                    const isSelected = data.color_hex.toLowerCase() === col.hex.toLowerCase();
                                    return (
                                        <button
                                            type="button"
                                            key={col.hex}
                                            onClick={() => setData('color_hex', col.hex)}
                                            className={`relative w-7 h-7 rounded-full transition-all flex items-center justify-center ${
                                                isSelected
                                                    ? 'ring-2 ring-offset-2 ring-primary scale-110 shadow-sm'
                                                    : 'hover:scale-105 opacity-85 hover:opacity-100'
                                            }`}
                                            style={{ backgroundColor: col.hex }}
                                            title={col.name}
                                        >
                                            {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-sm stroke-[3]" />}
                                        </button>
                                    );
                                })}

                                {/* Custom Color Picker */}
                                <div className="relative inline-flex items-center justify-center">
                                    <label
                                        htmlFor="custom_color_picker"
                                        className="w-7 h-7 rounded-full border-2 border-dashed border-muted-foreground/40 hover:border-primary flex items-center justify-center cursor-pointer transition-colors"
                                        title="Pick Custom Color"
                                        style={{ backgroundColor: data.color_hex }}
                                    >
                                        <input
                                            id="custom_color_picker"
                                            type="color"
                                            value={data.color_hex}
                                            onChange={(e) => setData('color_hex', e.target.value)}
                                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Targeting & Associations */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5 min-w-0">
                            <Label htmlFor="pickup_zone_id" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5" />
                                Target Pickup Zone (Optional)
                            </Label>
                            <Select
                                value={data.pickup_zone_id ? String(data.pickup_zone_id) : 'all'}
                                onValueChange={(val) => setData('pickup_zone_id', val === 'all' ? '' : val)}
                            >
                                <SelectTrigger id="pickup_zone_id" className="h-10 w-full min-w-0">
                                    <SelectValue placeholder="All Pickup Zones (Global)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Pickup Zones (Global)</SelectItem>
                                    {pickupZones.map((zone) => (
                                        <SelectItem key={zone.id} value={String(zone.id)}>
                                            {zone.name} ({zone.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 min-w-0">
                            <Label htmlFor="area_id" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5" />
                                Target Area (Optional)
                            </Label>
                            <Select
                                value={data.area_id ? String(data.area_id) : 'all'}
                                onValueChange={(val) => setData('area_id', val === 'all' ? '' : val)}
                            >
                                <SelectTrigger id="area_id" className="h-10 w-full min-w-0">
                                    <SelectValue placeholder="All Areas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Areas (Unrestricted)</SelectItem>
                                    {areas.map((area) => (
                                        <SelectItem key={area.id} value={String(area.id)}>
                                            {area.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {batches.length > 0 && (
                            <div className="space-y-1.5 min-w-0">
                                <Label htmlFor="batch_id" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5" />
                                    Linked Shipping Batch (Optional)
                                </Label>
                                <Select
                                    value={data.batch_id ? String(data.batch_id) : 'none'}
                                    onValueChange={(val) => setData('batch_id', val === 'none' ? '' : val)}
                                >
                                    <SelectTrigger id="batch_id" className="h-10 w-full min-w-0">
                                        <SelectValue placeholder="None (Standalone Event)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None (Standalone Event)</SelectItem>
                                        {batches.map((batch) => (
                                            <SelectItem key={batch.id} value={String(batch.id)}>
                                                Batch #{batch.batch_number} {batch.container_number ? `(${batch.container_number})` : ''} - {batch.status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-1.5 min-w-0">
                            <Label htmlFor="location" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" />
                                Location / Venue (Optional)
                            </Label>
                            <Input
                                id="location"
                                value={data.location}
                                onChange={(e) => setData('location', e.target.value)}
                                placeholder="e.g. Sydney Warehouse / Blacktown Center"
                                className="h-10 w-full"
                            />
                        </div>
                    </div>

                    {/* Section 5: Description */}
                    <div className="space-y-1.5">
                        <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Event Description & Instructions (Optional)
                        </Label>
                        <Textarea
                            id="description"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Add guidelines, customer notices, special promo terms, or staff instructions..."
                            rows={3}
                            className="text-sm resize-none"
                        />
                        {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                    </div>
                </form>

                {/* Footer */}
                <DialogFooter className="px-6 py-4 bg-muted/40 border-t flex flex-row items-center justify-end gap-2.5">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={processing}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="calendar-event-form"
                        disabled={processing}
                        className="min-w-[120px]"
                    >
                        {processing ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </span>
                        ) : isEditing ? (
                            'Save Changes'
                        ) : (
                            'Create Event'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
