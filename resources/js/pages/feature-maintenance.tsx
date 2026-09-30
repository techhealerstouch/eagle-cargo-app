import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Clock, RefreshCw, Wrench } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type Props = {
    feature: {
        key: string;
        name: string;
        message?: string | null;
    };
};

export default function FeatureMaintenance({ feature }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: feature.name || 'Maintenance', href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${feature.name || 'Module'} Under Maintenance`} />

            <div className="flex min-h-[75vh] flex-1 items-center justify-center p-6">
                <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-brand-warm/30 bg-card p-8 shadow-xl text-center md:p-12">
                    {/* Background glow */}
                    <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-72 rounded-full bg-amber-500/10 blur-3xl" />

                    <div className="relative space-y-6">
                        {/* Icon Header */}
                        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-8 ring-amber-500/5 shadow-inner">
                            <Wrench className="size-10 animate-pulse" />
                        </div>

                        {/* Status Chip */}
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                                Temporary Maintenance
                            </span>
                        </div>

                        {/* Headings */}
                        <div className="space-y-2">
                            <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-text md:text-4xl">
                                {feature.name}
                            </h1>
                            <p className="text-sm font-semibold uppercase tracking-wider text-brand-text-light">
                                Module Temporarily Unavailable
                            </p>
                        </div>

                        {/* Message Box */}
                        <div className="rounded-2xl border border-brand-warm/20 bg-brand-warm/5 p-5 text-sm leading-relaxed text-brand-text-mid text-left">
                            <div className="flex items-start gap-3">
                                <Clock className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                                <div className="space-y-1">
                                    <p className="font-medium text-brand-text">Notice from System Operators</p>
                                    <p className="text-brand-text-mid">
                                        {feature.message ||
                                            'We are currently performing scheduled maintenance and updates on this feature to improve system stability. It will be restored shortly.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-brand-text-light">
                            All other services, deliveries, and tracking continue to operate normally.
                        </p>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
                            <Link
                                href="/dashboard"
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-rust px-6 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-md shadow-brand-rust/20 transition-all hover:bg-brand-rust/90 hover:shadow-lg hover:shadow-brand-rust/30"
                            >
                                <ArrowLeft className="size-4" />
                                <span>Return to Dashboard</span>
                            </Link>

                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-warm/30 bg-card px-6 py-3 text-sm font-bold uppercase tracking-wider text-brand-text shadow-sm transition-all hover:bg-brand-warm/10"
                            >
                                <RefreshCw className="size-4" />
                                <span>Check Again</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
