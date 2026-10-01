import React, { useState } from 'react';
import { router, Link } from '@inertiajs/react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CalendarEvent } from '@/types/calendar';
import {
    Calendar as CalendarIcon,
    MapPin,
    AlertOctagon,
    Eye,
    Tag,
    Layers,
    ClipboardList,
    Pencil,
    Trash2,
    Download,
    ExternalLink,
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';

interface EventDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    event?: CalendarEvent | null;
    onEdit?: (event: CalendarEvent) => void;
    canManage?: boolean;
}

export function EventDetailModal({
    isOpen,
    onClose,
    event,
    onEdit,
    canManage = false,
}: EventDetailModalProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    if (!event) return null;

    const formattedStart = event.start_date
        ? format(new Date(event.start_date), event.is_all_day ? 'EEEE, MMMM d, yyyy' : 'EEEE, MMMM d, yyyy • h:mm a')
        : '';

    const formattedEnd = event.end_date && event.end_date !== event.start_date
        ? format(new Date(event.end_date), event.is_all_day ? 'EEEE, MMMM d, yyyy' : 'EEEE, MMMM d, yyyy • h:mm a')
        : null;

    const handleClose = () => {
        setShowDeleteConfirm(false);
        onClose();
    };

    const confirmDelete = () => {
        router.delete(`/admin/calendar/${event.id}`, {
            onSuccess: () => handleClose(),
        });
    };

    const buildGoogleCalendarUrl = () => {
        const title = encodeURIComponent(event.title);
        const details = encodeURIComponent(event.description || '');
        const location = encodeURIComponent(event.location || '');

        let datesStr = '';
        if (event.is_all_day) {
            const startDate = parseISO(event.start_date);
            const startClean = format(startDate, 'yyyyMMdd');
            const nextDay = event.end_date ? addDays(parseISO(event.end_date), 1) : addDays(startDate, 1);
            const endClean = format(nextDay, 'yyyyMMdd');
            datesStr = `${startClean}/${endClean}`;
        } else {
            const startDate = parseISO(event.start_date);
            const endDate = event.end_date ? parseISO(event.end_date) : new Date(startDate.getTime() + 3600000);
            const startUtc = startDate.toISOString().replace(/-|:|\.\d+/g, '');
            const endUtc = endDate.toISOString().replace(/-|:|\.\d+/g, '');
            datesStr = `${startUtc}/${endUtc}`;
        }

        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${datesStr}`;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-xl p-0 overflow-hidden shadow-2xl border">
                <DialogHeader className="px-6 pt-6 pb-4 border-b bg-card space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: event.color_hex || '#3B82F6' }}
                        />
                        <Badge variant="outline" className="capitalize text-xs font-semibold">
                            {event.category}
                        </Badge>
                        <Badge variant="secondary" className="capitalize text-xs">
                            {event.event_type.replace('_', ' ')}
                        </Badge>
                        {event.is_blocking && (
                            <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                                <AlertOctagon className="w-3.5 h-3.5" />
                                Blackout (Booking Blocked)
                            </Badge>
                        )}
                    </div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-foreground leading-snug">
                        {event.title}
                    </DialogTitle>
                </DialogHeader>

                <div className="px-6 py-5 space-y-5 text-sm">
                    {/* Time / Date */}
                    <div className="flex items-start gap-3 text-muted-foreground p-3 rounded-lg bg-muted/30 border">
                        <CalendarIcon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                        <div className="space-y-0.5">
                            <p className="font-semibold text-foreground">{formattedStart}</p>
                            {formattedEnd && (
                                <p className="text-xs text-muted-foreground">Until: {formattedEnd}</p>
                            )}
                            {event.is_all_day && (
                                <span className="inline-block text-[11px] bg-background border px-2 py-0.5 rounded text-muted-foreground font-medium mt-1">
                                    All Day Event
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {/* Visibility */}
                        <div className="flex items-center gap-2.5 text-muted-foreground">
                            <Eye className="w-4 h-4 text-primary shrink-0" />
                            <span className="capitalize text-xs">
                                Visibility: <strong className="text-foreground font-medium">{event.visibility.replace('_', ' ')}</strong>
                            </span>
                        </div>

                        {/* Target Zone */}
                        {event.pickup_zone ? (
                            <div className="flex items-center gap-2.5 text-muted-foreground">
                                <Tag className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-xs">
                                    Target Zone: <strong className="text-foreground font-medium">{event.pickup_zone.name} ({event.pickup_zone.code})</strong>
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5 text-muted-foreground">
                                <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="text-xs">
                                    Target Zone: <strong className="text-foreground font-medium">All Zones (Global)</strong>
                                </span>
                            </div>
                        )}

                        {/* Location */}
                        {event.location && (
                            <div className="flex items-center gap-2.5 text-muted-foreground col-span-full">
                                <MapPin className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-xs text-foreground">{event.location}</span>
                            </div>
                        )}
                    </div>

                    {/* Linked Batch */}
                    {event.batch && (
                        <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/50 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                <div>
                                    <p className="font-semibold text-xs text-indigo-950 dark:text-indigo-200">
                                        Linked Batch #{event.batch.batch_number}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Container: {event.batch.container_number || 'TBA'} • Status: {event.batch.status}
                                    </p>
                                </div>
                            </div>
                            {canManage ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-8 bg-background"
                                    onClick={() => router.visit(`/admin/batches`)}
                                >
                                    View Batch
                                </Button>
                            ) : (
                                <Link href="/book">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-8 bg-background font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                                    >
                                        Book Shipment
                                    </Button>
                                </Link>
                            )}
                        </div>
                    )}

                    {/* Linked Runsheet */}
                    {event.runsheet && canManage && (
                        <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/50 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <div>
                                    <p className="font-semibold text-xs text-emerald-950 dark:text-emerald-200">
                                        Linked {event.runsheet.type === 'pickup' ? 'Pickup' : 'Delivery'} Runsheet #{event.runsheet.id}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Area: {event.runsheet.area_description} • Status: {event.runsheet.status}
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8 bg-background"
                                onClick={() => router.visit(`/admin/runsheets/${event.runsheet?.id}`)}
                            >
                                View Runsheet
                            </Button>
                        </div>
                    )}

                    {/* Description */}
                    {event.description && (
                        <div className="pt-3 border-t space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Description & Notes
                            </p>
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                {event.description}
                            </p>
                        </div>
                    )}

                    {/* Export / Sync Action Strip */}
                    <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                        <a
                            href={buildGoogleCalendarUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex"
                        >
                            <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 bg-background">
                                <ExternalLink className="w-3.5 h-3.5 text-primary" />
                                <span>Google Calendar</span>
                            </Button>
                        </a>

                        <a
                            href={`/calendar/${event.id}/export.ics`}
                            download
                            className="inline-flex"
                        >
                            <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 bg-background">
                                <Download className="w-3.5 h-3.5 text-primary" />
                                <span>Export iCal (.ics)</span>
                            </Button>
                        </a>
                    </div>

                    {/* Creator Info */}
                    {event.creator && (
                        <p className="text-[11px] text-muted-foreground pt-1">
                            Created by {event.creator.name}
                        </p>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 bg-muted/40 border-t flex flex-row items-center justify-between w-full">
                    {showDeleteConfirm ? (
                        <div className="flex items-center justify-between w-full gap-4">
                            <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                Are you sure? This cannot be undone.
                            </p>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="h-9"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={confirmDelete}
                                    className="h-9 gap-1.5"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Yes, delete
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div>
                                {canManage && !event.batch_id && !event.runsheet_id && !event.is_virtual_promo && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5 h-9"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {canManage && event.is_virtual_promo && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            handleClose();
                                            router.visit('/admin/promotions');
                                        }}
                                        className="gap-1.5 h-9 text-fuchsia-600 border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-fuchsia-900/50 dark:text-fuchsia-400 dark:hover:bg-fuchsia-950/50"
                                    >
                                        <Tag className="w-3.5 h-3.5" />
                                        Manage Promotion
                                    </Button>
                                )}
                                {canManage && !event.batch_id && !event.runsheet_id && !event.is_virtual_promo && onEdit && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            handleClose();
                                            onEdit(event);
                                        }}
                                        className="gap-1.5 h-9"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Edit
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={handleClose}
                                    className="h-9"
                                >
                                    Close
                                </Button>
                            </div>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
