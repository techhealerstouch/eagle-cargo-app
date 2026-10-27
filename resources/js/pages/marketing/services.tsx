import type { PageProps } from '@inertiajs/core';
import { Head, Link, usePage } from '@inertiajs/react';
import { Package, Globe, Anchor, Clock, ShieldCheck } from 'lucide-react';
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
                        Whether it's sea cargo or air cargo, we have options
                        crafted for your specific timetable and budget.
                    </p>
                </div>

                <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2 mb-20">
                    <div className="card group text-center flex flex-col justify-between border border-border shadow-sm hover:shadow-md transition-all">
                        <div>
                            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-warm text-brand-rust">
                                <Anchor className="size-8 stroke-[1.8]" />
                            </div>
                            <h3 className="mb-4 font-serif text-2xl font-bold">
                                Sea Cargo (Standard)
                            </h3>
                            <p className="mb-6 text-brand-text-mid leading-relaxed">
                                The classic, highly affordable cargo route for
                                heavy and large items. Delivered to the Philippines
                                via ship in 4-8 weeks depending on the island.
                            </p>
                            <div className="mb-6 rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-4 text-xs space-y-1.5 text-left border border-slate-200/80 dark:border-zinc-700/80">
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
                        <a href="#rate-calculator" className="btn-outline w-full justify-center">
                            Calculate Sea Rates
                        </a>
                    </div>

                    <div className="card group relative overflow-hidden text-center flex flex-col justify-between border border-border shadow-sm hover:shadow-md transition-all">
                        <div className="absolute top-4 right-4 rounded-full bg-brand-primary px-3 py-1 text-xs font-bold text-white uppercase tracking-wider">
                            Fastest
                        </div>
                        <div>
                            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-warm text-brand-rust">
                                <Globe className="size-8 stroke-[1.8]" />
                            </div>
                            <h3 className="mb-4 font-serif text-2xl font-bold">
                                Air Cargo (Express)
                            </h3>
                            <p className="mb-6 text-brand-text-mid leading-relaxed">
                                Quick and reliable transit by air. Ideal for smaller
                                parcels, gifts, or time-sensitive documents to
                                arrive in 1-2 weeks.
                            </p>
                            <div className="mb-6 rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-4 text-xs space-y-1.5 text-left border border-slate-200/80 dark:border-zinc-700/80">
                                <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                                    <Clock className="size-3.5 text-brand-primary shrink-0" />
                                    <span><strong>Transit Time:</strong> 1–2 weeks door-to-door</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                                    <ShieldCheck className="size-3.5 text-brand-primary shrink-0" />
                                    <span><strong>Best for:</strong> Chocolates, urgent documents, latest gadgets or gifts</span>
                                </div>
                            </div>
                        </div>
                        <Link href="/book" className="btn-primary w-full justify-center">
                            Book Express Priority
                        </Link>
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