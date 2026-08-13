import { Head } from '@inertiajs/react';
import AppearanceTabs from '@/components/common/appearance-tabs';
import Heading from '@/components/common/heading';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit as editAppearance } from '@/routes/appearance';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Look & Feel',
        href: editAppearance(),
    },
];

export default function Appearance() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Look & Feel" />

            <h1 className="sr-only">Look & Feel</h1>

            <SettingsLayout
                eyebrow="Settings"
                title="Look & Feel"
                description="Change how the app looks on your screen."
            >
                <div className="space-y-8">
                    <AppearanceTabs />

                    <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">What happens next?</p>
                        <p className="mt-1 text-sm text-zinc-500">
                            Changes apply instantly but only affect your own view.
                        </p>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}






