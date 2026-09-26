import type { PageProps } from '@inertiajs/core';
import { Head, Link, usePage, router } from '@inertiajs/react';
import {
    Package,
    Truck,
    HeartHandshake,
    ShieldCheck,
    ArrowRight,
    ArrowRightCircle,
    Search,
    Clock,
    MapPin,
    Boxes,
    CheckCircle2,
    Anchor,
} from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { Auth, BreadcrumbItem } from '@/types';

export default function Welcome() {
    const { auth, settings } = usePage<PageProps & { auth: Auth; settings?: any }>().props;
    const isGuest = !auth?.user;
    const appName = settings?.appName || 'Eagle Cargo';

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Welcome', href: '/home' },
    ];

    const Layout = isGuest ? MarketingLayout : AppLayout;
    const [trackingNumber, setTrackingNumber] = useState('');

    const handleTrackingSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!trackingNumber.trim()) return;
        router.get('/track', { tracking_number: trackingNumber.trim() });
    };

    return (
        <Layout {...(!isGuest ? { breadcrumbs } : {})}>
            <Head title={`${appName} | Balikbayan Box Cargo & Logistics to the Philippines`} />

            {/* Hero Section */}
            <section className="relative flex min-h-[88vh] w-full items-center justify-center overflow-hidden border-b border-brand-sand/60 bg-linear-to-b from-brand-cream/60 via-brand-warm/30 to-white">
                {/* Ambient Maritime Background Image */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <img
                        src="/images/hero-cargo.jpg"
                        alt="Eagle Cargo Ocean Freight"
                        className="h-full w-full object-cover object-right lg:object-[80%_center] opacity-80 md:opacity-90 transition-opacity duration-700"
                    />
                    {/* Left-side vibrant Light Blue to Sunset Orange gradient wash — full width with smooth zero-opacity fade to eliminate seam lines */}
                    <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'linear-gradient(100deg, rgba(224, 242, 254, 0.95) 0%, rgba(224, 242, 254, 0.88) 25%, rgba(254, 215, 170, 0.75) 50%, rgba(254, 215, 170, 0.2) 65%, rgba(254, 215, 170, 0) 75%)'
                        }}
                    />

                    {/* Atmospheric Light Blue & Warm Sunset Orange ambient glows */}
                    <div className="absolute -top-16 -left-16 size-[32rem] rounded-full bg-sky-200/40 blur-3xl pointer-events-none" />
                    <div className="absolute bottom-6 left-1/4 size-[28rem] rounded-full bg-orange-200/40 blur-3xl pointer-events-none" />

                    {/* Bottom soft transition into the next section */}
                    <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-white via-orange-50/50 to-transparent" />
                    {/* Subtle top fade for the header */}
                    <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-sky-100/50 via-white/30 to-transparent" />
                </div>

                <div className="container mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24 relative z-10 grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
                    {/* Left Column: Heading & CTAs */}
                    <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left lg:col-span-7">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-300/60 bg-white/80 px-4 py-1.5 text-xs font-bold text-zinc-800 shadow-2xs backdrop-blur-xs">
                            <Anchor className="size-3.5 text-brand-rust" />
                            Reliable Australia to Philippines Door-to-Door Freight
                        </div>

                        <h1 className="text-4xl font-black tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl leading-[1.1] mb-6">
                            Delivering love inside every{' '}
                            <span className="text-brand-rust underline decoration-brand-rust/30 underline-offset-8">
                                balikbayan box.
                            </span>
                        </h1>

                        <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-zinc-700 font-medium sm:text-lg lg:mx-0">
                            The most dependable, heartfelt cargo service connecting Filipinos in Australia with family back home. Safe ocean transit, customs clearance, and direct delivery straight to their doorstep.
                        </p>

                        <div className="flex flex-col justify-center gap-3.5 sm:flex-row lg:justify-start">
                            <Button asChild size="lg" className="h-13 rounded-2xl bg-brand-rust px-8 text-sm font-bold text-white shadow-md hover:bg-brand-rust/90 active:scale-98 transition-all">
                                <Link href="/guest/book">
                                    Book a Pickup
                                    <ArrowRight className="size-4 ml-1.5" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="h-13 rounded-2xl border-zinc-300 bg-white/90 px-8 text-sm font-bold text-zinc-800 hover:bg-white active:scale-98 transition-all shadow-xs backdrop-blur-xs">
                                <Link href="/track">
                                    Track Shipment
                                </Link>
                            </Button>
                        </div>


                    </div>

                    {/* Right Column: Interactive Tracker Card */}
                    <div className="relative flex justify-center lg:justify-end lg:col-span-5">
                        <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/90 bg-white/95 p-7 shadow-2xl shadow-zinc-900/10 backdrop-blur-md transition-all">
                            {/* Graphic simulation */}
                            <div className="space-y-4 text-center">
                                <div className="mx-auto flex size-20 items-center justify-center rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/15 via-orange-500/10 to-amber-500/10 text-[#c2410c] shadow-xs transition-transform duration-200 hover:scale-105">
                                    <Package className="size-10 stroke-[1.8]" />
                                </div>
                                <div>
                                    <h2 className="font-sans text-xl font-bold tracking-tight text-zinc-900">
                                        Quick Shipment Lookup
                                    </h2>
                                    <p className="mt-1 font-sans text-xs text-zinc-500">
                                        Enter your tracking code or booking reference
                                    </p>
                                </div>
                            </div>

                            {/* Working Public Tracking Search Form */}
                            <form onSubmit={handleTrackingSearch} className="mt-6 space-y-3">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="e.g. TRK-2026-001 or BK-2026-042"
                                        value={trackingNumber}
                                        onChange={(e) => setTrackingNumber(e.target.value)}
                                        className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 pr-11 font-sans text-sm text-zinc-900 placeholder:text-zinc-400 transition-all focus:border-[#c2410c] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c2410c]/20"
                                        required
                                    />
                                    <button
                                        type="submit"
                                        className="absolute right-1.5 top-1.5 flex size-9 cursor-pointer items-center justify-center rounded-xl bg-[#c2410c] text-white shadow-xs transition-all hover:bg-[#9a3412] active:scale-95"
                                        title="Track Shipment"
                                    >
                                        <Search className="size-4" />
                                    </button>
                                </div>

                                <p className="text-center font-sans text-[11px] text-zinc-400">
                                    Works for both active barcodes and pending references
                                </p>
                            </form>

                            <div className="mt-6 border-t border-zinc-100 pt-5 text-center">
                                <Link
                                    href="/guest/book"
                                    className="inline-flex items-center gap-1 font-sans text-xs font-semibold text-[#c2410c] hover:underline"
                                >
                                    Don't have a tracking number? Book a pickup &rarr;
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="border-b border-zinc-100 bg-white py-16 md:py-24">
                <div className="container mx-auto max-w-7xl px-4 md:px-8">
                    <div className="mx-auto mb-16 max-w-2xl text-center">
                        <span className="rounded-full bg-brand-rust/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-brand-rust">
                            Simple Process
                        </span>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-900 md:text-4xl">
                            How It Works
                        </h2>
                        <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
                            Sending a balikbayan box has never been easier. We handle the pickup, sea transit, customs clearance, and delivery.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="relative rounded-3xl border border-zinc-200 bg-zinc-50/50 p-8 text-center transition-all hover:bg-white hover:shadow-lg hover:shadow-zinc-100">
                            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-brand-rust text-lg font-black text-white shadow-xs">
                                1
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 mb-2">Book Online in 2 Mins</h3>
                            <p className="text-xs text-zinc-600 leading-relaxed">
                                Choose your box size, input your pickup address in Australia and destination in the Philippines. No account required to get started.
                            </p>
                        </div>

                        <div className="relative rounded-3xl border border-zinc-200 bg-zinc-50/50 p-8 text-center transition-all hover:bg-white hover:shadow-lg hover:shadow-zinc-100">
                            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-brand-rust text-lg font-black text-white shadow-xs">
                                2
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 mb-2">Doorstep Home Collection</h3>
                            <p className="text-xs text-zinc-600 leading-relaxed">
                                Our professional driver arrives on your scheduled pickup date, inspects the box, applies official barcode tracking tags, and loads it securely.
                            </p>
                        </div>

                        <div className="relative rounded-3xl border border-zinc-200 bg-zinc-50/50 p-8 text-center transition-all hover:bg-white hover:shadow-lg hover:shadow-zinc-100">
                            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-brand-rust text-lg font-black text-white shadow-xs">
                                3
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 mb-2">Door-to-Door Delivery</h3>
                            <p className="text-xs text-zinc-600 leading-relaxed">
                                Follow container movement across the sea. Once cleared through Philippine customs, our local couriers hand-deliver straight to your receiver.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Choose Us Section */}
            <section className="border-b border-zinc-100 bg-zinc-50/50 py-16 md:py-24">
                <div className="container mx-auto max-w-7xl px-4 md:px-8">
                    <div className="mx-auto mb-16 max-w-2xl text-center">
                        <span className="rounded-full bg-brand-rust/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-brand-rust">
                            Our Service Promise
                        </span>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-900 md:text-4xl">
                            Why Filipino Families Trust Us
                        </h2>
                        <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
                            We understand the months of hard work and love packed into every parcel.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-xs text-center transition-all hover:shadow-md">
                            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-brand-rust/10 text-brand-rust">
                                <ShieldCheck className="size-8 stroke-[2]" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 mb-2">Safe & Customs Compliant</h3>
                            <p className="text-xs text-zinc-600 leading-relaxed">
                                Strict handling protocols, tamper-evident seals, and streamlined Bureau of Customs processing to ensure your items arrive untouched.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-xs text-center transition-all hover:shadow-md">
                            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-brand-rust/10 text-brand-rust">
                                <Truck className="size-8 stroke-[2]" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 mb-2">Live Milestones & Tracking</h3>
                            <p className="text-xs text-zinc-600 leading-relaxed">
                                Accurate status logs from Australian dispatch, sea vessel voyage, Manila port customs inspection, and provincial courier runsheets.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-xs text-center transition-all hover:shadow-md">
                            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-brand-rust/10 text-brand-rust">
                                <HeartHandshake className="size-8 stroke-[2]" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 mb-2">Filipino-Led Heartfelt Care</h3>
                            <p className="text-xs text-zinc-600 leading-relaxed">
                                More than freight — it's family connection. Our bilingual support team is always available to assist in English and Tagalog.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Box Sizes Preview */}
            <section className="border-b border-zinc-100 bg-white py-16 md:py-24">
                <div className="container mx-auto max-w-7xl px-4 md:px-8">
                    <div className="mx-auto mb-16 max-w-2xl text-center">
                        <span className="rounded-full bg-brand-rust/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-brand-rust">
                            Cargo Options
                        </span>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-900 md:text-4xl">
                            Standard Sizes & Custom CBM
                        </h2>
                        <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
                            Heavy-duty corrugated boxes designed to withstand ocean transit
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
                        <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-6 text-center">
                            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-rust/10 text-brand-rust">
                                <Package className="size-6" />
                            </div>
                            <h4 className="text-base font-bold text-zinc-900">Jumbo Box</h4>
                            <p className="text-xs text-zinc-500 font-mono mt-1">24 &times; 24 &times; 24 inches</p>
                            <p className="mt-3 text-xs text-zinc-600">
                                Best value for electronics, appliances, canned goods, and large gifts.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-6 text-center">
                            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-rust/10 text-brand-rust">
                                <Package className="size-6" />
                            </div>
                            <h4 className="text-base font-bold text-zinc-900">Regular Box</h4>
                            <p className="text-xs text-zinc-500 font-mono mt-1">20 &times; 20 &times; 20 inches</p>
                            <p className="mt-3 text-xs text-zinc-600">
                                Perfect for clothes, shoes, chocolates, and everyday household essentials.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-6 text-center">
                            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-rust/10 text-brand-rust">
                                <Boxes className="size-6" />
                            </div>
                            <h4 className="text-base font-bold text-zinc-900">Custom Dimensions</h4>
                            <p className="text-xs text-zinc-500 font-mono mt-1">Priced per CBM</p>
                            <p className="mt-3 text-xs text-zinc-600">
                                Furniture, irregular parcels, machinery, or non-standard cargo sizes.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Bottom CTA Banner */}
            <section className="relative overflow-hidden bg-brand-navy py-16 md:py-20 text-white">
                <div className="absolute top-0 right-0 h-full w-1/2 -skew-x-12 transform bg-brand-navy-light/40" />
                <div className="container mx-auto max-w-7xl px-4 md:px-8 relative z-10 flex flex-col items-center justify-between gap-8 md:flex-row">
                    <div className="max-w-2xl text-center md:text-left space-y-2">
                        <h2 className="text-3xl font-black text-white md:text-4xl">
                            Ready to send joy to the Philippines?
                        </h2>
                        <p className="text-sm text-zinc-300 leading-relaxed">
                            Schedule a pickup in minutes. Our driver will collect directly from your Australian doorstep.
                        </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-center gap-3 sm:flex-row">
                        <Button asChild size="lg" className="h-13 rounded-2xl bg-brand-rust px-8 text-sm font-bold text-white hover:bg-brand-rust/90 shadow-md">
                            <Link href="/guest/book">
                                Book Pickup Now
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="h-13 rounded-2xl border-white/20 bg-white/10 px-8 text-sm font-bold text-white hover:bg-white/20">
                            <Link href="/contact">
                                Contact Support
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>
        </Layout>
    );
}
