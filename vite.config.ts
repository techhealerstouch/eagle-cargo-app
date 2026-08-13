import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        host: 'localhost',
        port: 5173,
        hmr: {
            host: 'localhost',
        },
        origin: 'http://localhost:5173',
        cors: {
            origin: 'http://localhost:8080',
        },
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react({
            babel: {
                plugins: [
                    [
                        'babel-plugin-react-compiler',
                        {
                            sources: (filename: string) => {
                                return filename.includes('resources/js/') || filename.includes('resources\\js\\');
                            },
                        },
                    ],
                ],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
    esbuild: {
        jsx: 'automatic',
    },
    build: {
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        const parts = id.split('node_modules/').pop()?.split('/');
                        if (!parts || parts.length === 0) return 'vendor';

                        // Handle scoped packages like @inertiajs/react
                        const pkg = parts[0].startsWith('@') && parts.length > 1
                            ? `${parts[0]}/${parts[1]}`
                            : parts[0];

                        // Keep chunk names filesystem-safe
                        const safeName = pkg.replace('/', '_');
                        return `vendor-${safeName}`;
                    }
                },
            },
        },
    },
});
