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
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40 flex h-14 md:h-16 shrink-0 items-center justify-between border-b border-sidebar-border bg-background/95 backdrop-blur-md px-3 sm:px-4 lg:px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            {/* Left: Sidebar trigger + Breadcrumbs */}
            <div className="flex items-center gap-2 min-w-0 shrink mr-2 overflow-hidden">
                <SidebarTrigger className="-ml-1 shrink-0" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            {/* Center: Sleek Compact Localization widget */}
            <HeaderLocalization />

            {/* Right: Actions */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto sm:ml-0">
                <a
                    href="/declaration-form/blank"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                        e.preventDefault();
                        setIsConfirmOpen(true);
                    }}
                    title="Download Blank Declaration Form"
                >
                    <Button variant="ghost" size="sm" className="hidden md:inline-flex group cursor-pointer h-8 px-2 sm:px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80">
                        <Download className="size-3.5 opacity-80 group-hover:opacity-100 transition-opacity shrink-0" />
                        <span className="hidden xl:inline font-medium">Declaration Form</span>
                        <span className="hidden md:inline xl:hidden font-medium">Declaration</span>
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
