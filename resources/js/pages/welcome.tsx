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
    Calculator,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { Auth, BreadcrumbItem } from '@/types';
import PublicRateCalculator from '@/components/logistics/PublicRateCalculator';
import SeaFreightScheduleWidget from '@/components/logistics/SeaFreightScheduleWidget';

interface WelcomeProps {
    areas?: any[];
    provinces?: any[];
    boxTypes?: any[];
    boxPrices?: any[];
    pickupZones?: any[];
    suburbs?: any[];
    upcomingBatches?: any[];
}

export default function Welcome({
    areas = [],
    provinces = [],
    boxTypes = [],
    boxPrices = [],
    pickupZones = [],
    suburbs = [],
    upcomingBatches = [],
}: WelcomeProps) {
    const { auth, settings } = usePage<
        PageProps & { auth: Auth; settings?: any }
    >().props;
    const isGuest = !auth?.user;
    const appName = settings?.appName || 'Eagle Cargo';

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Welcome', href: '/home' },
    ];

    const Layout = isGuest ? MarketingLayout : AppLayout;
    const [trackingNumber, setTrackingNumber] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [heroTab, setHeroTab] = useState<'track' | 'calculator'>('track');

    // Dynamic Hero Quick Rate Estimator State
    const activeBoxTypes = useMemo(() => {
        return (boxTypes || []).filter(
            (bt) => !bt.name.toLowerCase().includes('custom'),
        );
    }, [boxTypes]);

    const [heroBoxTypeId, setHeroBoxTypeId] = useState<number>(() => {
        const jumbo = (boxTypes || []).find((b) =>
            b.name.toLowerCase().includes('jumbo'),
        );
        return jumbo?.id ?? (boxTypes[0]?.id || 1);
    });

    const [heroZoneId, setHeroZoneId] = useState<number>(() => {
        const metro = (pickupZones || []).find((z) =>
            z.name.toLowerCase().includes('metro'),
        );
        return metro?.id ?? (pickupZones[0]?.id || 5);
    });

    const sortedProvinces = useMemo(() => {
        if (!provinces || provinces.length === 0) return [];
        return [...provinces].sort((a: any, b: any) => {
            const isAMetro = (a.name || '')
                .toLowerCase()
                .includes('metro manila');
            const isBMetro = (b.name || '')
                .toLowerCase()
                .includes('metro manila');
            if (isAMetro && !isBMetro) return -1;
            if (!isAMetro && isBMetro) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [provinces]);

    const [heroProvinceId, setHeroProvinceId] = useState<number | null>(() => {
        if (!provinces || provinces.length === 0) return null;
        const manila = provinces.find(
            (p: any) =>
                (p.name || '').toLowerCase().includes('metro manila') ||
                (p.name || '').toLowerCase().includes('manila'),
        );
        return manila?.id ?? (provinces[0]?.id || null);
    });

    const heroSelectedProvince = useMemo(() => {
        if (!heroProvinceId) return null;
        return (
            (provinces || []).find((p: any) => p.id === heroProvinceId) || null
        );
    }, [provinces, heroProvinceId]);

    const [heroFallbackAreaId, setHeroFallbackAreaId] = useState<number>(() => {
        const manila = (areas || []).find((a) =>
            a.name.toLowerCase().includes('manila'),
        );
        return manila?.id ?? (areas[0]?.id || 1);
    });

    const heroAreaId = useMemo(() => {
        if (heroSelectedProvince?.area_id) {
            return Number(heroSelectedProvince.area_id);
        }
        return heroFallbackAreaId;
    }, [heroSelectedProvince, heroFallbackAreaId]);

    // Suburb filter / quick select state
    const [heroSuburbSearch, setHeroSuburbSearch] = useState('');
    const [selectedHeroSuburb, setSelectedHeroSuburb] = useState<any | null>(
        null,
    );

    const heroCalculatedRate = useMemo(() => {
        const match = (boxPrices || []).find(
            (bp) =>
                Number(bp.box_type_id) === Number(heroBoxTypeId) &&
                Number(bp.area_id) === Number(heroAreaId) &&
                Number(bp.pickup_zone_id) === Number(heroZoneId),
        );
        if (match && Number(match.price) > 0) {
            return Number(match.price);
        }
        const fallback = (boxPrices || []).find(
            (bp) =>
                Number(bp.box_type_id) === Number(heroBoxTypeId) &&
                Number(bp.area_id) === Number(heroAreaId) &&
                Number(bp.price) > 0,
        );
        return fallback ? Number(fallback.price) : 95;
    }, [boxPrices, heroBoxTypeId, heroAreaId, heroZoneId]);

    const heroSelectedBox = (boxTypes || []).find(
        (b) => b.id === heroBoxTypeId,
    ) ||
        activeBoxTypes[0] || { name: 'Jumbo Box' };
    const heroSelectedZone =
        (pickupZones || []).find((z) => z.id === heroZoneId) || pickupZones[0];
    const heroSelectedArea =
        (areas || []).find((a) => a.id === heroAreaId) || areas[0];

    const heroBookingUrl = useMemo(() => {
        const base = isGuest ? '/guest/book' : '/book';
        const params = new URLSearchParams();
        if (selectedHeroSuburb) {
            params.set('suburb', selectedHeroSuburb.name);
            if (selectedHeroSuburb.postcode)
                params.set('postcode', selectedHeroSuburb.postcode);
            params.set('state', 'VIC');
        }
        if (heroZoneId) params.set('pickup_zone_id', String(heroZoneId));
        if (heroAreaId) {
            params.set('area_id', String(heroAreaId));
        }
        if (heroSelectedProvince) {
            params.set('province', heroSelectedProvince.name);
        } else if (heroAreaId) {
            const matchingProvs = (provinces || []).filter(
                (p) => Number(p.area_id) === Number(heroAreaId),
            );
            if (matchingProvs.length === 1) {
                params.set('province', matchingProvs[0].name);
            } else if (heroSelectedArea) {
                const nameMatch = (provinces || []).find(
                    (p) =>
                        p.name.trim().toLowerCase() ===
                        heroSelectedArea.name?.trim().toLowerCase(),
                );
                if (nameMatch) {
                    params.set('province', nameMatch.name);
                }
            }
        }
        if (heroBoxTypeId) params.set('box_type_id', String(heroBoxTypeId));
        return `${base}?${params.toString()}`;
    }, [
        isGuest,
        selectedHeroSuburb,
        heroZoneId,
        heroAreaId,
        heroBoxTypeId,
        heroSelectedProvince,
        provinces,
        heroSelectedArea,
    ]);

    const handleTrackingSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const cleaned = trackingNumber.trim();
        if (!cleaned) return;
        setIsSearching(true);
        router.get('/track', { tracking_number: cleaned });
    };

    return (
        <Layout {...(!isGuest ? { breadcrumbs } : {})}>
            <Head
                title={`${appName} | Balikbayan Box Cargo & Logistics to the Philippines`}
            />

            {/* Hero Section */}
            <section className="relative flex min-h-[88vh] w-full items-center justify-center overflow-hidden border-b border-brand-sand/60 bg-linear-to-b from-brand-cream/60 via-brand-warm/30 to-white">
                {/* Ambient Maritime Background Image */}
                <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                    <img
                        src="/images/hero-cargo.jpg"
                        alt="Eagle Cargo Ocean Freight"
                        className="h-full w-full object-cover object-right opacity-80 transition-opacity duration-700 md:opacity-90 lg:object-[80%_center]"
                    />
                    {/* Left-side vibrant Light Blue to Sunset Orange gradient wash */}
                    <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                            background:
                                'linear-gradient(100deg, rgba(224, 242, 254, 0.95) 0%, rgba(224, 242, 254, 0.88) 25%, rgba(254, 215, 170, 0.75) 50%, rgba(254, 215, 170, 0.2) 65%, rgba(254, 215, 170, 0) 75%)',
                        }}
                    />

                    {/* Atmospheric Light Blue & Warm Sunset Orange ambient glows */}
                    <div className="pointer-events-none absolute -top-16 -left-16 size-[32rem] rounded-full bg-sky-200/40 blur-3xl" />
                    <div className="pointer-events-none absolute bottom-6 left-1/4 size-[28rem] rounded-full bg-orange-200/40 blur-3xl" />

                    {/* Bottom soft transition into the next section */}
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-orange-50/50 to-transparent" />
                    {/* Subtle top fade for the header */}
                    <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-sky-100/50 via-white/30 to-transparent" />
                </div>

                <div className="relative z-10 container mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:gap-8">
                    {/* Left Column: Heading & CTAs */}
                    <div className="mx-auto max-w-2xl text-center lg:col-span-7 lg:mx-0 lg:text-left">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-300/60 bg-white/80 px-4 py-1.5 text-xs font-bold text-zinc-800 shadow-2xs backdrop-blur-xs">
                            <Anchor className="size-3.5 text-brand-rust" />
                            Reliable Australia to Philippines Door-to-Door
                            Freight
                        </div>

                        <h1 className="mb-6 text-4xl leading-[1.1] font-black tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
                            Delivering love inside every{' '}
                            <span className="text-brand-rust underline decoration-brand-rust/30 underline-offset-8">
                                balikbayan box.
                            </span>
                        </h1>

                        <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed font-medium text-zinc-700 sm:text-lg lg:mx-0">
                            The most dependable, heartfelt cargo service
                            connecting Filipinos in Australia with family back
                            home. Safe ocean transit, customs clearance, and
                            direct delivery straight to their doorstep.
                        </p>

                        <div className="flex flex-col justify-center gap-3.5 sm:flex-row lg:justify-start">
                            <Button
                                asChild
                                size="lg"
                                className="h-13 rounded-2xl bg-brand-rust px-8 text-sm font-bold text-white shadow-md transition-all hover:bg-brand-rust/90 active:scale-98"
                            >
                                <Link href={isGuest ? '/guest/book' : '/book'}>
                                    Book a Pickup
                                    <ArrowRight className="ml-1.5 size-4" />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="h-13 rounded-2xl border-zinc-300 bg-white/90 px-8 text-sm font-bold text-zinc-800 shadow-xs backdrop-blur-xs transition-all hover:bg-white active:scale-98"
                            >
                                <a href="#rate-calculator">
                                    <Calculator className="mr-2 size-4 text-brand-rust" />
                                    <span>Calculate Rates</span>
                                </a>
                            </Button>
                        </div>
                    </div>

                    {/* Right Column: Interactive Tracker & Calculator Card */}
                    <div className="relative flex justify-center lg:col-span-5 lg:justify-end">
                        <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/90 bg-white/95 p-6 shadow-2xl shadow-zinc-900/10 backdrop-blur-md transition-all sm:p-7">
                            {/* Tab Toggle: Track vs Quick Rate */}
                            <div className="mx-auto mb-6 flex w-full max-w-[280px] items-center rounded-full border border-zinc-200 bg-zinc-100 p-1">
                                <button
                                    type="button"
                                    onClick={() => setHeroTab('track')}
                                    className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                                        heroTab === 'track'
                                            ? 'bg-white text-zinc-900 shadow-2xs'
                                            : 'text-zinc-500 hover:text-zinc-800'
                                    }`}
                                >
                                    Track Cargo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHeroTab('calculator')}
                                    className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                                        heroTab === 'calculator'
                                            ? 'bg-white text-zinc-900 shadow-2xs'
                                            : 'text-zinc-500 hover:text-zinc-800'
                                    }`}
                                >
                                    Price Quote
                                </button>
                            </div>

                            {heroTab === 'track' ? (
                                <>
                                    {/* Graphic simulation */}
                                    <div className="space-y-4 text-center">
                                        <div className="mx-auto flex size-18 items-center justify-center rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/15 via-orange-500/10 to-amber-500/10 text-brand-rust shadow-xs transition-transform duration-200 hover:scale-105 sm:size-20">
                                            <Package className="size-9 stroke-[1.8] sm:size-10" />
                                        </div>
                                        <div>
                                            <h2 className="font-sans text-xl font-bold tracking-tight text-zinc-900">
                                                Quick Shipment Lookup
                                            </h2>
                                            <p className="mt-1 font-sans text-xs text-zinc-500">
                                                Enter your tracking code or
                                                booking reference
                                            </p>
                                        </div>
                                    </div>

                                    {/* Working Public Tracking Search Form */}
                                    <form
                                        onSubmit={handleTrackingSearch}
                                        className="mt-6 space-y-3"
                                    >
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="e.g. TRK-2026-001 or BK-2026-042"
                                                value={trackingNumber}
                                                onChange={(e) =>
                                                    setTrackingNumber(
                                                        e.target.value,
                                                    )
                                                }
                                                className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 pr-11 font-sans text-sm text-zinc-900 transition-all placeholder:text-zinc-400 focus:border-brand-rust focus:bg-white focus:ring-2 focus:ring-brand-rust/20 focus:outline-none"
                                                required
                                            />
                                            <button
                                                type="submit"
                                                disabled={
                                                    !trackingNumber.trim() ||
                                                    isSearching
                                                }
                                                className="absolute top-1.5 right-1.5 flex size-9 cursor-pointer items-center justify-center rounded-xl bg-brand-rust text-white shadow-xs transition-all hover:bg-brand-rust/90 active:scale-95 disabled:opacity-50"
                                                title="Track Shipment"
                                            >
                                                {isSearching ? (
                                                    <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                ) : (
                                                    <Search className="size-4" />
                                                )}
                                            </button>
                                        </div>

                                        <p className="text-center font-sans text-[11px] text-zinc-400">
                                            Works for both active barcodes and
                                            pending references
                                        </p>
                                    </form>

                                    <div className="mt-6 border-t border-zinc-100 pt-5 text-center">
                                        <Link
                                            href={
                                                isGuest
                                                    ? '/guest/book'
                                                    : '/book'
                                            }
                                            className="inline-flex items-center gap-1 font-sans text-xs font-semibold text-brand-rust hover:underline"
                                        >
                                            Don't have a tracking number? Book a
                                            pickup &rarr;
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <div className="flex w-full flex-col items-center">
                                    {/* Header Badge & Title */}
                                    <div className="mb-2 flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-bold tracking-wider text-sky-800 uppercase shadow-2xs">
                                        <Calculator className="size-3" />
                                        <span>Dynamic Rate Estimator</span>
                                    </div>

                                    <h2 className="mb-1 text-xl font-bold tracking-tight text-zinc-900">
                                        Instant Box Quote
                                    </h2>
                                    <p className="mb-4 max-w-[320px] text-center text-[11px] text-zinc-500">
                                        Rates vary by your Victoria pickup zone
                                        & Philippine destination
                                    </p>

                                    {/* 1. Origin Pickup Zone Selector */}
                                    <div className="mb-2.5 w-full text-left">
                                        <div className="mb-1 flex items-center justify-between">
                                            <label className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                                                1. Pickup Zone (Victoria)
                                            </label>
                                            <span className="text-[10px] text-zinc-400">
                                                Doorstep Pickup
                                            </span>
                                        </div>
                                        <select
                                            value={heroZoneId}
                                            onChange={(e) => {
                                                setHeroZoneId(
                                                    Number(e.target.value),
                                                );
                                                setSelectedHeroSuburb(null);
                                                setHeroSuburbSearch('');
                                            }}
                                            className="h-9 w-full cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-800 outline-none focus:ring-2 focus:ring-brand-rust/30"
                                        >
                                            {pickupZones.map((z) => (
                                                <option key={z.id} value={z.id}>
                                                    {z.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* 2. Destination Province Selector */}
                                    <div className="mb-3 w-full text-left">
                                        <div className="mb-1 flex items-center justify-between">
                                            <label className="text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                                                2. Destination Province
                                            </label>
                                            {heroSelectedArea && (
                                                <span className="text-[10px] font-medium text-zinc-400">
                                                    Zone:{' '}
                                                    {heroSelectedArea.name}
                                                </span>
                                            )}
                                        </div>
                                        {sortedProvinces.length > 0 ? (
                                            <select
                                                value={heroProvinceId || ''}
                                                onChange={(e) =>
                                                    setHeroProvinceId(
                                                        e.target.value
                                                            ? Number(
                                                                  e.target
                                                                      .value,
                                                              )
                                                            : null,
                                                    )
                                                }
                                                className="h-9 w-full cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-800 outline-none focus:ring-2 focus:ring-brand-rust/30"
                                            >
                                                {sortedProvinces.map(
                                                    (p: any) => (
                                                        <option
                                                            key={p.id}
                                                            value={p.id}
                                                        >
                                                            {p.name}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        ) : (
                                            <select
                                                value={heroFallbackAreaId}
                                                onChange={(e) =>
                                                    setHeroFallbackAreaId(
                                                        Number(e.target.value),
                                                    )
                                                }
                                                className="h-9 w-full cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-800 outline-none focus:ring-2 focus:ring-brand-rust/30"
                                            >
                                                {areas.map((a) => (
                                                    <option
                                                        key={a.id}
                                                        value={a.id}
                                                    >
                                                        {a.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {/* 3. Box Size Pill Selector */}
                                    <div className="mb-3.5 w-full text-left">
                                        <label className="mb-1 block text-[10px] font-bold tracking-wider text-zinc-600 uppercase">
                                            3. Box Size
                                        </label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {activeBoxTypes
                                                .slice(0, 3)
                                                .map((bt) => {
                                                    const isSelected =
                                                        bt.id === heroBoxTypeId;
                                                    return (
                                                        <button
                                                            key={bt.id}
                                                            type="button"
                                                            onClick={() =>
                                                                setHeroBoxTypeId(
                                                                    bt.id,
                                                                )
                                                            }
                                                            className={`cursor-pointer rounded-xl border px-1 py-1.5 text-center text-[11px] font-bold transition-all ${
                                                                isSelected
                                                                    ? 'border-brand-rust bg-brand-rust text-white shadow-xs'
                                                                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                                                            }`}
                                                        >
                                                            <span className="block truncate">
                                                                {bt.name}
                                                            </span>
                                                            {bt.dimensions && (
                                                                <span
                                                                    className={`block truncate text-[9px] font-normal ${isSelected ? 'text-white/80' : 'text-zinc-400'}`}
                                                                >
                                                                    {
                                                                        bt.dimensions
                                                                    }
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>

                                    {/* 4. Live Quote Display Card */}
                                    <div className="mb-3.5 flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 text-left shadow-2xs">
                                        <div className="min-w-0 pr-2">
                                            <span className="block text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                                                All-Inclusive Door-to-Door
                                            </span>
                                            <span className="block truncate text-xs font-bold text-zinc-800">
                                                {heroSelectedBox?.name} to{' '}
                                                {heroSelectedProvince?.name ||
                                                    heroSelectedArea?.name ||
                                                    'Philippines'}
                                            </span>
                                            <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                                                <CheckCircle2 className="size-3 shrink-0" />{' '}
                                                Customs & doorstep delivery
                                                included
                                            </span>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <span className="font-mono text-2xl font-black text-zinc-900">
                                                ${heroCalculatedRate}
                                            </span>
                                            <span className="block text-[10px] font-bold text-zinc-400">
                                                AUD
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <Button
                                        asChild
                                        size="lg"
                                        className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand-rust text-xs font-bold text-white shadow-md transition-all hover:bg-brand-rust/90 active:scale-95 sm:text-sm"
                                    >
                                        <Link href={heroBookingUrl}>
                                            <span>
                                                Book This Box ($
                                                {heroCalculatedRate} AUD)
                                            </span>
                                            <ArrowRight className="size-4" />
                                        </Link>
                                    </Button>

                                    {/* Transparency Note */}
                                    <div className="mt-3 text-center text-[10px] text-zinc-500">
                                        <p>
                                            Prices strictly reflect your pickup
                                            zone & destination region.{' '}
                                            <a
                                                href="#rate-calculator"
                                                className="inline-flex items-center gap-0.5 font-semibold text-brand-rust hover:underline"
                                            >
                                                Search by Victorian suburb
                                                &rarr;
                                            </a>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Live Ocean Maritime Schedules Section */}
            <section className="border-b border-zinc-100 bg-slate-50/70 py-12 md:py-16">
                <div className="container mx-auto max-w-7xl px-4 md:px-8">
                    <SeaFreightScheduleWidget
                        upcomingBatches={upcomingBatches}
                        isGuest={isGuest}
                    />
                </div>
            </section>

            {/* How It Works Section */}
            <section className="border-b border-zinc-100 bg-white py-16 md:py-24">
                <div className="container mx-auto max-w-7xl px-4 md:px-8">
                    <div className="mx-auto mb-16 max-w-2xl text-center">
                        <span className="rounded-full bg-brand-rust/10 px-3.5 py-1 text-xs font-bold tracking-widest text-brand-rust uppercase">
                            Simple Process
                        </span>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-900 md:text-4xl">
                            How It Works
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                            Sending a balikbayan box has never been easier. We
                            handle the pickup, sea transit, customs clearance,
                            and delivery.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="relative rounded-3xl border border-zinc-200 bg-zinc-50/50 p-8 text-center transition-all hover:bg-white hover:shadow-lg hover:shadow-zinc-100">
                            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-brand-rust text-lg font-black text-white shadow-xs">
                                1
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-zinc-900">
                                Book Online in 2 Mins
                            </h3>
                            <p className="text-xs leading-relaxed text-zinc-600">
                                Choose your box size, input your pickup address
                                in Australia and destination in the Philippines.
                                No account required to get started.
                            </p>
                        </div>

                        <div className="relative rounded-3xl border border-zinc-200 bg-zinc-50/50 p-8 text-center transition-all hover:bg-white hover:shadow-lg hover:shadow-zinc-100">
                            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-brand-rust text-lg font-black text-white shadow-xs">
                                2
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-zinc-900">
                                Doorstep Home Collection
                            </h3>
                            <p className="text-xs leading-relaxed text-zinc-600">
                                Our professional driver arrives on your
                                scheduled pickup date, inspects the box, applies
                                official barcode tracking tags, and loads it
                                securely.
                            </p>
                        </div>

                        <div className="relative rounded-3xl border border-zinc-200 bg-zinc-50/50 p-8 text-center transition-all hover:bg-white hover:shadow-lg hover:shadow-zinc-100">
                            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-brand-rust text-lg font-black text-white shadow-xs">
                                3
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-zinc-900">
                                Door-to-Door Delivery
                            </h3>
                            <p className="text-xs leading-relaxed text-zinc-600">
                                Follow container movement across the sea. Once
                                cleared through Philippine customs, our local
                                couriers hand-deliver straight to your receiver.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Choose Us Section */}
            <section className="border-b border-zinc-100 bg-zinc-50/50 py-16 md:py-24">
                <div className="container mx-auto max-w-7xl px-4 md:px-8">
                    <div className="mx-auto mb-16 max-w-2xl text-center">
                        <span className="rounded-full bg-brand-rust/10 px-3.5 py-1 text-xs font-bold tracking-widest text-brand-rust uppercase">
                            Why Eagle Cargo
                        </span>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-900 md:text-4xl">
                            Built for Reliability & Trust
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                            Serving the Filipino-Australian community with care,
                            transparency, and dependable freight solutions.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xs transition-all hover:shadow-md">
                            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-brand-rust/10 text-brand-rust">
                                <ShieldCheck className="size-8 stroke-[2]" />
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-zinc-900">
                                Secure & Insured Cargo
                            </h3>
                            <p className="text-xs leading-relaxed text-zinc-600">
                                Heavy-duty strapping, tamper-evident seals, and
                                full insurance coverage options for peace of
                                mind.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xs transition-all hover:shadow-md">
                            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-brand-rust/10 text-brand-rust">
                                <Clock className="size-8 stroke-[2]" />
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-zinc-900">
                                Live Milestones & Tracking
                            </h3>
                            <p className="text-xs leading-relaxed text-zinc-600">
                                Accurate status logs from Australian dispatch,
                                sea vessel voyage, Manila port customs
                                inspection, and provincial courier runsheets.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xs transition-all hover:shadow-md">
                            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-brand-rust/10 text-brand-rust">
                                <HeartHandshake className="size-8 stroke-[2]" />
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-zinc-900">
                                Filipino-Led Heartfelt Care
                            </h3>
                            <p className="text-xs leading-relaxed text-zinc-600">
                                More than freight — it's family connection. Our
                                bilingual support team is always available to
                                assist in English and Tagalog.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Interactive Shipping Rate Calculator Section */}
            <section
                id="rate-calculator"
                className="scroll-mt-12 border-b border-zinc-100 bg-zinc-50/50 py-16 md:py-24"
            >
                <div className="container mx-auto max-w-7xl px-4 md:px-8">
                    <div className="mx-auto mb-12 max-w-2xl text-center">
                        <span className="rounded-full bg-brand-rust/10 px-3.5 py-1 text-xs font-bold tracking-widest text-brand-rust uppercase">
                            Transparent Door-to-Door Pricing
                        </span>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-900 md:text-4xl">
                            Instant Box Rate Calculator
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                            Select your pickup suburb in Australia, desired box
                            size, and recipient region in the Philippines to get
                            an exact all-inclusive price quote.
                        </p>
                    </div>

                    <div className="mx-auto max-w-4xl">
                        <PublicRateCalculator
                            areas={areas}
                            provinces={provinces}
                            boxTypes={boxTypes}
                            boxPrices={boxPrices}
                            pickupZones={pickupZones}
                            suburbs={suburbs}
                            isGuest={isGuest}
                        />
                    </div>
                </div>
            </section>

            {/* Box Sizes Preview */}
            <section className="border-b border-zinc-100 bg-white py-16 md:py-24">
                <div className="container mx-auto max-w-7xl px-4 md:px-8">
                    <div className="mx-auto mb-16 max-w-2xl text-center">
                        <span className="rounded-full bg-brand-rust/10 px-3.5 py-1 text-xs font-bold tracking-widest text-brand-rust uppercase">
                            Cargo Options
                        </span>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-900 md:text-4xl">
                            Standard Sizes & Custom CBM
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                            Heavy-duty corrugated boxes designed to withstand
                            ocean transit
                        </p>
                    </div>

                    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
                        <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-6 text-center">
                            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-rust/10 text-brand-rust">
                                <Package className="size-6" />
                            </div>
                            <h4 className="text-base font-bold text-zinc-900">
                                Jumbo Box
                            </h4>
                            <p className="mt-1 font-mono text-xs text-zinc-500">
                                24 &times; 24 &times; 24 inches
                            </p>
                            <p className="mt-3 text-xs text-zinc-600">
                                Best value for electronics, appliances, canned
                                goods, and large gifts.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-6 text-center">
                            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-rust/10 text-brand-rust">
                                <Package className="size-6" />
                            </div>
                            <h4 className="text-base font-bold text-zinc-900">
                                Regular Box
                            </h4>
                            <p className="mt-1 font-mono text-xs text-zinc-500">
                                20 &times; 20 &times; 20 inches
                            </p>
                            <p className="mt-3 text-xs text-zinc-600">
                                Perfect for clothes, shoes, chocolates, and
                                everyday household essentials.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-6 text-center">
                            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-rust/10 text-brand-rust">
                                <Boxes className="size-6" />
                            </div>
                            <h4 className="text-base font-bold text-zinc-900">
                                Custom Dimensions
                            </h4>
                            <p className="mt-1 font-mono text-xs text-zinc-500">
                                Priced per CBM
                            </p>
                            <p className="mt-3 text-xs text-zinc-600">
                                Furniture, irregular parcels, machinery, or
                                non-standard cargo sizes.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Bottom CTA Banner */}
            <section className="relative overflow-hidden bg-brand-navy py-16 text-white md:py-20">
                <div className="absolute top-0 right-0 h-full w-1/2 -skew-x-12 transform bg-brand-navy-light/40" />
                <div className="relative z-10 container mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-4 md:flex-row md:px-8">
                    <div className="max-w-2xl space-y-2 text-center md:text-left">
                        <h2 className="text-3xl font-black text-white md:text-4xl">
                            Ready to send joy to the Philippines?
                        </h2>
                        <p className="text-sm leading-relaxed text-zinc-300">
                            Schedule a pickup in minutes. Our driver will
                            collect directly from your Australian doorstep.
                        </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-center gap-3 sm:flex-row">
                        <Button
                            asChild
                            size="lg"
                            className="h-13 rounded-2xl bg-brand-rust px-8 text-sm font-bold text-white shadow-md hover:bg-brand-rust/90"
                        >
                            <Link href={isGuest ? '/guest/book' : '/book'}>
                                Book Pickup Now
                            </Link>
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            size="lg"
                            className="h-13 rounded-2xl border-white/20 bg-white/10 px-8 text-sm font-bold text-white hover:bg-white/20"
                        >
                            <Link href="/contact">Contact Support</Link>
                        </Button>
                    </div>
                </div>
            </section>
        </Layout>
    );
}
