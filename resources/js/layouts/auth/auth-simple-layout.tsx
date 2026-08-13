import { Link, usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/layout/app-logo-icon';
import BrandLogoImage from '@/components/layout/brand-logo-image';
import type { AuthLayoutProps, SharedData } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { settings } = usePage<SharedData>().props;

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
            <div className="w-full max-w-sm">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <Link
                            href="/"
                            className="group flex flex-col items-center gap-3"
                        >
                            <div className="flex h-32 w-full items-center justify-center transition-all group-hover:scale-105">
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

                        <div className="space-y-3 text-center">
                            <h1 className="font-serif text-3xl leading-none font-bold tracking-tighter text-brand-rust uppercase">
                                {title}
                            </h1>
                            <div className="flex items-center justify-center gap-2">
                                <div className="h-px w-8 bg-brand-warm/20"></div>
                                <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                                    {description}
                                </p>
                                <div className="h-px w-8 bg-brand-warm/20"></div>
                            </div>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
