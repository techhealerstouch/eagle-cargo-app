import { createPortal } from 'react-dom';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
    visible: boolean;
    message?: string;
    className?: string;
}

export function LoadingOverlay({ visible, message = 'Loading...', className }: LoadingOverlayProps) {
    if (!visible) {
return null;
}

    return createPortal(
        <div 
            className={cn(
                "fixed inset-0 z-[10000] flex items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in",
                className
            )}
        >
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
                    <div className="relative flex items-center justify-center">
                        <Spinner className="text-primary h-12 w-12" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center px-4">
                    <span className="text-xs font-medium tracking-[0.3em] text-primary/80 animate-pulse">
                        {message}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                        This may take a few moments
                    </span>
                </div>
            </div>
        </div>,
        document.body
    );
}


