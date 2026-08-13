import { Head, Link, useForm } from '@inertiajs/react';
import { Save, ArrowLeft, Package, User, MapPin, Calendar, ShieldCheck, Info, FileCheck, CreditCard, Receipt, Upload, FileText, X } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Sender {
    id: number;
    first_name: string;
    last_name: string;
}

interface Booking {
    id: number;
    sender_id: number;
    pickup_zone_id?: number | null;
    status: string;
    recipient_name: string;
    destination: string;
    preferred_date: string | null;
    payment_status: string;
    payment_method: string | null;
    declaration_form_status: string;
    notes: string;
    admin_notes: string;
    reference_number: string;
    payment_reference?: string | null;
    proof_of_payment?: string | null;
}

export default function BookingsEdit({
    booking,
    senders,
    pickupZones = [],
}: {
    booking: Booking;
    senders: Sender[];
    pickupZones?: any[];
}) {
    // Format date properly for the input type="date"
    let formattedDate = '';

    if (booking.preferred_date) {
        try {
            formattedDate = new Date(booking.preferred_date)
                .toISOString()
                .split('T')[0];
        } catch {
            formattedDate = booking.preferred_date.split('T')[0];
        }
    }

    const { data, setData, post, processing, errors } = useForm({
        _method: 'put',
        sender_id: booking.sender_id.toString(),
        pickup_zone_id: booking.pickup_zone_id ? booking.pickup_zone_id.toString() : '',
        status: booking.status,
        recipient_name: booking.recipient_name || '',
        destination: booking.destination || '',
        preferred_date: formattedDate,
        payment_status: booking.payment_status,
        payment_method: booking.payment_method || 'bank_transfer',
        payment_reference: booking.payment_reference || '',
        proof_of_payment: null as File | null,
        declaration_form_status: booking.declaration_form_status,
        notes: booking.notes || '',
        admin_notes: booking.admin_notes || '',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Bookings', href: '/admin/bookings' },
        { title: 'Edit Booking', href: '#' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/admin/bookings/${booking.id}`, {
            forceFormData: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit Booking ${booking.reference_number} | Admin`} />
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-brand-warm/20 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/admin/bookings/${booking.id}`}
                            className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Heading
                                eyebrow="Admin Booking"
                                title="Edit Booking"
                                description="Update booking details, delivery info, and status."
                            />
                            <span className="rounded-xl bg-brand-warm/30 px-5 py-2 font-mono text-sm font-bold text-brand-rust tracking-tight border border-brand-rust/10 shadow-sm">
                                {booking.reference_number}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 max-w-4xl mx-auto w-full flex-1 card border border-brand-warm/15 shadow-lg rounded-3xl bg-white overflow-hidden">
                    <div className="bg-brand-warm/5 px-6 py-5 border-b border-brand-warm/10 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="h-6 w-1 bg-brand-rust rounded-full"></div>
                            <h2 className="font-serif text-xl font-bold text-brand-rust">Booking Details</h2>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-brand-warm/25 shadow-sm">
                            <ShieldCheck className="size-3.5 text-brand-secondary" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-rust/80">Admin Edit</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            {/* Sender */}
                            <div className="space-y-3">
                                <Label htmlFor="sender_id" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">Sender</Label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <select
                                        id="sender_id"
                                        aria-label="Sender"
                                        className="flex h-11 w-full items-center rounded-xl border border-brand-warm/20 bg-brand-warm/5 pl-11 pr-4 text-sm font-medium text-brand-rust focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm appearance-none cursor-pointer"
                                        value={data.sender_id}
                                        onChange={(e) =>
                                            setData('sender_id', e.target.value)
                                        }
                                    >
                                        <option value="">Select a sender</option>
                                        {senders.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.first_name} {c.last_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {errors.sender_id && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">
                                        {errors.sender_id}
                                    </p>
                                )}
                            </div>


                            {/* Status */}
                            <div className="space-y-3">
                                <Label htmlFor="status" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">Booking Status</Label>
                                <select
                                    id="status"
                                    aria-label="Status"
                                    className="flex h-11 w-full items-center rounded-xl border border-brand-warm/20 bg-white px-4 text-sm font-medium text-brand-rust focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm appearance-none cursor-pointer"
                                    value={data.status}
                                    onChange={(e) =>
                                        setData('status', e.target.value)
                                    }
                                >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="collected">Collected</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                                {errors.status && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">
                                        {errors.status}
                                    </p>
                                )}
                            </div>

                            {/* Pickup Area */}
                            <div className="space-y-3">
                                <Label htmlFor="pickup_zone_id" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">Pickup Area</Label>
                                <select
                                    id="pickup_zone_id"
                                    aria-label="Pickup Area"
                                    className="flex h-11 w-full items-center rounded-xl border border-brand-warm/20 bg-white px-4 text-sm font-medium text-brand-rust focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm appearance-none cursor-pointer"
                                    value={data.pickup_zone_id}
                                    onChange={(e) =>
                                        setData('pickup_zone_id', e.target.value)
                                    }
                                >
                                    <option value="">Select Pickup Area</option>
                                    {pickupZones.map((z: any) => (
                                        <option key={z.id} value={z.id.toString()}>
                                            {z.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.pickup_zone_id && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">
                                        {errors.pickup_zone_id}
                                    </p>
                                )}
                            </div>

                            {/* Payment Status */}
                            <div className="space-y-3">
                                <Label htmlFor="payment_status" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">Payment Status</Label>
                                <select
                                    id="payment_status"
                                    aria-label="Payment Status"
                                    className="flex h-11 w-full items-center rounded-xl border border-brand-warm/20 bg-white px-4 text-sm font-medium text-brand-rust focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm appearance-none cursor-pointer"
                                    value={data.payment_status}
                                    onChange={(e) =>
                                        setData(
                                            'payment_status',
                                            e.target.value,
                                        )
                                    }
                                >
                                    <option value="pending">Pending</option>
                                    <option value="balance_pending">Balance Pending</option>
                                    <option value="partially_paid">Partially Paid</option>
                                    <option value="paid">Paid</option>
                                    <option value="cash_on_pickup">Payment on Pickup</option>
                                </select>
                                {errors.payment_status && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">
                                        {errors.payment_status}
                                    </p>
                                )}
                            </div>

                            {/* Payment Method */}
                            <div className="space-y-3">
                                <Label htmlFor="payment_method" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">Payment Method</Label>
                                <select
                                    id="payment_method"
                                    aria-label="Payment Method"
                                    className="flex h-11 w-full items-center rounded-xl border border-brand-warm/20 bg-white px-4 text-sm font-medium text-brand-rust focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm appearance-none cursor-pointer"
                                    value={data.payment_method}
                                    onChange={(e) =>
                                        setData(
                                            'payment_method',
                                            e.target.value,
                                        )
                                    }
                                >
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="pay_id">Pay ID</option>
                                    <option value="stripe">Stripe</option>
                                    <option value="afterpay">Afterpay (+6.3%)</option>
                                    <option value="square">Square</option>
                                    <option value="cash_on_pickup">Cash on Pickup</option>
                                </select>
                                {errors.payment_method && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">
                                        {errors.payment_method}
                                    </p>
                                )}
                            </div>

                            {/* Recipient */}
                            <div className="space-y-3">
                                <Label htmlFor="recipient_name" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">Recipient Name</Label>
                                <Input
                                    id="recipient_name"
                                    className="h-11 rounded-xl border border-brand-warm/20 bg-white font-medium px-4 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                    value={data.recipient_name}
                                    onChange={(e) =>
                                        setData(
                                            'recipient_name',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Full recipient name"
                                />
                                {errors.recipient_name && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">
                                        {errors.recipient_name}
                                    </p>
                                )}
                            </div>

                            {/* Destination */}
                            <div className="space-y-3">
                                <Label htmlFor="destination" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">Destination</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="destination"
                                        className="h-11 rounded-xl border border-brand-warm/20 bg-white pl-11 pr-4 font-medium focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.destination}
                                        onChange={(e) =>
                                            setData('destination', e.target.value)
                                        }
                                        placeholder="e.g. Manila, Philippines"
                                    />
                                </div>
                                {errors.destination && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">
                                        {errors.destination}
                                    </p>
                                )}
                            </div>

                            {/* Preferred Date */}
                            <div className="space-y-3">
                                <Label htmlFor="preferred_date" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">Preferred Pickup Date</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                    <Input
                                        id="preferred_date"
                                        type="date"
                                        className="h-11 rounded-xl border border-brand-warm/20 bg-white pl-11 pr-4 font-medium focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.preferred_date}
                                        onChange={(e) =>
                                            setData(
                                                'preferred_date',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                                {errors.preferred_date && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">
                                        {errors.preferred_date}
                                    </p>
                                )}
                            </div>

                        </div>

                        {data.payment_status === 'paid' && (
                            <div className="mt-8 mb-6 rounded-3xl bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-white p-8 border-2 border-emerald-200/80 shadow-lg relative overflow-hidden transition-all duration-300">
                                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-6 mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="size-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0">
                                            <FileCheck className="size-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-serif text-lg font-bold text-emerald-950 tracking-tight flex items-center gap-2">
                                                Payment Verification Required
                                            </h3>
                                            <p className="text-xs text-emerald-800/80 font-medium mt-0.5">
                                                Marking booking as Paid will verify payment and reflect directly in the Payments table.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-3.5 py-1.5 rounded-full border border-emerald-300/60 shadow-2xs">
                                        Mandatory
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                                    <div className="space-y-3">
                                        <Label htmlFor="payment_method_verify" className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-900/90 ml-1">
                                            Payment Method <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="relative">
                                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-emerald-600/60" />
                                            <select
                                                id="payment_method_verify"
                                                title="Payment Method Verification"
                                                className="flex h-12 w-full rounded-xl border border-emerald-200/80 bg-white pl-11 pr-4 text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm appearance-none cursor-pointer"
                                                value={data.payment_method}
                                                onChange={(e) => setData('payment_method', e.target.value)}
                                            >
                                                <option value="bank_transfer">Bank Transfer</option>
                                                <option value="cash">Cash</option>
                                                <option value="pay_id">Pay ID</option>
                                                <option value="stripe">Stripe</option>
                                                <option value="afterpay">Afterpay</option>
                                                <option value="square">Square</option>
                                                <option value="cash_on_pickup">Cash on Pickup</option>
                                                <option value="cheque">Cheque</option>
                                            </select>
                                        </div>
                                        {errors.payment_method && (
                                            <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.payment_method}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <Label htmlFor="payment_reference" className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-900/90 ml-1 flex items-center gap-1">
                                            Reference / Transaction No. {['cash', 'cash_on_pickup'].includes(data.payment_method || '') ? <span className="text-[10px] lowercase tracking-normal text-emerald-700/80 font-semibold">(optional for cash)</span> : <span className="text-red-500">*</span>}
                                        </Label>
                                        <div className="relative">
                                            <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-emerald-600/60" />
                                            <Input
                                                id="payment_reference"
                                                type="text"
                                                className="h-12 rounded-xl border-emerald-200/80 bg-white pl-11 pr-4 text-xs font-bold text-emerald-950 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm font-mono placeholder:font-sans placeholder:font-normal placeholder:text-muted-foreground"
                                                value={data.payment_reference}
                                                onChange={(e) => setData('payment_reference', e.target.value)}
                                                placeholder={['cash', 'cash_on_pickup'].includes(data.payment_method || '') ? "Optional note or receipt # for cash" : "e.g. TRN-9827346 or Bank Receipt #"}
                                            />
                                        </div>
                                        {errors.payment_reference && (
                                            <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.payment_reference}</p>
                                        )}
                                    </div>

                                    <div className="space-y-3 md:col-span-2">
                                        <Label htmlFor="proof_of_payment" className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-900/90 ml-1">
                                            Proof of Payment (Image or PDF) {booking.proof_of_payment ? <span className="text-[10px] lowercase tracking-normal text-emerald-700/80 font-semibold">(file already on file - upload to replace)</span> : <span className="text-red-500">*</span>}
                                        </Label>
                                        <div className="relative border-2 border-dashed border-emerald-300/80 rounded-2xl p-6 bg-white/80 hover:bg-white transition-all text-center group cursor-pointer shadow-2xs">
                                            <Upload className="size-8 text-emerald-400 mx-auto mb-3 group-hover:text-emerald-600 transition-colors" />
                                            <div className="text-xs font-bold text-emerald-950 mb-1">
                                                {data.proof_of_payment ? data.proof_of_payment.name : (booking.proof_of_payment ? 'An existing proof is attached. Click to upload replacement.' : 'Click to select or drag proof of payment document')}
                                            </div>
                                            <p className="text-[11px] text-emerald-700/80">Supports JPG, PNG, or PDF (Max 5MB)</p>
                                            <input
                                                id="proof_of_payment"
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={(e) => setData('proof_of_payment', e.target.files ? e.target.files[0] : null)}
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                title="Upload proof of payment"
                                            />
                                            {data.proof_of_payment && (
                                                <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 py-2 px-4 rounded-xl border border-emerald-200 w-fit mx-auto shadow-xs">
                                                    <FileText className="size-4 shrink-0" />
                                                    <span className="truncate max-w-xs">{data.proof_of_payment.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setData('proof_of_payment', null);
                                                        }}
                                                        className="ml-2 text-emerald-600 hover:text-red-600 transition-colors p-1"
                                                        title="Remove file"
                                                    >
                                                        <X className="size-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {errors.proof_of_payment && (
                                            <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.proof_of_payment}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-6 bg-brand-warm/[0.03] rounded-2xl border border-brand-warm/10 space-y-6">
                            <div className="flex items-center gap-2">
                                <Info className="size-4 text-brand-rust/80" />
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-rust/80">Additional Notes</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Notes */}
                                <div className="space-y-3">
                                    <Label htmlFor="notes" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">Notes for Courier</Label>
                                    <textarea
                                        id="notes"
                                        className="min-h-32 w-full rounded-xl border border-brand-warm/20 bg-white p-4 text-sm font-normal text-brand-rust/95 focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.notes}
                                        onChange={(e) =>
                                            setData('notes', e.target.value)
                                        }
                                        placeholder="Pickup instructions for the courier..."
                                    />
                                </div>

                                {/* Admin Notes */}
                                <div className="space-y-3">
                                    <Label htmlFor="admin_notes" className="text-[11px] font-semibold uppercase tracking-wider text-brand-rust/80 ml-1">Internal Notes</Label>
                                    <textarea
                                        id="admin_notes"
                                        className="min-h-32 w-full rounded-xl border border-brand-rust/10 bg-brand-rust/[0.01] p-4 text-sm font-normal text-brand-rust/95 focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all shadow-sm"
                                        value={data.admin_notes}
                                        onChange={(e) =>
                                            setData('admin_notes', e.target.value)
                                        }
                                        placeholder="Internal notes only (not visible to sender)..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 pt-6 border-t border-brand-warm/10">
                            <Link href={`/admin/bookings/${booking.id}`} className="px-6 h-11 flex items-center justify-center rounded-xl border border-brand-warm/20 text-xs font-semibold uppercase tracking-wider hover:bg-brand-warm/5 transition-all active:scale-95 text-muted-foreground">
                                Cancel
                            </Link>
                            <Button
                                type="submit"
                                disabled={processing}
                                variant="success"
                                className="px-8 h-11 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-md flex items-center gap-2 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none"
                            >
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
