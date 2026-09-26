import { Link, usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/layout/app-logo-icon';
import BrandLogoImage from '@/components/layout/brand-logo-image';
import MarketingLayout from '@/layouts/marketing-layout';
import type { AuthLayoutProps, SharedData } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { settings } = usePage<SharedData>().props;

    return (
        <MarketingLayout>
            <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center py-12 px-4 sm:px-6 md:px-8 font-sans">
                <div className="w-full max-w-md">
                    <div className="flex flex-col gap-8">
                        <div className="flex flex-col items-center gap-4">
                            <Link
                                href="/"
                                className="group flex flex-col items-center gap-3"
                            >
                                <div className="flex h-16 w-auto items-center justify-center transition-all group-hover:scale-105">
                                    <BrandLogoImage
                                        src={settings?.appLogo}
                                        alt={settings?.appName || 'Logo'}
                                        className="h-full w-auto max-w-full object-contain"
                                        fallback={
                                            <div className="flex h-20 w-20 items-center justify-center rounded-4xl border border-brand-warm/20 bg-brand-warm/10 text-brand-rust shadow-sm">
                                                <AppLogoIcon className="size-10" />
                                            </div>
                                        }
                                    />
                                </div>
                                <span className="sr-only">{title}</span>
                            </Link>

                            <div className="space-y-1 text-center">
                                <h1 className="text-2xl font-bold tracking-tight text-[#0a2540] sm:text-3xl">
                                    {title}
                                </h1>
                                <p className="text-sm text-zinc-500">
                                    {description}
                                </p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </MarketingLayout>
    );
}
