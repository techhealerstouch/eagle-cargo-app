import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Pencil, Printer, ShieldCheck, ShieldAlert, Download, RefreshCw, Upload, Search, ChevronDown, CheckCircle2, AlertTriangle, Send, Eye } from 'lucide-react';
import { useRef, useState } from 'react';

import { toast } from 'sonner';
import Heading from '@/components/common/heading';
import UpdateBoxStatusModal from '@/components/admin/update-box-status-modal';
import type { QrCodeLabelHandle } from '@/components/common/QrCodeLabel';
import QrCodeLabel from '@/components/common/QrCodeLabel';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface Booking {
    id: number;
    reference_number: string;
    sender: {
        first_name: string;
        last_name: string;
        mobile?: string;
        address?: string;
        suburb?: string;
        state?: string;
        postcode?: string;
    };
    destination: string;
    payment_status: string;
    service_type?: string;
    preferred_date?: string;
    boxes?: Box[];
}

interface Box {
    id: number;
    tracking_number: string;
    serial_number: string;
    status: string;
    tracking_step_key?: string | null;
    eta_date?: string | null;
    eta_message?: string | null;
    courier_notes: string | null;
    delivery_proof_path: string | null;
    signature_path: string | null;
    pickup_proof_path: string | null;
    tracking_views_count?: number;
    last_tracked_at?: string | null;
    tracking_logs?: {
        id: number;
        search_query: string;
        ip_address: string | null;
        user_agent: string | null;
        source: string;
        created_at: string;
    }[];
    recipient: {
        name: string;
        phone_number?: string;
        address?: string;
        city?: string;
        province?: string;
    } | null;
    box_type?: { name: string } | null;
    booking: Booking;
}

