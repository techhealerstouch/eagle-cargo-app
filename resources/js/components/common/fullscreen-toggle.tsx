import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export function FullscreenToggle() {
    const [isSupported, setIsSupported] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const canUseFullscreen = document.fullscreenEnabled;

        const syncFullscreenState = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };

        setIsSupported(canUseFullscreen);
        syncFullscreenState();

        document.addEventListener('fullscreenchange', syncFullscreenState);

        return () => {
            document.removeEventListener(
                'fullscreenchange',
                syncFullscreenState,
            );
        };
    }, []);

    const toggleFullscreen = async () => {
        if (typeof document === 'undefined') {
            return;
        }

        if (document.fullscreenElement) {
            await document.exitFullscreen();

            return;
        }

        await document.documentElement.requestFullscreen();
    };

    if (!isSupported) {
        return null;
    }

    const Icon = isFullscreen ? Minimize2 : Maximize2;
    const label = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="group h-9 w-9 cursor-pointer"
                    aria-label={label}
                    onClick={toggleFullscreen}
                >
                    <Icon className="size-5 opacity-80 group-hover:opacity-100" />
                </Button>
            </TooltipTrigger>
            <TooltipContent align="end">{label}</TooltipContent>
        </Tooltip>
    );
}
