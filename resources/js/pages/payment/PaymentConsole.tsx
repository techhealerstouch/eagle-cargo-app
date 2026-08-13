import { Head, Link, router } from '@inertiajs/react';
import {
    ShieldCheck, ArrowLeft, Package, MapPin,
    AlertCircle, Lock, Eye, Zap,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import Heading from '@/components/common/heading';
import PaymentFlow from '@/components/payment/PaymentFlow';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import bookingsRoutes from '@/routes/bookings';

interface Recipient { first_name: string; last_name: string; city: string; province: string; }
interface BoxType { id: number; name: string; }
interface Box { price_charged: string; recipient: Recipient; box_type?: BoxType; weight?: string; actual_cbm?: string; }
interface Booking {
    id: number;
    reference_number: string;
    payment_status?: string;
    boxes: Box[];
    proof_of_payment?: string;
    sender?: { first_name: string; last_name: string; email?: string; mobile?: string; address?: string; };
    payment_method?: string;
    preferred_date?: string;
}
export interface Invoice {
    id: number;
    invoice_number: string;
    amount: string;
    status: string;
    payments?: Array<{ amount: string | number; paid_at?: string | null; stripe_status?: string | null }>;
    booking: Booking;
}
interface SharedPaymentProps {
    booking?: Booking;
    invoice?: Invoice;
    stripeKey?: string;
    role: 'sender' | 'picker' | 'admin';
    endpoint?: string;
    backUrl?: string;
    bankDetails?: { bank_name?: string; bsb?: string; account_number?: string; company_name?: string; };
}

const calculateTotal = (boxes: Box[]) =>
    (boxes || []).reduce((acc, box) => acc + parseFloat(box.price_charged || '0'), 0);

const TrustBadge = ({ icon: Icon, label }: { icon: any; label: string }) => (
    <div className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 transition-colors cursor-default">
        <Icon className="size-3.5" />
        <span className="text-[11px] font-semibold tracking-tight">{label}</span>
    </div>
);

export default function PaymentConsole({
    booking: initialBooking, invoice, stripeKey, role, endpoint,
    backUrl = '/dashboard', bankDetails,
}: SharedPaymentProps) {
    const booking = initialBooking || invoice?.booking;

    const [alreadyPaidState, setAlreadyPaidState] = useState(false);
    const isPaid = booking?.payment_status === 'paid' || alreadyPaidState;
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [isLoadingSecret, setIsLoadingSecret] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const fetchInProgress = useRef(false);
    const stripeAutoRetryUsed = useRef(false);

    const fetchPaymentIntent = useCallback(
        (options?: { signal?: AbortSignal; forceNew?: boolean }) => {
            const signal = options?.signal;
            const forceNew = options?.forceNew ?? false;

            if (!booking || role !== 'sender' || isPaid || fetchInProgress.current) {
                return;
            }

            fetchInProgress.current = true;

            // Use promise to avoid synchronous setState inside useEffect
            Promise.resolve().then(() => {
                setIsLoadingSecret(true);
                setLoadError(null);

                if (forceNew) {
                    setClientSecret(null);
                }
            });

            const getXsrfToken = () => {
                const match = document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'));

                return match ? decodeURIComponent(match[3]) : '';
            };

            fetch(bookingsRoutes.stripeIntent.url(booking), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getXsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({ force_new: forceNew }),
                signal,
            })
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`Server error ${res.status}`);
                    }

                    return res.json();
                })
                .then((data) => {
                    if (data.alreadyPaid) {
                        setAlreadyPaidState(true);

                        return;
                    }

                    if (!data.clientSecret) {
                        throw new Error('Missing client secret');
                    }

                    setClientSecret(data.clientSecret);
                })
                .catch((err) => {
                    if (err.name === 'AbortError') {
                        return;
                    } // cleanup on unmount, not a real error

                    console.error('Payment intent failed:', err);
                    setLoadError('Unable to initialize payment gateway. Please try again.');
                })
                .finally(() => {
                    fetchInProgress.current = false;
                    setIsLoadingSecret(false);
                });
        },
        [booking, role, isPaid],
    );

    useEffect(() => {
        if (!booking || role !== 'sender' || isPaid) {
            return;
        }

        const controller = new AbortController();
        fetchPaymentIntent({ signal: controller.signal });

        return () => {
            controller.abort();
            fetchInProgress.current = false;
        };
    }, [booking, role, isPaid, fetchPaymentIntent]);

    if (!booking) {
        return (
            <AppLayout breadcrumbs={[{ title: 'Dashboard', href: backUrl }, { title: 'Payment', href: '#' }]}>
                <div className="flex flex-col items-center justify-center p-24 text-zinc-400">
                    <AlertCircle className="size-10 mb-4" />
                    <p className="font-semibold text-sm">No booking data available</p>
                </div>
            </AppLayout>
        );
    }

    const totalAmount = invoice ? parseFloat(invoice.amount) : calculateTotal(booking.boxes);
    const settledInvoicePayments = (invoice?.payments || []).reduce((sum, payment) => {
        const isSettled = payment.paid_at != null || payment.stripe_status === 'succeeded';

        return isSettled ? sum + parseFloat(String(payment.amount || 0)) : sum;
    }, 0);
    const manualAmountCap = invoice
        ? Math.max(parseFloat(invoice.amount) - settledInvoicePayments, 0)
        : totalAmount;

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: backUrl }, { title: 'Payment', href: '#' }]}>
            <Head title="Payment Console" />
            <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-zinc-100">
                    <Heading
                        eyebrow={role === 'sender' ? 'Secure Checkout' : 'Financial Console'}
                        title={role === 'sender' ? 'Complete Your Payment' : (role === 'picker' && booking?.payment_status === 'cash_on_pickup' ? 'Cash Collected' : 'Record Payment')}
                        description={`Booking ${booking.reference_number}`}
                    />
                    <Link href={backUrl}>
                        <Button variant="outline" className="rounded-lg h-10 px-5 text-sm font-medium">
                            <ArrowLeft className="mr-2 size-3.5" /> Back
                        </Button>
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
                            <div className="p-6 border-b border-zinc-100 bg-zinc-50/60">
                                <h3 className="font-semibold text-zinc-900 text-base">Order Summary</h3>
                                <p className="text-xs text-zinc-500 mt-1">{(booking.boxes || []).length} item{(booking.boxes || []).length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="p-6 space-y-3">
                                {(booking.boxes || []).map((box: any, i: number) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-zinc-50/80 border border-zinc-100 group/item transition-all hover:bg-white hover:shadow-xs">
                                        <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center border border-zinc-200 shrink-0 shadow-xs group-hover/item:border-zinc-300 transition-colors">
                                            <Package className="size-5 text-zinc-400 group-hover/item:text-zinc-600 transition-colors" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Item {String(i + 1).padStart(2, '0')}</span>
                                                    <span className="text-sm font-bold text-zinc-800">{box.box_type?.name || 'Standard Box'}</span>
                                                </div>
                                                <span className="text-base font-mono font-bold text-zinc-900">${parseFloat(box.price_charged || '0').toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                                                <p className="truncate flex items-center gap-1">
                                                    <MapPin className="size-3 text-zinc-400" /> {box.recipient?.city}, {box.recipient?.province}
                                                </p>
                                                <span className="text-zinc-300">•</span>
                                                <p className="truncate font-medium text-zinc-600">
                                                    {box.recipient?.first_name} {box.recipient?.last_name}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <div className="pt-6 mt-4 border-t border-zinc-100 space-y-3">
                                    <div className="flex justify-between text-sm px-1">
                                        <span className="text-zinc-500">Subtotal</span>
                                        <span className="font-medium text-zinc-900">${totalAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm px-1">
                                        <span className="text-zinc-500 flex items-center gap-1.5">
                                            GST <span className="text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-400 font-bold">10%</span>
                                        </span>
                                        <span className="font-medium text-zinc-900">${(totalAmount / 11).toFixed(2)}</span>
                                    </div>
                                    <div className="pt-4">
                                        <div className="flex items-center justify-between p-5 bg-zinc-900 rounded-xl text-white shadow-md hover:shadow-lg hover:scale-[1.01] hover:bg-black transition-all duration-500 cursor-default group relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <Zap className="size-16" />
                                            </div>
                                            <div className="relative z-10">
                                                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 group-hover:text-zinc-400 transition-colors block mb-1">Final Amount</span>
                                                
                                            </div>
                                            <span className="text-4xl font-black font-mono tracking-tighter relative z-10">${totalAmount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {booking.sender && (
                            <div className="p-5 rounded-xl border border-zinc-100 bg-white shadow-xs space-y-4">
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Customer Details</h4>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-xs border border-zinc-200">
                                        {booking.sender.first_name[0]}{booking.sender.last_name[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-zinc-800">{booking.sender.first_name} {booking.sender.last_name}</p>
                                        <p className="text-[11px] text-zinc-500 truncate">{booking.sender.email}</p>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-zinc-50 text-[11px] text-zinc-500 space-y-1.5">
                                    <p className="flex justify-between"><span>Reference</span> <span className="font-mono text-zinc-900">{booking.reference_number}</span></p>
                                    {booking.sender.mobile && <p className="flex justify-between"><span>Phone</span> <span className="text-zinc-900">{booking.sender.mobile}</span></p>}
                                    {booking.sender.address && <p className="flex flex-col gap-0.5 mt-2"><span>Pickup Address</span> <span className="text-zinc-900 leading-tight">{booking.sender.address}</span></p>}
                                </div>
                            </div>
                        )}

                        {/* <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 backdrop-blur-sm space-y-2.5">
                            <TrustBadge icon={Lock} label="256-bit SSL encrypted" />
                            <TrustBadge icon={ShieldCheck} label="PCI DSS compliant" />
                            <TrustBadge icon={Eye} label="No card data stored on our servers" />
                        </div> */}
                    </div>

                    <div className="lg:col-span-3 space-y-6">
                        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-xs">
                            <PaymentFlow
                                booking={isPaid ? { ...booking, payment_status: 'paid' } : booking}
                                stripeKey={stripeKey}
                                clientSecret={clientSecret}
                                bankDetails={bankDetails}
                                role={role}
                                endpoint={endpoint}
                                invoiceId={invoice?.id}
                                manualAmount={manualAmountCap}
                                manualAmountCap={manualAmountCap}
                                isLoading={isLoadingSecret}
                                backUrl={backUrl}
                                backLabel={role === 'picker' ? 'Back to Runsheet' : role === 'admin' ? 'Back to Payments' : 'Go to Dashboard'}
                                onStripeLoadError={(message) => {
                                    if (!stripeAutoRetryUsed.current) {
                                        stripeAutoRetryUsed.current = true;
                                        setLoadError('Payment fields failed to load. Retrying with a fresh session...');
                                        fetchPaymentIntent({ forceNew: true });

                                        return;
                                    }

                                    setLoadError(message || 'Payment fields failed to load. Please retry.');
                                }}
                                onSuccess={() => {
                                    if (window.location.pathname.includes('/payment/')) {
                                        router.reload();
                                    }
                                }}
                            />
                            {loadError && (
                                <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center">
                                    {loadError}
                                    <button onClick={() => fetchPaymentIntent({ forceNew: true })} className="ml-2 font-bold underline">Retry</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
