import type { PageProps } from '@inertiajs/core';
import { Head, usePage } from '@inertiajs/react';
import { HeartHandshake } from 'lucide-react';
import React from 'react';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { Auth, BreadcrumbItem } from '@/types';

export default function About() {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'About Us', href: '/about' },
    ];

    const { auth, settings } = usePage<
        PageProps & { auth: Auth; settings?: any }
    >().props;
    const Layout = !auth.user ? MarketingLayout : AppLayout;
    const appName = settings?.appName || 'Eagle Cargo';

    return (
        <Layout breadcrumbs={breadcrumbs}>
            <Head title={`About Us | ${appName}`} />
            <div className="section-padding container-default mx-auto max-w-5xl px-4 py-12 md:py-16">
                <div className="mx-auto mb-12 max-w-3xl text-center">
                    <span className="eyebrow mb-3 inline-block rounded-full bg-brand-rust/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-rust">
                        Our Story
                    </span>
                    <h1 className="font-serif text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl md:text-5xl">
                        About {appName}
                    </h1>
                    <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
                        Connecting families across Australia and the Philippines with dependable door-to-door cargo services.
                    </p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-900 md:p-12">
                    <HeartHandshake className="mx-auto mb-6 size-16 text-brand-rust" />
                    <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                        A Legacy of Care & Trust
                    </h2>
                    <p className="mx-auto max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-base">
                        A Balikbayan box is not merely a parcel—it represents months of hard work, love, and care for loved ones miles away. At {appName}, we ensure every single box is handled with the highest level of security, transparent tracking, and dependable door-to-door delivery across the Philippines.
                    </p>
                </div>
            </div>
        </Layout>
    );
}
