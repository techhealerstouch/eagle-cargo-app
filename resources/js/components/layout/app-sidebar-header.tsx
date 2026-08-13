import { Download } from 'lucide-react';
import { useState } from 'react';
import { AppearanceToggle } from '@/components/common/appearance-toggle';
import DeclarationDownloadModal from '@/components/common/declaration-download-modal';
import { FullscreenToggle } from '@/components/common/fullscreen-toggle';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { GlobalQuickActions } from '@/components/layout/global-quick-actions';
import { HeaderLocalization } from '@/components/layout/header-localization';
import { NotificationDropdown } from '@/components/layout/notification-dropdown';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { toUrl } from '@/lib/utils';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border bg-background px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <HeaderLocalization />

            <div className="flex items-center gap-2">
                <a
                    href="/declaration-form/blank"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                        e.preventDefault();
                        setIsConfirmOpen(true);
                    }}
                >
                    <Button variant="ghost" size="sm" className="hidden lg:flex group cursor-pointer h-9 px-3 gap-2">
                        <Download className="size-5 opacity-80 group-hover:opacity-100" />
                        <span className="font-medium text-sm opacity-80 group-hover:opacity-100">Declaration Form</span>
                    </Button>
                </a>
                <GlobalQuickActions />
                <NotificationDropdown />
                <AppearanceToggle />
                <FullscreenToggle />
            </div>

            <DeclarationDownloadModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
            />
        </header>
    );
}




