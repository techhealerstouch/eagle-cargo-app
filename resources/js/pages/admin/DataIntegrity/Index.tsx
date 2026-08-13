
import { Head, Link, router } from '@inertiajs/react';
import { ShieldAlert, CheckCircle, ArrowRight, AlertTriangle, Info, Clock, Search, X, PackageSearch, Warehouse, Ship, Truck, CreditCard, Database, Wrench } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import Heading from '@/components/common/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import * as bookingRoutes from '@/routes/admin/bookings';
import * as boxRoutes from '@/routes/admin/boxes';
import * as integrityRoutes from '@/routes/admin/data-integrity';
import type { BreadcrumbItem } from '@/types';

interface Warning {
    id: number;
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    is_resolved: boolean;
    created_at: string;
    metadata: any;
    record?: {
        id: number;
        reference_number?: string;
        tracking_number?: string;
    };
}

interface Props {
    warnings: {
        data: Warning[];
        links: any[];
    };
    filters: {
        category: string;
        type: string;
        severity: string;
        record_type: string;
        q: string;
    };
    filterOptions: {
        types: string[];
        severities: string[];
        categories: Record<string, number>;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'System Health', href: '#' },
];

const severityColors = {
    low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    high: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const typeLabels: Record<string, string> = {
    missing_declaration: 'Missing Declaration',
    missed_pickup: 'Missed Pickup',
    partial_pickup: 'Partial Pickup',
    orphan_box: 'Orphan Box',
    box_count_mismatch: 'Count Mismatch',
    stale_scan: 'Stale Scan',
    delayed_receipt: 'Delayed Receipt',
    missing_warehouse_location: 'Missing Warehouse Location',
    overdue_loading: 'Overdue Loading',
    batch_capacity_overrun: 'Batch Capacity Overrun',
    batch_status_blocked: 'Batch Status Blocked',
    missed_eta: 'Missed ETA',
    held_box: 'Held Box',
    damaged_box: 'Damaged Box',
    unpaid_loading_block: 'Unpaid Loading Block',
    delivery_overdue: 'Delivery Overdue',
    partial_delivery: 'Partial Delivery',
    delivery_proof_missing: 'Missing Delivery Proof',
    paid_no_payment_record: 'Paid Without Payment Record',
    payment_balance_mismatch: 'Payment Balance Mismatch',
    delivered_no_invoice: 'Delivered Without Invoice',
};

const categoryLabels: Record<string, string> = {
    all: 'All',
    pickup: 'Pickup',
    warehouse: 'Warehouse',
    batch: 'Batch',
    delivery: 'Delivery',
    payment: 'Payment',
    data: 'Data',
};

const categoryIcons = {
    all: ShieldAlert,
    pickup: PackageSearch,
    warehouse: Warehouse,
    batch: Ship,
    delivery: Truck,
    payment: CreditCard,
    data: Database,
};

export default function DataIntegrityIndex({ warnings, filters, filterOptions }: Props) {
    const [localFilters, setLocalFilters] = useState(filters);

    const handleResolve = (id: number) => {
        router.post(integrityRoutes.resolve.url(id), {}, {
            onSuccess: () => toast.success('Warning marked as resolved'),
        });
    };

    const applyFilters = () => {
        router.get('/admin/data-integrity', localFilters, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearFilters = () => {
        const cleared = { category: localFilters.category || '', type: '', severity: '', record_type: '', q: '' };
        setLocalFilters(cleared);
        router.get('/admin/data-integrity', cleared, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleCategoryChange = (category: string) => {
        const nextFilters = {
            ...localFilters,
            category: category === 'all' ? '' : category,
            type: '',
        };

        setLocalFilters(nextFilters);
        router.get('/admin/data-integrity', nextFilters, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Operations Exceptions | Admin" />

            <div className="flex h-full flex-1 flex-col gap-6 p-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-brand-warm/20 pb-6">
                    <Heading
                        eyebrow="System Health"
                        title="Operations Exceptions"
                        description="Review system health warnings, stale scans, SLA risks, and logistics exceptions before they become customer problems."
                    />
                    <Button 
                        onClick={() => router.post('/admin/data-integrity/scan', {}, { preserveScroll: true })}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                        <ShieldAlert className="size-5" />
                        <span className="font-bold tracking-wider">RUN SYSTEM SCAN</span>
                    </Button>
                </div>

                <Tabs
                    value={localFilters.category || 'all'}
                    onValueChange={handleCategoryChange}
                    className="w-full"
                >
                    <TabsList className="h-auto flex-wrap justify-start bg-white/50 backdrop-blur-sm border border-brand-warm/10 shadow-sm">
                        {Object.entries(categoryLabels).map(([category, label]) => {
                            const Icon = categoryIcons[category as keyof typeof categoryIcons];
                            const count = filterOptions.categories?.[category] ?? 0;

                            return (
                                <TabsTrigger key={category} value={category} className="gap-2">
                                    <Icon className="size-3" />
                                    {label}
                                    <span className="rounded-full bg-brand-warm/40 px-1.5 py-0.5 text-[10px] font-bold text-brand-text-mid">
                                        {count}
                                    </span>
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </Tabs>

                <div className="grid gap-3 rounded-2xl border border-brand-warm/20 bg-white p-4 shadow-sm md:grid-cols-[1fr_180px_180px_auto_auto]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-text-mid" />
                        <input
                            value={localFilters.q}
                            onChange={(event) => setLocalFilters({ ...localFilters, q: event.target.value })}
                            onKeyDown={(event) => event.key === 'Enter' && applyFilters()}
                            placeholder="Search message or record id"
                            className="h-11 w-full rounded-xl border border-brand-warm/20 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-brand-rust/40 focus:ring-2 focus:ring-brand-rust/10"
                        />
                    </div>

                    <select
                        aria-label="Filter by type"
                        value={localFilters.type}
                        onChange={(event) => setLocalFilters({ ...localFilters, type: event.target.value })}
                        className="h-11 rounded-xl border border-brand-warm/20 bg-white px-3 text-sm outline-none transition focus:border-brand-rust/40 focus:ring-2 focus:ring-brand-rust/10"
                    >
                        <option value="">All types</option>
                        {filterOptions.types.map((type) => (
                            <option key={type} value={type}>{typeLabels[type] || type}</option>
                        ))}
                    </select>

                    <select
                        aria-label="Filter by severity"
                        value={localFilters.severity}
                        onChange={(event) => setLocalFilters({ ...localFilters, severity: event.target.value })}
                        className="h-11 rounded-xl border border-brand-warm/20 bg-white px-3 text-sm capitalize outline-none transition focus:border-brand-rust/40 focus:ring-2 focus:ring-brand-rust/10"
                    >
                        <option value="">All severities</option>
                        {filterOptions.severities.map((severity) => (
                            <option key={severity} value={severity}>{severity}</option>
                        ))}
                    </select>

                    <Button type="button" onClick={applyFilters} className="h-11 rounded-xl px-5 text-xs font-bold uppercase tracking-wider">
                        Apply
                    </Button>

                    <Button type="button" variant="outline" onClick={clearFilters} className="h-11 gap-2 rounded-xl px-5 text-xs font-bold uppercase tracking-wider">
                        <X className="size-4" />
                        Clear
                    </Button>
                </div>

                <div className="grid gap-6">
                    {warnings.data.length > 0 ? (
                        warnings.data.map((warning) => (
                            <div
                                key={warning.id}
                                className="group relative overflow-hidden bg-white border border-brand-warm/20 rounded-2xl shadow-sm transition-all hover:shadow-md hover:border-brand-rust/20"
                            >
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                    warning.severity === 'high' ? 'bg-red-500' :
                                    warning.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                                }`}></div>

                                <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-start gap-4">
                                        <div className={`mt-1 p-2 rounded-xl ${severityColors[warning.severity]}`}>
                                            {warning.severity === 'high' ? <ShieldAlert className="size-5" /> :
                                             warning.severity === 'medium' ? <AlertTriangle className="size-5" /> : <Info className="size-5" />}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className={`text-[10px] uppercase tracking-widest font-bold ${severityColors[warning.severity]}`}>
                                                    {typeLabels[warning.type] || warning.type}
                                                </Badge>
                                                <span className="text-[10px] text-brand-text-mid font-medium flex items-center gap-1">
                                                    <Clock className="size-3" />
                                                    {new Date(warning.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-serif font-medium text-brand-text mb-2">
                                                {warning.message}
                                            </h3>

                                            {warning.metadata && (
                                                <div className="mb-3 grid gap-2 rounded-xl border border-brand-warm/20 bg-brand-cream/30 p-3 text-xs text-brand-text-mid md:grid-cols-2">
                                                    {warning.metadata.tracking_number && <span><strong>Tracking:</strong> {warning.metadata.tracking_number}</span>}
                                                    {warning.metadata.booking_reference && <span><strong>Booking:</strong> {warning.metadata.booking_reference}</span>}
                                                    {warning.metadata.status && <span><strong>Status:</strong> {warning.metadata.status.replaceAll('_', ' ')}</span>}
                                                    {warning.metadata.last_scan_at && <span><strong>Last scan:</strong> {new Date(warning.metadata.last_scan_at).toLocaleString()}</span>}
                                                    {warning.metadata.age_hours !== null && warning.metadata.age_hours !== undefined && <span><strong>Age:</strong> {warning.metadata.age_hours}h</span>}
                                                    {warning.metadata.severity_reason && <span><strong>Why:</strong> {warning.metadata.severity_reason}</span>}
                                                    {warning.metadata.recommended_action && (
                                                        <span className="md:col-span-2"><strong>Recommended action:</strong> {warning.metadata.recommended_action}</span>
                                                    )}
                                                </div>
                                            )}

                                            {warning.record && (
                                                <div className="flex items-center gap-3">
                                                    <Link
                                                        href={warning.metadata?.target_url || (warning.record.tracking_number
                                                            ? boxRoutes.show.url(warning.record.id)
                                                            : bookingRoutes.show.url(warning.record.id))}
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-rust hover:underline"
                                                    >
                                                        View Record
                                                        <ArrowRight className="size-3" />
                                                    </Link>
                                                    {warning.metadata?.resolve_url && (
                                                        <Link
                                                            href={warning.metadata.resolve_url}
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:underline"
                                                        >
                                                            <Wrench className="size-3" />
                                                            Resolve Issue
                                                            <ArrowRight className="size-3" />
                                                        </Link>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 md:border-l md:border-brand-warm/20 md:pl-6">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            title="Mark as resolved"
                                            className="h-9 w-9 p-0 text-brand-text-mid hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                            onClick={() => handleResolve(warning.id)}
                                        >
                                            <CheckCircle className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-emerald-50/30 rounded-3xl border-2 border-dashed border-emerald-100">
                            <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                                <CheckCircle className="size-10 text-emerald-500" />
                            </div>
                            <h3 className="text-xl font-serif font-medium text-brand-text mb-1">System is healthy</h3>
                            <p className="text-brand-text-mid max-w-xs text-center">
                                No system health warnings detected. Everything is looking good!
                            </p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {warnings.links.length > 3 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                        {((Array.isArray(warnings.links) ? warnings.links : (warnings.links ? Object.values(warnings.links) : []))).map((link, i) => (
                            <Link
                                key={i}
                                href={link.url || '#'}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                    link.active
                                        ? 'bg-brand-rust text-white shadow-md'
                                        : 'bg-white border border-brand-warm/20 text-brand-text hover:border-brand-rust/20'
                                } ${!link.url && 'opacity-50 cursor-not-allowed'}`}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
