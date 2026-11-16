import type { PageProps } from '@inertiajs/core';
import { Head, Link, usePage } from '@inertiajs/react';
import { Package, Anchor, Clock, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import PublicRateCalculator from '@/components/logistics/PublicRateCalculator';
import SeaFreightScheduleWidget from '@/components/logistics/SeaFreightScheduleWidget';
import type { Auth, BreadcrumbItem } from '@/types';

interface ServicesProps {
    areas?: any[];
    provinces?: any[];
    boxTypes?: any[];
    boxPrices?: any[];
    pickupZones?: any[];
    suburbs?: any[];
    upcomingBatches?: any[];
}

export default function Services({
    areas = [],
    provinces = [],
    boxTypes = [],
    boxPrices = [],
    pickupZones = [],
    suburbs = [],
    upcomingBatches = [],
}: ServicesProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Our Services', href: '/services' },
    ];

    const { auth, settings } = usePage<PageProps & { auth: Auth; settings?: any }>().props;
    const isGuest = !auth?.user;
    const Layout = isGuest ? MarketingLayout : AppLayout;
    const appName = settings?.appName || 'Eagle Cargo';

    return (
        <Layout {...(!isGuest ? { breadcrumbs } : {})}>
            <Head title={`Our Services & Shipping Rates | ${appName}`} />
            <div className="section-padding container-default">
                <div className="mx-auto mb-16 max-w-3xl text-center">
                    <span className="eyebrow mb-4 inline-block">
                        What We Do
                    </span>
                    <h1 className="text-display-md mb-8">
                        Cargo Box Shipping
                    </h1>
                    <p className="text-lg text-brand-text-mid leading-relaxed">
                        Dependable ocean freight and door-to-door cargo services connecting
                        Filipinos in Australia with family back home across the Philippines.
                    </p>
                </div>

                <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2 mb-20">
                    {/* Sea Cargo Standard */}
                    <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="size-14 rounded-2xl bg-brand-warm text-brand-rust flex items-center justify-center shadow-2xs">
                                    <Anchor className="size-7 stroke-[1.8]" />
                                </div>
                                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-brand-rust text-[10px] font-bold uppercase tracking-wider border border-brand-rust/20">
                                    Sea Freight
                                </span>
                            </div>
                            <h3 className="mb-2.5 font-serif text-2xl font-bold text-zinc-900 dark:text-white">
                                Sea Cargo (Door-to-Door)
                            </h3>
                            <p className="mb-6 text-sm text-brand-text-mid leading-relaxed">
                                The classic, highly affordable ocean route for heavy and large items. Delivered to the Philippines
                                via ship in 4–8 weeks depending on the destination island.
                            </p>
                            <div className="mb-6 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 p-4 text-xs space-y-2 text-left border border-slate-200/80 dark:border-zinc-700/80">
                                <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                                    <Clock className="size-3.5 text-brand-rust shrink-0" />
                                    <span><strong>Transit Time:</strong> 4–8 weeks door-to-door</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                                    <ShieldCheck className="size-3.5 text-brand-rust shrink-0" />
                                    <span><strong>Best for:</strong> Groceries, bulk electronics, home appliances, clothes</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2.5">
                            <Link href={isGuest ? '/guest/book' : '/book'} className="btn-primary w-full justify-center">
                                Book Sea Cargo
                            </Link>
                            <a href="#rate-calculator" className="text-xs font-semibold text-brand-text-mid hover:text-brand-rust inline-flex items-center justify-center gap-1 w-full transition-colors pt-1">
                                Calculate shipping rates <ArrowRight className="size-3" />
                            </a>
                        </div>
                    </div>

                    {/* Empty Box Delivery */}
                    <div className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="size-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-2xs">
                                    <Package className="size-7 stroke-[1.8]" />
                                </div>
                                <span className="px-3 py-1 rounded-full bg-amber-100/70 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-200/60 dark:border-amber-900/40">
                                    Box Supplies
                                </span>
                            </div>
                            <h3 className="mb-2.5 font-serif text-2xl font-bold text-zinc-900 dark:text-white">
                                Empty Box Delivery
                            </h3>
                            <p className="mb-6 text-sm text-brand-text-mid leading-relaxed">
                                Need empty boxes before booking your shipment? Order heavy-duty double-wall balikbayan boxes delivered directly to your doorstep to pack at your own pace.
                            </p>
                            <div className="mb-6 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 p-4 text-xs space-y-2 text-left border border-slate-200/80 dark:border-zinc-700/80">
                                <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                                    <CheckCircle2 className="size-3.5 text-amber-600 shrink-0" />
                                    <span><strong>Deposit:</strong> $10.00 per box (credited towards shipping)</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                                    <Clock className="size-3.5 text-amber-600 shrink-0" />
                                    <span><strong>Delivery:</strong> Scheduled directly to your home address</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2.5">
                            <Link href="/order-boxes" className="btn-primary w-full justify-center" id="services-order-empty-boxes-btn">
                                Order Empty Boxes
                            </Link>
                            <span className="text-[11px] text-brand-text-mid block text-center pt-1">
                                $10 deposit is deducted from your final shipping invoice
                            </span>
                        </div>
                    </div>
                </div>

                {/* Live Sea-Freight Container Schedule Calendar */}
                <div className="mb-20">
                    <SeaFreightScheduleWidget upcomingBatches={upcomingBatches} isGuest={isGuest} />
                </div>

                {/* Instant Public Shipping Rate Calculator */}
                <div id="rate-calculator" className="scroll-mt-12">
                    <div className="mx-auto mb-10 max-w-2xl text-center">
                        <span className="inline-block px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-3 shadow-2xs">
                            Transparent Door-to-Door Pricing
                        </span>
                        <h2 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-brand-text">
                            Instant Shipping Rate Calculator
                        </h2>
                        <p className="mt-3 text-sm sm:text-base leading-relaxed text-brand-text-mid">
                            Get an exact, all-inclusive price quote from your Australian address to any destination province in the Philippines.
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto">
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
            </div>
        </Layout>
    );
}