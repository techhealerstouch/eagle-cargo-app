import React from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import {
    RunsheetDispatchCalendar,
    type DispatchCalendarData,
} from '@/components/runsheets/RunsheetDispatchCalendar';
import type { BreadcrumbItem } from '@/types';

interface PickupCalendarPageProps {
    initialData: DispatchCalendarData;
    pickers?: Array<{ id: number; name: string; email?: string; picker?: { mobile?: string } | null }>;
    pickupZones?: Array<{ id: number; name: string; code: string }>;
    filters?: {
        start?: string;
        end?: string;
        driver_id?: string | number;
        zone_id?: string | number;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pickup Runsheets', href: '/admin/runsheets/pickups' },
    { title: 'Calendar View', href: '/admin/runsheets/pickups/calendar' },
];

export default function PickupCalendarPage({
    initialData,
    pickers = [],
    pickupZones = [],
}: PickupCalendarPageProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pickup Schedule Calendar | Admin" />
            <RunsheetDispatchCalendar
                mode="pickup"
                initialData={initialData}
                pickers={pickers}
                pickupZones={pickupZones}
                tableUrl="/admin/runsheets/pickups"
            />
        </AppLayout>
    );
}