export default function BoxShow({ box }: { box: Box }) {
    const { auth, tracking_steps } = usePage<any>().props;

    const getValueForSystemStatus = (status: string | undefined) => {
        if (!status) return '';
        const step = tracking_steps?.find((s: any) => s.system_status === status);
        return step ? step.key : status;
    };

    const getLabelForBox = (box: Box) => {
        if (box.tracking_step_key) {
            const step = tracking_steps?.find((s: any) => s.key === box.tracking_step_key);
            if (step) return step.label;
        }
        return humanize(box.status);
    };

    const getStepOrder = (val: string | null | undefined) => {
        if (!val) return 0;
        const step = tracking_steps?.find((s: any) => s.key === val || s.system_status === val);
        return step ? step.order : 0;
    };

    const qrRef = useRef<QrCodeLabelHandle>(null);
    const hasPickupProof = Boolean(box.pickup_proof_path);
    const hasDeliveryProof = Boolean(box.delivery_proof_path);
    const hasSignature = Boolean(box.signature_path);

    const incompleteCount = [hasPickupProof, hasDeliveryProof, hasSignature].filter(x => !x).length;

    // Direct action handlers for evidence upload/reminders
    const triggerPickupProofUpload = () => {
        setNewStatus(getValueForSystemStatus('collected'));
        setStatusNotes('');
        setOverrideReason('');
        setProofFile(null);
        setUpdateEtaDate(false);
        setUpdateEtaMessage(false);
        setEtaDate(box.eta_date || '');
        setEtaMessage(box.eta_message || 'Your box is expected to be delivered on or before this date');
        setIsStatusOpen(true);
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 150);
    };

    const triggerDeliveryProofUpload = () => {
        setNewStatus(getValueForSystemStatus('delivered'));
        setStatusNotes('');
        setOverrideReason('');
        setProofFile(null);
        setUpdateEtaDate(false);
        setUpdateEtaMessage(false);
        setEtaDate(box.eta_date || '');
        setEtaMessage(box.eta_message || 'Your box is expected to be delivered on or before this date');
        setIsStatusOpen(true);
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 150);
    };

    const triggerSendSignatureReminder = () => {
        toast.success('Signature reminder notification sent to recipient successfully.');
    };

    // Status update dialog state
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [newStatus, setNewStatus] = useState(box.tracking_step_key || getValueForSystemStatus(box.status));
    const [statusNotes, setStatusNotes] = useState('');
    const [overrideReason, setOverrideReason] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [updateEtaDate, setUpdateEtaDate] = useState(false);
    const [updateEtaMessage, setUpdateEtaMessage] = useState(false);
    const [etaDate, setEtaDate] = useState(box.eta_date || '');
    const [etaMessage, setEtaMessage] = useState(box.eta_message || 'Your box is expected to be delivered on or before this date');
    const [isUpdating, setIsUpdating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleStatusUpdate = () => {
        if (!newStatus) {
return;
}

        const selectedStep = tracking_steps?.find((s: any) => s.key === newStatus);
        const systemStatus = selectedStep ? selectedStep.system_status : newStatus;
        const trackingStepKey = selectedStep ? selectedStep.key : undefined;

        // Proof is required only for delivered and collected statuses
        const proofRequiredStatuses = ['delivered', 'collected'];
        if (proofRequiredStatuses.includes(systemStatus) && !proofFile) {
            toast.error('A proof photo is required for this status.');

            return;
        }

        setIsUpdating(true);
        router.post(`/admin/boxes/${box.id}/update-status`, {
            status: systemStatus,
            tracking_step_key: trackingStepKey,
            courier_notes: statusNotes || undefined,
            admin_delivery_override_reason: overrideReason || undefined,
            delivery_proof: proofFile,
            update_eta_date: updateEtaDate,
            update_eta_message: updateEtaMessage,
            eta_date: etaDate || undefined,
            eta_message: etaMessage || undefined,
        }, {
            onSuccess: () => {
                setIsStatusOpen(false);
                setStatusNotes('');
                setOverrideReason('');
                setProofFile(null);
                setUpdateEtaDate(false);
                setUpdateEtaMessage(false);
                setEtaDate('');
                setEtaMessage('Your box is expected to be delivered on or before this date');
            },
            onError: (errors) => {
                toast.error(errors?.message || 'Failed to update box status');
            },
            onFinish: () => setIsUpdating(false),
        });
    };

    const showDeliveryOverride = newStatus === 'delivered';

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Boxes', href: '/admin/boxes' },
        { title: box.serial_number || box.tracking_number, href: `/admin/boxes/${box.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Box ${box.tracking_number} | Admin`} />

            <div className="mx-auto mb-10 w-full max-w-7xl animate-fade-in p-4 lg:p-6">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/boxes"
                            className="group flex h-10 w-10 items-center justify-center rounded-xl border border-brand-sand bg-white text-brand-text-mid shadow-sm transition-all hover:border-brand-secondary hover:text-brand-secondary"
                        >
                            <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-1" />
                        </Link>

                        <div className="space-y-1">
                            <Heading eyebrow="Asset Management" title="Box Details" />
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-sm font-bold text-zinc-500">#{box.serial_number || box.tracking_number}</span>
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                                    box.status === 'delivered' || box.status === 'collected' || box.status === 'received_by_branch'
                                        ? 'bg-green-50 text-green-700 border-green-200/50'
                                        : box.status === 'cancelled'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                                        : 'bg-amber-50 text-amber-800 border-amber-200/60'
                                }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${
                                        box.status === 'delivered' || box.status === 'collected' || box.status === 'received_by_branch'
                                            ? 'bg-emerald-500'
                                            : box.status === 'cancelled'
                                            ? 'bg-rose-500'
                                            : 'bg-amber-500'
                                    }`} />
                                    {getLabelForBox(box)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={`/admin/boxes/${box.id}/edit`}
                            className={buttonVariants({ variant: 'outline', size: 'default', className: 'h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold' })}
                        >
                            <Pencil className="size-4 text-zinc-500" />
                            Edit
                        </Link>
                        <Link
                            href={`/track?tracking_number=${box.tracking_number}`}
                            className={buttonVariants({ variant: 'outline', size: 'default', className: 'h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold' })}
                        >
                            <Search className="size-4 text-zinc-500" />
                            Track
                        </Link>
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="default" className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold cursor-pointer">
                                    <Printer className="size-4 text-zinc-500" />
                                    Print
                                    <ChevronDown className="size-3.5 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 bg-white border border-zinc-200 rounded-lg shadow-md p-1">
                                <DropdownMenuItem 
                                    className="cursor-pointer rounded-md text-xs py-2 hover:bg-zinc-50 flex items-center gap-2"
                                    onClick={() => qrRef.current?.handlePrint()}
                                >
                                    <Printer className="size-3.5 text-zinc-500" />
                                    Print Label
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    className="cursor-pointer rounded-md text-xs py-2 hover:bg-zinc-50 flex items-center gap-2"
                                    onClick={() => qrRef.current?.handleDownload?.()}
                                >
                                    <Download className="size-3.5 text-zinc-500" />
                                    Download PDF
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                            onClick={() => {
                                setNewStatus(box.status);
                                setStatusNotes('');
                                setOverrideReason('');
                                setProofFile(null);
                                setIsStatusOpen(true);
                            }}
                            variant="brand"
                            size="default"
                            className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-bold"
                        >
                            <RefreshCw className="size-4" />
                            Update status
                        </Button>
                    </div>
                </div>

                <div className="flex items-stretch gap-6 lg:flex-row flex-col">
                    <div className="w-full lg:w-2/3">
                        <div className="h-full rounded-xl border border-brand-sand bg-white p-5 sm:p-6 shadow-sm">
                            <div className="mb-6 flex items-center justify-between border-b border-brand-warm pb-4">
                                <h3 className="font-serif text-2xl font-bold text-brand-navy">Specifications</h3>
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                                    box.booking.payment_status === 'paid' ? 'bg-green-50 text-green-700 border-green-200/50' : 'bg-amber-50 text-amber-800 border-amber-200/60'
                                }`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${
                                        box.booking.payment_status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`} />
                                    {humanize(box.booking.payment_status)}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">
                                        Box Serial Number
                                    </span>
                                    <p className="font-mono text-lg font-bold text-brand-navy">
                                        {box.serial_number || 'Pending'}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">
                                        Tracking Number
                                    </span>
                                    <p className="font-mono text-lg font-bold text-brand-navy">
                                        {box.tracking_number}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">
                                        Booking Reference
                                    </span>
                                    <p className="font-mono text-lg font-bold text-brand-navy">
                                        <Link
                                            href={`/admin/bookings/${box.booking.id}`}
                                            className="underline decoration-brand-secondary/30 underline-offset-4 transition-colors hover:text-brand-secondary"
                                        >
                                            {box.booking.reference_number}
                                        </Link>
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Sender Name</span>
                                    <p className="text-lg font-bold text-brand-navy capitalize">
                                        {box.booking.sender.first_name} {box.booking.sender.last_name}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Recipient Name</span>
                                    <p className="text-lg font-bold text-brand-navy capitalize">
                                        {box.recipient?.name || 'N/A'}
                                    </p>
                                </div>

                                {box.recipient?.phone_number && (
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-text-light">Recipient Phone</span>
                                        <p className="text-lg font-bold text-brand-navy">
                                            {box.recipient.phone_number}
                                        </p>
                                    </div>
                                )}


                                <div className="space-y-2 border-2 border-brand-rust/20 rounded-xl bg-brand-rust/5 p-5 sm:col-span-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertTriangle className="size-4 text-brand-rust" />
                                        <span className="text-xs font-black uppercase tracking-[0.2em] text-brand-rust">Verified Booked Destination</span>
                                    </div>
                                    <p className="text-4xl font-black uppercase leading-tight text-brand-navy tracking-tight">{box.booking.destination}</p>
                                    <p className="text-[11px] font-bold text-brand-text-mid/70 uppercase tracking-wide mt-2">
                                        * Ensure this matches the physical address written on the box
                                    </p>
                                </div>

                                {box.courier_notes && (
                                    <div className="mt-3 rounded-lg border border-brand-sand/50 bg-brand-warm/50 p-4 sm:col-span-2">
                                        <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-brand-secondary">
                                            Courier Field Notes
                                        </span>
                                        <p className="font-serif text-lg italic leading-relaxed text-brand-text-mid">"{box.courier_notes}"</p>
                                    </div>
                                )}

                                <div className="mt-3 rounded-lg border border-brand-sand/50 bg-white p-5 sm:col-span-2">
                                    <div className="mb-4 flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-secondary">
                                            Evidence Status
                                        </span>
                                        {incompleteCount > 0 && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/50 px-2.5 py-0.5 text-xs font-semibold">
                                                {incompleteCount} of 3 incomplete
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 ${
                                            hasPickupProof ? 'border-green-200 bg-emerald-50/40 text-emerald-800' : 'border-amber-200 bg-amber-50/30 text-amber-850'
                                        }`}>
                                            <div className="flex items-center gap-3">
                                                {hasPickupProof ? <ShieldCheck className="size-5 text-emerald-600" /> : <ShieldAlert className="size-5 text-amber-600" />}
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Pickup Proof Photo</p>
                                                    <p className="text-sm font-bold">{hasPickupProof ? 'Captured' : 'Missing'}</p>
                                                </div>
                                            </div>
                                            {!hasPickupProof && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-2 w-full h-8 text-[11px] font-semibold flex items-center justify-center gap-1 border-amber-200/80 hover:bg-amber-50 hover:text-amber-900 bg-white cursor-pointer"
                                                    onClick={triggerPickupProofUpload}
                                                >
                                                    <Upload className="size-3 text-amber-600" />
                                                    Upload photo
                                                </Button>
                                            )}
                                        </div>

                                        <div className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 ${
                                            hasDeliveryProof ? 'border-green-200 bg-emerald-50/40 text-emerald-800' : 'border-amber-200 bg-amber-50/30 text-amber-850'
                                        }`}>
                                            <div className="flex items-center gap-3">
                                                {hasDeliveryProof ? <ShieldCheck className="size-5 text-emerald-600" /> : <ShieldAlert className="size-5 text-amber-600" />}
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Delivery Proof Photo</p>
                                                    <p className="text-sm font-bold">{hasDeliveryProof ? 'Captured' : 'Missing'}</p>
                                                </div>
                                            </div>
                                            {!hasDeliveryProof && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-2 w-full h-8 text-[11px] font-semibold flex items-center justify-center gap-1 border-amber-200/80 hover:bg-amber-50 hover:text-amber-900 bg-white cursor-pointer"
                                                    onClick={triggerDeliveryProofUpload}
                                                >
                                                    <Upload className="size-3 text-amber-600" />
                                                    Upload photo
                                                </Button>
                                            )}
                                        </div>

                                        <div className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 ${
                                            hasSignature ? 'border-green-200 bg-emerald-50/40 text-emerald-800' : 'border-amber-200 bg-amber-50/30 text-amber-855'
                                        }`}>
                                            <div className="flex items-center gap-3">
                                                {hasSignature ? <ShieldCheck className="size-5 text-emerald-600" /> : <ShieldAlert className="size-5 text-amber-650" />}
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Recipient Signature</p>
                                                    <p className="text-sm font-bold">{hasSignature ? 'Captured' : 'Unsigned'}</p>
                                                </div>
                                            </div>
                                            {!hasSignature && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-2 w-full h-8 text-[11px] font-semibold flex items-center justify-center gap-1 border-amber-200/80 hover:bg-amber-50 hover:text-amber-900 bg-white cursor-pointer"
                                                    onClick={triggerSendSignatureReminder}
                                                >
                                                    <Send className="size-3 text-amber-600" />
                                                    Send reminder
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {box.pickup_proof_path && (
                                    <div className={`mt-3 rounded-lg border border-brand-sand/50 p-4 ${box.delivery_proof_path ? 'sm:col-span-1' : 'sm:col-span-2'}`}>
                                        <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-brand-secondary">
                                            Pickup Proof Photo
                                        </span>
                                        <a
                                            href={`/uploads/${box.pickup_proof_path}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group relative block w-48 overflow-hidden rounded-lg border-2 border-brand-warm transition-all hover:border-brand-primary"
                                        >
                                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-brand-navy/60 opacity-0 transition-opacity group-hover:opacity-100">
                                                <span className="text-[10px] font-bold text-white uppercase tracking-widest">View Full Size</span>
                                            </div>
                                            {box.pickup_proof_path.toLowerCase().endsWith('.pdf') ? (
                                                <div className="flex h-32 w-full flex-col items-center justify-center bg-brand-warm/30">
                                                    <span className="text-4xl">📄</span>
                                                    <span className="mt-2 text-[10px] font-bold text-brand-text-mid uppercase tracking-widest">PDF Document</span>
                                                </div>
                                            ) : (
                                                <img
                                                    src={`/uploads/${box.pickup_proof_path}`}
                                                    alt="Pickup Proof"
                                                    className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                            )}
                                        </a>
                                    </div>
                                )}

                                {box.delivery_proof_path && (
                                    <div className={`mt-3 rounded-lg border border-brand-sand/50 p-4 ${box.pickup_proof_path ? 'sm:col-span-1' : 'sm:col-span-2'}`}>
                                        <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-brand-secondary">
                                            Delivery Proof Photo
                                        </span>
                                        <a
                                            href={`/uploads/${box.delivery_proof_path}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group relative block w-48 overflow-hidden rounded-lg border-2 border-brand-warm transition-all hover:border-brand-primary"
                                        >
                                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-brand-navy/60 opacity-0 transition-opacity group-hover:opacity-100">
                                                <span className="text-[10px] font-bold text-white uppercase tracking-widest">View Full Size</span>
                                            </div>
                                            {box.delivery_proof_path.toLowerCase().endsWith('.pdf') ? (
                                                <div className="flex h-32 w-full flex-col items-center justify-center bg-brand-warm/30">
                                                    <span className="text-4xl">📄</span>
                                                    <span className="mt-2 text-[10px] font-bold text-brand-text-mid uppercase tracking-widest">PDF Document</span>
                                                </div>
                                            ) : (
                                                <img
                                                    src={`/uploads/${box.delivery_proof_path}`}
                                                    alt="Delivery Proof"
                                                    className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                            )}
                                        </a>
                                    </div>
                                )}

                                {box.signature_path && (
                                    <div className="mt-3 rounded-lg border border-brand-sand/50 p-4 sm:col-span-2">
                                        <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-brand-secondary">
                                            Recipient Signature
                                        </span>
                                        <div className="inline-block rounded-lg border-2 border-brand-warm bg-white p-2">
                                            <img
                                                src={`/uploads/${box.signature_path}`}
                                                alt="Recipient Signature"
                                                className="max-h-24 w-auto grayscale contrast-125 transition-all hover:grayscale-0"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="w-full lg:w-1/3">
                        <div className="h-full rounded-xl border border-brand-sand bg-white p-5 sm:p-6 shadow-sm flex flex-col">
                            <div className="mb-6 flex items-center justify-between border-b border-brand-warm pb-4">
                                <h3 className="font-serif text-2xl font-bold text-brand-navy">Shipping Label</h3>
                                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 text-zinc-650 border border-zinc-200/60 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider">
                                    Preview
                                </span>
                            </div>
                            <div className="flex items-center justify-center flex-1 py-2">
                                <div className="group relative p-1 transition-transform hover:scale-[1.01]">
                                    <QrCodeLabel
                                        ref={qrRef}
                                        trackingNumber={box.tracking_number}
                                        serialNumber={box.serial_number}
                                        bookingRef={box.booking.reference_number}
                                        senderName={`${box.booking.sender.first_name} ${box.booking.sender.last_name}`}
                                        senderPhone={box.booking.sender.mobile}
                                        senderAddress={box.booking.sender.address ? [box.booking.sender.address, box.booking.sender.suburb, box.booking.sender.state, box.booking.sender.postcode].filter(Boolean).join(', ') : undefined}
                                        recipientName={box.recipient?.name || ''}
                                        recipientPhone={box.recipient?.phone_number}
                                        recipientAddress={box.recipient?.address ? [box.recipient.address, box.recipient.city, box.recipient.province].filter(Boolean).join(', ') : undefined}
                                        destination={box.booking.destination}
                                        paymentStatus={box.booking.payment_status}
                                        status={box.status}
                                        boxType={box.box_type?.name}
                                        serviceType={box.booking.service_type}
                                        preferredDate={box.booking.preferred_date ? new Date(box.booking.preferred_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : undefined}
                                        boxLabel={box.booking.boxes && box.booking.boxes.length > 1 ? `${(box.booking.boxes.findIndex(b => b.id === box.id) ?? 0) + 1} of ${box.booking.boxes.length}` : undefined}
                                        size={180}
                                        showActions={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <UpdateBoxStatusModal
                    isOpen={isStatusOpen}
                    onClose={() => setIsStatusOpen(false)}
                    box={box}
                    trackingSteps={tracking_steps}
                    userRole={auth?.user?.role}
                />
            </div>
        </AppLayout>
    );
}




