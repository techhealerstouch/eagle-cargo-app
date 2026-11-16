import React, { useState } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import { 
    Package, 
    Truck, 
    Calendar, 
    MapPin, 
    Phone, 
    CheckCircle2, 
    AlertCircle, 
    Plus, 
    Minus, 
    CreditCard, 
    Banknote, 
    ArrowLeft, 
    Sparkles, 
    ShieldCheck, 
    Clock, 
    DollarSign,
    Box as BoxIcon
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
    sender: SenderData | null;
    isGuest?: boolean;
    confirmedReference?: string | null;
    emptyBoxFee: number;
    breadcrumbs: BreadcrumbItem[];
}

export default function OrderBoxes({
    boxTypes = [],
    sender,
    isGuest = false,
    confirmedReference = null,
    emptyBoxFee = 10.00,
    breadcrumbs = [],
}: Props) {
    const Layout = isGuest ? MarketingLayout : AppLayout;
    const today = new Date().toISOString().split('T')[0];

    const { data, setData, post, processing, errors } = useForm({
        first_name: sender?.first_name || '',
        last_name: sender?.last_name || '',
        email: sender?.email || '',
        items: boxTypes.map((type, idx) => ({
            box_type_id: type.id,
            quantity: idx === 0 ? 1 : 0, // default 1 for standard box
        })),
        address: sender?.address || '',
        suburb: sender?.suburb || '',
        state: sender?.state || 'NSW',
        postcode: sender?.postcode || '',
        contact_number: sender?.mobile || '',
        delivery_date: '',
        payment_method: 'cash_on_pickup',
        delivery_notes: '',
    });

    const updateQuantity = (boxTypeId: number, delta: number) => {
        setData('items', data.items.map(item => {
            if (item.box_type_id === boxTypeId) {
                const nextQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: nextQty };
            }
            return item;
        }));
    };

    const totalBoxes = data.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const totalPrice = totalBoxes * emptyBoxFee;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (totalBoxes < 1) {
            toast.error('Please select at least 1 empty box to order.');
            return;
        }

        post('/order-boxes', {
            onError: () => {
                toast.error('Please check all required fields and try again.');
            },
        });
    };

    return (
        <Layout {...(!isGuest ? { breadcrumbs } : {})}>
            <Head title="Order Empty Balikbayan Boxes" />

            <div className="min-h-screen bg-linear-to-b from-amber-50/40 via-white to-zinc-50/50 py-8 px-4 sm:px-6 lg:px-8 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
                <div className="mx-auto max-w-5xl">
                    {/* Header */}
                    <div className="mb-8">
                        <Link
                            href={isGuest ? '/' : '/bookings'}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-brand-rust transition-colors mb-3"
                        >
                            <ArrowLeft className="size-3.5" />
                            <span>{isGuest ? 'Back to Home' : 'Back to My Bookings'}</span>
                        </Link>
                        {confirmedReference && (
                            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-xs dark:border-emerald-800/60 dark:bg-emerald-950/30">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                                                Empty Box Order Submitted — Reference {confirmedReference}
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
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5">
                                    <Package className="size-7 text-brand-rust shrink-0" />
                                    Order Empty Balikbayan Boxes
                                </h1>
                                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                                    Need boxes in advance? Order heavy-duty balikbayan boxes delivered directly to your doorstep.
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-bold">
                                <Sparkles className="size-3.5 text-brand-rust" />
                                <span>${emptyBoxFee.toFixed(2)} deposit per box</span>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Main Ordering Section */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* Step 1: Choose Box Types & Quantities */}
                            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="size-7 rounded-lg bg-brand-rust/10 text-brand-rust flex items-center justify-center font-bold text-xs">
                                            1
                                        </div>
                                        <div>
                                            <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                                                Select Box Types & Quantities
                                            </h2>
                                            <p className="text-xs text-zinc-500">
                                                Choose how many empty boxes you need delivered.
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                        {totalBoxes} box{totalBoxes !== 1 ? 'es' : ''} selected
                                    </span>
                                </div>

                                {errors.items && (
                                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 flex items-center gap-2">
                                        <AlertCircle className="size-4 shrink-0" />
                                        <span>{errors.items}</span>
                                    </div>
                                )}

                                <div className="space-y-3.5">
                                    {boxTypes.map((boxType) => {
                                        const currentItem = data.items.find(i => i.box_type_id === boxType.id);
                                        const qty = currentItem?.quantity || 0;

                                        return (
                                            <div
                                                key={boxType.id}
                                                className={cn(
                                                    "flex items-center justify-between p-4 rounded-xl border transition-all",
                                                    qty > 0 
                                                        ? "border-amber-300 bg-amber-50/40 dark:border-amber-700/60 dark:bg-amber-950/20 shadow-2xs" 
                                                        : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
                                                )}
                                            >
                                                <div className="flex items-start gap-3.5 min-w-0">
                                                    <div className={cn(
                                                        "size-10 rounded-xl flex items-center justify-center shrink-0 border",
                                                        qty > 0
                                                            ? "bg-brand-rust text-white border-brand-rust"
                                                            : "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                                    )}>
                                                        <BoxIcon className="size-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                                                                {boxType.name}
                                                            </h3>
                                                            {boxType.dimensions && (
                                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-200/70 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-semibold">
                                                                    {boxType.dimensions} in
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                            ${emptyBoxFee.toFixed(2)} deposit per box (refundable or credited towards shipment)
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Increment / Decrement controls */}
                                                <div className="flex items-center gap-2 shrink-0 ml-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(boxType.id, -1)}
                                                        disabled={qty === 0}
                                                        className={cn(
                                                            "size-8 rounded-lg flex items-center justify-center border transition-colors",
                                                            qty > 0
                                                                ? "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs"
                                                                : "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900"
                                                        )}
                                                    >
                                                        <Minus className="size-3.5" />
                                                    </button>
                                                    <span className="w-8 text-center font-bold text-sm text-zinc-900 dark:text-white">
                                                        {qty}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(boxType.id, 1)}
                                                        className="size-8 rounded-lg flex items-center justify-center border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs transition-colors"
                                                    >
                                                        <Plus className="size-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Step 2: Delivery Address & Contact */}
                            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-5">
                                    <div className="size-7 rounded-lg bg-brand-rust/10 text-brand-rust flex items-center justify-center font-bold text-xs">
                                        2
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                                            Delivery Address & Contact
                                        </h2>
                                        <p className="text-xs text-zinc-500">
                                            Where should our delivery driver drop off your empty boxes?
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {isGuest && (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                                <div>
                                                    <Label htmlFor="first_name" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                        First Name <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="first_name"
                                                        value={data.first_name}
                                                        onChange={(e) => setData('first_name', e.target.value)}
                                                        placeholder="e.g. Maria"
                                                        className="mt-1.5"
                                                    />
                                                    {errors.first_name && <p className="mt-1 text-xs text-red-600">{errors.first_name}</p>}
                                                </div>

                                                <div>
                                                    <Label htmlFor="last_name" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                        Last Name <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="last_name"
                                                        value={data.last_name}
                                                        onChange={(e) => setData('last_name', e.target.value)}
                                                        placeholder="e.g. Santos"
                                                        className="mt-1.5"
                                                    />
                                                    {errors.last_name && <p className="mt-1 text-xs text-red-600">{errors.last_name}</p>}
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="email" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                    Email Address <span className="text-red-500">*</span>
                                                </Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    value={data.email}
                                                    onChange={(e) => setData('email', e.target.value)}
                                                    placeholder="you@example.com"
                                                    className="mt-1.5"
                                                />
                                                <p className="mt-1 text-[11px] text-zinc-500">
                                                    We will send your empty box order confirmation and invoice to this email.
                                                </p>
                                                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                                            </div>
                                        </>
                                    )}
                                    <div>
                                        <Label htmlFor="address" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                            Street Address <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="address"
                                            value={data.address}
                                            onChange={(e) => setData('address', e.target.value)}
                                            placeholder="Unit / House Number, Street Name"
                                            className="mt-1.5"
                                        />
                                        {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                        <div>
                                            <Label htmlFor="suburb" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                Suburb <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="suburb"
                                                value={data.suburb}
                                                onChange={(e) => setData('suburb', e.target.value)}
                                                placeholder="e.g. Arundel"
                                                className="mt-1.5"
                                            />
                                            {errors.suburb && <p className="mt-1 text-xs text-red-600">{errors.suburb}</p>}
                                        </div>

                                        <div>
                                            <Label htmlFor="state" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                State <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="state"
                                                value={data.state}
                                                onChange={(e) => setData('state', e.target.value)}
                                                placeholder="e.g. QLD, NSW"
                                                className="mt-1.5"
                                            />
                                            {errors.state && <p className="mt-1 text-xs text-red-600">{errors.state}</p>}
                                        </div>

                                        <div>
                                            <Label htmlFor="postcode" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                Postcode <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                id="postcode"
                                                value={data.postcode}
                                                onChange={(e) => setData('postcode', e.target.value)}
                                                placeholder="e.g. 4214"
                                                className="mt-1.5"
                                            />
                                            {errors.postcode && <p className="mt-1 text-xs text-red-600">{errors.postcode}</p>}
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="contact_number" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                            Contact Phone Number <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="contact_number"
                                            value={data.contact_number}
                                            onChange={(e) => setData('contact_number', e.target.value)}
                                            placeholder="e.g. 0405 998 800"
                                            className="mt-1.5"
                                        />
                                        <p className="mt-1 text-[11px] text-zinc-500">
                                            Our driver will contact this number prior to arrival.
                                        </p>
                                        {errors.contact_number && <p className="mt-1 text-xs text-red-600">{errors.contact_number}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Step 3: Preferred Date & Instructions */}
                            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-5">
                                    <div className="size-7 rounded-lg bg-brand-rust/10 text-brand-rust flex items-center justify-center font-bold text-xs">
                                        3
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                                            Preferred Delivery Date & Instructions
                                        </h2>
                                        <p className="text-xs text-zinc-500">
                                            When would you like the boxes delivered?
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="delivery_date" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                            Preferred Delivery Date <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="delivery_date"
                                            type="date"
                                            min={today}
                                            value={data.delivery_date}
                                            onChange={(e) => setData('delivery_date', e.target.value)}
                                            className="mt-1.5"
                                        />
                                        {errors.delivery_date && <p className="mt-1 text-xs text-red-600">{errors.delivery_date}</p>}
                                    </div>

                                    <div>
                                        <Label htmlFor="delivery_notes" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                            Special Delivery Instructions (Optional)
                                        </Label>
                                        <Textarea
                                            id="delivery_notes"
                                            value={data.delivery_notes}
                                            onChange={(e) => setData('delivery_notes', e.target.value)}
                                            placeholder="e.g. Gate code, leave under the carport if no answer, beware of dog..."
                                            rows={3}
                                            className="mt-1.5 text-xs"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 block">
                                            Payment Method for Box Deposit
                                        </Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setData('payment_method', 'cash_on_pickup')}
                                                className={cn(
                                                    "flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                                                    data.payment_method === 'cash_on_pickup'
                                                        ? "border-brand-rust bg-brand-rust/5 text-zinc-900 dark:text-white shadow-2xs font-bold"
                                                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                                                )}
                                            >
                                                <Banknote className="size-4 text-brand-rust shrink-0" />
                                                <div>
                                                    <span className="text-xs block">Cash Upon Box Delivery</span>
                                                    <span className="text-[10px] text-zinc-500 font-normal">Pay driver directly</span>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setData('payment_method', 'bank_transfer')}
                                                className={cn(
                                                    "flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                                                    data.payment_method === 'bank_transfer'
                                                        ? "border-brand-rust bg-brand-rust/5 text-zinc-900 dark:text-white shadow-2xs font-bold"
                                                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                                                )}
                                            >
                                                <CreditCard className="size-4 text-brand-rust shrink-0" />
                                                <div>
                                                    <span className="text-xs block">Bank Transfer / PayID</span>
                                                    <span className="text-[10px] text-zinc-500 font-normal">Details provided on invoice</span>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Order Summary Sidebar */}
                        <div className="lg:col-span-4 sticky top-6 space-y-4">
                            <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <h3 className="font-bold text-base text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Package className="size-4 text-brand-rust" />
                                    Order Summary
                                </h3>

                                <div className="space-y-3 text-xs border-b border-zinc-100 dark:border-zinc-800 pb-4">
                                    {data.items.filter(i => i.quantity > 0).length === 0 ? (
                                        <p className="text-zinc-400 italic text-center py-2">
                                            No boxes selected yet
                                        </p>
                                    ) : (
                                        data.items.filter(i => i.quantity > 0).map(item => {
                                            const boxType = boxTypes.find(t => t.id === item.box_type_id);
                                            return (
                                                <div key={item.box_type_id} className="flex justify-between items-center text-zinc-700 dark:text-zinc-300">
                                                    <span>{item.quantity}x {boxType?.name || 'Box'}</span>
                                                    <span className="font-semibold">${(item.quantity * emptyBoxFee).toFixed(2)}</span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="pt-4 space-y-2 text-xs">
                                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                                        <span>Total Boxes</span>
                                        <span className="font-bold text-zinc-900 dark:text-white">{totalBoxes}</span>
                                    </div>
                                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                                        <span>Delivery Fee</span>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">FREE</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-extrabold text-zinc-900 dark:text-white pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                        <span>Total Due</span>
                                        <span className="text-brand-rust text-base">${totalPrice.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <Button
                                        type="submit"
                                        disabled={processing || totalBoxes < 1}
                                        className="w-full h-11 text-sm font-bold bg-brand-rust hover:bg-brand-rust/90 text-white rounded-xl shadow-xs"
                                        id="submit-empty-box-order-button"
                                    >
                                        {processing ? 'Submitting Order...' : `Confirm Order (${totalBoxes} Boxes)`}
                                    </Button>
                                </div>

                                <div className="mt-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3 text-[11px] text-zinc-500 space-y-1.5 border border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-semibold">
                                        <ShieldCheck className="size-3.5 text-emerald-600" />
                                        <span>100% Quality Guaranteed</span>
                                    </div>
                                    <p>
                                        Our heavy-duty double-wall corrugated boxes are specially manufactured for international sea freight.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
}
