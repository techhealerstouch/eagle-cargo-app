import React from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import {
    RunsheetDispatchCalendar,
    type DispatchCalendarData,
} from '@/components/runsheets/RunsheetDispatchCalendar';
import type { BreadcrumbItem } from '@/types';

interface DeliveryCalendarPageProps {
    initialData: DispatchCalendarData;
    couriers?: Array<{ id: number; name: string; email?: string; courier?: { mobile?: string } | null }>;
    areas?: Array<{ id: number; name: string }>;
    filters?: {
        start?: string;
        end?: string;
        driver_id?: string | number;
        area_id?: string | number;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Delivery Runsheets', href: '/admin/runsheets/deliveries' },
    { title: 'Calendar View', href: '/admin/runsheets/deliveries/calendar' },
];

export default function DeliveryCalendarPage({
    initialData,
    couriers = [],
    areas = [],
}: DeliveryCalendarPageProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Delivery Schedule Calendar | Admin" />
            <RunsheetDispatchCalendar
                mode="delivery"
                initialData={initialData}
                couriers={couriers}
                areas={areas}
                tableUrl="/admin/runsheets/deliveries"
            />
        </AppLayout>
    );
}
