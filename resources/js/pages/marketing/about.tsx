import type { PageProps } from '@inertiajs/core';
import { Head, usePage } from '@inertiajs/react';
import { HeartHandshake } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { Auth, BreadcrumbItem } from '@/types';

export default function About() {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'About Us', href: '/about' },
    ];

    const { auth } = usePage<PageProps & { auth: Auth }>().props;
    const Layout = !auth.user ? MarketingLayout : AppLayout;

    return (
        <Layout breadcrumbs={breadcrumbs}>
            <Head title="About Us | Box Tracker" />
            <div className="section-padding container-default">
                <div className="mx-auto mb-16 max-w-3xl text-center">
                    <span className="eyebrow mb-4 inline-block">
                        Our History
                    </span>
                    <h1 className="text-display-md mb-8">
About LOVE Box Tracker
                    </h1>
                    <p className="text-lg text-brand-text-mid">
LOVE Box Tracker was built to
                        connect Filipino families across the world.
                    </p>
                </div>
                <div className="card mx-auto flex max-w-4xl flex-col items-center text-center">
                    <HeartHandshake className="mb-6 size-16 text-brand-rust" />
                    <h2 className="text-display-sm mb-4">A legacy of care</h2>
                    <p className="mx-auto max-w-2xl text-brand-text-mid">
A box is not just a corrugated box
                        filled with love, hard work, and longing for home. We
                        exist to ensure that these precious items are treated
                        with the highest level of care, respect, and security.
                        Thank you for trusting us with your deliveries.
                    </p>
                </div>
            </div>
        </Layout>
    );
}





