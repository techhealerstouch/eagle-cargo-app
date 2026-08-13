import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { GlobalLoadingSpinner } from '@/components/common/global-loading-spinner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';

import '../css/app.css';
import 'leaflet/dist/leaflet.css';
import { configureEcho } from '@laravel/echo-react';

configureEcho({
    broadcaster: 'reverb',
});

const appName = import.meta.env.VITE_APP_NAME || 'Box Tracker';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) => {
        const pages = import.meta.glob('./pages/**/*.tsx');
        const path = `./pages/${name}.tsx`;

        return pages[path]
            ? resolvePageComponent(path, pages)
            : resolvePageComponent(Object.keys(pages).find(k => k.toLowerCase() === path.toLowerCase()) || path, pages);
    },
    setup({ el, App, props }) {
        if (!el) {
            throw new Error('Could not find Inertia app root element. Make sure @inertia is present in your Blade template.');
        }

        const root = createRoot(el);

        root.render(
            <StrictMode>
                <TooltipProvider delayDuration={0}>
                    <App {...props} />
                    <GlobalLoadingSpinner />
                    <Toaster position="top-right" richColors expand={true} />
                </TooltipProvider>
            </StrictMode>,
        );
    },
    progress: {
        color: '#117604ff',
    },
    defaults: {
        prefetch: {
            hoverDelay: 50,
            cacheFor: '1m',
        },
    },
});

// This will set light / dark mode on load...
initializeTheme();





