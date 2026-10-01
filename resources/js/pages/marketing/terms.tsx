import React from 'react';
import { Head } from '@inertiajs/react';
import MarketingLayout from '@/layouts/marketing-layout';

import DeclarationTerms from '@/components/common/declaration-terms';

export default function Terms() {
    return (
        <MarketingLayout>
            <Head title="Terms of Service - Love Balikbayan" />
            <div className="py-20 md:py-32 bg-white dark:bg-zinc-900">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <h1 className="text-4xl font-serif font-bold text-zinc-900 dark:text-zinc-100 mb-8">Terms of Service</h1>
                    <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-400">
                        <DeclarationTerms variant="screen" />
                    </div>
                </div>
            </div>
        </MarketingLayout>
    );
}
