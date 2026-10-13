import type { PageProps } from '@inertiajs/core';
import { Head, usePage } from '@inertiajs/react';
import { Newspaper, Calendar } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { Auth, BreadcrumbItem } from '@/types';

type ShippingUpdateData = {
    id: number;
    title: string;
    body: string;
    published_at: string;
    type: string;
};

export default function ShippingUpdates({ updates = [] }: { updates?: ShippingUpdateData[] }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Shipping Updates', href: '/shipping-updates' },
    ];

    const { auth, settings } = usePage<PageProps & { auth: Auth; settings?: any }>().props;
    const Layout = !auth.user ? MarketingLayout : AppLayout;
    const appName = settings?.appName || 'Eagle Cargo';

    return (
        <Layout breadcrumbs={breadcrumbs}>
            <Head title={`Shipping Updates | ${appName}`} />
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
                    {updates.length === 0 ? (
                        <div className="col-span-1 md:col-span-2 py-12 text-center text-brand-text-mid">
                            No shipping updates available at the moment.
                        </div>
                    ) : (
                        updates.map((update) => {
                            const date = new Date(update.published_at);
                            const formattedDate = new Intl.DateTimeFormat('en-US', {
                                month: 'long',
                                year: 'numeric',
                                day: 'numeric',
                            }).format(date);

                            return (
                                <article key={update.id} className="card">
                                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-brand-secondary">
                                        <Calendar className="size-4" />
                                        {formattedDate}
                                    </div>
                                    <h3 className="mb-3 font-serif text-2xl font-bold">
                                        {update.title}
                                    </h3>
                                    <div 
                                        className="mb-4 text-brand-text-mid prose prose-sm max-w-none prose-p:mb-2 prose-p:last:mb-0 line-clamp-3"
                                        dangerouslySetInnerHTML={{ __html: update.body }}
                                    />
                                    <a
                                        href={`#update-${update.id}`}
                                        className="text-sm font-semibold text-brand-primary hover:underline"
                                    >
                                        Read full update →
                                    </a>
                                </article>
                            );
                        })
                    )}
                </div>
            </div>
        </Layout>
    );
}
