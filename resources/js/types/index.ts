export type * from './auth';
export type * from './navigation';
export type * from './notifications';
export type * from './ui';
export type * from './settings';
export type * from './commissions';

import type { Auth } from './auth';
import type { GeneralSettings } from './settings';

export interface SharedData {
    name: string;
    auth: Auth;
    settings: GeneralSettings;
    sidebarOpen: boolean;
    sidebarCounts?: {
        bookings?: number;
        payments?: number;
        enquiries?: number;
        batches?: number;
        systemHealth?: number;
        myBookings?: number;
    } | null;
    flash?: {
        success?: string;
        error?: string;
        warning?: string;
        [key: string]: any;
    };
    [key: string]: unknown;
}
