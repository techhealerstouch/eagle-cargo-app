import { Head, Link, useForm, router, usePage } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { BookOpen, Plus, Pencil, CheckCircle, UserPlus, Search, Ban, CheckSquare, Eye, Clock, Package, Ship, Truck, ListFilter, AlertTriangle, Calendar, MapPin, User, FileText, DollarSign, Sparkles, Upload } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import ActiveFilterChips from '@/components/common/active-filter-chips';
import ConfirmModal from '@/components/common/confirm-modal';
import BookingExportModal from '@/components/bookings/booking-export-modal';
import ExcelImportModal from '@/components/common/excel-import-modal';
import FilterSelect from '@/components/common/filter-select';
import Heading from '@/components/common/heading';
import Pagination, { PaginationData } from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
import SortLink from '@/components/common/sort-link';
import TableSelectionBar from '@/components/common/table-selection-bar';
import BookingBulkUpdateModal from '@/components/admin/booking-bulk-update-modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';
import * as bookingRoutes from '@/routes/admin/bookings';
import type { BreadcrumbItem } from '@/types';

interface Booking {
    id: number;
    reference_number: string;
    sender_id: number;
    sender: {
        first_name: string;
        last_name: string;
        mobile?: string | null;
        user_id?: number | null;
    };
    status: string;
    booking_type: string;
    payment_status: string;
    service_type: string;
    destination: string;
    preferred_date: string | null;
    is_guest?: boolean;
    is_potential_duplicate?: boolean;
    has_completed_pickup_runsheet?: boolean;
    has_active_pickup_runsheet?: boolean;
    has_active_delivery_runsheet?: boolean;
    warehouse_handoff_completed?: boolean;
    can_assign_picker?: boolean;
    can_assign_courier?: boolean;
    picker_assignment_block_reason?: string | null;
    courier_assignment_block_reason?: string | null;
    assignment_block_reason?: string | null;
    declaration_form_status: string;
    declaration_data?: any;
    box_count: number;
    admin_notes?: string | null;
    created_at: string;
    runsheets?: {
        id: number;
        courier?: {
            name: string;
        };
    }[];
    deleted_at?: string | null;
}

interface Courier {
    id: number;
    name: string;
    email?: string;
    active_runsheet_count?: number;
    picker?: { id: number; user_id: number; mobile?: string } | null;
    courier?: { id: number; user_id: number; mobile?: string } | null;
}

interface Runsheet {
    id: number;
    runsheet_number: string;
    status: string;
    courier?: {
        name: string;
    };
    picker?: {
        name: string;
    };
}

type BookingsPagination = PaginationData & { data: Booking[] };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Bookings', href: '/admin/bookings' },
];

const isNewBooking = (createdAt: string) => {
    const createdDate = new Date(createdAt);
    const now = new Date();
    return now.getTime() - createdDate.getTime() < 24 * 60 * 60 * 1000;
};

