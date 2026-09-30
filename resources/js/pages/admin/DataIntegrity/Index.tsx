import { Head, Link, router } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronDown,
    Clock,
    Copy,
    CreditCard,
    Database,
    Download,
    ExternalLink,
    FileSpreadsheet,
    FileText,
    HardDrive,
    History,
    Info,
    Layers,
    LayoutGrid,
    Lightbulb,
    List,
    Maximize2,
    Minimize2,
    PackageSearch,
    Radio,
    RefreshCw,
    RotateCcw,
    Search,
    ShieldAlert,
    ShieldCheck,
    Ship,
    Truck,
    Volume2,
    VolumeX,
    Warehouse,
    Wrench,
    X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    record_type?: string;
    record_id?: number;
    message: string;
    is_resolved: boolean;
    resolved_at?: string | null;
    created_at: string;
    metadata: {
        tracking_number?: string;
        booking_reference?: string;
        status?: string;
        last_scan_at?: string;
        age_hours?: number;
        severity_reason?: string;
        recommended_action?: string;
        target_url?: string;
        resolve_url?: string;
        [key: string]: any;
    };
    record?: {
        id: number;
        reference_number?: string;
        tracking_number?: string;
        [key: string]: any;
    };
}

interface TelemetryData {
    database: {
        status: string;
        latency_ms: number;
        connection: string;
    };
    queue: {
        status: string;
        failed_jobs: number;
        driver: string;
    };
    cache: {
        status: string;
        driver: string;
    };
    storage: {
        status: string;
        writable: boolean;
        driver: string;
    };
    environment: {
        php_version: string;
        laravel_version: string;
        env: string;
        debug: boolean;
        last_scan_at: string | null;
    };
    security: {
        status: 'healthy' | 'warning' | 'critical';
        active_incidents: number;
        critical_incidents: number;
        blocked_uploads_last_24_hours: number;
        privileged_accounts_without_2fa: number;
        last_incident_at: string | null;
    };
}

interface Props {
    warnings: {
        data: Warning[];
        links: any[];
        current_page: number;
        last_page: number;
        total: number;
        from: number;
        to: number;
    };
    filters: {
        category: string;
        type: string;
        severity: string;
        record_type: string;
        status: string;
        q: string;
    };
    filterOptions: {
        types: string[];
        severities: string[];
        categories: Record<string, number>;
        resolvedCount?: number;
    };
    metrics?: {
        healthScore: number;
        severityCounts: {
            high: number;
            medium: number;
            low: number;
            resolvedToday: number;
            totalResolved: number;
            totalActive: number;
        };
        telemetry: TelemetryData;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'System Health', href: '#' },
];

const severityColors = {
    low: {
        badge: 'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
        dot: 'bg-blue-500',
        bar: 'bg-blue-500',
        icon: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400',
    },
    medium: {
        badge: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
        dot: 'bg-amber-500',
        bar: 'bg-amber-500',
        icon: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400',
    },
    high: {
        badge: 'bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60',
        dot: 'bg-red-500',
        bar: 'bg-red-500',
        icon: 'text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400',
    },
};

const typeLabels: Record<string, string> = {
    missing_declaration: 'Missing Customs Declaration',
    missed_pickup: 'Missed Pickup Window',
    partial_pickup: 'Partial Pickup',
    orphan_box: 'Orphan Box Record',
    box_count_mismatch: 'Box Count Mismatch',
    stale_scan: 'Stale Tracking Scan (>72h)',
    delayed_receipt: 'Delayed Warehouse Receipt',
    missing_warehouse_location: 'Missing Warehouse Bay',
    overdue_loading: 'Overdue Container Loading',
    batch_capacity_overrun: 'Batch Over Capacity',
    batch_status_blocked: 'Batch Status Blocked',
    missed_eta: 'Missed Vessel ETA',
    held_box: 'Held / Quarantine Box',
    damaged_box: 'Damaged Box Warning',
    unpaid_loading_block: 'Unpaid Staging Block',
    delivery_overdue: 'Delivery Overdue',
    partial_delivery: 'Partial Delivery',
    delivery_proof_missing: 'Missing Proof of Delivery',
    paid_no_payment_record: 'Paid Without Ledger Record',
    payment_balance_mismatch: 'Payment Balance Discrepancy',
    delivered_no_invoice: 'Delivered Without Invoice',
    paid_no_invoice: 'Paid Without Invoice',
    booking_status_mismatch: 'Booking Status Mismatch',
    port_dwell_overrun: 'Port Dwell Overrun (>7d)',
    orphan_runsheet_stop: 'Closed Runsheet Unacted Stops',
    payment_overcollection: 'Payment Overcollection Discrepancy',
    suspicious_file_upload: 'Suspicious File Upload Blocked',
    privileged_user_without_2fa: 'Privileged Account Missing Two-Factor Authentication',
    debug_mode_enabled: 'Production Debug Mode Enabled',
};

const categoryLabels: Record<string, string> = {
    all: 'All Exceptions',
    pickup: 'Pickup Ops',
    warehouse: 'Warehouse Hub',
    batch: 'Batch & Ocean',
    delivery: 'Final Mile',
    payment: 'Financial & Billing',
    data: 'Data Quality',
    security: 'Security Incidents',
};

const categoryIcons = {
    all: ShieldAlert,
    pickup: PackageSearch,
    warehouse: Warehouse,
    batch: Ship,
    delivery: Truck,
    payment: CreditCard,
    data: Database,
    security: ShieldAlert,
};

