import type { PageProps } from '@inertiajs/core';
import { Head, usePage } from '@inertiajs/react';
import { Newspaper, Calendar } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { Auth, BreadcrumbItem } from '@/types';

export default function ShippingUpdates() {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Shipping Updates', href: '/shipping-updates' },
    ];

    const { auth } = usePage<PageProps & { auth: Auth }>().props;
    const Layout = !auth.user ? MarketingLayout : AppLayout;

    return (
        <Layout breadcrumbs={breadcrumbs}>
            <Head title="Shipping Updates | Box Tracker" />
            <div className="section-padding container-default mx-auto max-w-5xl">
                <div className="mb-16 text-center">
                    <span className="eyebrow mb-4 inline-block">
                        Announcements
                    </span>
                    <h1 className="text-display-md mb-8">Shipping Updates</h1>
                    <p className="mx-auto max-w-2xl text-lg text-brand-text-mid">
                        Stay informed on our latest container departures,
                        expected arrivals, and holiday cut-off dates.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    {/* Placeholder content for now */}
                    <article className="card">
                        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-brand-secondary">
                            <Calendar className="size-4" />
                            March 2026
                        </div>
                        <h3 className="mb-3 font-serif text-2xl font-bold">
                            Easter Holiday Cut-off Dates
                        </h3>
                        <p className="mb-4 line-clamp-3 text-brand-text-mid">
                            To ensure your boxes arrive in the Philippines
                            before the holy week restrictions take place, please
                            schedule your sea cargo collections before March
                            25th.
                        </p>
                        <a
                            href="#"
                            className="text-sm font-semibold text-brand-primary hover:underline"
                        >
                            Read full update →
                        </a>
                    </article>

                    <article className="card">
                        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-brand-secondary">
                            <Calendar className="size-4" />
                            February 2026
                        </div>
                        <h3 className="mb-3 font-serif text-2xl font-bold">
                            Container Vessel Arrival: LBB-V12
                        </h3>
                        <p className="mb-4 line-clamp-3 text-brand-text-mid">
                            Great news! Container LBB-V12 has cleared Manila
                            customs early. For recipients in Metro Manila,
                            expect deliveries to begin dispatching this weekend.
                        </p>
                        <a
                            href="#"
                            className="text-sm font-semibold text-brand-primary hover:underline"
                        >
                            Read full update →
                        </a>
                    </article>

                    <article className="card">
                        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-brand-secondary">
                            <Calendar className="size-4" />
                            January 2026
                        </div>
                        <h3 className="mb-3 font-serif text-2xl font-bold">
                            New Expansion to Mindanao Regions
                        </h3>
                        <p className="mb-4 line-clamp-3 text-brand-text-mid">
                            We are proud to announce enhanced direct delivery to
                            major cities in Mindanao, cutting down our previous
                            transit times by almost a week.
                        </p>
                        <a
                            href="#"
                            className="text-sm font-semibold text-brand-primary hover:underline"
                        >
                            Read full update →
                        </a>
                    </article>
                </div>
            </div>
        </Layout>
    );
}





