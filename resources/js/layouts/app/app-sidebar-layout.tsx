import { usePage, router } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { AppContent } from '@/components/layout/app-content';
import { AppShell } from '@/components/layout/app-shell';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppSidebarHeader } from '@/components/layout/app-sidebar-header';
import { PickerAssignmentModal } from '@/components/picker/PickerAssignmentModal';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { auth, flash } = usePage<{ auth: any; flash?: { success?: string; error?: string; warning?: string } }>().props;
    const isImpersonating = !!auth?.impersonator_id;
    const lastFlashRef = useRef<string | null>(null);

    useEffect(() => {
        // Build a fingerprint of the current flash to deduplicate
        const fingerprint = JSON.stringify({
            s: flash?.success || '',
            w: flash?.warning || '',
            e: flash?.error || '',
        });

        // Skip if this is the same flash we already showed
        if (fingerprint === lastFlashRef.current || fingerprint === '{"s":"","w":"","e":""}') {
            return;
        }

        lastFlashRef.current = fingerprint;

        if (flash?.success) {
            toast.success(flash.success);
        }

        if (flash?.warning) {
            toast.warning(flash.warning);
        }

        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    useEffect(() => {
        const role = auth?.user?.role;
        const isAdmin = role === 'super_admin' || role === 'admin';

        if (!isAdmin || !window.Echo) {
            return;
        }

        const channel = window.Echo.private('admin.system-health')
            .listen('.SystemHealthUpdated', (e: any) => {
                router.reload({ only: ['sidebarCounts', 'warnings', 'filterOptions'] });
                toast.info('System health anomaly detected or resolved.', {
                    description: 'The Operations Exceptions dashboard has been updated in real-time.',
                });
            });

        return () => {
            channel.stopListening('.SystemHealthUpdated');
        };
    }, [auth?.user?.role]);

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="noise-texture md:h-screen flex flex-col min-h-screen min-w-0 w-full">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                {auth?.user?.role === 'picker' && <PickerAssignmentModal />}
                {isImpersonating && (
                    <div className="bg-amber-600 dark:bg-amber-700 text-white px-6 py-2.5 flex items-center justify-between border-b border-amber-700/50 shadow-sm z-50 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="bg-white/20 text-white text-xs font-bold uppercase px-2 py-0.5 rounded tracking-wider">
                                Impersonating
                            </span>
                            <span>
                                You are currently logged in as <strong>{auth.user.name}</strong> ({auth.user.email}).
                            </span>
                        </div>
                        <a
                            href="/stop-impersonating"
                            className="inline-flex items-center gap-1.5 bg-white text-amber-800 px-3.5 py-1.5 rounded-lg font-bold text-xs uppercase hover:bg-amber-50 transition-colors shadow-sm"
                        >
                            <LogOut className="size-3.5" />
                            Leave Impersonation
                        </a>
                    </div>
                )}
                <div className="relative flex-1 min-w-0 md:overflow-y-auto w-full">
                    {/* Dot grid — single source of truth for all pages */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-0 dot-grid"
                    />
                    <div className="relative min-h-full w-full min-w-0">
                        {children}
                    </div>
                </div>
            </AppContent>
        </AppShell>
    );
}