export default function DataIntegrityIndex({ warnings, filters, filterOptions, metrics }: Props) {
    const [localFilters, setLocalFilters] = useState(filters);
    const [isScanning, setIsScanning] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

    // Web App Fullscreen & Real-time Operations Console State
    const [isFullscreen, setIsFullscreen] = useState(false);
    const fullscreenContainerRef = useRef<HTMLDivElement>(null);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // 0 = paused, 15, 30, 60s
    const [countdown, setCountdown] = useState<number>(30);
    const [isAutoRefreshing, setIsAutoRefreshing] = useState<boolean>(false);
    const [isMuted, setIsMuted] = useState<boolean>(true);
    const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    const isResolvedView = localFilters.status === 'resolved';

    // Calculation defaults
    const healthScore = metrics?.healthScore ?? 100;
    const severityCounts = metrics?.severityCounts ?? {
        high: 0,
        medium: 0,
        low: 0,
        resolvedToday: 0,
        totalResolved: 0,
        totalActive: warnings.total || 0,
    };
    const telemetry = metrics?.telemetry;
    const security = telemetry?.security;
    const isSecurityView = localFilters.category === 'security';
    const hasSecurityFindings = (security?.active_incidents ?? 0) > 0
        || (security?.privileged_accounts_without_2fa ?? 0) > 0;
    const requiresSecurityAudit = (security?.active_incidents ?? 0) === 0
        && (security?.privileged_accounts_without_2fa ?? 0) > 0;

    // Web Audio Synthesizer Tone for Alert Chimes
    const playAlertSound = (type: 'success' | 'alert') => {
        if (isMuted) return;
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const audioCtx = new AudioCtx();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            if (type === 'alert') {
                osc.frequency.setValueAtTime(440, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.3);
            } else {
                osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.25);
            }
        } catch {
            // Audio context disabled or blocked
        }
    };

    // Fullscreen Toggle (Native HTML5 API with overlay fallback)
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (fullscreenContainerRef.current?.requestFullscreen) {
                fullscreenContainerRef.current.requestFullscreen().then(() => {
                    setIsFullscreen(true);
                }).catch(() => {
                    setIsFullscreen((prev) => !prev);
                });
            } else {
                setIsFullscreen((prev) => !prev);
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
            setIsFullscreen(false);
        }
    };

    const handleAutoRefreshChange = (interval: number) => {
        setAutoRefreshInterval(interval);
        setCountdown(interval);
        if (interval > 0) {
            toast.info(`Auto-refresh set to ${interval} seconds`);
        } else {
            toast.info('Auto-refresh paused');
        }
    };

    // Listen for Native Fullscreen change
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, []);

    // Check URL parameters for fullscreen mode
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('fullscreen') === '1' || urlParams.get('mode') === 'fullscreen') {
            setIsFullscreen(true);
        }
    }, []);

    // Keyboard Shortcuts (F: Fullscreen, Esc: Exit Fullscreen, R: Audit)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInputField = target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.isContentEditable
            );

            if (isInputField) return;

            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                toggleFullscreen();
            } else if (e.key === 'Escape' && isFullscreen) {
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                }
                setIsFullscreen(false);
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                if (!isScanning) {
                    handleScan();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen, isScanning]);

    // Auto-refresh countdown & background query reload
    useEffect(() => {
        if (autoRefreshInterval === 0) return;

        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    setIsAutoRefreshing(true);
                    router.reload({
                        only: ['warnings', 'metrics', 'filterOptions'],
                        onFinish: () => setIsAutoRefreshing(false),
                    });
                    return autoRefreshInterval;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [autoRefreshInterval]);

    // Live World Clock (Local & Manila)
    useEffect(() => {
        const clockTimer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(clockTimer);
    }, []);

    const handleResolve = (id: number) => {
        router.post(integrityRoutes.resolve.url(id), {}, {
            preserveScroll: true,
            onSuccess: () => {
                setSelectedIds((prev) => prev.filter((item) => item !== id));
                toast.success('Exception marked as resolved');
            },
        });
    };

    const handleReopen = (id: number) => {
        router.post(`/admin/data-integrity/${id}/reopen`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success('Exception reopened for operational review'),
        });
    };

    const handleBatchResolve = () => {
        if (selectedIds.length === 0) {
            return;
        }

        router.post('/admin/data-integrity/resolve-batch', { ids: selectedIds }, {
            preserveScroll: true,
            onSuccess: () => {
                setSelectedIds([]);
                toast.success(`${selectedIds.length} exceptions marked as resolved.`);
            },
        });
    };

    const handleScan = () => {
        setIsScanning(true);
        router.post(integrityRoutes.scan.url(), {}, {
            preserveScroll: true,
            onFinish: () => setIsScanning(false),
            onSuccess: () => toast.success('System health scan completed successfully.'),
        });
    };

    const handleExport = (format: 'csv' | 'excel' = 'csv') => {
        const queryParams = new URLSearchParams({
            format,
            status: localFilters.status || 'unresolved',
            category: localFilters.category || '',
            severity: localFilters.severity || '',
            type: localFilters.type || '',
        }).toString();

        window.location.href = `/admin/data-integrity/export?${queryParams}`;
    };

    const applyFilters = () => {
        router.get('/admin/data-integrity', localFilters, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearFilters = () => {
        const cleared = {
            category: '',
            type: '',
            severity: '',
            record_type: '',
            status: 'unresolved',
            q: '',
        };
        setLocalFilters(cleared);
        router.get('/admin/data-integrity', cleared, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const removeFilter = (key: keyof typeof localFilters) => {
        const next = { ...localFilters, [key]: '' };
        setLocalFilters(next);
        router.get('/admin/data-integrity', next, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleCategoryChange = (category: string) => {
        if (category === 'history') {
            const nextFilters = {
                ...localFilters,
                status: 'resolved',
                category: '',
                type: '',
            };
            setLocalFilters(nextFilters);
            router.get('/admin/data-integrity', nextFilters, {
                preserveState: true,
                preserveScroll: true,
            });

            return;
        }

        const nextFilters = {
            ...localFilters,
            status: 'unresolved',
            category: category === 'all' ? '' : category,
            type: '',
        };

        setLocalFilters(nextFilters);
        router.get('/admin/data-integrity', nextFilters, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === warnings.data.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(warnings.data.map((w) => w.id));
        }
    };

    const toggleSelectOne = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedTracking(text);
        toast.success(`Copied "${text}" to clipboard`);
        setTimeout(() => setCopiedTracking(null), 2000);
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (isNaN(diffInSeconds) || diffInSeconds < 0) return new Date(dateString).toLocaleDateString();
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) {
            const mins = Math.floor(diffInSeconds / 60);
            return `${mins}m ago`;
        }
        if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours}h ago`;
        }
        const days = Math.floor(diffInSeconds / 86400);
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const getScoreVariant = (score: number) => {
        if (score >= 90) {
            return { label: 'Optimal System State', color: 'text-emerald-600', bg: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-800' };
        }

        if (score >= 70) {
            return { label: 'Attention Required', color: 'text-amber-600', bg: 'bg-amber-500', pill: 'bg-amber-100 text-amber-800' };
        }

        return { label: 'Critical Action Needed', color: 'text-red-600', bg: 'bg-red-500', pill: 'bg-red-100 text-red-800' };
    };

    const scoreInfo = getScoreVariant(healthScore);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="System Health & Security Monitor | Admin" />

            <div
                ref={fullscreenContainerRef}
                className={`flex h-full flex-1 flex-col gap-6 w-full min-w-0 transition-all duration-300 ${
                    isFullscreen
                        ? 'fixed inset-0 z-50 overflow-y-auto bg-[#faf8f5] dark:bg-zinc-950 p-4 sm:p-6 lg:p-8 xl:p-10'
                        : 'p-4 sm:p-6 lg:p-8 xl:p-10'
                }`}
            >
                {/* Fullscreen Operations NOC Top Bar */}
                {isFullscreen && (
                    <div className="sticky top-0 z-40 -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8 xl:-mx-10 xl:-mt-10 mb-2 border-b border-brand-warm/20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 xl:px-10 py-3 shadow-md flex flex-wrap items-center justify-between gap-4">
                        {/* Left: NOC Command Center Badge & Status */}
                        <div className="flex items-center gap-3.5">
                            <div className="relative flex items-center justify-center size-9 rounded-xl bg-brand-navy text-white shadow-xs">
                                <Radio className="size-4 animate-pulse text-emerald-400" />
                                <span className="absolute -top-1 -right-1 flex size-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
                                </span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-serif font-bold text-sm tracking-tight text-brand-text dark:text-white">
                                        Operations NOC &bull; System Command Center
                                    </span>
                                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border ${
                                        healthScore >= 90
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                            : healthScore >= 70
                                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                                    }`}>
                                        {scoreInfo.label} &bull; {healthScore}%
                                    </span>
                                </div>
                                <p className="text-[11px] text-brand-text-mid dark:text-zinc-400">
                                    Full-Screen Workstation Console &bull; Press <kbd className="font-mono bg-brand-warm/20 px-1 rounded text-[10px]">Esc</kbd> or <kbd className="font-mono bg-brand-warm/20 px-1 rounded text-[10px]">F</kbd> to exit
                                </p>
                            </div>
                        </div>

                        {/* Center: Real-Time World Clocks */}
                        <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-brand-text dark:text-zinc-300 bg-brand-cream/30 dark:bg-zinc-800/60 px-4 py-1.5 rounded-xl border border-brand-warm/20">
                            <div className="flex items-center gap-1.5">
                                <Clock className="size-3.5 text-brand-text-mid" />
                                <span className="text-brand-text-mid text-[11px]">Local:</span>
                                <span className="font-bold">{currentTime.toLocaleTimeString()}</span>
                            </div>
                            <span className="text-brand-warm/40">|</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-brand-text-mid text-[11px]">Manila (PHT):</span>
                                <span className="font-bold">{currentTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' })}</span>
                            </div>
                        </div>

                        {/* Right: Operations Controls */}
                        <div className="flex items-center gap-2">
                            {/* Auto-Refresh Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5 rounded-xl border-brand-warm/30 bg-white hover:bg-brand-cream/40 text-brand-text shadow-xs text-xs font-semibold"
                                        title="Configure auto-refresh frequency"
                                    >
                                        <span className={`relative flex size-2 ${autoRefreshInterval > 0 ? 'text-emerald-500' : 'text-zinc-400'}`}>
                                            {autoRefreshInterval > 0 && (
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            )}
                                            <span className={`relative inline-flex rounded-full size-2 ${autoRefreshInterval > 0 ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                                        </span>
                                        <span className="text-[11px] font-mono">
                                            {autoRefreshInterval > 0 ? (
                                                isAutoRefreshing ? 'Syncing...' : `Live: ${countdown}s`
                                            ) : (
                                                'Paused'
                                            )}
                                        </span>
                                        <ChevronDown className="size-3 text-brand-text-mid/70 ml-0.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 shadow-lg border-brand-warm/25 bg-white dark:bg-card">
                                    <div className="px-2 py-1 text-[10px] font-bold text-brand-text-mid uppercase tracking-wider">
                                        Polling Rate
                                    </div>
                                    {[
                                        { label: 'Every 15 seconds', value: 15 },
                                        { label: 'Every 30 seconds', value: 30 },
                                        { label: 'Every 60 seconds', value: 60 },
                                        { label: 'Pause Auto-refresh', value: 0 },
                                    ].map((item) => (
                                        <DropdownMenuItem
                                            key={item.value}
                                            onClick={() => handleAutoRefreshChange(item.value)}
                                            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer transition ${
                                                autoRefreshInterval === item.value ? 'bg-brand-warm/20 font-bold text-brand-text' : 'hover:bg-brand-cream/50'
                                            }`}
                                        >
                                            <span>{item.label}</span>
                                            {autoRefreshInterval === item.value && <Check className="size-3.5 text-brand-rust" />}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Density Switcher */}
                            <div className="flex items-center rounded-xl border border-brand-warm/25 bg-brand-cream/20 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setDensity('comfortable')}
                                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                                        density === 'comfortable'
                                            ? 'bg-white shadow-xs text-brand-text dark:bg-card'
                                            : 'text-brand-text-mid hover:text-brand-text'
                                    }`}
                                    title="Comfortable layout"
                                >
                                    <LayoutGrid className="size-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDensity('compact')}
                                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                                        density === 'compact'
                                            ? 'bg-white shadow-xs text-brand-text dark:bg-card'
                                            : 'text-brand-text-mid hover:text-brand-text'
                                    }`}
                                    title="Compact density"
                                >
                                    <List className="size-3" />
                                </button>
                            </div>

                            {/* Sound Toggle */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setIsMuted(!isMuted);
                                    toast.info(!isMuted ? 'Sound alerts muted' : 'Sound alerts enabled');
                                    if (isMuted) playAlertSound('success');
                                }}
                                className="h-8 w-8 rounded-xl border border-brand-warm/30 bg-white hover:bg-brand-cream/40 text-brand-text-mid hover:text-brand-text"
                                title={isMuted ? 'Enable Sound Alerts' : 'Mute Sound Alerts'}
                            >
                                {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5 text-emerald-600" />}
                            </Button>

                            {/* Run Audit */}
                            <Button
                                size="sm"
                                onClick={handleScan}
                                disabled={isScanning}
                                className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs text-xs font-semibold px-3"
                            >
                                <RefreshCw className={`size-3 ${isScanning ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">{isScanning ? 'Auditing...' : 'Audit'}</span>
                                <kbd className="hidden md:inline-block ml-0.5 rounded border border-white/30 bg-white/20 px-1 py-0.2 font-mono text-[9px] text-white">
                                    R
                                </kbd>
                            </Button>

                            {/* Exit Fullscreen Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleFullscreen}
                                className="h-8 gap-1.5 rounded-xl border-brand-rust/40 bg-brand-rust text-white hover:bg-brand-rust/90 text-xs font-semibold shadow-xs"
                                title="Exit Fullscreen Mode [Esc or F]"
                            >
                                <Minimize2 className="size-3.5" />
                                <span>Exit Fullscreen</span>
                                <kbd className="hidden sm:inline-block ml-0.5 rounded border border-white/30 bg-white/20 px-1 py-0.2 font-mono text-[9px] text-white">
                                    Esc
                                </kbd>
                            </Button>
                        </div>
                    </div>
                )}

                {/* Hero Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-brand-warm/20">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-rust">
                                System Diagnostics
                            </span>
                            <span className="size-1 rounded-full bg-brand-warm/40" />
                            <span className="text-[11px] font-mono text-brand-text-mid flex items-center gap-1">
                                <span className={`size-1.5 rounded-full ${autoRefreshInterval > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                                {autoRefreshInterval > 0 ? `Auto-sync: ${countdown}s` : 'Auto-sync: Paused'}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold text-brand-text tracking-tight">
                            System Health & Security Control
                        </h1>
                        <p className="text-sm text-brand-text-mid max-w-2xl">
                            Infrastructure health, automated data audits, security findings, and exception triage for shipment operations.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Auto-Refresh Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-9 gap-1.5 rounded-xl border-brand-warm/30 bg-white hover:bg-brand-cream/40 text-brand-text shadow-xs text-xs font-semibold transition"
                                    title="Auto-refresh interval"
                                >
                                    <span className={`relative flex size-2 ${autoRefreshInterval > 0 ? 'text-emerald-500' : 'text-zinc-400'}`}>
                                        {autoRefreshInterval > 0 && (
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        )}
                                        <span className={`relative inline-flex rounded-full size-2 ${autoRefreshInterval > 0 ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                                    </span>
                                    <span className="text-[11px] font-mono">
                                        {autoRefreshInterval > 0 ? (
                                            isAutoRefreshing ? 'Syncing...' : `Live: ${countdown}s`
                                        ) : (
                                            'Paused'
                                        )}
                                    </span>
                                    <ChevronDown className="size-3 text-brand-text-mid/70 ml-0.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 shadow-lg border-brand-warm/25 bg-white dark:bg-card">
                                <div className="px-2 py-1 text-[10px] font-bold text-brand-text-mid uppercase tracking-wider">
                                    Polling Rate
                                </div>
                                {[
                                    { label: 'Every 15 seconds', value: 15 },
                                    { label: 'Every 30 seconds', value: 30 },
                                    { label: 'Every 60 seconds', value: 60 },
                                    { label: 'Pause Auto-refresh', value: 0 },
                                ].map((item) => (
                                    <DropdownMenuItem
                                        key={item.value}
                                        onClick={() => handleAutoRefreshChange(item.value)}
                                        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer transition ${
                                            autoRefreshInterval === item.value ? 'bg-brand-warm/20 font-bold text-brand-text' : 'hover:bg-brand-cream/50'
                                        }`}
                                    >
                                        <span>{item.label}</span>
                                        {autoRefreshInterval === item.value && <Check className="size-3.5 text-brand-rust" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Fullscreen Button */}
                        <Button
                            variant="outline"
                            onClick={toggleFullscreen}
                            className="h-9 gap-1.5 rounded-xl border-brand-warm/30 bg-white hover:bg-brand-cream/40 text-brand-text shadow-xs text-xs font-semibold transition"
                            title="Fullscreen Operations Console [F]"
                        >
                            <Maximize2 className="size-3.5 text-brand-rust" />
                            <span className="hidden sm:inline">Fullscreen Console</span>
                            <kbd className="hidden md:inline-block ml-0.5 rounded border border-brand-warm/30 bg-brand-cream/40 px-1.5 py-0.2 font-mono text-[9px] text-brand-text-mid">
                                F
                            </kbd>
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-9 gap-1.5 rounded-xl border-brand-warm/30 bg-white hover:bg-brand-cream/40 text-brand-text shadow-xs text-xs font-semibold transition"
                                    title="Export audit report"
                                >
                                    <Download className="size-3.5 text-brand-text-mid" />
                                    <span>Export Report</span>
                                    <ChevronDown className="size-3 text-brand-text-mid/70 ml-0.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-lg border-brand-warm/25 bg-white dark:bg-card">
                                <DropdownMenuItem
                                    onClick={() => handleExport('excel')}
                                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer hover:bg-brand-cream/50 transition"
                                >
                                    <FileSpreadsheet className="size-4 text-emerald-600 shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-brand-text">Styled Excel (.xls)</span>
                                        <span className="text-[10px] text-brand-text-mid">Color highlights & summary header</span>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleExport('csv')}
                                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer hover:bg-brand-cream/50 transition"
                                >
                                    <FileText className="size-4 text-brand-rust shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-brand-text">Standard CSV (.csv)</span>
                                        <span className="text-[10px] text-brand-text-mid">UTF-8 with executive header block</span>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                            onClick={handleScan}
                            disabled={isScanning}
                            className="h-9 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs px-4 text-xs font-semibold transition-all disabled:opacity-75"
                        >
                            <RefreshCw className={`size-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                            <span>{isScanning ? 'Scanning System...' : 'Run System Audit'}</span>
                            <kbd className="hidden lg:inline-block ml-1 rounded border border-white/30 bg-white/20 px-1 py-0.2 font-mono text-[9px] text-white">
                                R
                            </kbd>
                        </Button>
                    </div>
                </div>

                {hasSecurityFindings && !isResolvedView && security && (
                    <div
                        role="alert"
                        className={`flex flex-col gap-4 border p-4 shadow-sm md:flex-row md:items-center md:justify-between ${
                            security.status === 'critical'
                                ? 'border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100'
                                : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <ShieldAlert className={`mt-0.5 size-5 shrink-0 ${security.status === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />
                            <div>
                                <p className="text-sm font-bold">Security attention required</p>
                                <p className="mt-0.5 text-xs leading-5 opacity-90">
                                    {security.critical_incidents > 0
                                        ? `${security.critical_incidents} critical security incident${security.critical_incidents === 1 ? '' : 's'} require immediate review.`
                                        : `${security.privileged_accounts_without_2fa} privileged account${security.privileged_accounts_without_2fa === 1 ? '' : 's'} need confirmed two-factor authentication.`}
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            disabled={requiresSecurityAudit && isScanning}
                            onClick={requiresSecurityAudit ? handleScan : () => handleCategoryChange('security')}
                            className={security.status === 'critical'
                                ? 'gap-2 bg-red-700 text-white hover:bg-red-800'
                                : 'gap-2 bg-amber-700 text-white hover:bg-amber-800'}
                        >
                            {requiresSecurityAudit ? 'Run security audit' : 'Review security incidents'}
                            <ArrowRight className="size-3.5" />
                        </Button>
                    </div>
                )}

                {/* Infrastructure Telemetry Diagnostics Bar */}
                {telemetry && (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                        <div className="p-3.5 rounded-2xl border border-brand-warm/20 bg-white dark:bg-card shadow-xs flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                <Database className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-brand-text-mid">
                                    <span>Database</span>
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Optimal</span>
                                </div>
                                <div className="text-xs font-mono font-medium text-brand-text truncate">
                                    {telemetry.database.latency_ms}ms <span className="text-brand-text-mid/60 text-[10px]">({telemetry.database.connection})</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-2xl border border-brand-warm/20 bg-white dark:bg-card shadow-xs flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${telemetry.queue.failed_jobs > 0 ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                <Layers className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-brand-text-mid">
                                    <span>Queue / Jobs</span>
                                    <span className={`text-[10px] font-bold uppercase ${telemetry.queue.failed_jobs > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                                        {telemetry.queue.failed_jobs > 0 ? 'Alert' : 'Active'}
                                    </span>
                                </div>
                                <div className="text-xs font-mono font-medium text-brand-text truncate">
                                    {telemetry.queue.failed_jobs} Failed <span className="text-brand-text-mid/60 text-[10px]">({telemetry.queue.driver})</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-2xl border border-brand-warm/20 bg-white dark:bg-card shadow-xs flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                                <Activity className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-brand-text-mid">
                                    <span>Cache System</span>
                                    <span className="text-[10px] font-bold text-purple-600 uppercase">Healthy</span>
                                </div>
                                <div className="text-xs font-mono font-medium text-brand-text truncate capitalize">
                                    {telemetry.cache.driver} <span className="text-brand-text-mid/60 text-[10px]">driver</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-2xl border border-brand-warm/20 bg-white dark:bg-card shadow-xs flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                                <HardDrive className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-brand-text-mid">
                                    <span>Storage Engine</span>
                                    <span className="text-[10px] font-bold text-sky-600 uppercase">Writable</span>
                                </div>
                                <div className="text-xs font-mono font-medium text-brand-text truncate">
                                    {telemetry.storage.driver} <span className="text-brand-text-mid/60 text-[10px]">disk</span>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-2 md:col-span-1 p-3.5 rounded-2xl border border-brand-warm/20 bg-white dark:bg-card shadow-xs flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                                <Radio className="size-4 animate-pulse" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-brand-text-mid">
                                    <span>WebSockets</span>
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Syncing</span>
                                </div>
                                <div className="text-xs font-mono font-medium text-brand-text truncate">
                                    Reverb Live
                                </div>
                            </div>
                        </div>

                        <div className={`col-span-2 p-3.5 rounded-2xl border shadow-xs flex items-center gap-3 md:col-span-1 ${
                            telemetry.security.status === 'critical'
                                ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20'
                                : telemetry.security.status === 'warning'
                                    ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
                                    : 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20'
                        }`}>
                            <div className={`p-2 rounded-xl ${
                                telemetry.security.status === 'critical'
                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'
                                    : telemetry.security.status === 'warning'
                                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
                                        : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400'
                            }`}>
                                <ShieldCheck className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-brand-text-mid">
                                    <span>Security</span>
                                    <span className={`text-[10px] font-bold uppercase ${
                                        telemetry.security.status === 'critical'
                                            ? 'text-red-600'
                                            : telemetry.security.status === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                                    }`}>
                                        {telemetry.security.status === 'healthy' ? 'Clear' : telemetry.security.status}
                                    </span>
                                </div>
                                <div className="text-xs font-mono font-medium text-brand-text truncate">
                                    {telemetry.security.active_incidents} Open <span className="text-brand-text-mid/60 text-[10px]">({telemetry.security.blocked_uploads_last_24_hours} blocked / 24h)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* KPI Ribbon */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Score Card */}
                    <div className="relative overflow-hidden rounded-2xl border border-brand-warm/20 bg-gradient-to-br from-white to-brand-cream/30 dark:from-card dark:to-card/80 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-brand-text-mid">
                                Health Index
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scoreInfo.pill}`}>
                                {scoreInfo.label}
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-3xl font-serif font-bold text-brand-text">
                                {healthScore}%
                            </span>
                            <span className="text-xs text-brand-text-mid font-medium">
                                score rating
                            </span>
                        </div>
                        <div className="w-full bg-brand-warm/20 h-2 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${scoreInfo.bg}`}
                                style={{ width: `${healthScore}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-brand-text-mid mt-2.5">
                            {severityCounts.totalActive === 0
                                ? 'No open warnings across monitored systems.'
                                : `${severityCounts.totalActive} active warnings requiring triage.`}
                        </p>
                    </div>

                    {/* High Severity */}
                    <div className="rounded-2xl border border-red-200/80 dark:border-red-950 bg-red-50/40 dark:bg-red-950/20 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                                Critical Severity
                            </span>
                            <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/50 text-red-600">
                                <ShieldAlert className="size-4" />
                            </div>
                        </div>
                        <div className="text-3xl font-serif font-bold text-red-700 dark:text-red-400">
                            {severityCounts.high}
                        </div>
                        <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-1">
                            Urgent operational or security findings
                        </p>
                    </div>

                    {/* Medium Severity */}
                    <div className="rounded-2xl border border-amber-200/80 dark:border-amber-950 bg-amber-50/40 dark:bg-amber-950/20 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                Warnings & SLA
                            </span>
                            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600">
                                <AlertTriangle className="size-4" />
                            </div>
                        </div>
                        <div className="text-3xl font-serif font-bold text-amber-700 dark:text-amber-400">
                            {severityCounts.medium}
                        </div>
                        <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">
                            Stale scans (&gt;72h), delayed receipts, loading blocks
                        </p>
                    </div>

                    {/* Low & Resolved */}
                    <div className="rounded-2xl border border-brand-warm/20 bg-white dark:bg-card p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-brand-text-mid">
                                Low / Data Checks
                            </span>
                            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                                <Info className="size-4" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-3">
                            <div className="text-3xl font-serif font-bold text-brand-text">
                                {severityCounts.low}
                            </div>
                            <span className="text-xs text-brand-text-mid">
                                active info warnings
                            </span>
                        </div>
                        <div className="mt-2 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            {severityCounts.resolvedToday} resolved today ({severityCounts.totalResolved} all-time)
                        </div>
                    </div>
                </div>

                {/* Category Navigation Tabs */}
                <div className="w-full">
                    <Tabs
                        value={isResolvedView ? 'history' : (localFilters.category || 'all')}
                        onValueChange={handleCategoryChange}
                        className="w-full"
                    >
                        <TabsList className="h-auto w-full flex-nowrap items-center justify-between bg-white/80 dark:bg-card/80 backdrop-blur-md border border-brand-warm/20 shadow-xs p-1.5 rounded-2xl gap-2 overflow-hidden">
                            {/* Scrollable Categories on the left */}
                            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
                                {Object.entries(categoryLabels).map(([category, label]) => {
                                    const Icon = categoryIcons[category as keyof typeof categoryIcons];
                                    const count = filterOptions.categories?.[category] ?? 0;
                                    const isSecurity = category === 'security';
                                    const isActive = !isResolvedView && (localFilters.category || 'all') === category;

                                    return (
                                        <TabsTrigger
                                            key={category}
                                            value={category}
                                            className={`gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold normal-case tracking-normal shrink-0 transition-all ${
                                                isSecurity
                                                    ? 'data-[state=active]:bg-red-600 data-[state=active]:text-white'
                                                    : 'data-[state=active]:bg-brand-rust data-[state=active]:text-white'
                                            }`}
                                        >
                                            <Icon className="size-3.5" />
                                            <span>{label}</span>
                                            <span
                                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                                                    isActive
                                                        ? 'bg-white/20 text-white'
                                                        : isSecurity && count > 0
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                                            : count > 0
                                                                ? 'bg-brand-warm/25 text-brand-text'
                                                                : 'bg-brand-warm/15 text-brand-text-mid/60'
                                                }`}
                                            >
                                                {count}
                                            </span>
                                        </TabsTrigger>
                                    );
                                })}
                            </div>

                            {/* Resolved Archive Section on the right */}
                            <div className="flex items-center shrink-0 pl-2 border-l border-brand-warm/20">
                                <TabsTrigger
                                    value="history"
                                    className="gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold normal-case tracking-normal shrink-0 data-[state=active]:bg-brand-navy data-[state=active]:text-white data-[state=active]:shadow-xs transition-all"
                                >
                                    <History className="size-3.5" />
                                    <span className="hidden sm:inline">Resolved Archive</span>
                                    <span className="sm:hidden">Archive</span>
                                    <span
                                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                            isResolvedView ? 'bg-white/20 text-white' : 'bg-brand-warm/20 text-brand-text-mid'
                                        }`}
                                    >
                                        {filterOptions.resolvedCount ?? severityCounts.totalResolved}
                                    </span>
                                </TabsTrigger>
                            </div>
                        </TabsList>
                    </Tabs>
                </div>

                {/* Filter Control & Search Bar */}
                {(() => {
                    const hasActiveFilters = Boolean(localFilters.q || localFilters.type || localFilters.severity);

                    return (
                        <div className="flex flex-col gap-2.5 rounded-2xl border border-brand-warm/20 bg-white dark:bg-card p-3 shadow-xs">
                            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
                                {/* Search Input */}
                                <div className="relative flex-1">
                                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-text-mid/60" />
                                    <input
                                        value={localFilters.q}
                                        onChange={(event) => setLocalFilters({ ...localFilters, q: event.target.value })}
                                        onKeyDown={(event) => event.key === 'Enter' && applyFilters()}
                                        placeholder="Search tracking #, booking ref, error or record ID..."
                                        className="h-10 w-full rounded-xl border border-brand-warm/20 bg-brand-cream/10 dark:bg-muted/30 pl-9.5 pr-8 text-xs outline-none transition focus:border-brand-rust/50 focus:ring-2 focus:ring-brand-rust/10 placeholder:text-brand-text-mid/50"
                                    />
                                    {localFilters.q ? (
                                        <button
                                            type="button"
                                            onClick={() => removeFilter('q')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-mid hover:text-brand-rust p-1"
                                            title="Clear search query"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={applyFilters}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-mid/40 hover:text-brand-rust text-[10px] font-mono px-1.5 py-0.5 rounded border border-brand-warm/20"
                                            title="Press Enter to search"
                                        >
                                            ↵
                                        </button>
                                    )}
                                </div>

                                {/* Type Select */}
                                <select
                                    aria-label="Filter by type"
                                    value={localFilters.type}
                                    onChange={(event) => {
                                        const next = { ...localFilters, type: event.target.value };
                                        setLocalFilters(next);
                                        router.get('/admin/data-integrity', next, { preserveState: true, preserveScroll: true });
                                    }}
                                    className="h-10 rounded-xl border border-brand-warm/20 bg-white dark:bg-card px-3 text-xs outline-none transition focus:border-brand-rust/50 focus:ring-2 focus:ring-brand-rust/10 md:w-56"
                                >
                                    <option value="">All Exception Types</option>
                                    {filterOptions.types.map((type) => (
                                        <option key={type} value={type}>
                                            {typeLabels[type] || type}
                                        </option>
                                    ))}
                                </select>

                                {/* Severity Select */}
                                <select
                                    aria-label="Filter by severity"
                                    value={localFilters.severity}
                                    onChange={(event) => {
                                        const next = { ...localFilters, severity: event.target.value };
                                        setLocalFilters(next);
                                        router.get('/admin/data-integrity', next, { preserveState: true, preserveScroll: true });
                                    }}
                                    className="h-10 rounded-xl border border-brand-warm/20 bg-white dark:bg-card px-3 text-xs capitalize outline-none transition focus:border-brand-rust/50 focus:ring-2 focus:ring-brand-rust/10 md:w-44"
                                >
                                    <option value="">All Severities</option>
                                    {filterOptions.severities.map((severity) => (
                                        <option key={severity} value={severity}>
                                            {severity} Severity
                                        </option>
                                    ))}
                                </select>

                                {/* Density Switcher */}
                                <div className="flex items-center rounded-xl border border-brand-warm/20 bg-brand-cream/15 dark:bg-muted/30 p-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setDensity('comfortable')}
                                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                            density === 'comfortable'
                                                ? 'bg-white shadow-xs text-brand-text dark:bg-card'
                                                : 'text-brand-text-mid hover:text-brand-text'
                                        }`}
                                        title="Comfortable card view"
                                    >
                                        <LayoutGrid className="size-3.5" />
                                        <span className="hidden xl:inline">Comfortable</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDensity('compact')}
                                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                            density === 'compact'
                                                ? 'bg-white shadow-xs text-brand-text dark:bg-card'
                                                : 'text-brand-text-mid hover:text-brand-text'
                                        }`}
                                        title="Compact high-density view"
                                    >
                                        <List className="size-3.5" />
                                        <span className="hidden xl:inline">Compact</span>
                                    </button>
                                </div>

                                {/* Reset Action */}
                                {hasActiveFilters && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                        className="h-10 gap-1.5 rounded-xl text-xs font-semibold text-brand-rust hover:bg-brand-rust/10 shrink-0 px-3 transition"
                                    >
                                        <X className="size-3.5" />
                                        <span>Reset</span>
                                    </Button>
                                )}
                            </div>

                            {/* Active Filter Chips Row */}
                            {hasActiveFilters && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-brand-warm/15 text-xs">
                                    <span className="text-[11px] font-medium text-brand-text-mid mr-1">Active filters:</span>

                                    {localFilters.q && (
                                        <span className="inline-flex items-center gap-1 bg-brand-cream/40 dark:bg-muted/40 text-brand-text border border-brand-warm/25 px-2 py-0.5 rounded-lg text-xs font-medium">
                                            <span>Search: &ldquo;{localFilters.q}&rdquo;</span>
                                            <button
                                                type="button"
                                                onClick={() => removeFilter('q')}
                                                className="text-brand-text-mid hover:text-brand-rust ml-0.5"
                                                title="Remove search query"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </span>
                                    )}

                                    {localFilters.type && (
                                        <span className="inline-flex items-center gap-1 bg-brand-cream/40 dark:bg-muted/40 text-brand-text border border-brand-warm/25 px-2 py-0.5 rounded-lg text-xs font-medium">
                                            <span>Type: {typeLabels[localFilters.type] || localFilters.type}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeFilter('type')}
                                                className="text-brand-text-mid hover:text-brand-rust ml-0.5"
                                                title="Remove type filter"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </span>
                                    )}

                                    {localFilters.severity && (
                                        <span className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded-lg text-xs font-medium ${
                                            localFilters.severity === 'high'
                                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300'
                                                : localFilters.severity === 'medium'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                        }`}>
                                            <span className="capitalize">{localFilters.severity} Severity</span>
                                            <button
                                                type="button"
                                                onClick={() => removeFilter('severity')}
                                                className="text-current opacity-70 hover:opacity-100 ml-0.5"
                                                title="Remove severity filter"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </span>
                                    )}

                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="text-[11px] font-semibold text-brand-rust hover:underline ml-1"
                                    >
                                        Clear all
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Multi-Select Action Bar */}
                {warnings.data.length > 0 && !isResolvedView && (
                    <div className="flex items-center justify-between px-2 py-1">
                        <label className="flex items-center gap-2.5 text-xs font-semibold text-brand-text cursor-pointer select-none">
                            <Checkbox
                                checked={warnings.data.length > 0 && selectedIds.length === warnings.data.length}
                                onCheckedChange={toggleSelectAll}
                                className="rounded-md border-brand-warm/40"
                            />
                            <span>Select all on this page ({warnings.data.length})</span>
                        </label>

                        {selectedIds.length > 0 && (
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-brand-rust">
                                    {selectedIds.length} item(s) selected
                                </span>
                                <Button
                                    size="sm"
                                    onClick={handleBatchResolve}
                                    className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                                >
                                    <CheckCircle2 className="size-3.5" />
                                    Mark Selected Resolved
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Exceptions Cards List */}
                <div className={density === 'compact' ? 'grid gap-2.5' : 'grid gap-4'}>
                    {warnings.data.length > 0 ? (
                        warnings.data.map((warning) => {
                            const colors = severityColors[warning.severity] || severityColors.medium;
                            const isSelected = selectedIds.includes(warning.id);

                            return (
                                <div
                                    key={warning.id}
                                    className={`group relative overflow-hidden bg-white dark:bg-card border rounded-2xl shadow-xs transition-all hover:shadow-md ${
                                        warning.is_resolved
                                            ? 'border-emerald-200/60 bg-emerald-50/20 dark:bg-emerald-950/10'
                                            : isSelected
                                                ? 'border-brand-rust ring-2 ring-brand-rust/20'
                                                : 'border-brand-warm/20 hover:border-brand-rust/30'
                                    }`}
                                >
                                    {/* Left Status Strip */}
                                    <div
                                        className={`absolute top-0 left-0 w-1.5 h-full ${
                                            warning.is_resolved ? 'bg-emerald-500' : colors.bar
                                        }`}
                                    />

                                    <div className={density === 'compact' ? 'p-3.5 pl-6 flex flex-col gap-2.5' : 'p-5 pl-7 flex flex-col gap-3.5'}>
                                        {/* Card Header: Checkbox, Severity, Type, Timestamp */}
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex flex-wrap items-center gap-2.5">
                                                {!warning.is_resolved && (
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSelectOne(warning.id)}
                                                        className="rounded-md border-brand-warm/40"
                                                    />
                                                )}

                                                {/* Severity Badge with Dot */}
                                                <span
                                                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                                        warning.is_resolved
                                                             ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                            : colors.badge
                                                    }`}
                                                >
                                                    <span
                                                        className={`size-1.5 rounded-full ${
                                                            warning.is_resolved ? 'bg-emerald-500' : colors.dot
                                                        }`}
                                                    />
                                                    {warning.is_resolved ? 'Resolved' : `${warning.severity} Severity`}
                                                </span>

                                                {/* Category / Type Badge */}
                                                <Badge
                                                    variant="outline"
                                                    className="text-[11px] font-medium text-brand-text-mid bg-brand-cream/30 dark:bg-muted/40 border-brand-warm/25 px-2.5 py-0.5 rounded-md"
                                                >
                                                    {typeLabels[warning.type] || warning.type}
                                                </Badge>

                                                {/* Age Badge */}
                                                {warning.metadata?.age_hours !== undefined && warning.metadata.age_hours !== null && (
                                                    <span className="text-[11px] font-mono text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/50 flex items-center gap-1 font-semibold">
                                                        <Clock className="size-3" />
                                                        {warning.metadata.age_hours}h Age
                                                    </span>
                                                )}
                                            </div>

                                            {/* Relative Timestamp with tooltip */}
                                            <span
                                                className="text-[11px] text-brand-text-mid/70 font-medium flex items-center gap-1 ml-auto"
                                                title={new Date(warning.created_at).toLocaleString()}
                                            >
                                                <Clock className="size-3 text-brand-text-mid/50" />
                                                {formatTimeAgo(warning.created_at)}
                                            </span>
                                        </div>

                                        {/* Main Message Title */}
                                        <h3 className={`${density === 'compact' ? 'text-sm' : 'text-base'} font-semibold text-brand-text tracking-tight leading-snug`}>
                                            {warning.message}
                                        </h3>

                                        {/* Structured Metadata & Context Chips */}
                                        {warning.metadata && (
                                            <div className={density === 'compact' ? 'space-y-2' : 'space-y-3'}>
                                                {/* Key Entity Chips */}
                                                <div className={`flex flex-wrap items-center ${density === 'compact' ? 'gap-1.5' : 'gap-2'} text-xs`}>
                                                    {warning.metadata.tracking_number && (
                                                        <div className="inline-flex items-center gap-1.5 bg-brand-cream/40 dark:bg-muted/40 px-2.5 py-1 rounded-lg border border-brand-warm/25 font-mono">
                                                            <span className="text-[11px] font-sans font-medium text-brand-text-mid">Tracking:</span>
                                                            <span className="font-semibold text-brand-text">
                                                                {warning.metadata.tracking_number}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => copyToClipboard(warning.metadata.tracking_number!)}
                                                                className="text-brand-text-mid hover:text-brand-rust transition p-0.5"
                                                                title="Copy tracking code"
                                                            >
                                                                {copiedTracking === warning.metadata.tracking_number ? (
                                                                    <Check className="size-3 text-emerald-600" />
                                                                ) : (
                                                                    <Copy className="size-3" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {warning.metadata.booking_reference && (
                                                        <div className="inline-flex items-center gap-1.5 bg-brand-cream/40 dark:bg-muted/40 px-2.5 py-1 rounded-lg border border-brand-warm/25 font-mono">
                                                            <span className="text-[11px] font-sans font-medium text-brand-text-mid">Booking:</span>
                                                            <span className="font-semibold text-brand-text">
                                                                {warning.metadata.booking_reference}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => copyToClipboard(warning.metadata.booking_reference!)}
                                                                className="text-brand-text-mid hover:text-brand-rust transition p-0.5"
                                                                title="Copy booking reference"
                                                            >
                                                                {copiedTracking === warning.metadata.booking_reference ? (
                                                                    <Check className="size-3 text-emerald-600" />
                                                                ) : (
                                                                    <Copy className="size-3" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {warning.metadata.user_email && (
                                                        <div className="inline-flex items-center gap-1.5 bg-brand-cream/40 dark:bg-muted/40 px-2.5 py-1 rounded-lg border border-brand-warm/25">
                                                            <span className="text-[11px] font-medium text-brand-text-mid">Account:</span>
                                                            <span className="font-medium text-brand-text">{warning.metadata.user_email}</span>
                                                        </div>
                                                    )}

                                                    {warning.metadata.role && (
                                                        <div className="inline-flex items-center gap-1.5 bg-brand-cream/40 dark:bg-muted/40 px-2.5 py-1 rounded-lg border border-brand-warm/25">
                                                            <span className="text-[11px] font-medium text-brand-text-mid">Role:</span>
                                                            <span className="capitalize font-semibold text-brand-text">
                                                                {warning.metadata.role.replaceAll('_', ' ')}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {warning.metadata.status && (
                                                        <div className="inline-flex items-center gap-1.5 bg-brand-cream/40 dark:bg-muted/40 px-2.5 py-1 rounded-lg border border-brand-warm/25">
                                                            <span className="text-[11px] font-medium text-brand-text-mid">Status:</span>
                                                            <span className="capitalize font-semibold text-brand-text">
                                                                {warning.metadata.status.replaceAll('_', ' ')}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {warning.metadata.filename && (
                                                        <div className="inline-flex items-center gap-1.5 bg-brand-cream/40 dark:bg-muted/40 px-2.5 py-1 rounded-lg border border-brand-warm/25 font-mono">
                                                            <span className="text-[11px] font-sans font-medium text-brand-text-mid">File:</span>
                                                            <span className="font-medium text-brand-text break-all">{warning.metadata.filename}</span>
                                                        </div>
                                                    )}

                                                    {warning.metadata.signal && (
                                                        <div className="inline-flex items-center gap-1.5 bg-brand-cream/40 dark:bg-muted/40 px-2.5 py-1 rounded-lg border border-brand-warm/25">
                                                            <span className="text-[11px] font-medium text-brand-text-mid">Signal:</span>
                                                            <span className="capitalize font-semibold text-brand-text">
                                                                {warning.metadata.signal.replaceAll('_', ' ')}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {warning.metadata.ip_address && (
                                                        <div className="inline-flex items-center gap-1.5 bg-brand-cream/40 dark:bg-muted/40 px-2.5 py-1 rounded-lg border border-brand-warm/25 font-mono">
                                                            <span className="text-[11px] font-sans font-medium text-brand-text-mid">IP:</span>
                                                            <span className="font-medium text-brand-text">{warning.metadata.ip_address}</span>
                                                        </div>
                                                    )}

                                                    {warning.metadata.last_scan_at && (
                                                        <div className="inline-flex items-center gap-1.5 bg-brand-cream/40 dark:bg-muted/40 px-2.5 py-1 rounded-lg border border-brand-warm/25">
                                                            <span className="text-[11px] font-medium text-brand-text-mid">Scanned:</span>
                                                            <span>{new Date(warning.metadata.last_scan_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Recommended Action & Root Cause Callout */}
                                                {(warning.metadata.recommended_action || warning.metadata.severity_reason) && (
                                                    <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/25 dark:border-amber-800/40 p-3 text-xs space-y-1.5">
                                                        {warning.metadata.recommended_action && (
                                                            <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                                                                <Lightbulb className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                                                <div>
                                                                    <strong className="font-semibold text-amber-950 dark:text-amber-100">Recommended Action: </strong>
                                                                    <span>{warning.metadata.recommended_action}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {warning.metadata.severity_reason && (
                                                            <div className="text-brand-text-mid pl-6 text-[11px]">
                                                                <strong className="text-brand-text font-medium">Root Cause: </strong>
                                                                <span>{warning.metadata.severity_reason}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Card Footer: Record Link & Action Buttons */}
                                        <div className={`flex flex-wrap items-center justify-between gap-3 ${density === 'compact' ? 'pt-2 mt-0.5' : 'pt-2.5 mt-1'} border-t border-brand-warm/15`}>
                                            {/* Left: View Record Details */}
                                            <div className="flex items-center gap-3">
                                                {warning.record && (
                                                    <Link
                                                        href={warning.metadata?.target_url || (warning.record.tracking_number
                                                            ? boxRoutes.show.url(warning.record.id)
                                                            : bookingRoutes.show.url(warning.record.id))}
                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-rust hover:text-brand-rust/80 hover:underline transition"
                                                    >
                                                        <span>View Record Details</span>
                                                        <ExternalLink className="size-3.5" />
                                                    </Link>
                                                )}
                                            </div>

                                            {/* Right: Resolution Actions */}
                                            <div className="flex items-center gap-2.5">
                                                {warning.metadata?.resolve_url && !warning.is_resolved && (
                                                    <Link
                                                        href={warning.metadata.resolve_url}
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-900 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 shadow-xs transition"
                                                    >
                                                        <Wrench className="size-3.5 text-amber-700 dark:text-amber-300" />
                                                        <span>Resolve in Context</span>
                                                    </Link>
                                                )}

                                                {warning.is_resolved ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleReopen(warning.id)}
                                                        className="gap-1.5 h-8 rounded-xl border-brand-warm/30 text-xs font-semibold text-brand-text hover:bg-brand-cream/40 transition"
                                                    >
                                                        <RotateCcw className="size-3.5 text-brand-text-mid" />
                                                        Reopen
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleResolve(warning.id)}
                                                        className="gap-1.5 h-8 rounded-xl border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-xs transition"
                                                    >
                                                        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                                        Mark Resolved
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        /* Celebratory Zero-State */
                        <div className="flex flex-col items-center justify-center py-20 px-4 bg-gradient-to-b from-emerald-50/40 to-white dark:from-emerald-950/20 dark:to-card rounded-3xl border-2 border-dashed border-emerald-200 dark:border-emerald-900 text-center">
                            <div className="p-4 bg-white dark:bg-card rounded-2xl shadow-sm mb-4 border border-emerald-100 dark:border-emerald-800/40">
                                <ShieldCheck className="size-12 text-emerald-500" />
                            </div>
                            <h3 className="text-xl lg:text-2xl font-serif font-bold text-brand-text mb-1">
                                {isResolvedView
                                    ? 'No Resolved Exceptions Found'
                                    : isSecurityView ? 'No Active Security Incidents' : 'All Operations Systems Optimal'}
                            </h3>
                            <p className="text-sm text-brand-text-mid max-w-md mx-auto mb-6">
                                {isResolvedView
                                    ? 'No exceptions have been marked as resolved yet in this view.'
                                    : isSecurityView
                                        ? 'No blocked upload attempts or current configuration risks are awaiting triage.'
                                        : 'No active data integrity anomalies, SLA breaches, or logistics warnings detected.'}
                            </p>
                            <Button
                                onClick={handleScan}
                                disabled={isScanning}
                                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs text-xs font-bold uppercase tracking-wider"
                            >
                                <RefreshCw className={`size-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                                Run Fresh System Audit
                            </Button>
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
                                        : 'bg-white dark:bg-card border border-brand-warm/20 text-brand-text hover:border-brand-rust/20'
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
