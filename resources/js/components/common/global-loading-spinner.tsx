import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '@/components/ui/spinner';

export function GlobalLoadingSpinner() {
    const [loading, setLoading] = useState(false);
    const activeVisits = useRef(new Set<any>());
    const showTimer = useRef<number | null>(null);

    useEffect(() => {
        const clearShowTimer = () => {
            if (showTimer.current !== null) {
                window.clearTimeout(showTimer.current);
                showTimer.current = null;
            }
        };

        const start = (event: any) => {
            const visit = event.detail.visit;

            if (visit.prefetch) {
                return;
            }

            activeVisits.current.add(visit);

            if (showTimer.current !== null) {
                return;
            }

            // Avoid flashing the overlay for very fast requests.
            showTimer.current = window.setTimeout(() => {
                if (activeVisits.current.size > 0) {
                    setLoading(true);
                }

                showTimer.current = null;
            }, 150);
        };

        const cleanupVisit = (visit: any) => {
            activeVisits.current.delete(visit);

            // Clean up any other completed/cancelled/interrupted visits
            for (const active of activeVisits.current) {
                if (
                    active.completed ||
                    active.cancelled ||
                    active.interrupted
                ) {
                    activeVisits.current.delete(active);
                }
            }

            if (activeVisits.current.size === 0) {
                clearShowTimer();
                setLoading(false);
            }
        };

        const finish = (event: any) => {
            const visit = event.detail.visit;

            if (visit.prefetch) {
                return;
            }

            cleanupVisit(visit);
        };

        const cancel = (event: any) => {
            const visit = event.detail.visit;

            if (visit.prefetch) {
                return;
            }

            cleanupVisit(visit);
        };

        const success = (event: any) => {
            // A page transition completed successfully. Reset state to ensure spinner hides.
            activeVisits.current.clear();
            clearShowTimer();
            setLoading(false);
        };

        const error = (event: any) => {
            // A request completed with validation errors. Reset state to ensure spinner hides.
            activeVisits.current.clear();
            clearShowTimer();
            setLoading(false);
        };

        const unbindStart = router.on('start', start);
        const unbindFinish = router.on('finish', finish);
        const unbindCancel = router.on('cancel', cancel);
        const unbindSuccess = router.on('success', success);
        const unbindError = router.on('error', error);

        return () => {
            clearShowTimer();
            unbindStart();
            unbindFinish();
            unbindCancel();
            unbindSuccess();
            unbindError();
        };
    }, []);

    if (!loading) {
return null;
}

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex animate-in items-center justify-center bg-background/60 backdrop-blur-sm transition-all duration-300 fade-in">
            <div className="flex flex-col items-center gap-4">
                <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary/20"></div>
                    <Spinner className="h-12 w-12 text-primary" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <span className="animate-pulse text-xs font-medium tracking-[0.3em] text-primary/80">
                        Please Wait
                    </span>
                </div>
            </div>
        </div>,
        document.body,
    );
}

