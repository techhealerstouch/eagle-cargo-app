import { Head, Link, router, useForm } from '@inertiajs/react';
import { Package, Search, PlusCircle, ArrowRight, User, Edit2, Trash2, AlertCircle, FileEdit, FileText, CheckCircle2, Printer, SlidersHorizontal, CreditCard, Filter, Ban, Tag, Upload, Eye, X, Building2, Loader2, Hash, Copy, Check } from 'lucide-react';
import { useEffect, useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import ConfirmModal from '@/components/common/confirm-modal';
import DeclarationPromptModal from '@/components/common/declaration-prompt-modal';
import Heading from '@/components/common/heading';
import BoxProgressStepper from '@/components/admin/box-progress-stepper';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

export default function Bookings({ sender, history, filters = {}, pageTitle = 'My Bookings', breadcrumbs = [] }: any) {
    const { delete: destroy } = useForm();
    const defaultBreadcrumbs: BreadcrumbItem[] = breadcrumbs.length > 0 ? breadcrumbs : [
        { title: 'Home', href: '/dashboard' },
        { title: 'My Bookings', href: '/bookings' }
    ];
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'confirmed' | 'cancelled'>('all');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ id: number, type: 'cancel' | 'delete' } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const [uploadingProofFor, setUploadingProofFor] = useState<any>(null);
    const [declarationPromptBookingId, setDeclarationPromptBookingId] = useState<number | null>(null);
    const [copiedRef, setCopiedRef] = useState(false);
    const initialUrlHandled = useRef(false);

    const handleCopyReference = (ref: string) => {
        if (!ref) return;
        navigator.clipboard.writeText(ref);
        setCopiedRef(true);
        toast.success(`Reference "${ref}" copied to clipboard!`);
        setTimeout(() => setCopiedRef(false), 2000);
    };

    const cancelBooking = (id: number) => {
        setPendingAction({ id, type: 'cancel' });
        setIsConfirmModalOpen(true);
    };

    const deleteDraft = (id: number) => {
        setPendingAction({ id, type: 'delete' });
        setIsConfirmModalOpen(true);
    };

    const handleConfirmAction = () => {
        if (!pendingAction) {
            return;
        }

        setIsProcessing(true);
        destroy(`/bookings/${pendingAction.id}`, {
            onSuccess: () => {
                setIsConfirmModalOpen(false);
                setPendingAction(null);
            },
            onFinish: () => setIsProcessing(false),
        });
    };

    const bookings = Array.isArray(history) ? history : history?.data || [];

    useEffect(() => {
        if (initialUrlHandled.current) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const highlight = params.get('highlight');
        const uploadProof = params.get('upload_proof');
        const action = params.get('action');

        const targetRef = uploadProof || highlight;
        if (targetRef) {
            initialUrlHandled.current = true;
            setHighlightedId(targetRef);

            const timerScroll = setTimeout(() => {
                const element = document.getElementById(`booking-${targetRef}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);

            const targetBooking = bookings.find((b: any) =>
                (b.reference_number && b.reference_number.toLowerCase() === targetRef.toLowerCase()) ||
                String(b.id) === targetRef
            );

            if (targetBooking && targetBooking.payment_status !== 'paid') {
                openProofModalFor(targetBooking);
            }

            const timerClear = setTimeout(() => {
                setHighlightedId(null);
            }, 5000);

            return () => {
                clearTimeout(timerScroll);
                clearTimeout(timerClear);
            };
        }
    }, [bookings]);
    
    // Status counts
    const statusCounts = useMemo(() => {
        const counts = { all: bookings.length, active: 0, draft: 0, confirmed: 0, cancelled: 0 };
        bookings.forEach((b: any) => {
            const s = (b.status || '').toLowerCase();
            if (s === 'draft') counts.draft++;
            else if (s === 'cancelled') counts.cancelled++;
            else {
                counts.active++;
                if (['confirmed', 'collected', 'shipped', 'partially_delivered', 'delivered'].includes(s)) {
                    counts.confirmed++;
                }
            }
        });
        return counts;
    }, [bookings]);

    const filteredHistory = useMemo(() => {
        let items = [...bookings].sort((a: any, b: any) => {
            if (a.status === 'draft' && b.status !== 'draft') return -1;
            if (a.status !== 'draft' && b.status === 'draft') return 1;
            return 0;
        });

        if (statusFilter !== 'all') {
            if (statusFilter === 'draft') {
                items = items.filter((b: any) => (b.status || '').toLowerCase() === 'draft');
            } else if (statusFilter === 'cancelled') {
                items = items.filter((b: any) => (b.status || '').toLowerCase() === 'cancelled');
            } else if (statusFilter === 'confirmed') {
                items = items.filter((b: any) => ['confirmed', 'collected', 'shipped', 'partially_delivered', 'delivered'].includes((b.status || '').toLowerCase()));
            } else if (statusFilter === 'active') {
                items = items.filter((b: any) => (b.status || '').toLowerCase() !== 'cancelled' && (b.status || '').toLowerCase() !== 'draft');
            }
        }

        return items;
    }, [bookings, statusFilter]);

    // Separate active and cancelled bookings for the "ALL" view
    const mainListBookings = useMemo(() => {
        if (statusFilter === 'cancelled') return [];
        if (statusFilter === 'all') {
            return filteredHistory.filter((b: any) => (b.status || '').toLowerCase() !== 'cancelled');
        }
        return filteredHistory;
    }, [filteredHistory, statusFilter]);

    const cancelledListBookings = useMemo(() => {
        if (statusFilter === 'cancelled') return filteredHistory;
        if (statusFilter === 'all') {
            return filteredHistory.filter((b: any) => (b.status || '').toLowerCase() === 'cancelled');
        }
        return [];
    }, [filteredHistory, statusFilter]);

    useEffect(() => {
        if (searchTerm === (filters.search || '')) {
            return;
        }

        const timeout = window.setTimeout(() => {
            router.get('/bookings', searchTerm ? { search: searchTerm } : {}, {
                preserveState: true,
                replace: true,
                only: ['history', 'filters'],
            });
        }, 300);

        return () => window.clearTimeout(timeout);
    }, [filters.search, searchTerm]);

    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const { data: proofData, setData: setProofData, post: postProof, processing: uploadingProof, errors: proofErrors, reset: resetProof } = useForm({
        proof_of_payment: null as File | null,
        payment_reference: '',
    });

    const openProofModalFor = (booking: any) => {
        setUploadingProofFor(booking);
        setProofData({
            proof_of_payment: null,
            payment_reference: booking.payment_reference || '',
        });
        setProofPreview(null);
    };

    const handleProofFileSelect = (file: File | null) => {
        setProofData('proof_of_payment', file);
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => setProofPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setProofPreview(null);
        }
    };

    const handleCloseProofModal = () => {
        setUploadingProofFor(null);
        resetProof();
        setProofPreview(null);
    };

    const submitProof = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!uploadingProofFor) {
            return;
        }

        if (!proofData.proof_of_payment && !proofData.payment_reference.trim() && !uploadingProofFor.proof_of_payment) {
            toast.error('Please select a receipt file or provide a transaction reference number.');
            return;
        }

        postProof(`/bookings/${uploadingProofFor.id}/upload-proof`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                const targetBooking = uploadingProofFor;
                handleCloseProofModal();
                const isDeclarationMissing = !targetBooking?.declaration_form_status || targetBooking.declaration_form_status === 'missing';
                if (targetBooking?.id && isDeclarationMissing) {
                    setDeclarationPromptBookingId(targetBooking.id);
                }
            },
            onError: (errs) => {
                const firstErr = Object.values(errs)[0];
                toast.error(typeof firstErr === 'string' ? firstErr : 'Failed to submit payment details.');
            },
        });
    };

    const renderBooking = (booking: any) => {
        const bStatus = booking.status?.toLowerCase() || '';
        const isDraft = bStatus === 'draft';
        const isCancelled = bStatus === 'cancelled';
        const isConfirmed = ['confirmed', 'collected', 'shipped', 'partially_delivered', 'delivered'].includes(bStatus);
        const isPending = bStatus === 'pending';

        const isHighlighted = highlightedId === booking.reference_number || highlightedId === String(booking.id);

        return (
            <div
                key={booking.id}
                id={`booking-${booking.reference_number || booking.id}`}
                className={cn(
                    "bg-white dark:bg-zinc-900 rounded-2xl border overflow-hidden transition-all duration-300 shadow-xs group",
                    isHighlighted ? "ring-2 ring-brand-rust border-brand-rust shadow-md" : "border-zinc-200/80 dark:border-zinc-900",
                    isDraft && "border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-50/10 dark:bg-amber-950/10",
                    isCancelled && "border-zinc-200/60 dark:border-zinc-850 bg-zinc-50/30 dark:bg-zinc-900/20 opacity-90"
                )}
            >
                {/* Header Row */}
                <div className={cn(
                    "p-5 md:p-6 border-b flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6",
                    isDraft ? "bg-amber-50/30 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/30" : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-900",
                    isCancelled && "bg-zinc-50/60 dark:bg-zinc-900/40"
                )}>
                    <div className="flex items-center gap-4 min-w-0 w-full xl:w-auto">
                        <div className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-2xs group-hover:scale-105 transition-all duration-300",
                            isDraft ? 'bg-amber-100/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400' :
                            isCancelled ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500' :
                            'bg-zinc-50 dark:bg-zinc-900 border-zinc-200/60 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        )}>
                            {isDraft ? <FileEdit className="size-5" /> : isCancelled ? <Ban className="size-5" /> : <Package className="size-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5 mb-1">
                                <h2 className={cn(
                                    "text-base font-bold tracking-tight uppercase font-mono truncate",
                                    isCancelled ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-900 dark:text-white"
                                )}>
                                    {isDraft ? 'DRAFT BOOKING' : `REF: ${booking.reference_number}`}
                                </h2>
                                <span className={cn(
                                    "px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-colors",
                                    isDraft ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40' :
                                    isCancelled ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40' :
                                    isPending ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40' :
                                    isConfirmed ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40' :
                                    'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                                )}>
                                    {isDraft ? 'DRAFT' : isCancelled ? 'CANCELLED' : isPending ? 'PENDING' : isConfirmed ? 'CONFIRMED' : 'ACTIVE'}
                                </span>
                                {!isDraft && !isCancelled && (booking.promo_code || Number(booking.discount_amount || 0) > 0) && (
                                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40 flex items-center gap-1">
                                        <Tag className="size-3" /> {booking.promo_code || 'Promo Applied'}
                                    </span>
                                )}
                                {!isDraft && !isCancelled && booking.payment_status === 'pending' && (
                                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/40 flex items-center gap-1">
                                        <CreditCard className="size-3" /> Unpaid
                                    </span>
                                )}
                                {!isDraft && !isCancelled && booking.payment_status === 'pending' && booking.proof_of_payment && (
                                    <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40 flex items-center gap-1">
                                        <CheckCircle2 className="size-3" /> Proof Uploaded
                                    </span>
                                )}
                                {!isDraft && !isCancelled && booking.payment_reference && (
                                    <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider rounded-full border bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 flex items-center gap-1 font-mono">
                                        <Hash className="size-3 text-zinc-400" /> Ref: {booking.payment_reference}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 overflow-hidden truncate">
                                {isDraft
                                    ? <>Started {new Date(booking.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })} <span className="text-zinc-300 dark:text-zinc-700">•</span> Saved {new Date(booking.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                                    : <>Booked {new Date(booking.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })} <span className="text-zinc-300 dark:text-zinc-700">•</span> {booking.boxes?.length} Box(es)</>
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
                        {/* Primary Action Button */}
                        {isDraft ? (
                            <Link
                                href="/book"
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-brand-rust px-5 h-10 text-xs font-bold text-white shadow-sm hover:bg-brand-rust/90 transition-all active:scale-95"
                            >
                                <FileEdit className="size-3.5" /> Continue Draft
                            </Link>
                        ) : isCancelled ? (
                            <Link
                                href={`/book?clone_id=${booking.id}`}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-brand-rust px-5 h-10 text-xs font-bold text-white shadow-sm hover:bg-brand-rust/90 transition-all active:scale-95"
                            >
                                <PlusCircle className="size-3.5" /> Rebook
                            </Link>
                        ) : !isCancelled && booking.payment_status === 'pending' ? (
                            <>
                                {booking.payment_method === 'bank_transfer' ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => openProofModalFor(booking)}
                                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-brand-rust px-5 h-10 text-xs font-bold text-white shadow-sm hover:bg-brand-rust/90 transition-all active:scale-95 cursor-pointer"
                                        >
                                            <Upload className="size-3.5" /> {booking.proof_of_payment ? 'Update Proof' : 'Upload Proof'}
                                        </button>
                                        <Link
                                            href={`/bookings/${booking.id}/pay`}
                                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 h-10 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95"
                                        >
                                            <CreditCard className="size-3.5" /> Pay Online
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => openProofModalFor(booking)}
                                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 h-10 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer"
                                        >
                                            <Upload className="size-3.5" /> {booking.proof_of_payment ? 'Update Proof' : 'Upload Proof'}
                                        </button>
                                        <Link
                                            href={`/bookings/${booking.id}/pay`}
                                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-brand-rust px-5 h-10 text-xs font-bold text-white shadow-sm hover:bg-brand-rust/90 transition-all active:scale-95"
                                        >
                                            <CreditCard className="size-3.5" /> Pay Online
                                        </Link>
                                    </>
                                )}
                            </>
                        ) : (
                            <Link
                                href={`/track?tracking_number=${booking.reference_number}`}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-brand-rust px-5 h-10 text-xs font-bold text-white shadow-sm hover:bg-brand-rust/90 transition-all active:scale-95 group/btn"
                            >
                                Track <ArrowRight className="size-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                            </Link>
                        )}

                        {/* Secondary Actions Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    aria-label="Booking options"
                                    title="Booking options"
                                    className="inline-flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 w-10 h-10 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                                >
                                    <SlidersHorizontal className="size-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg">
                                {isPending && booking.payment_status === 'pending' && (
                                    <>
                                        <div className="px-3 py-2 mb-1 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <AlertCircle className="size-3" /> Awaiting Review
                                            </p>
                                        </div>
                                        <DropdownMenuSeparator className="my-1.5 dark:border-zinc-800" />
                                    </>
                                )}

                                {!isCancelled && booking.payment_status === 'pending' && (
                                    <DropdownMenuItem
                                        onClick={() => openProofModalFor(booking)}
                                        className="rounded-xl flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                    >
                                        <Upload className="size-4" /> {booking.proof_of_payment ? 'Update Proof of Payment' : 'Upload Proof of Payment'}
                                    </DropdownMenuItem>
                                )}

                                {booking.proof_of_payment && (
                                    <DropdownMenuItem asChild className="rounded-xl">
                                        <a
                                            href={`/storage/${booking.proof_of_payment}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                        >
                                            <Eye className="size-4" /> View Uploaded Proof
                                        </a>
                                    </DropdownMenuItem>
                                )}

                                {!isCancelled && (
                                    <DropdownMenuItem asChild className="rounded-xl">
                                        <Link href={`/book?clone_id=${booking.id}`} className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                                            <PlusCircle className="size-4" /> Repeat Booking
                                        </Link>
                                    </DropdownMenuItem>
                                )}

                                {isCancelled && (
                                    <DropdownMenuItem asChild className="rounded-xl">
                                        <Link href={`/track?tracking_number=${booking.reference_number}`} className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                                            <Package className="size-4" /> Track Shipment
                                        </Link>
                                    </DropdownMenuItem>
                                )}

                                {booking.declaration_form_status !== 'missing' && (
                                    <DropdownMenuItem asChild className="rounded-xl">
                                        <a
                                            href={`/track/declaration/${booking.id}/view`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                        >
                                            <Printer className="size-4" /> View Declaration
                                        </a>
                                    </DropdownMenuItem>
                                )}

                                {booking.declaration_form_status === 'missing' && !isCancelled && (
                                    <DropdownMenuItem asChild className="rounded-xl">
                                        <a
                                            href={`/track/declaration/${booking.id}`}
                                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer"
                                        >
                                            <FileEdit className="size-4" /> Fill Declaration Form
                                        </a>
                                    </DropdownMenuItem>
                                )}

                                {booking.invoice && (
                                    <DropdownMenuItem asChild className="rounded-xl">
                                        <a
                                            href={`/bookings/${booking.id}/invoice-pdf`}
                                            className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                        >
                                            <FileText className="size-4" /> Download Invoice
                                        </a>
                                    </DropdownMenuItem>
                                )}

                                {isPending && (
                                    <>
                                        <DropdownMenuSeparator className="my-1.5 dark:border-zinc-800" />
                                        <DropdownMenuItem asChild className="rounded-xl">
                                            <Link href={`/bookings/${booking.id}/edit`} className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                                                <Edit2 className="size-4" /> Edit Details
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => cancelBooking(booking.id)}
                                            className="rounded-xl flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer"
                                        >
                                            <Trash2 className="size-4" /> Cancel Booking
                                        </DropdownMenuItem>
                                    </>
                                )}

                                {isDraft && (
                                    <>
                                        <DropdownMenuSeparator className="my-1.5 dark:border-zinc-800" />
                                        <DropdownMenuItem
                                            onClick={() => deleteDraft(booking.id)}
                                            className="rounded-xl flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 cursor-pointer"
                                        >
                                            <Trash2 className="size-4" /> Delete Draft
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Customs Declaration Warning */}
                {booking.declaration_form_status === 'missing' && !isDraft && !isCancelled && (
                    <div className="px-6 py-4 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                <AlertCircle className="size-5" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200">Customs Declaration Required</h4>
                                <p className="text-[11px] text-amber-800 dark:text-amber-300/80 mt-0.5">
                                    Must be submitted <strong>on or before pickup</strong> for box collection.
                                </p>
                            </div>
                        </div>
                        <Link
                            href={`/track/declaration/${booking.id}`}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 h-9 text-xs font-bold text-white hover:bg-amber-700 transition-all shadow-xs active:scale-95 shrink-0"
                        >
                            Complete Form Now <ArrowRight className="size-3.5" />
                        </Link>
                    </div>
                )}

                {/* Card Body: Boxes & Statuses */}
                <div className="p-5 md:p-6 bg-zinc-50/40 dark:bg-zinc-900/20">
                    {isDraft ? (
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-dashed border-amber-200/80 dark:border-amber-900/40">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                                <FileEdit className="size-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-amber-900 dark:text-amber-300">Draft Booking Saved</p>
                                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">Finish entering box and address details to schedule pickup.</p>
                            </div>
                            <Link
                                href="/book"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-rust hover:underline shrink-0"
                            >
                                Resume <ArrowRight className="size-3.5" />
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {booking.boxes?.map((box: any) => {
                                const isDelivered = box.status === 'delivered';
                                const isCancelled = box.status === 'cancelled';

                                return (
                                    <div key={box.id} className="bg-white dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-900 p-5 rounded-2xl flex flex-col justify-between gap-5 hover:border-zinc-300 dark:hover:border-zinc-800 transition-all duration-300 shadow-2xs">
                                        <div className="flex justify-between items-start gap-3">
                                            <div>
                                                <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Tracking Number</div>
                                                <Link href={`/track?tracking_number=${box.tracking_number}`} className="group/track-link inline-flex items-center gap-1.5">
                                                    <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white group-hover/track-link:text-brand-rust transition-colors">{box.tracking_number}</span>
                                                </Link>
                                            </div>
                                            <div className={cn(
                                                "flex h-9 w-9 items-center justify-center rounded-xl border transition-all shadow-2xs",
                                                isDelivered ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-200/60 dark:border-emerald-900/40' : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200/60 dark:border-zinc-800'
                                            )}>
                                                <Package className="size-4.5" />
                                            </div>
                                        </div>

                                        {/* Status Progress Stepper */}
                                        {isCancelled ? (
                                            <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-xl">
                                                <AlertCircle className="size-4 text-zinc-400 shrink-0" />
                                                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Shipment Cancelled</span>
                                            </div>
                                        ) : (
                                            <BoxProgressStepper 
                                                status={box.status} 
                                                trackingStepKey={box.tracking_step_key} 
                                                size="md"
                                                className="w-full" 
                                            />
                                        )}

                                        {/* Recipient Details */}
                                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-900 flex items-center gap-3">
                                            <div className="h-8 w-8 shrink-0 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 flex items-center justify-center text-zinc-400">
                                                <User className="size-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Recipient</div>
                                                <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">{box.recipient?.name || 'Saved Contact'}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={defaultBreadcrumbs}>
            <Head title={`Customer ${pageTitle}`} />

            <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
                {/* Header Banner */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-zinc-200/80 dark:border-zinc-800 pb-6 md:pb-8">
                    <Heading
                        eyebrow="Sender Portal"
                        title={pageTitle}
                        description="Track, resume, and manage all your balikbayan box bookings in one place."
                    />
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                        <div className="relative group flex-1 sm:w-72">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by Ref or Tracking ID..."
                                className="w-full pl-10 pr-4 h-11 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-2xs placeholder:text-zinc-400 text-zinc-900 dark:text-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Link
                            href="/book"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-rust px-6 h-11 text-xs font-semibold text-white shadow-sm hover:bg-brand-rust/90 transition-all duration-300 active:scale-95 shrink-0 group"
                        >
                            <PlusCircle className="h-4 w-4 group-hover:rotate-90 transition-transform duration-500" />
                            New Booking
                        </Link>
                    </div>
                </div>

                {/* Filter Tabs Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-zinc-200/70 dark:border-zinc-800">
                    {(['all', 'active', 'draft', 'confirmed', 'cancelled'] as const).map((tab) => {
                        const count = statusCounts[tab];
                        const isActive = statusFilter === tab;

                        return (
                            <button
                                key={tab}
                                onClick={() => setStatusFilter(tab)}
                                className={cn(
                                    "px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 shrink-0 border uppercase tracking-wider",
                                    isActive
                                        ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white shadow-xs"
                                        : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                )}
                            >
                                {tab}
                                {count > 0 && (
                                    <span className={cn(
                                        "px-1.5 py-0.2 text-[10px] font-bold rounded-full",
                                        isActive ? "bg-white/20 text-white dark:bg-zinc-900 dark:text-zinc-100" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                    )}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Booking List Container */}
                <div className="space-y-8">
                    {/* Main Active/Draft/Confirmed List */}
                    {mainListBookings.length > 0 && (
                        <div className="space-y-5">
                            {mainListBookings.map(renderBooking)}
                        </div>
                    )}

                    {/* Empty State when no main list bookings */}
                    {mainListBookings.length === 0 && cancelledListBookings.length === 0 && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-900 rounded-2xl p-12 md:p-16 text-center shadow-2xs">
                            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-50 dark:bg-zinc-900 mb-4 border border-zinc-200/50 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600">
                                <Search className="size-8" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">No Bookings Found</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs mx-auto leading-relaxed">
                                {searchTerm
                                    ? `No results found matching "${searchTerm}". Try searching for another reference number.`
                                    : `There are currently no bookings in the ${statusFilter} category.`}
                            </p>
                            {!searchTerm && (
                                <Link
                                    href="/book"
                                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-rust px-6 py-2.5 text-xs font-semibold text-white hover:bg-brand-rust/90 transition-all shadow-sm"
                                >
                                    <PlusCircle className="size-4" /> Start a New Booking
                                </Link>
                            )}
                        </div>
                    )}

                    {/* Dedicated Cancelled Bookings Section (Bottom Section for ALL view or direct view for CANCELLED tab) */}
                    {cancelledListBookings.length > 0 && (
                        <div className={cn(
                            "space-y-5",
                            statusFilter === 'all' && "pt-8 border-t border-zinc-200/80 dark:border-zinc-800"
                        )}>
                            {statusFilter === 'all' && (
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                                        <Ban className="size-4 text-zinc-400" />
                                        Cancelled Bookings ({cancelledListBookings.length})
                                    </h3>
                                </div>
                            )}
                            <div className="space-y-5">
                                {cancelledListBookings.map(renderBooking)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {history?.links?.length > 3 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                        {history.links.map((link: any, index: number) =>
                            link.url ? (
                                <Link
                                    key={`${link.label}-${index}`}
                                    href={link.url}
                                    preserveScroll
                                    className={cn(
                                        "rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border",
                                        link.active ? 'bg-brand-rust text-white border-brand-rust' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                                    )}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ) : (
                                <span
                                    key={`${link.label}-${index}`}
                                    className="rounded-xl px-3.5 py-2 text-xs font-semibold text-zinc-300 dark:text-zinc-700 border border-transparent"
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ),
                        )}
                    </div>
                )}
            </div>

            {/* Upload Proof of Payment Modal */}
            <Dialog
                open={!!uploadingProofFor}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseProofModal();
                    }
                }}
            >
                <DialogContent className="max-w-lg p-0 overflow-hidden border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl">
                    {/* Header with accent decoration */}
                    <div className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60">
                        <div className="flex items-center gap-3.5">
                            <div className="h-11 w-11 rounded-2xl bg-brand-rust/10 text-brand-rust flex items-center justify-center shrink-0">
                                <Upload className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                                    Upload Proof of Payment
                                </DialogTitle>
                                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
                                    <span>Booking Ref:</span>
                                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-200/70 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">
                                        {uploadingProofFor?.reference_number}
                                    </span>
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Booking Context Pill */}
                        {uploadingProofFor && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-zinc-850 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Amount Due</p>
                                    <p className="text-sm font-black text-zinc-900 dark:text-white">
                                        ${uploadingProofFor?.invoice?.amount != null
                                            ? Number(uploadingProofFor.invoice.amount).toFixed(2)
                                            : (uploadingProofFor?.boxes?.reduce((sum: number, b: any) => sum + parseFloat(b.price_charged || '0'), 0)?.toFixed(2) || '0.00')}
                                    </p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Payment Method</p>
                                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 capitalize flex items-center gap-1.5 truncate">
                                        <Building2 className="size-3.5 text-zinc-400 shrink-0" />
                                        {(uploadingProofFor?.payment_method || 'bank_transfer').replace('_', ' ')}
                                    </p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Transfer Reference</p>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyReference(uploadingProofFor.reference_number)}
                                        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-brand-rust hover:underline group/copy cursor-pointer"
                                        title="Click to copy transfer reference"
                                    >
                                        <span>{uploadingProofFor.reference_number}</span>
                                        {copiedRef ? (
                                            <Check className="size-3.5 text-emerald-600" />
                                        ) : (
                                            <Copy className="size-3 text-zinc-400 group-hover/copy:text-brand-rust transition-colors" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={submitProof} className="p-6 pt-4 space-y-4">
                        {/* Existing Proof Notice */}
                        {uploadingProofFor?.proof_of_payment && (
                            <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                                    <div>
                                        <p className="font-bold">Proof Already Uploaded</p>
                                        <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 mt-0.5">
                                            A receipt is currently attached. Submitting a new file will replace it.
                                        </p>
                                    </div>
                                </div>
                                <a
                                    href={`/storage/${uploadingProofFor.proof_of_payment}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0 text-xs"
                                >
                                    <Eye className="size-3.5" /> View Current
                                </a>
                            </div>
                        )}

                        {/* Transaction Reference Input */}
                        <div className="space-y-1.5">
                            <label htmlFor="payment_reference" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Hash className="size-3.5 text-zinc-400" />
                                    Transaction Reference / Receipt No.
                                </span>
                                <span className="text-[11px] font-normal text-zinc-400">
                                    {proofData.proof_of_payment ? 'Optional if on receipt' : 'Required if no file'}
                                </span>
                            </label>
                            <div className="relative">
                                <input
                                    id="payment_reference"
                                    type="text"
                                    value={proofData.payment_reference}
                                    onChange={e => setProofData('payment_reference', e.target.value)}
                                    placeholder="e.g. CBA-984214, PayID Ref, or Receipt #"
                                    className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-rust/30 focus:border-brand-rust transition-all"
                                />
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                Enter the transaction ID or receipt reference provided by your bank app to speed up verification.
                            </p>
                            {proofErrors.payment_reference && (
                                <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1.5">
                                    <AlertCircle className="size-3.5 shrink-0" />
                                    {proofErrors.payment_reference}
                                </p>
                            )}
                        </div>

                        {/* Interactive Dropzone */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    Select Payment Screenshot or Receipt
                                </label>
                                <span className="text-[11px] font-normal text-zinc-400">Max 5MB</span>
                            </div>

                            <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-brand-rust/50 dark:hover:border-brand-rust/50 rounded-2xl p-6 text-center hover:bg-zinc-50/60 dark:hover:bg-zinc-850/30 transition-all cursor-pointer relative group">
                                <input
                                    id="proof-file"
                                    type="file"
                                    accept="image/jpeg,image/png,image/jpg,application/pdf,.pdf"
                                    capture="environment"
                                    onChange={e => handleProofFileSelect(e.target.files ? e.target.files[0] : null)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                    title="Upload proof of payment"
                                    aria-label="Upload proof of payment"
                                />

                                {!proofData.proof_of_payment ? (
                                    <div className="space-y-3 pointer-events-none">
                                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:text-brand-rust group-hover:scale-105 transition-all flex items-center justify-center mx-auto shadow-2xs">
                                            <Upload className="size-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                                Click to upload or drag & drop
                                            </p>
                                            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                                Bank transfer receipt, screenshot, or PDF
                                            </p>
                                        </div>
                                        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                                            <span>JPG, PNG, PDF</span>
                                            <span>•</span>
                                            <span>Up to 5MB</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative z-20 space-y-3">
                                        {proofPreview ? (
                                            <div className="relative inline-block group/preview">
                                                <img
                                                    src={proofPreview}
                                                    alt="Receipt preview"
                                                    className="max-h-40 max-w-full rounded-xl mx-auto border border-zinc-200 dark:border-zinc-700 shadow-sm object-contain"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleProofFileSelect(null);
                                                    }}
                                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-md transition-all active:scale-95"
                                                    title="Remove file"
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-3 p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                                <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                                                    <FileText className="size-5" />
                                                </div>
                                                <div className="text-left flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                                                        {proofData.proof_of_payment.name}
                                                    </p>
                                                    <p className="text-[11px] text-zinc-500">
                                                        {(proofData.proof_of_payment.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleProofFileSelect(null);
                                                    }}
                                                    className="text-zinc-400 hover:text-red-500 p-1.5 transition-colors rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                                    title="Remove file"
                                                >
                                                    <X className="size-4" />
                                                </button>
                                            </div>
                                        )}

                                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                                            <CheckCircle2 className="size-3.5" /> File selected and ready to submit
                                        </p>
                                    </div>
                                )}
                            </div>

                            {proofErrors.proof_of_payment && (
                                <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1.5">
                                    <AlertCircle className="size-3.5 shrink-0" />
                                    {proofErrors.proof_of_payment}
                                </p>
                            )}
                        </div>

                        {/* Helper instructions */}
                        <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-[11px] text-blue-900 dark:text-blue-300 space-y-1">
                            <p className="font-bold flex items-center gap-1.5">
                                <AlertCircle className="size-3 text-blue-600 shrink-0" /> Verification Tip
                            </p>
                            <p className="text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                                Please ensure the transfer amount, date, and reference (<span className="font-mono font-bold text-blue-950 dark:text-blue-200">{uploadingProofFor?.reference_number}</span>) are legible. Our dispatch team will verify and confirm your booking.
                            </p>
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={handleCloseProofModal}
                                className="px-4 h-11 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={uploadingProof || (!proofData.proof_of_payment && !proofData.payment_reference.trim() && !uploadingProofFor?.proof_of_payment)}
                                className="px-6 h-11 rounded-xl bg-brand-rust hover:bg-brand-rust/90 text-white text-xs font-bold transition-all disabled:opacity-40 shadow-sm inline-flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                            >
                                {uploadingProof ? (
                                    <>
                                        <Loader2 className="size-3.5 animate-spin" />
                                        Uploading Proof...
                                    </>
                                ) : uploadingProofFor?.proof_of_payment ? (
                                    <>
                                        <Upload className="size-3.5" />
                                        Update Proof
                                    </>
                                ) : (
                                    <>
                                        <Upload className="size-3.5" />
                                        Submit Proof
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete / Cancel Confirm Modal */}
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmAction}
                loading={isProcessing}
                title={pendingAction?.type === 'cancel' ? 'Cancel Booking?' : 'Delete Draft?'}
                description={pendingAction?.type === 'cancel'
                    ? 'Are you sure you want to cancel this booking? This action cannot be undone and will stop any further processing.'
                    : 'Are you sure you want to delete this draft? All progress on this booking will be permanently lost.'
                }
                variant="destructive"
                confirmText={pendingAction?.type === 'cancel' ? 'Cancel Booking' : 'Delete Draft'}
            />

            {/* Declaration Prompt Modal on Payment Proof Submission */}
            <DeclarationPromptModal
                isOpen={declarationPromptBookingId !== null}
                onClose={() => setDeclarationPromptBookingId(null)}
                bookingId={declarationPromptBookingId}
                badgeText="Payment Initiated"
            />
        </AppLayout>
    );
}
