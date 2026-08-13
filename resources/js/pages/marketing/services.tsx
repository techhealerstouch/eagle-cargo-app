import type { PageProps } from '@inertiajs/core';
import { Head, Link, usePage } from '@inertiajs/react';
import { Package, Globe, Anchor } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { Auth, BreadcrumbItem } from '@/types';

export default function Services() {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Our Services', href: '/services' },
    ];

    const { auth } = usePage<PageProps & { auth: Auth }>().props;
    const Layout = !auth.user ? MarketingLayout : AppLayout;

    return (
        <Layout {...(auth.user ? { breadcrumbs } : {})}>
            <Head title="Our Services | Box Tracker" />
            <div className="section-padding container-default">
                <div className="mx-auto mb-16 max-w-3xl text-center">
                    <span className="eyebrow mb-4 inline-block">
                        What We Do
                    </span>
                    <h1 className="text-display-md mb-8">
                        Cargo Box Shipping
                    </h1>
                    <p className="text-lg text-brand-text-mid">
                        Whether it's sea cargo or air cargo, we have options
                        crafted for your specific timetable and budget.
                    </p>
                </div>

                <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
                    <div className="card group text-center">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-warm">
                            <Anchor className="size-8 text-brand-rust" />
                        </div>
                        <h3 className="mb-4 font-serif text-2xl font-bold">
                            Sea Cargo (Standard)
                        </h3>
                        <p className="mb-6 text-brand-text-mid">
                            The classic, highly affordable cargo route for
                            heavy and large items. Delivered to the Philippines
                            via ship in 4-8 weeks depending on the island.
                        </p>
                        <p className="mb-6 text-sm font-semibold text-brand-text">
                            Best for: Groceries, bulk electronics, home
                            appliances, clothes.
                        </p>
                        <Link href="/book" className="btn-outline">
                            Book Standard Box
                        </Link>
                    </div>

                    <div className="card group relative overflow-hidden text-center">
                        <div className="absolute top-4 right-4 rounded-full bg-brand-primary px-3 py-1 text-xs font-bold text-white uppercase">
                            Fastest
                        </div>
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-warm">
                            <Globe className="size-8 text-brand-rust" />
                        </div>
                        <h3 className="mb-4 font-serif text-2xl font-bold">
                            Air Cargo (Express)
                        </h3>
                        <p className="mb-6 text-brand-text-mid">
                            Quick and reliable transit by air. Ideal for smaller
                            parcels, gifts, or time-sensitive documents to
                            arrive in 1-2 weeks.
                        </p>
                        <p className="mb-6 text-sm font-semibold text-brand-text">
                            Best for: Chocolates, urgent documents, latest
                            gadgets or gifts.
                        </p>
                        <Link href="/book" className="btn-primary">
                            Book Express Priority
                        </Link>
                    </div>
                </div>
            </div>
        </Layout>
    );
}





