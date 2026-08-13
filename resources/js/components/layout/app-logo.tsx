import { usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/layout/app-logo-icon';
import BrandLogoImage from '@/components/layout/brand-logo-image';
import { cn } from '@/lib/utils';

export default function AppLogo({ className }: { className?: string }) {
    const { settings } = usePage().props as any;
    const appLogo = settings?.appLogo;
    const appName = settings?.appName || 'Love Balikbayan Box';
    const appSubtitle = settings?.appSubtitle || 'SEA CARGO';

    // Dynamically adjust text size based on length to prevent layout breakage
    const isLongName = appName.length > 15;
    const nameClasses = isLongName
        ? 'text-xs sm:text-sm font-semibold'
        : 'text-sm sm:text-[15px] font-bold';

    return (
        <div
            className={cn(
                'flex items-center gap-3 transition-all duration-300',
                className,
            )}
        >
            <BrandLogoImage
                src={appLogo}
                alt={appName}
                className="size-10 shrink-0 object-contain transition-all duration-200 group-data-[state=collapsed]:size-8"
                fallback={
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary p-2 text-white transition-all duration-200 group-hover:bg-brand-primary-dark group-data-[state=collapsed]:size-8">
                        <AppLogoIcon className="size-5 group-data-[state=collapsed]:size-4" />
                    </div>
                }
            />

            {/* Text block - hidden when sidebar is collapsed */}
            <div className="flex min-w-0 flex-1 flex-col justify-center group-data-[state=collapsed]:hidden">
                <span
                    className={cn(
                        'line-clamp-2 font-sans leading-tight tracking-tight text-brand-text transition-all',
                        nameClasses,
                    )}
                >
                    {appName}
                </span>
                {appSubtitle && (
                    <span className="mt-0.5 flex min-w-0 items-center">
                        <span className="mr-1.5 inline-block h-[2px] w-3 shrink-0 rounded-full bg-[#c2410c] transition-all"></span>
                        <span className="truncate font-sans text-[8px] leading-none font-bold tracking-[0.15em] text-[#c2410c] uppercase transition-all sm:text-[9px]">
                            {appSubtitle}
                        </span>
                    </span>
                )}
            </div>
        </div>
    );
}