export default function BookingsIndex({
    bookings,
    pickers,
    couriers,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    activeRunsheets = [],
    filters = { search: '', status: 'all', sort: 'created_at', direction: 'desc', trashed: false },
}: {
    bookings: BookingsPagination;
    pickers: Courier[];
    couriers: Courier[];
    activeRunsheets?: Runsheet[];
    filters?: {
        search?: string;
        status?: string;
        payment_status?: string;
        booking_type?: string;
        declaration_form_status?: string;
        customer_type?: string;
        sort?: string;
        direction?: string;
        trashed?: boolean | string;
    };
}) {
    const { post, processing, data: formData, setData } = useForm({
        picker_id: '',
        courier_id: '',
    });

    const { flash, auth } = usePage<any>().props;
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (flash?.success) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSuccessMessage(flash.success);
            setShowSuccessModal(true);
        }
    }, [flash]);

    const triggerSuccess = (message: string) => {
        setSuccessMessage(message);
        setShowSuccessModal(true);
    };

    const [isAssignPickerModalOpen, setIsAssignPickerModalOpen] = useState(false);
    const [isAssignCourierModalOpen, setIsAssignCourierModalOpen] = useState(false);
    const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
    const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isGlobalSelection, setIsGlobalSelection] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');
    const [courierSearch, setCourierSearch] = useState('');
    const [isBulkAcceptModalOpen, setIsBulkAcceptModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isBulkCancelModalOpen, setIsBulkCancelModalOpen] = useState(false);
    const [isSingleCancelModalOpen, setIsSingleCancelModalOpen] = useState(false);
    const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

    const filteredPickers = pickers.filter(picker =>
        picker.name.toLowerCase().includes(pickerSearch.toLowerCase())
    );

    const filteredCouriers = couriers.filter(courier =>
        courier.name.toLowerCase().includes(courierSearch.toLowerCase())
    );

    const handleStatusChange = (status: string) => {
        router.get('/admin/bookings', { ...filters, status: status === 'all' ? '' : status }, { preserveState: true });
    };

    const openAcceptModal = (id: number) => {
        setSelectedBookingId(id);
        setAdminNotes('');
        setIsAcceptModalOpen(true);
    };

    const handleAcceptConfirm = () => {
        if (!selectedBookingId) {
            return;
        }

        setIsProcessing(true);
        router.post(bookingRoutes.accept.url(selectedBookingId), {
            admin_notes: adminNotes,
        }, {
            onSuccess: (page) => {
                if (page.props.flash?.error) {
                    return;
                }

                setIsAcceptModalOpen(false);
                setSelectedBookingId(null);
                setAdminNotes('');
                triggerSuccess('Booking accepted successfully');
            },
            onError: () => {
                toast.error('Failed to accept booking');
            },
            onFinish: () => setIsProcessing(false),
        });
    };

    const toggleSelect = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(item => item !== id));
            setIsGlobalSelection(false);
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === bookings.data.length) {
            setSelectedIds([]);
            setIsGlobalSelection(false);
        } else {
            setSelectedIds(bookings.data.map(b => b.id));
        }
    };

    const handleSingleCancelConfirm = () => {
        if (!selectedBookingId) return;

        setIsProcessing(true);
        router.post(`/admin/bookings/bulk-cancel`, {
            ids: [selectedBookingId],
        }, {
            onSuccess: (page) => {
                if (page.props.flash?.error) {
                    return;
                }

                setSelectedBookingId(null);
                setIsSingleCancelModalOpen(false);
                triggerSuccess('Booking cancelled successfully');
            },
            onError: () => {
                toast.error('Failed to cancel booking');
            },
            onFinish: () => setIsProcessing(false),
        });
    };

    const handleArchiveConfirm = () => {
        if (!selectedBookingId) return;

        setIsProcessing(true);
        router.delete(`/admin/bookings/${selectedBookingId}`, {
            onSuccess: (page) => {
                if (page.props.flash?.error) {
                    return;
                }

                setSelectedBookingId(null);
                setIsArchiveModalOpen(false);
                triggerSuccess('Booking archived successfully');
            },
            onError: () => {
                toast.error('Failed to archive booking');
            },
            onFinish: () => setIsProcessing(false),
        });
    };

    const handleRestoreConfirm = () => {
        if (!selectedBookingId) return;

        setIsProcessing(true);
        router.post(`/admin/bookings/${selectedBookingId}/restore`, {}, {
            onSuccess: (page) => {
                if (page.props.flash?.error) {
                    return;
                }

                setSelectedBookingId(null);
                setIsRestoreModalOpen(false);
                triggerSuccess('Booking restored successfully');
            },
            onError: () => {
                toast.error('Failed to restore booking');
            },
            onFinish: () => setIsProcessing(false),
        });
    };

    const selectedBookings = bookings.data.filter(b => selectedIds.includes(b.id));
    const selectedBooking = bookings.data.find(b => b.id === selectedBookingId);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Bookings | Admin" />

            <Dialog open={isAcceptModalOpen} onOpenChange={(open) => {
                setIsAcceptModalOpen(open);
                if (!open) {
                    setSelectedBookingId(null);
                    setAdminNotes('');
                }
            }}>
                <DialogContent className="sm:max-w-lg rounded-xl p-5 bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-zinc-900 font-semibold text-lg">
                            <CheckCircle className="size-5 text-emerald-600" />
                            Accept Booking
                        </DialogTitle>
                        <DialogDescription className="text-xs text-zinc-500 mt-1">
                            Confirming booking {selectedBooking?.reference_number}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedBooking && (
                        <div className="space-y-4 py-2">
                            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-zinc-500 block">Sender</span>
                                        <p className="font-semibold text-zinc-900">
                                            {selectedBooking.sender.first_name} {selectedBooking.sender.last_name}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 block">Box Count</span>
                                        <p className="font-semibold text-zinc-900">
                                            {selectedBooking.box_count} {selectedBooking.box_count === 1 ? 'Box' : 'Boxes'}
                                        </p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-zinc-500 block">Destination</span>
                                        <p className="font-medium text-zinc-800">
                                            {selectedBooking.destination}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-zinc-700">
                                    Internal Admin Notes (Optional)
                                </label>
                                <textarea
                                    placeholder="Add any notes..."
                                    value={adminNotes}
                                    onChange={e => setAdminNotes(e.target.value)}
                                    className="flex min-h-20 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setIsAcceptModalOpen(false);
                                setSelectedBookingId(null);
                                setAdminNotes('');
                            }}
                            className="h-9 rounded-lg px-4 text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleAcceptConfirm}
                            disabled={isProcessing}
                            className="h-9 rounded-lg px-4 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
                        >
                            {isProcessing ? 'Accepting...' : 'Confirm Accept'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmModal
                isOpen={isSingleCancelModalOpen}
                onClose={() => {
                    setIsSingleCancelModalOpen(false);
                    setSelectedBookingId(null);
                }}
                onConfirm={handleSingleCancelConfirm}
                title="Cancel Booking"
                description={selectedBooking
                    ? `Cancel booking ${selectedBooking.reference_number}? Current logistics status: ${selectedBooking.status}. Current payment status: ${selectedBooking.payment_status}. Cancellation bypasses normal workflow progression and may affect active operational work.`
                    : 'Cancel this booking?'}
                confirmText="Cancel Booking"
                variant="destructive"
                loading={isProcessing}
            />

            <ConfirmModal
                isOpen={isArchiveModalOpen}
                onClose={() => {
                    setIsArchiveModalOpen(false);
                    setSelectedBookingId(null);
                }}
                onConfirm={handleArchiveConfirm}
                title="Archive Booking"
                description={`Are you sure you want to archive booking ${selectedBooking?.reference_number || ''}? It can be viewed under the trashed filter or restored later.`}
                confirmText="Archive"
                variant="warning"
                loading={isProcessing}
            />

            <ConfirmModal
                isOpen={isRestoreModalOpen}
                onClose={() => {
                    setIsRestoreModalOpen(false);
                    setSelectedBookingId(null);
                }}
                onConfirm={handleRestoreConfirm}
                title="Restore Booking"
                description={`Are you sure you want to restore booking ${selectedBooking?.reference_number || ''}?`}
                confirmText="Restore"
                variant="success"
                loading={isProcessing}
            />

            <ExcelImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Bookings"
                description="Upload an Excel (.xlsx) file to create new or update existing bookings."
                importUrl="/admin/bookings/import-excel"
                templateUrl="/admin/bookings/import-template"
                entityName="Bookings"
            />

            <div className="flex h-full flex-1 flex-col gap-5 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-zinc-200/80 pb-5">
                    <Heading
                        eyebrow="Operations Management"
                        title="Logistics Bookings"
                        description="Manage sender box bookings, schedules, and carrier assignments."
                    />
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <BookingExportModal
                            exportUrl="/admin/bookings/export-excel"
                            selectedIds={selectedIds}
                            filters={filters}
                            label="Export"
                            size="sm"
                        />
                        {/* <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsImportModalOpen(true)}
                            className="gap-1.5"
                        >
                            <Upload className="size-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Import</span>
                        </Button> */}
                        <Link
                            href="/admin/bookings/create"
                            className="h-8 px-3 rounded-lg bg-brand-rust text-white text-xs font-medium hover:bg-brand-rust/90 flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
                        >
                            <Plus className="size-3.5" />
                            New Booking
                        </Link>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    {/* Status Filter Tabs */}
                    <Tabs
                        value={filters.trashed ? 'trashed' : (filters.status || 'all')}
                        onValueChange={(value) => {
                            if (value === 'trashed') {
                                router.get('/admin/bookings', { trashed: true }, { preserveState: true });
                            } else {
                                router.get(
                                    '/admin/bookings',
                                    { ...filters, status: value === 'all' ? '' : value, trashed: undefined },
                                    { preserveState: true }
                                );
                            }
                        }}
                        className="w-full"
                    >
                        <TabsList className="h-10 inline-flex items-center gap-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 p-1 w-auto overflow-x-auto">
                            <TabsTrigger value="all" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs gap-1.5">
                                <ListFilter className="size-3.5" />
                                All
                            </TabsTrigger>
                            <TabsTrigger value="pending" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs gap-1.5">
                                <Clock className="size-3.5" />
                                Pending
                            </TabsTrigger>
                            <TabsTrigger value="confirmed" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs gap-1.5">
                                <CheckCircle className="size-3.5" />
                                Confirmed
                            </TabsTrigger>
                            <TabsTrigger value="collected" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs gap-1.5">
                                <Package className="size-3.5" />
                                Collected
                            </TabsTrigger>
                            <TabsTrigger value="shipped" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs gap-1.5">
                                <Ship className="size-3.5" />
                                Shipped
                            </TabsTrigger>
                            <TabsTrigger value="delivered" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs gap-1.5">
                                <Truck className="size-3.5" />
                                Delivered
                            </TabsTrigger>
                            <TabsTrigger value="cancelled" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs gap-1.5">
                                <Ban className="size-3.5" />
                                Cancelled
                            </TabsTrigger>
                            {auth?.user?.role === 'super_admin' && (
                                <TabsTrigger value="trashed" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs gap-1.5">
                                    <AlertTriangle className="size-3.5" />
                                    Archived
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-1 flex-wrap items-end gap-2.5">
                            <SearchFilter
                                label="Search"
                                routeName="/admin/bookings"
                                queryParams={filters}
                                placeholder="Search reference or sender..."
                            />
                            <FilterSelect
                                label="Payment"
                                routeName="/admin/bookings"
                                paramName="payment_status"
                                queryParams={filters}
                                placeholder="All Payments"
                                options={[
                                    { label: 'Paid', value: 'paid' },
                                    { label: 'Unpaid', value: 'unpaid' },
                                    { label: 'Partial', value: 'partial' },
                                ]}
                            />
                            <FilterSelect
                                label="Declaration"
                                routeName="/admin/bookings"
                                paramName="declaration_form_status"
                                queryParams={filters}
                                placeholder="All Forms"
                                options={[
                                    { label: 'Missing', value: 'missing' },
                                    { label: 'Submitted (Any)', value: 'submitted' },
                                    { label: 'Submitted Online', value: 'submitted_online' },
                                    { label: 'Physical Copy', value: 'physical_copy_received' },
                                ]}
                            />
                            <FilterSelect
                                label="Customer"
                                routeName="/admin/bookings"
                                paramName="customer_type"
                                queryParams={filters}
                                placeholder="All Customers"
                                options={[
                                    { label: 'Guest Bookings', value: 'guest' },
                                    { label: 'Registered Members', value: 'registered' },
                                ]}
                            />
                        </div>
                    </div>

                    <ActiveFilterChips
                        routeName="/admin/bookings"
                        queryParams={filters}
                    />
                </div>

                <div className="card overflow-hidden shadow-xs">
                    {bookings.data.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-border bg-brand-warm/10 dark:bg-brand-warm/20 text-xs font-semibold text-brand-text-mid">
                                        <th scope="col" className="px-4 py-3 w-10">
                                            <Checkbox
                                                checked={selectedIds.length === bookings.data.length && bookings.data.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                                aria-label="Select all"
                                                className="size-4 rounded border-border"
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Reference</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Sender / Box Count</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Destination</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Form</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Payment</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Schedule</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Internal Note</th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-xs font-normal">
                                    {bookings.data.map((booking) => {
                                        const isNew = isNewBooking(booking.created_at);

                                        return (
                                            <tr
                                                key={booking.id}
                                                className={`transition-colors ${
                                                    selectedIds.includes(booking.id)
                                                        ? 'bg-brand-warm/30 dark:bg-brand-warm/40'
                                                        : 'hover:bg-brand-cream/20 dark:hover:bg-brand-warm/20'
                                                }`}
                                            >
                                                <td className="px-4 py-3.5">
                                                    <Checkbox
                                                        checked={selectedIds.includes(booking.id)}
                                                        onCheckedChange={() => toggleSelect(booking.id)}
                                                        aria-label={`Select booking ${booking.reference_number}`}
                                                        className="size-4 rounded border-border"
                                                    />
                                                </td>
                                                <td className="px-4 py-3.5 font-semibold text-brand-text">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <Link href={`/admin/bookings/${booking.id}`} className="font-mono text-xs font-semibold text-brand-text hover:text-brand-rust transition-colors">
                                                            {booking.reference_number}
                                                        </Link>
                                                        <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground border border-border uppercase">
                                                            {humanize(booking.booking_type || 'home_pickup')}
                                                        </span>
                                                        {Boolean(booking.is_guest || !booking.sender?.user_id) && (
                                                            <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                Guest
                                                            </span>
                                                        )}
                                                        {isNew && (
                                                            <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                New
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-brand-text-light/60 block font-normal mt-0.5">
                                                        {formatDistanceToNow(new Date(booking.created_at), { addSuffix: true })}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-brand-text">{booking.sender.first_name} {booking.sender.last_name}</span>
                                                        <span className="text-brand-text-mid text-[11px] font-normal mt-0.5">
                                                            {booking.box_count} {booking.box_count === 1 ? 'Box' : 'Boxes'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-brand-text-mid">
                                                    {booking.destination}
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border capitalize">
                                                        {humanize(booking.status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                                        booking.declaration_form_status === 'submitted_online' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' :
                                                        booking.declaration_form_status === 'physical_copy_received' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                                                        'bg-muted text-muted-foreground border border-border'
                                                    }`}>
                                                        {booking.declaration_form_status === 'missing' ? 'Missing' :
                                                         booking.declaration_form_status === 'submitted_online' ? 'Digital' : 'Physical'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                                         booking.payment_status === 'paid' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                                                         booking.payment_status === 'pending' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                                                         'bg-muted text-muted-foreground border border-border'
                                                    }`}>
                                                        {humanize(booking.payment_status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-brand-text-mid whitespace-nowrap">
                                                    {booking.preferred_date
                                                        ? new Date(booking.preferred_date).toLocaleDateString()
                                                        : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3.5 text-brand-text-mid max-w-[150px] truncate" title={booking.admin_notes || ''}>
                                                    {booking.admin_notes ? (
                                                        <span className="text-xs">{booking.admin_notes}</span>
                                                    ) : (
                                                        <span className="text-xs text-brand-text-light/60 italic">None</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                    <div className="flex justify-end items-center gap-1.5">
                                                        {/* Primary Action Button */}
                                                        {booking.status === 'pending' && (
                                                            <div className="flex items-center gap-1.5">
                                                                {booking.declaration_form_status !== 'missing' && (
                                                                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" title="Declaration Ready" />
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => openAcceptModal(booking.id)}
                                                                    className="h-8 px-3 text-xs font-medium rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 transition-colors shadow-2xs gap-1.5"
                                                                >
                                                                    <CheckCircle className="size-3.5" />
                                                                    Accept
                                                                </Button>
                                                            </div>
                                                        )}

                                                        {booking.status === 'confirmed' && !booking.has_completed_pickup_runsheet && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => router.get('/admin/runsheets/create', { type: 'pickup', booking_id: booking.id })}
                                                                disabled={!booking.can_assign_picker}
                                                                className={`h-8 px-3 text-xs font-medium rounded-lg gap-1.5 transition-colors shadow-2xs ${
                                                                    booking.can_assign_picker
                                                                        ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/80 hover:bg-amber-100/80 dark:hover:bg-amber-900/50'
                                                                        : 'text-brand-text-light/50 bg-muted/50 border-border cursor-not-allowed'
                                                                }`}
                                                            >
                                                                <UserPlus className="size-3.5" />
                                                                Assign
                                                            </Button>
                                                        )}

                                                        {booking.status === 'confirmed' && booking.can_assign_courier && !booking.deleted_at && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => router.get('/admin/runsheets/create', { type: 'delivery', booking_id: booking.id })}
                                                                className="h-8 px-3 text-xs font-medium rounded-lg text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-800/80 hover:bg-blue-100/80 dark:hover:bg-blue-900/50 transition-colors shadow-2xs gap-1.5"
                                                            >
                                                                <UserPlus className="size-3.5" />
                                                                Assign
                                                            </Button>
                                                        )}

                                                        {/* Secondary Icon Action Buttons */}
                                                        {booking.deleted_at && auth?.user?.role === 'super_admin' ? (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                title="Restore booking"
                                                                className="h-8 px-3 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 rounded-lg shadow-2xs"
                                                                onClick={() => {
                                                                    setSelectedBookingId(booking.id);
                                                                    setIsRestoreModalOpen(true);
                                                                }}
                                                            >
                                                                Restore
                                                            </Button>
                                                        ) : (
                                                            <>
                                                                <Link
                                                                    href={`/admin/bookings/${booking.id}`}
                                                                    title="View details"
                                                                    className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-brand-rust hover:bg-brand-warm/50 hover:border-brand-sand dark:hover:border-border transition-all flex items-center justify-center shadow-2xs"
                                                                >
                                                                    <Eye className="size-3.5" />
                                                                </Link>

                                                                <Link
                                                                    href={`/admin/bookings/${booking.id}/edit`}
                                                                    title="Edit booking"
                                                                    className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-brand-rust hover:bg-brand-warm/50 hover:border-brand-sand dark:hover:border-border transition-all flex items-center justify-center shadow-2xs"
                                                                >
                                                                    <Pencil className="size-3.5" />
                                                                </Link>

                                                                {['pending', 'draft', 'confirmed'].includes(booking.status) && (
                                                                    <button
                                                                        type="button"
                                                                        title="Cancel booking"
                                                                        className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 dark:hover:border-red-800 transition-all flex items-center justify-center shadow-2xs"
                                                                        onClick={() => {
                                                                            setSelectedBookingId(booking.id);
                                                                            setIsSingleCancelModalOpen(true);
                                                                        }}
                                                                    >
                                                                        <Ban className="size-3.5" />
                                                                    </button>
                                                                )}

                                                                {auth?.user?.role === 'super_admin' && (
                                                                    <button
                                                                        type="button"
                                                                        title="Archive booking (Super Admin)"
                                                                        className="h-8 w-8 rounded-lg border border-border bg-card text-brand-text-mid hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-200 dark:hover:border-amber-800 transition-all flex items-center justify-center shadow-2xs"
                                                                        onClick={() => {
                                                                            setSelectedBookingId(booking.id);
                                                                            setIsArchiveModalOpen(true);
                                                                        }}
                                                                    >
                                                                        <AlertTriangle className="size-3.5" />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-4 py-8 text-center text-xs text-brand-text-light/60 italic">
                            No bookings found.
                        </div>
                    )}

                    <Pagination data={bookings} />
                </div>
            </div>

            <TableSelectionBar
                selectedCount={selectedIds.length}
                totalCount={bookings.total}
                isGlobalSelection={isGlobalSelection}
                onToggleGlobal={setIsGlobalSelection}
                onClear={() => {
                    setSelectedIds([]);
                    setIsGlobalSelection(false);
                }}
                actions={[
                    {
                        label: 'Update Selected',
                        icon: Sparkles,
                        onClick: () => setIsBulkUpdateModalOpen(true),
                    }
                ]}
            />

            <BookingBulkUpdateModal
                isOpen={isBulkUpdateModalOpen}
                onClose={() => setIsBulkUpdateModalOpen(false)}
                selectedIds={selectedIds}
                isGlobalSelection={isGlobalSelection}
                filters={filters}
                bookingsData={bookings.data}
                onSuccessCallback={() => {
                    setSelectedIds([]);
                    setIsGlobalSelection(false);
                }}
            />
        </AppLayout>
    );
}
