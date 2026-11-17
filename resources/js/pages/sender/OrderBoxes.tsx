import React, { useState, useEffect } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import { format } from 'date-fns';
import {
    Package,
    Truck,
    CalendarIcon,
    MapPin,
    CheckCircle2,
    Check,
    AlertCircle,
    AlertTriangle,
    Plus,
    Minus,
    CreditCard,
    Building2,
    Lock,
    ArrowLeft,
    ArrowRight,
    ChevronRight,
    Loader2,
    Sparkles,
    ShieldCheck,
    Box as BoxIcon,
    Zap,
    Wallet,
    Smartphone,
    Mail,
    Coins,
    User,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PhoneInput from '@/components/ui/PhoneInput';
import { SuburbSelect, type SuburbOption } from '@/components/ui/SuburbSelect';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const AUSTRALIAN_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

const baseInputClass =
    'h-12 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400';

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {title}
            </h2>
            {subtitle ? <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
        </div>
    );
}

function Field({
    label,
    required,
    error,
    hint,
    children,
}: {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {label}
                {required ? <span className="ml-1 text-red-500">*</span> : null}
            </label>
            {children}
            {hint ? <p className="text-xs text-zinc-400 dark:text-zinc-500">{hint}</p> : null}
            {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
        </div>
    );
}

interface BoxType {
    id: number;
    name: string;
    dimensions: string | null;
    description: string | null;
}

interface SenderData {
    first_name: string;
    last_name: string;
    email: string;
    mobile: string;
    address: string;
    suburb: string;
    state: string;
    postcode: string;
}

interface Props {
    boxTypes: BoxType[];
    suburbs?: SuburbOption[];
    sender: SenderData | null;
    isGuest?: boolean;
    confirmedReference?: string | null;
    emptyBoxFee: number;
    breadcrumbs: BreadcrumbItem[];
}

type OrderPaymentMethodId = 'stripe' | 'cash_on_pickup' | 'bank_transfer' | 'pay_id';

export default function OrderBoxes({
    boxTypes = [],
    suburbs = [],
    sender,
    isGuest = false,
    confirmedReference = null,
    emptyBoxFee = 10.0,
    breadcrumbs = [],
}: Props) {
    const Layout = isGuest ? MarketingLayout : AppLayout;
    const [datePopoverOpen, setDatePopoverOpen] = useState(false);
    const [isRegisteredEmail, setIsRegisteredEmail] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);

    const { data, setData, post, processing, errors, clearErrors } = useForm({
        first_name: sender?.first_name || '',
        last_name: sender?.last_name || '',
        email: sender?.email || '',
        items: boxTypes.map((type, idx) => ({
            box_type_id: type.id,
            quantity: idx === 0 ? 1 : 0,
        })),
        address: sender?.address || '',
        suburb: sender?.suburb || '',
        state: sender?.state || 'NSW',
        postcode: sender?.postcode || '',
        contact_number: sender?.mobile || '',
        delivery_date: '',
        payment_method: 'stripe' as OrderPaymentMethodId,
        delivery_notes: '',
        website: '',
    });

    useEffect(() => {
        if (!isGuest || !data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            setIsRegisteredEmail(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setCheckingEmail(true);
                const res = await fetch(`/api/users/check-email?email=${encodeURIComponent(data.email)}`);
                if (res.ok) {
                    const json = await res.json();
                    setIsRegisteredEmail(json.available === false);
                }
            } catch {
                // Ignore network failure
            } finally {
                setCheckingEmail(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [data.email, isGuest]);

    const updateQuantity = (boxTypeId: number, delta: number) => {
        setData(
            'items',
            data.items.map((item) => {
                if (item.box_type_id === boxTypeId) {
                    return { ...item, quantity: Math.max(0, item.quantity + delta) };
                }
                return item;
            })
        );
        clearErrors('items');
    };

    const totalBoxes = data.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const totalPrice = totalBoxes * emptyBoxFee;

    const selectedDateObj = data.delivery_date ? new Date(`${data.delivery_date}T00:00:00`) : undefined;
    const isStep1Complete = totalBoxes > 0;
    const isStep2Complete = Boolean(
        data.address.trim() &&
            data.suburb.trim() &&
            data.state.trim() &&
            data.postcode.trim() &&
            data.contact_number.trim() &&
            (!isGuest || (data.first_name.trim() && data.last_name.trim() && data.email.trim()))
    );
    const isStep3Complete = Boolean(data.delivery_date && data.payment_method);

    const paymentMethods: Array<{
        id: OrderPaymentMethodId;
        label: string;
        subtitle: string;
        icon: React.ElementType;
        color: string;
    }> = [
        {
            id: 'stripe',
            label: 'Online Payment',
            subtitle: 'Card via Stripe',
            icon: Zap,
            color: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900',
        },
        {
            id: 'cash_on_pickup',
            label: 'Pay on Delivery',
            subtitle: 'Cash to driver',
            icon: Wallet,
            color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
        },
        {
            id: 'bank_transfer',
            label: 'Bank Transfer',
            subtitle: 'BSB & Account',
            icon: Building2,
            color: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
        },
        {
            id: 'pay_id',
            label: 'PayID',
            subtitle: 'Fast PayID',
            icon: Smartphone,
            color: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900',
        },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (totalBoxes < 1) {
            toast.error('Please select at least 1 empty box to order.');
            return;
        }

        if (isGuest && isRegisteredEmail) {
            toast.error('An account with this email already exists. Please log in to place your order.');
            return;
        }

        post('/order-boxes', {
            onError: () => {
                toast.error('Please check all required fields and try again.');
            },
        });
    };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return (
        <Layout {...(!isGuest ? { breadcrumbs } : {})}>
            <Head title="Order Empty Balikbayan Boxes | Eagle Express Cargo" />

            <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
                {/* Confirmed Order Banner */}
                {confirmedReference && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-xs dark:border-emerald-800/60 dark:bg-emerald-950/30">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                                        Empty Box Order Submitted • Pending Confirmation ({confirmedReference})
                                    </p>
                                    <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                                        Our team has received your order and will confirm your box delivery schedule shortly.
                                    </p>
                                </div>
                            </div>
                            <Link
                                href={`/track?tracking_number=${encodeURIComponent(confirmedReference)}`}
                                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-2xs transition-colors shrink-0"
                            >
                                Track Order Status
                            </Link>
                        </div>
                    </div>
                )}

                {/* Mobile Header */}
                <div className="md:hidden space-y-1 pt-1">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-rust dark:text-amber-500">
                        EMPTY BOX SUPPLY
                    </p>
                    <h1 className="font-serif text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                        Order Empty Boxes
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        Heavy-duty balikbayan boxes delivered to your doorstep (${emptyBoxFee.toFixed(2)} refundable deposit per box).
                    </p>
                </div>

                {/* Desktop Hero Header Card & Overview Ribbon (matching Book.tsx) */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                    <div className="p-5 sm:p-6 pb-4 sm:pb-5 hidden md:block">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <Link
                                    href={isGuest ? '/' : '/bookings'}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shadow-2xs"
                                    title={isGuest ? 'Back to Home' : 'Back to My Bookings'}
                                >
                                    <ArrowLeft className="size-4" />
                                </Link>
                                <div>
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                                            Order Empty Balikbayan Boxes
                                        </h1>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-brand-warm/30 dark:bg-brand-rust/30 text-brand-rust dark:text-brand-warm text-[10px] font-extrabold uppercase tracking-wide border border-brand-rust/15">
                                            {isGuest ? 'Guest Supply Order' : 'Sender Portal'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        Need heavy-duty boxes before packing? Order empty boxes delivered straight to your door.
                                    </p>
                                </div>
                            </div>

                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-bold shrink-0">
                                <Sparkles className="size-3.5 text-brand-rust" />
                                <span>${emptyBoxFee.toFixed(2)} deposit / box • Credited on shipment</span>
                            </div>
                        </div>
                    </div>

                    {/* 3-Step Overview Ribbon */}
                    <div className="border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/60 p-2 sm:px-4 sm:py-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 shadow-2xs">
                                <span
                                    className={cn(
                                        'flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                                        isStep1Complete ? 'bg-emerald-600 text-white' : 'bg-brand-rust text-white'
                                    )}
                                >
                                    {isStep1Complete ? <Check className="size-3.5 stroke-[2.5]" /> : '1'}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">Box Selection</p>
                                    <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
                                        {totalBoxes > 0 ? `${totalBoxes} box${totalBoxes !== 1 ? 'es' : ''} selected` : 'Select box quantities'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 shadow-2xs">
                                <span
                                    className={cn(
                                        'flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                                        isStep2Complete ? 'bg-emerald-600 text-white' : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                    )}
                                >
                                    {isStep2Complete ? <Check className="size-3.5 stroke-[2.5]" /> : '2'}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">Delivery Address</p>
                                    <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
                                        {data.suburb ? `${data.suburb}, ${data.state}` : 'Australian doorstep drop-off'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 shadow-2xs">
                                <span
                                    className={cn(
                                        'flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                                        isStep3Complete ? 'bg-emerald-600 text-white' : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                    )}
                                >
                                    {isStep3Complete ? <Check className="size-3.5 stroke-[2.5]" /> : '3'}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">Schedule & Payment</p>
                                    <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
                                        {selectedDateObj ? format(selectedDateObj, 'MMM d, yyyy') : 'Select date & payment'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Honeypot */}
                    <input
                        type="text"
                        name="website"
                        value={data.website}
                        onChange={(e) => setData('website', e.target.value)}
                        style={{ display: 'none' }}
                        tabIndex={-1}
                        autoComplete="off"
                    />

                    {/* Main Form Sections */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Section 1: Box Sizes & Quantities */}
                        <section className="space-y-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-2xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                                <div>
                                    <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                                        1. Select Box Sizes & Quantities
                                    </h2>
                                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                                        Choose how many empty balikbayan boxes you need delivered before packing.
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 self-start sm:self-center text-xs font-bold px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shrink-0">
                                    <Package className="size-3.5 text-brand-rust" />
                                    {totalBoxes} box{totalBoxes !== 1 ? 'es' : ''} selected
                                </span>
                            </div>

                            {errors.items && (
                                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 flex items-center gap-2">
                                    <AlertCircle className="size-4 shrink-0" />
                                    <span>{errors.items}</span>
                                </div>
                            )}

                            <div className="space-y-3.5">
                                {boxTypes.map((boxType) => {
                                    const currentItem = data.items.find((i) => i.box_type_id === boxType.id);
                                    const qty = currentItem?.quantity || 0;

                                    return (
                                        <div
                                            key={boxType.id}
                                            className={cn(
                                                'flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all',
                                                qty > 0
                                                    ? 'border-brand-rust/40 bg-brand-warm/10 dark:border-amber-700/60 dark:bg-amber-950/20 shadow-2xs'
                                                    : 'border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50'
                                            )}
                                        >
                                            <div className="flex items-start gap-3.5 min-w-0">
                                                <div
                                                    className={cn(
                                                        'size-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors',
                                                        qty > 0
                                                            ? 'bg-brand-rust text-white border-brand-rust'
                                                            : 'bg-white text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                                    )}
                                                >
                                                    <BoxIcon className="size-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                                                            {boxType.name}
                                                        </h3>
                                                        {boxType.dimensions && (
                                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-200/70 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-semibold">
                                                                {boxType.dimensions}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                        ${emptyBoxFee.toFixed(2)} deposit per box (100% credited towards ocean freight)
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 ml-4">
                                                <button
                                                    type="button"
                                                    onClick={() => updateQuantity(boxType.id, -1)}
                                                    disabled={qty === 0}
                                                    aria-label={`Decrease quantity for ${boxType.name}`}
                                                    className={cn(
                                                        'size-9 rounded-xl flex items-center justify-center border transition-colors',
                                                        qty > 0
                                                            ? 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs cursor-pointer'
                                                            : 'border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900'
                                                    )}
                                                >
                                                    <Minus className="size-3.5" />
                                                </button>
                                                <span className="w-8 text-center font-bold text-sm tabular-nums text-zinc-900 dark:text-white">
                                                    {qty}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => updateQuantity(boxType.id, 1)}
                                                    aria-label={`Increase quantity for ${boxType.name}`}
                                                    className="size-9 rounded-xl flex items-center justify-center border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer"
                                                >
                                                    <Plus className="size-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Section 2: Delivery Address & Contact */}
                        <section className="space-y-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-2xs">
                            <SectionHeader
                                title="2. Delivery Address & Contact"
                                subtitle="Provide the Australian address where our driver will drop off your empty boxes."
                            />

                            {!isGuest && sender && (
                                <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                                            <User className="size-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                                {sender.first_name} {sender.last_name}
                                            </p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{sender.email}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
                                        Verified Sender
                                    </span>
                                </div>
                            )}

                            <div className="space-y-4">
                                {isGuest && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Field label="First Name" required error={errors.first_name}>
                                                <input
                                                    id="first_name"
                                                    type="text"
                                                    value={data.first_name}
                                                    onChange={(e) => {
                                                        setData('first_name', e.target.value);
                                                        clearErrors('first_name');
                                                    }}
                                                    placeholder="e.g. Maria"
                                                    className={baseInputClass}
                                                />
                                            </Field>

                                            <Field label="Last Name" required error={errors.last_name}>
                                                <input
                                                    id="last_name"
                                                    type="text"
                                                    value={data.last_name}
                                                    onChange={(e) => {
                                                        setData('last_name', e.target.value);
                                                        clearErrors('last_name');
                                                    }}
                                                    placeholder="e.g. Santos"
                                                    className={baseInputClass}
                                                />
                                            </Field>
                                        </div>

                                        <Field
                                            label="Email Address"
                                            required
                                            error={
                                                errors.email ||
                                                (isGuest && isRegisteredEmail
                                                    ? 'An account with this email already exists. Please log in to place your order.'
                                                    : undefined)
                                            }
                                            hint="We will send your verification code, order confirmation, receipt, and invoice to this email."
                                        >
                                            <div className="relative">
                                                <input
                                                    id="email"
                                                    type="email"
                                                    value={data.email}
                                                    onChange={(e) => {
                                                        setData('email', e.target.value);
                                                        clearErrors('email');
                                                        if (isRegisteredEmail) setIsRegisteredEmail(false);
                                                    }}
                                                    placeholder="e.g. maria.santos@gmail.com"
                                                    className={cn(
                                                        baseInputClass,
                                                        isGuest &&
                                                            isRegisteredEmail &&
                                                            'border-amber-500 dark:border-amber-500 focus:border-amber-600 focus:ring-amber-100 dark:focus:ring-amber-950/40'
                                                    )}
                                                />
                                                {checkingEmail && (
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-zinc-400">
                                                        <Loader2 className="size-3.5 animate-spin" />
                                                    </div>
                                                )}
                                            </div>
                                        </Field>

                                        {isGuest && isRegisteredEmail && (
                                            <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/30 flex items-start gap-3 animate-in fade-in duration-200">
                                                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                                                    <p className="font-bold">Existing Account Found</p>
                                                    <p>
                                                        An account already exists for <span className="font-semibold">{data.email}</span>. Please log in to continue and keep your orders linked to your account.
                                                    </p>
                                                    <div className="pt-0.5">
                                                        <a
                                                            href={`/login?email=${encodeURIComponent(data.email)}`}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shadow-2xs"
                                                        >
                                                            <span>Log In to Your Account</span>
                                                            <ChevronRight className="size-3.5" />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                <Field
                                    label="Contact Phone"
                                    required
                                    error={errors.contact_number}
                                    hint="Our driver will call or SMS on arrival."
                                >
                                    <PhoneInput
                                        name="contact_number"
                                        value={data.contact_number}
                                        onChange={(val) => {
                                            setData('contact_number', val);
                                            clearErrors('contact_number');
                                        }}
                                        defaultCountryCode="AU"
                                    />
                                </Field>

                                <Field
                                    label="Street Address"
                                    required
                                    error={errors.address}
                                    hint="Unit / House number, street name"
                                >
                                    <input
                                        id="address"
                                        type="text"
                                        value={data.address}
                                        onChange={(e) => {
                                            setData('address', e.target.value);
                                            clearErrors('address');
                                        }}
                                        placeholder="e.g. Unit 3, 42 King Street"
                                        className={baseInputClass}
                                    />
                                </Field>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Field label="Suburb" required error={errors.suburb}>
                                        <SuburbSelect
                                            id="suburb"
                                            name="suburb"
                                            value={data.suburb}
                                            onChange={(suburbName, postcode) => {
                                                setData((prev) => ({
                                                    ...prev,
                                                    suburb: suburbName,
                                                    postcode: postcode || prev.postcode,
                                                }));
                                                clearErrors('suburb');
                                            }}
                                            suburbs={suburbs}
                                            placeholder="Select or type suburb..."
                                            className={baseInputClass}
                                        />
                                    </Field>

                                    <Field label="State" required error={errors.state}>
                                        <select
                                            id="state"
                                            value={data.state}
                                            onChange={(e) => {
                                                setData('state', e.target.value);
                                                clearErrors('state');
                                            }}
                                            className={baseInputClass}
                                        >
                                            {AUSTRALIAN_STATES.map((st) => (
                                                <option key={st} value={st}>
                                                    {st}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field label="Postcode" required error={errors.postcode}>
                                        <input
                                            id="postcode"
                                            type="text"
                                            maxLength={4}
                                            value={data.postcode}
                                            onChange={(e) => {
                                                setData('postcode', e.target.value);
                                                clearErrors('postcode');
                                            }}
                                            placeholder="e.g. 2000"
                                            className={baseInputClass}
                                        />
                                    </Field>
                                </div>
                            </div>
                        </section>

                        {/* Section 3: Preferred Delivery Schedule & Payment */}
                        <section className="space-y-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-2xs">
                            <SectionHeader
                                title="3. Delivery Schedule & Payment"
                                subtitle="Choose when to drop off your empty boxes and select how you want to pay the deposit."
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field
                                    label="Preferred Delivery Date"
                                    required
                                    error={errors.delivery_date}
                                    hint="Select today or an upcoming drop-off date."
                                >
                                    <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                id="delivery_date"
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    'h-12 w-full justify-start text-left font-normal rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800',
                                                    !data.delivery_date && 'text-zinc-400 dark:text-zinc-500'
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 size-4 text-zinc-500" />
                                                {selectedDateObj ? format(selectedDateObj, 'PPP') : <span>Pick a delivery date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={selectedDateObj}
                                                onSelect={(date) => {
                                                    if (date) {
                                                        setData('delivery_date', format(date, 'yyyy-MM-dd'));
                                                        clearErrors('delivery_date');
                                                        setDatePopoverOpen(false);
                                                    }
                                                }}
                                                disabled={(date) => date < startOfToday}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    {selectedDateObj && (
                                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                            <CheckCircle2 className="size-3.5 shrink-0" />
                                            <span>
                                                Confirmed: <strong>{format(selectedDateObj, 'EEEE, MMMM d, yyyy')}</strong>
                                            </span>
                                        </div>
                                    )}
                                </Field>

                                <Field
                                    label="Special Delivery Instructions"
                                    hint="Optional gate codes, safe drop-off spot, etc."
                                    error={errors.delivery_notes}
                                >
                                    <textarea
                                        id="delivery_notes"
                                        value={data.delivery_notes}
                                        onChange={(e) => setData('delivery_notes', e.target.value)}
                                        placeholder="e.g. Gate code #1234, leave flat-packed by the side porch if unattended..."
                                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800 min-h-25"
                                    />
                                </Field>
                            </div>

                            {/* Unified Payment Method Selector (matching PaymentFlow.tsx & PaymentMethodSelector.tsx) */}
                            <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                            Payment Method for Box Deposit <span className="ml-1 text-red-500">*</span>
                                        </label>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            Select how you would like to settle the ${totalPrice.toFixed(2)} box deposit.
                                        </p>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200/80 dark:border-zinc-700 shrink-0">
                                        <Wallet className="size-4 text-zinc-400" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {paymentMethods.map((method) => {
                                        const Icon = method.icon;
                                        const isActive = data.payment_method === method.id;

                                        return (
                                            <button
                                                key={method.id}
                                                type="button"
                                                onClick={() => {
                                                    setData('payment_method', method.id);
                                                    clearErrors('payment_method');
                                                }}
                                                className={cn(
                                                    'flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer text-center',
                                                    isActive
                                                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 shadow-sm ring-1 ring-zinc-900/10 dark:ring-white/10'
                                                        : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/50'
                                                )}
                                            >
                                                <div className={cn('p-2 rounded-xl border mb-2', method.color)}>
                                                    <Icon className="size-4" />
                                                </div>
                                                <span
                                                    className={cn(
                                                        'text-xs font-bold leading-tight',
                                                        isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'
                                                    )}
                                                >
                                                    {method.label}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                    {method.subtitle}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {errors.payment_method && (
                                    <p className="text-xs font-medium text-red-600">{errors.payment_method}</p>
                                )}

                                {/* Contextual Payment Method Guidance (matching PaymentFlow.tsx styling) */}
                                {data.payment_method === 'stripe' && (
                                    <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-3.5 animate-in fade-in duration-300">
                                        <div className="h-8 w-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center shrink-0">
                                            <Zap className="size-4 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div className="text-xs leading-relaxed">
                                            <p className="font-bold text-indigo-950 dark:text-indigo-200">
                                                Instant Online Card Payment (Stripe)
                                            </p>
                                            <p className="text-indigo-800/80 dark:text-indigo-300/80 mt-0.5">
                                                Upon clicking proceed, you will be taken straight to our 256-bit SSL encrypted Stripe checkout to pay the{' '}
                                                <strong className="font-bold text-indigo-950 dark:text-indigo-100">${totalPrice.toFixed(2)}</strong> deposit immediately.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {data.payment_method === 'cash_on_pickup' && (
                                    <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-3.5 animate-in fade-in duration-300">
                                        <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center shrink-0">
                                            <Coins className="size-4 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div className="text-xs leading-relaxed">
                                            <p className="font-bold text-emerald-950 dark:text-emerald-200">
                                                Cash Upon Box Delivery
                                            </p>
                                            <p className="text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                                                No advance payment required today. Our driver will collect{' '}
                                                <strong className="font-bold text-emerald-950 dark:text-emerald-100">${totalPrice.toFixed(2)}</strong> in cash and provide a receipt when dropping off your boxes.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {data.payment_method === 'bank_transfer' && (
                                    <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 flex items-start gap-3.5 animate-in fade-in duration-300">
                                        <div className="h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center shrink-0">
                                            <Mail className="size-4 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="text-xs leading-relaxed">
                                            <p className="font-bold text-blue-950 dark:text-blue-200">
                                                Direct Bank Transfer (BSB & Account)
                                            </p>
                                            <p className="text-blue-800/80 dark:text-blue-300/80 mt-0.5">
                                                Our BSB, account details, and your unique booking reference for{' '}
                                                <strong className="font-bold text-blue-950 dark:text-blue-100">${totalPrice.toFixed(2)}</strong> will be emailed to you right after submitting your order.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {data.payment_method === 'pay_id' && (
                                    <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 flex items-start gap-3.5 animate-in fade-in duration-300">
                                        <div className="h-8 w-8 rounded-xl bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center shrink-0">
                                            <Smartphone className="size-4 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div className="text-xs leading-relaxed">
                                            <p className="font-bold text-purple-950 dark:text-purple-200">
                                                Instant PayID Transfer
                                            </p>
                                            <p className="text-purple-800/80 dark:text-purple-300/80 mt-0.5">
                                                Send <strong className="font-bold text-purple-950 dark:text-purple-100">${totalPrice.toFixed(2)}</strong> via PayID using your booking reference and upload your payment receipt in the portal.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Sticky Order Summary (matching PaymentConsole.tsx & Book.tsx) */}
                    <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-4">
                        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-7 shadow-xs space-y-5">
                            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                                <div>
                                    <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                        <Package className="size-4 text-brand-rust" />
                                        Order Summary
                                    </h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        {totalBoxes} empty box{totalBoxes !== 1 ? 'es' : ''}
                                    </p>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                                    Supply Drop-off
                                </span>
                            </div>

                            <div className="space-y-3 text-xs border-b border-zinc-100 dark:border-zinc-800 pb-4">
                                {data.items.filter((i) => i.quantity > 0).length === 0 ? (
                                    <p className="text-zinc-400 italic text-center py-3">No boxes selected yet</p>
                                ) : (
                                    data.items
                                        .filter((i) => i.quantity > 0)
                                        .map((item) => {
                                            const boxType = boxTypes.find((t) => t.id === item.box_type_id);
                                            return (
                                                <div
                                                    key={item.box_type_id}
                                                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                                            {item.quantity}x {boxType?.name || 'Box'}
                                                        </p>
                                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                                            ${emptyBoxFee.toFixed(2)} deposit / box
                                                        </p>
                                                    </div>
                                                    <span className="font-mono font-bold text-zinc-900 dark:text-white shrink-0">
                                                        ${(item.quantity * emptyBoxFee).toFixed(2)}
                                                    </span>
                                                </div>
                                            );
                                        })
                                )}
                            </div>

                            <div className="space-y-2.5 text-xs">
                                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                                    <span>Deposit Subtotal</span>
                                    <span className="font-mono font-medium text-zinc-900 dark:text-white">
                                        ${totalPrice.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                                    <span className="flex items-center gap-1.5">
                                        <Truck className="size-3.5 text-zinc-400" />
                                        Doorstep Delivery
                                    </span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">FREE</span>
                                </div>
                                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="size-3.5 text-zinc-400" />
                                        Destination Suburb
                                    </span>
                                    <span className="font-medium text-zinc-900 dark:text-white truncate max-w-36">
                                        {data.suburb ? `${data.suburb}, ${data.state}` : 'Pending'}
                                    </span>
                                </div>
                            </div>

                            {/* Dark Total Banner (matching PaymentConsole.tsx) */}
                            <div className="flex items-center justify-between p-5 bg-zinc-900 dark:bg-zinc-950 rounded-2xl text-white shadow-md">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                                        Total Box Deposit Due
                                    </span>
                                    <span className="text-xs text-zinc-300">
                                        Credited towards final shipping
                                    </span>
                                </div>
                                <span className="text-2xl font-mono font-bold tracking-tight tabular-nums">
                                    ${totalPrice.toFixed(2)}
                                </span>
                            </div>

                            <div className="space-y-2.5 pt-1">
                                <Button
                                    type="submit"
                                    disabled={processing || totalBoxes < 1}
                                    className="w-full h-12 text-sm font-bold bg-brand-rust hover:bg-brand-rust/90 text-white rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
                                    id="submit-empty-box-order-button"
                                >
                                    {processing ? (
                                        'Processing Order...'
                                    ) : data.payment_method === 'stripe' ? (
                                        <>
                                            <CreditCard className="size-4 shrink-0" />
                                            <span>Proceed to Payment (${totalPrice.toFixed(2)})</span>
                                            <ArrowRight className="size-4 shrink-0" />
                                        </>
                                    ) : (
                                        <>
                                            <span>
                                                Confirm Box Delivery Order ({totalBoxes} {totalBoxes === 1 ? 'Box' : 'Boxes'})
                                            </span>
                                            <ArrowRight className="size-4 shrink-0" />
                                        </>
                                    )}
                                </Button>

                                {data.payment_method === 'stripe' && (
                                    <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1.5">
                                        <Lock className="size-3 text-zinc-400 shrink-0" />
                                        <span>256-bit SSL encrypted Stripe checkout</span>
                                    </p>
                                )}
                            </div>

                            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-4 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1.5 border border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200 font-semibold">
                                    <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                                    <span>Deposit Credited on Shipment</span>
                                </div>
                                <p className="leading-relaxed">
                                    The ${emptyBoxFee.toFixed(2)}/box deposit is 100% credited towards your final ocean freight fee when your packed boxes are collected.
                                </p>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </Layout>
    );
}
