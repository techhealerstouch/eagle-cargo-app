import type { Auth } from '@/types/auth';
import type { GeneralSettings } from '@/types/settings';

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            settings: GeneralSettings;
            tracking_steps: {
                key: string;
                label: string;
                phase: string;
                order: number;
                icon: string;
                allowed_roles: string[];
                system_status: string;
            }[];
            sidebarOpen: boolean;
            flash?: {
                success?: string;
                error?: string;
                warning?: string;
                [key: string]: any;
            };
            [key: string]: unknown;
        };
    }
}

declare global {
    interface Window {
        Echo: any;
    }
}
