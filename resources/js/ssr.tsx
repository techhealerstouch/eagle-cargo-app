import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import ReactDOMServer from 'react-dom/server';
import { TooltipProvider } from '@/components/ui/tooltip';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createServer((page) =>
    createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        title: (title) => (title ? `${title} - ${appName}` : appName),
        resolve: (name) => {
            const pages = import.meta.glob('./pages/**/*.tsx');
            const path = `./pages/${name}.tsx`;

            return pages[path]
                ? resolvePageComponent(path, pages)
                : resolvePageComponent(Object.keys(pages).find(k => k.toLowerCase() === path.toLowerCase()) || path, pages);
        },
        setup: ({ App, props }) => {
            return (
                <TooltipProvider delayDuration={0}>
                    <App {...props} />
                </TooltipProvider>
            );
        },
        defaults: {
            prefetch: {
                hoverDelay: 50,
                cacheFor: '1m',
            },
        },
    }),
);





