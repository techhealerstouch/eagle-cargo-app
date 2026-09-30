import React from 'react';
import { Head } from '@inertiajs/react';
import MarketingLayout from '@/layouts/marketing-layout';

export default function Privacy() {
    return (
        <MarketingLayout>
            <Head title="Privacy Policy - Love Balikbayan" />
            <div className="py-20 md:py-32 bg-white dark:bg-zinc-900">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <h1 className="text-4xl font-serif font-bold text-zinc-900 dark:text-zinc-100 mb-8">Privacy Policy</h1>
                    <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-400">
                        <p>Our Privacy Policy will be updated soon. Please check back later.</p>
                    </div>
                </div>
            </div>
        </MarketingLayout>
    );
}
