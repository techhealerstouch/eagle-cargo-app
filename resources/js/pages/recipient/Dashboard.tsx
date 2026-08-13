import { Head, Link } from '@inertiajs/react';
import { Package, User, MapPin, ArrowRight, Truck, CheckCircle2, Clock } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface BoxRecipient {
    address: string;
    city: string;
    province: string;
    phone_number?: string;
}

export interface Box {
    id: number;
    tracking_number: string;
    status: string;
    recipient?: BoxRecipient;
    updated_at: string;
}

interface Stats {
    total: number;
    active: number;
    delivered: number;
}

interface DashboardProps {
    boxes: Box[];
    stats: Stats;
    pageTitle?: string;
    breadcrumbs?: BreadcrumbItem[];
}

export default function Dashboard({ boxes, stats, pageTitle = 'Recipient Dashboard', breadcrumbs = [] }: DashboardProps) {
    const defaultBreadcrumbs: BreadcrumbItem[] = breadcrumbs.length > 0 ? breadcrumbs : [{ title: 'Home', href: '/recipient/dashboard' }];

    return (
        <AppLayout breadcrumbs={defaultBreadcrumbs}>
            <Head title={pageTitle} />

            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="size-12 rounded-2xl bg-brand-rust/10 flex items-center justify-center text-brand-rust border border-brand-rust/20">
                            <User className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-serif font-black text-brand-rust uppercase tracking-tight">Welcome back!</h1>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">Recipient Command Center</p>
                        </div>
                    </div>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="card group p-6">
                        <div className="flex items-center gap-3 mb-3">
                             <div className="p-2 bg-muted rounded-xl">
                                <Package className="h-4 w-4 text-brand-rust" />
                            </div>
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">Total Packages</div>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-brand-rust leading-none">{stats.total}</span>
                            <span className="text-[10px] text-muted-foreground mb-1 font-black uppercase tracking-widest opacity-40">Inbound</span>
                        </div>
                    </div>
                    <div className="card group p-6 border-l-4 border-l-amber-400">
                        <div className="flex items-center gap-3 mb-3">
                             <div className="p-2 bg-amber-100/50 dark:bg-amber-900/20 rounded-xl">
                                <Truck className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">Active Shipment</div>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-brand-rust leading-none">{stats.active}</span>
                            <span className="text-[10px] mb-1 font-black uppercase tracking-widest text-amber-600 opacity-70">In Transit</span>
                        </div>
                    </div>
                    <div className="card group p-6 border-l-4 border-l-emerald-400">
                        <div className="flex items-center gap-3 mb-3">
                             <div className="p-2 bg-emerald-100/50 dark:bg-emerald-900/20 rounded-xl">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">Delivered</div>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-brand-rust leading-none">{stats.delivered}</span>
                            <span className="text-[10px] mb-1 font-black uppercase tracking-widest text-emerald-600 opacity-70">Completed</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                         <h2 className="text-xl font-serif font-black flex items-center gap-3 text-brand-rust uppercase tracking-tight">
                            <div className="p-2 bg-brand-rust/10 rounded-xl">
                                <Package className="h-5 w-5 text-brand-rust" />
                            </div>
                            Incoming Logistics
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {boxes && boxes.length > 0 ? (
                            boxes.map((box: Box) => {
                                const getStatusIndex = (status: string) => {
                                    switch (status) {
                                        case 'pending':
                                        case 'collected': return 0;
                                        case 'received_by_branch': return 1;
                                        case 'in_transit': return 2;
                                        case 'arrived': return 3;
                                        case 'out_for_delivery':
                                        case 'delivered': return 4;
                                        default: return -1;
                                    }
                                };
                                const currentIdx = getStatusIndex(box.status);
                                const trackingSteps = ['Origin', 'Processing', 'Transit', 'Arrived', 'Delivery'];

                                return (
                                    <div key={box.id} className="card overflow-hidden group">
                                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Tracking Number</div>
                                                    <div className="text-lg font-black text-zinc-900 dark:text-zinc-100 font-mono">{box.tracking_number}</div>
                                                </div>
                                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    box.status === 'delivered' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                }`}>
                                                    {box.status.replace(/_/g, ' ')}
                                                </div>
                                            </div>

                                            {/* Minimal Track */}
                                            <div className="space-y-2">
                                                <div className="flex items-center w-full">
                                                    {trackingSteps.map((step, idx) => (
                                                        <div key={step} className="flex flex-1 items-center last:flex-none">
                                                            <div className={`h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900 z-10 ${idx <= currentIdx ? 'bg-brand-rust' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                                                            {idx < trackingSteps.length - 1 && (
                                                                <div className={`h-0.5 flex-1 ${idx < currentIdx ? 'bg-brand-rust' : 'bg-zinc-100 dark:bg-zinc-800'}`} />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-between text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                                                    <span>Origin</span>
                                                    <span>Processing</span>
                                                    <span>Transit</span>
                                                    <span>Arrived</span>
                                                    <span>Delivery</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 bg-muted/30 space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-card rounded-xl border border-border">
                                                    <MapPin className="h-4 w-4 text-muted-foreground opacity-60" />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Destination</div>
                                                    <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{box.recipient?.address}</div>
                                                    <div className="text-xs text-zinc-500">{box.recipient?.city}, {box.recipient?.province}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-2 text-zinc-500">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-medium">Last updated {new Date(box.updated_at).toLocaleDateString()}</span>
                                                </div>
                                                <Link
                                                    href={`/track?tracking_number=${box.tracking_number}`}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-rust hover:text-brand-rust/80 transition-colors"
                                                >
                                                    Full Details <ArrowRight className="h-3.5 w-3.5" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-full card p-12 text-center flex flex-col items-center justify-center">
                                <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-6">
                                    <Package className="h-10 w-10 text-muted-foreground/30" />
                                </div>
                                <h3 className="text-2xl font-serif font-black text-brand-rust uppercase tracking-tight">No incoming packages</h3>
                                <p className="text-muted-foreground mt-2 max-w-xs mx-auto text-[10px] font-black uppercase tracking-widest opacity-60">
                                    When someone sends you a package, it will appear here for you to track.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
