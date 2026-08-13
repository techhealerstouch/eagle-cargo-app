import { Head, router } from '@inertiajs/react';
import currency from 'currency.js';
import { format, differenceInDays } from 'date-fns';
import {
    ArrowUpRight,
    Activity,
    Calendar,
    ChevronRight,
    ClipboardCheck,
    CreditCard,
    DollarSign,
    Download,
    DownloadCloud,
    FileText,
    Filter,
    History,
    LayoutDashboard,
    PieChart,
    Receipt,
    TableProperties,
    TrendingUp,
    Trophy,
    Box as BoxIcon,
    ArrowUp,
    ArrowDown,
    Eye,
    User,
    Users,
    Wallet,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart as RePieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    BarChart,
    Bar,
} from 'recharts';
import { toast } from 'sonner';
import Heading from '@/components/common/heading';
import { LoadingOverlay } from '@/components/common/loading-overlay';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import Pagination from '@/components/common/pagination';
import type { BreadcrumbItem } from '@/types';

const COLORS = ['#b74937', '#334155', '#d97706', '#0d9488', '#d6c5b3'];

type RangePresetValue = 7 | 30 | 'month' | 'ytd';
type FinancialReportType =
    | 'full'
    | 'summary'
    | 'collections'
    | 'receivables'
    | 'revenue'
    | 'tax';
type AgingBucket = 'current' | 'overdue_30' | 'overdue_60' | 'overdue_90' | 'overdue_90_plus';

const RANGE_PRESETS: {
    label: string;
    description: string;
    value: RangePresetValue;
}[] = [
    { label: '7D', description: 'Last 7 days', value: 7 },
    { label: '30D', description: 'Last 30 days', value: 30 },
    { label: 'MTD', description: 'Month to date', value: 'month' },
    { label: 'YTD', description: 'Year to date', value: 'ytd' },
];

const REPORT_TYPES: {
    value: FinancialReportType;
    label: string;
    description: string;
    icon: any;
}[] = [
    {
        value: 'full',
        label: 'Full Report',
        description: 'All financial sections in one PDF.',
        icon: FileText,
    },
    {
        value: 'summary',
        label: 'Summary',
        description: 'High-level KPIs and collection rate.',
        icon: LayoutDashboard,
    },
    {
        value: 'collections',
        label: 'Collections',
        description: 'Daily collections and payment channels.',
        icon: Wallet,
    },
    {
        value: 'receivables',
        label: 'Receivables',
        description: 'Outstanding balances and aging.',
        icon: Activity,
    },
    {
        value: 'revenue',
        label: 'Revenue',
        description: 'Box revenue and top senders.',
        icon: Trophy,
    },
    {
        value: 'tax',
        label: 'Tax & Audit',
        description: 'Tax summary and invoice log.',
        icon: Receipt,
    },
];

const AGING_META: Record<
    AgingBucket,
    { label: string; className: string; summaryClassName: string }
> = {
    current: {
        label: 'Current',
        className: 'bg-emerald-100 text-emerald-800',
        summaryClassName: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    },
    overdue_30: {
        label: '1-30 Days',
        className: 'bg-amber-100 text-amber-800',
        summaryClassName: 'border-amber-100 bg-amber-50 text-amber-700',
    },
    overdue_60: {
        label: '31-60 Days',
        className: 'bg-orange-100 text-orange-800',
        summaryClassName: 'border-orange-100 bg-orange-50 text-orange-700',
    },
    overdue_90: {
        label: '61-90 Days',
        className: 'bg-rose-100 text-rose-800',
        summaryClassName: 'border-rose-100 bg-rose-50 text-rose-700',
    },
    overdue_90_plus: {
        label: '90+ Days',
        className: 'bg-red-100 text-red-800',
        summaryClassName: 'border-red-100 bg-red-50 text-red-700',
    },
};

export default function FinancialReport({
    stats,
    recent_payments,
    report_history = [],
    filters,
    currencySymbol = '$',
    taxLabel = 'GST',
    ...props
}: any) {
    const [startDate, setStartDate] = useState(filters.start_date);
    const [endDate, setEndDate] = useState(filters.end_date);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [generateStartDate, setGenerateStartDate] = useState(
        filters.start_date,
    );
    const [generateEndDate, setGenerateEndDate] = useState(filters.end_date);
    const [generateReportType, setGenerateReportType] =
        useState<FinancialReportType>('full');
    const [chartReady, setChartReady] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [chartType, setChartType] = useState<'area' | 'bar'>('area');
    const [isFiltering, setIsFiltering] = useState(false);

    const formatCurrency = (value: any) =>
        currency(value, { symbol: currencySymbol || '$' }).format();
    const dailyRevenue = stats.daily_revenue ?? [];
    const paymentMethods = stats.payment_methods ?? [];
    const dailyCollections = stats.daily_collections ?? [];
    const outstandingReport = props.outstanding_report ?? [];
    const salesReport = props.sales_report?.data ?? [];

    const getPresetRange = (preset: RangePresetValue) => {
        const end = new Date();
        let start = new Date();

        if (preset === 'ytd') {
            start = new Date(end.getFullYear(), 0, 1);
        } else if (preset === 'month') {
            start = new Date(end.getFullYear(), end.getMonth(), 1);
        } else {
            start.setDate(end.getDate() - preset);
        }

        return {
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd'),
        };
    };

    const hasDateRange = Boolean(startDate && endDate);
    const isDateRangeValid =
        hasDateRange && new Date(startDate) <= new Date(endDate);
    const isGenerateRangeValid =
        Boolean(generateStartDate && generateEndDate) &&
        new Date(generateStartDate) <= new Date(generateEndDate);
    const isFilterUnchanged =
        startDate === filters.start_date && endDate === filters.end_date;
    const activePreset = RANGE_PRESETS.find((preset) => {
        const range = getPresetRange(preset.value);

        return startDate === range.startDate && endDate === range.endDate;
    })?.value;

    const formatPaymentMethod = (method?: string) => {
        if (!method) return 'N/A';
        const labels: Record<string, string> = {
            stripe_card: 'Stripe Card',
            stripe: 'Stripe Card',
            bank_transfer: 'Bank Transfer',
            payid: 'PayID',
            pay_id: 'PayID',
            cash: 'Cash / Manual',
            cash_on_pickup: 'Cash on Pickup',
            ewallet: 'E-Wallet',
        };
        return labels[method.toLowerCase()] || method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    };
    const formatServiceType = (type?: string) =>
        type ? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'N/A';
    const formatPaymentStatus = (payment: any) =>
        payment.status || payment.invoice?.status || 'Paid';
    const formatDateRange = (startStr?: string, endStr?: string) => {
        if (!startStr || !endStr) {
            return '';
        }

        const parseDate = (dateStr: string) => {
            const [year, month, day] = dateStr.split('-').map(Number);

            return new Date(year, month - 1, day);
        };

        try {
            const start = parseDate(startStr);
            const end = parseDate(endStr);

            return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
        } catch {
            return `${startStr} to ${endStr}`;
        }
    };
    const getReportTypeLabel = (type?: string) =>
        REPORT_TYPES.find((reportType) => reportType.value === type)?.label ||
        'Full Report';

    const getInvoiceBalance = (invoice: any) => {
        const paid =
            invoice.payments?.reduce(
                (sum: number, payment: any) =>
                    sum + Number.parseFloat(payment.amount || 0),
                0,
            ) || 0;

        return Math.max(Number.parseFloat(invoice.amount || 0) - paid, 0);
    };

    const getAgingBucket = (dueDate?: string): AgingBucket => {
        if (!dueDate) {
            return 'current';
        }

        const daysOverdue = differenceInDays(new Date(), new Date(dueDate));

        if (daysOverdue <= 0) {
            return 'current';
        }

        if (daysOverdue <= 30) {
            return 'overdue_30';
        }

        if (daysOverdue <= 60) {
            return 'overdue_60';
        }

        if (daysOverdue <= 90) {
            return 'overdue_90';
        }

        return 'overdue_90_plus';
    };

    // Aging buckets are now provided directly from the backend via stats.aging_buckets

    useEffect(() => {
        setChartReady(true);
        const unbindStart = router.on('start', (event: any) => {
            const visit = event?.detail?.visit;
            // Only trigger full-screen loading overlay for full page/filter visits, not partial background reloads (e.g. sidebarCounts or report_history)
            if (!visit?.only || visit.only.length === 0) {
                setIsFiltering(true);
            }
        });
        const unbindFinish = router.on('finish', () => setIsFiltering(false));

        return () => {
            unbindStart();
            unbindFinish();
        };
    }, []);

    const applyPreset = (preset: RangePresetValue) => {
        const range = getPresetRange(preset);

        setStartDate(range.startDate);
        setEndDate(range.endDate);

        router.get(
            '/admin/reports/financial',
            {
                start_date: range.startDate,
                end_date: range.endDate,
            },
            { preserveState: true },
        );
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Reports', href: '/admin/reports/financial' },
        { title: 'Financial', href: '/admin/reports/financial' },
    ];

    const handleFilter = () => {
        if (!isDateRangeValid) {
            toast.error('Choose a valid date range before filtering.');

            return;
        }

        if (isFilterUnchanged) {
            return;
        }

        router.get(
            '/admin/reports/financial',
            {
                start_date: startDate,
                end_date: endDate,
            },
            { preserveState: true },
        );
    };

    const handleDownloadPdf = async (
        start?: string,
        end?: string,
        reportType?: FinancialReportType,
    ) => {
        const sDate = start || generateStartDate;
        const eDate = end || generateEndDate;
        const selectedReportType = reportType || generateReportType;
        const reportRangeValid =
            Boolean(sDate && eDate) && new Date(sDate) <= new Date(eDate);

        if (!reportRangeValid) {
            toast.error(
                'Choose a valid date range before generating a report.',
            );

            return;
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 120000);

        setIsGenerating(true);
        setIsGenerateModalOpen(false);

        try {
            const params = new URLSearchParams({
                start_date: sDate,
                end_date: eDate,
                report_type: selectedReportType,
            });
            const response = await fetch(
                `/admin/reports/financial/pdf?${params.toString()}`,
                {
                    headers: {
                        Accept: 'application/pdf',
                    },
                    signal: controller.signal,
                },
            );
            const contentType = response.headers.get('content-type') || '';

            if (!response.ok || !contentType.includes('application/pdf')) {
                throw new Error('Failed to generate report');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `financial-${selectedReportType}-report-${sDate}-to-${eDate}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Report downloaded successfully');

            router.reload({
                only: ['report_history'],
            });
        } catch (error) {
            console.error('Error downloading report:', error);
            toast.error(
                error instanceof DOMException && error.name === 'AbortError'
                    ? 'Report generation took too long. Please try a smaller date range.'
                    : 'Failed to download report. Please try again.',
            );
        } finally {
            window.clearTimeout(timeoutId);
            setIsGenerating(false);
        }
    };

    const handleViewPdf = (
        start?: string,
        end?: string,
        reportType?: FinancialReportType,
    ) => {
        const sDate = start || generateStartDate;
        const eDate = end || generateEndDate;
        const selectedReportType = reportType || generateReportType;
        const reportRangeValid =
            Boolean(sDate && eDate) && new Date(sDate) <= new Date(eDate);

        if (!reportRangeValid) {
            toast.error(
                'Choose a valid date range before previewing a report.',
            );

            return;
        }

        const params = new URLSearchParams({
            start_date: sDate,
            end_date: eDate,
            report_type: selectedReportType,
        });

        window.open(
            `/admin/reports/financial/pdf?${params.toString()}`,
            '_blank',
        );

        // Silently refresh history to record the generation if it's new
        setTimeout(() => {
            router.reload({ only: ['report_history'] });
        }, 1000);
    };

    const collectionRate =
        stats.collection_rate ??
        (stats.total_invoiced > 0
            ? currency(stats.total_collected)
                  .divide(stats.total_invoiced)
                  .multiply(100).value
            : 0);
    const collectionRateValue = Number(collectionRate) || 0;
    const collectionRateWidth = Math.min(Math.max(collectionRateValue, 0), 100);

    const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) {
            return current > 0 ? 100 : 0;
        }

        return ((current - previous) / previous) * 100;
    };

    const invoicedTrend = calculateTrend(
        stats.total_invoiced,
        stats.prev_total_invoiced,
    );
    const commissionsTrend = calculateTrend(
        stats.total_commissions,
        stats.prev_total_commissions,
    );
    const netRevenueTrend = calculateTrend(
        stats.net_revenue,
        stats.prev_net_revenue,
    );
    const collectedTrend = calculateTrend(
        stats.total_collected,
        stats.prev_total_collected,
    );

    const handleExportCSV = () => {
        window.location.href = route('admin.reports.financial.csv', {
            start_date: filters.start_date,
            end_date: filters.end_date
        });
    };

    const EmptyState = ({ icon: Icon = FileText, title, description }: any) => (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center">
            <Icon className="size-8 text-zinc-300" />
            <p className="text-xs font-black tracking-widest text-zinc-500 uppercase">
                {title}
            </p>
            {description && (
                <p className="max-w-sm text-xs font-medium text-zinc-400">
                    {description}
                </p>
            )}
        </div>
    );

    const MetricCard = ({
        title,
        value,
        trend,
        icon: Icon,
        color,
        subtitle,
        description,
    }: any) => (
        <Card className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all hover:border-zinc-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    {title}
                </CardTitle>
                <div
                    className={`flex size-9 items-center justify-center rounded-xl border ${color}`}
                >
                    <Icon className="size-4" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight text-zinc-900">
                    {typeof value === 'number' ? formatCurrency(value) : value}
                </div>
                <div className="mt-1 flex items-center gap-2">
                    {trend !== undefined && (
                        <div
                            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                        >
                            {trend >= 0 ? (
                                <ArrowUp className="size-2.5" />
                            ) : (
                                <ArrowDown className="size-2.5" />
                            )}
                            {Math.abs(trend).toFixed(1)}%
                        </div>
                    )}
                    <p className="text-xs text-zinc-500 font-medium">
                        {subtitle}
                    </p>
                </div>
                {description && (
                    <p className="mt-2 text-xs text-zinc-500">
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    );

    const renderDashboard = () => (
        <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-zinc-200/80 border-t-2 border-t-zinc-900 bg-white p-5 shadow-sm transition-all hover:border-zinc-300">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Total Invoiced
                        </span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 border border-zinc-200">
                            <DollarSign className="size-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-zinc-900">
                        {formatCurrency(stats.total_invoiced)}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                        {invoicedTrend !== undefined && (
                            <div className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${invoicedTrend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {invoicedTrend >= 0 ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
                                {Math.abs(invoicedTrend).toFixed(1)}%
                            </div>
                        )}
                        <p className="text-xs text-zinc-500 font-medium">vs previous period</p>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">Gross invoiced amount.</p>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 border-t-2 border-t-blue-500 bg-white p-5 shadow-sm transition-all hover:border-zinc-300">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Net Revenue
                        </span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                            <Wallet className="size-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-zinc-900">
                        {formatCurrency(stats.net_revenue)}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                        {netRevenueTrend !== undefined && (
                            <div className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${netRevenueTrend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {netRevenueTrend >= 0 ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
                                {Math.abs(netRevenueTrend).toFixed(1)}%
                            </div>
                        )}
                        <p className="text-xs text-zinc-500 font-medium">vs previous period</p>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                        Less {formatCurrency(stats.total_commissions)} comm.{stats.total_clawbacks ? ` (+${formatCurrency(Math.abs(stats.total_clawbacks))} clawback)` : ''}
                    </p>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 border-t-2 border-t-emerald-500 bg-white p-5 shadow-sm transition-all hover:border-zinc-300">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Total Collected
                        </span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <TrendingUp className="size-4" />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-bold tracking-tight text-zinc-900">
                            {formatCurrency(stats.total_collected)}
                        </div>
                        <span className="text-xs font-bold text-emerald-600">
                            {collectionRateValue.toFixed(1)}% rate
                        </span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${collectionRateWidth}%` }}
                        />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                        {formatCurrency(stats.collected_against_period)} of {formatCurrency(stats.total_invoiced)} invoiced.
                    </p>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 border-t-2 border-t-amber-500 bg-white p-5 shadow-sm transition-all hover:border-zinc-300">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            All-Time Outstanding
                        </span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                            <ArrowUpRight className="size-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-zinc-900">
                        {formatCurrency(stats.outstanding_amount)}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            Pending collection
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">Unpaid or partially paid balance.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-7">
                <Card className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm md:col-span-4">
                    <CardHeader>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-900">
                                    Collections Over Time
                                </CardTitle>
                                <CardDescription className="text-xs text-zinc-500">
                                    Daily payment collections for the selected date range.
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex rounded-xl border border-zinc-200 bg-zinc-100/80 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setChartType('area')}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${chartType === 'area' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                                    >
                                        Area
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChartType('bar')}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${chartType === 'bar' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                                    >
                                        Bar
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600">
                                    <Activity className="size-3.5 text-emerald-600" />
                                    {dailyRevenue.length} Days
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {!chartReady ? (
                            <div className="h-[350px]" />
                        ) : dailyRevenue.length > 0 ? (
                            <ResponsiveContainer width="100%" height={350}>
                                {chartType === 'area' ? (
                                    <AreaChart data={dailyRevenue}>
                                        <defs>
                                            <linearGradient
                                                id="colorTotal"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="5%"
                                                    stopColor="#10b981"
                                                    stopOpacity={0.25}
                                                />
                                                <stop
                                                    offset="95%"
                                                    stopColor="#10b981"
                                                    stopOpacity={0}
                                                />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="#f1f5f9"
                                        />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                fill: '#64748b',
                                            }}
                                            tickFormatter={(val) =>
                                                format(new Date(val), 'MMM dd')
                                            }
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                fill: '#64748b',
                                            }}
                                            tickFormatter={(val) =>
                                                currency(val).format({
                                                    symbol: '',
                                                    precision: 0,
                                                })
                                            }
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: '12px',
                                                border: '1px solid #e2e8f0',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                            }}
                                            labelStyle={{
                                                fontWeight: 700,
                                                color: '#0f172a',
                                                marginBottom: '2px',
                                            }}
                                            formatter={(value: any) => [
                                                formatCurrency(value),
                                                'Collections',
                                            ]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="total"
                                            stroke="#059669"
                                            strokeWidth={2.5}
                                            fillOpacity={1}
                                            fill="url(#colorTotal)"
                                            animationDuration={500}
                                        />
                                    </AreaChart>
                                ) : (
                                    <BarChart data={dailyRevenue}>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="#f1f5f9"
                                        />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                fill: '#64748b',
                                            }}
                                            tickFormatter={(val) =>
                                                format(new Date(val), 'MMM dd')
                                            }
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                fill: '#64748b',
                                            }}
                                            tickFormatter={(val) =>
                                                currency(val).format({
                                                    symbol: '',
                                                    precision: 0,
                                                })
                                            }
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: '12px',
                                                border: '1px solid #e2e8f0',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                            }}
                                            labelStyle={{
                                                fontWeight: 700,
                                                color: '#0f172a',
                                                marginBottom: '2px',
                                            }}
                                            formatter={(value: any) => [
                                                formatCurrency(value),
                                                'Collections',
                                            ]}
                                        />
                                        <Bar
                                            dataKey="total"
                                            fill="#059669"
                                            radius={[6, 6, 0, 0]}
                                            animationDuration={500}
                                        />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState
                                icon={TrendingUp}
                                title="No collections found"
                                description="Try a wider date range or check whether payments have been recorded."
                            />
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm md:col-span-3">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-900">
                            Payment Channels
                        </CardTitle>
                        <CardDescription className="text-xs text-zinc-500">
                            Collection mix by payment method.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center">
                        {!chartReady ? (
                            <div className="h-[250px] w-full" />
                        ) : paymentMethods.length > 0 ? (
                            (() => {
                                const parsedMethods = paymentMethods.map((pm: any) => ({
                                    ...pm,
                                    totalNum: parseFloat(pm.total) || 0,
                                    displayName: formatPaymentMethod(pm.payment_method),
                                }));
                                const channelSum = parsedMethods.reduce((sum: number, pm: any) => sum + pm.totalNum, 0);

                                return (
                                    <>
                                        <div className="relative flex items-center justify-center w-full my-2">
                                            <ResponsiveContainer width="100%" height={220}>
                                                <RePieChart>
                                                    <Pie
                                                        data={parsedMethods}
                                                        dataKey="totalNum"
                                                        nameKey="displayName"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={62}
                                                        outerRadius={85}
                                                        paddingAngle={4}
                                                    >
                                                        {parsedMethods.map(
                                                            (
                                                                paymentMethod: any,
                                                                index: number,
                                                            ) => (
                                                                <Cell
                                                                    key={
                                                                        paymentMethod.payment_method ||
                                                                        index
                                                                    }
                                                                    fill={
                                                                        COLORS[
                                                                            index %
                                                                                COLORS.length
                                                                        ]
                                                                    }
                                                                    strokeWidth={0}
                                                                />
                                                            ),
                                                        )}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{
                                                            borderRadius: '12px',
                                                            border: '1px solid #e2e8f0',
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                                        }}
                                                        formatter={(value: any) => [
                                                            formatCurrency(value),
                                                            'Collected',
                                                        ]}
                                                    />
                                                </RePieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Mix Total</span>
                                                <span className="text-sm font-black text-zinc-900 mt-0.5">
                                                    {formatCurrency(channelSum)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-3 grid w-full grid-cols-1 gap-2.5 px-1">
                                            {parsedMethods.map(
                                                (pm: any, index: number) => {
                                                    const percentage =
                                                        channelSum > 0
                                                            ? (pm.totalNum / channelSum) * 100
                                                            : 0;
                                                    const itemColor = COLORS[index % COLORS.length];

                                                    return (
                                                        <div
                                                            key={pm.payment_method}
                                                            className="flex flex-col gap-1 rounded-xl p-2 bg-zinc-50/60 border border-zinc-100"
                                                        >
                                                            <div className="flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <div
                                                                        className="size-2.5 rounded-full"
                                                                        style={{
                                                                            backgroundColor: itemColor,
                                                                        }}
                                                                    />
                                                                    <span className="font-bold text-zinc-800">
                                                                        {pm.displayName}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-zinc-400 text-[11px]">
                                                                        {percentage.toFixed(0)}%
                                                                    </span>
                                                                    <span className="font-black text-zinc-900">
                                                                        {formatCurrency(pm.totalNum)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="h-1.5 w-full rounded-full bg-zinc-200/70 overflow-hidden mt-0.5">
                                                                <div 
                                                                    className="h-full rounded-full transition-all duration-500" 
                                                                    style={{ width: `${Math.min(100, Math.max(0, percentage))}%`, backgroundColor: itemColor }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                },
                                            )}
                                        </div>
                                    </>
                                );
                            })()
                        ) : (
                            <EmptyState
                                icon={CreditCard}
                                title="No payment channels"
                                description="Payment method totals will appear once collections are recorded."
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

        </>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Financial Report | Admin" />

            <LoadingOverlay
                visible={isGenerating || isFiltering}
                message={
                    isGenerating
                        ? 'Generating report please wait...'
                        : 'Loading report data...'
                }
            />

            <Dialog
                open={isGenerateModalOpen}
                onOpenChange={setIsGenerateModalOpen}
            >
                <DialogContent className="rounded-2xl border-none shadow-2xl sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-bold text-zinc-900">
                            <FileText className="size-5 text-emerald-600" />
                            Generate Official Report
                        </DialogTitle>
                        <DialogDescription className="text-xs text-zinc-500">
                            Select the specific date range for the financial audit report.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="px-1 text-xs font-semibold text-zinc-600">
                                Report Type
                            </label>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {REPORT_TYPES.map((reportType) => {
                                    const Icon = reportType.icon;
                                    const isSelected =
                                        generateReportType === reportType.value;

                                    return (
                                        <button
                                            key={reportType.value}
                                            type="button"
                                            onClick={() =>
                                                setGenerateReportType(
                                                    reportType.value,
                                                )
                                            }
                                            className={`rounded-xl border p-3 text-left transition-all ${
                                                isSelected
                                                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20'
                                                    : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                                            }`}
                                        >
                                            <div className="mb-1 flex items-center gap-2">
                                                <Icon
                                                    className={`size-4 ${isSelected ? 'text-emerald-600' : 'text-zinc-400'}`}
                                                />
                                                <span className="text-xs font-bold text-zinc-900">
                                                    {reportType.label}
                                                </span>
                                            </div>
                                            <p className="text-[11px] leading-snug font-medium text-zinc-500">
                                                {reportType.description}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="px-1 text-xs font-semibold text-zinc-600">
                                    Start Date
                                </label>
                                <Input
                                    type="date"
                                    name="generate_start_date"
                                    value={generateStartDate}
                                    onChange={(e) =>
                                        setGenerateStartDate(e.target.value)
                                    }
                                    className="rounded-xl border-zinc-200 focus:ring-emerald-600"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="px-1 text-xs font-semibold text-zinc-600">
                                    End Date
                                </label>
                                <Input
                                    type="date"
                                    name="generate_end_date"
                                    value={generateEndDate}
                                    onChange={(e) =>
                                        setGenerateEndDate(e.target.value)
                                    }
                                    className="rounded-xl border-zinc-200 focus:ring-emerald-600"
                                />
                            </div>
                        </div>
                        {generateStartDate &&
                            generateEndDate &&
                            !isGenerateRangeValid && (
                                <p className="text-[11px] font-bold text-rose-600">
                                    End date must be on or after the start date.
                                </p>
                            )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsGenerateModalOpen(false)}
                            className="rounded-xl border-zinc-200 font-semibold text-zinc-600"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => handleViewPdf()}
                            disabled={!isGenerateRangeValid || isGenerating}
                            className="gap-2 rounded-xl bg-zinc-900 px-5 font-semibold text-white hover:bg-zinc-800"
                        >
                            <Eye className="size-4" />
                            Preview Report
                        </Button>
                        <Button
                            onClick={() => handleDownloadPdf()}
                            disabled={!isGenerateRangeValid || isGenerating}
                            className="gap-2 rounded-xl bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-700 shadow-sm"
                        >
                            <Download className="size-4" />
                            Download PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex h-full flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
                    <Heading
                        eyebrow="Intelligence & Analytics"
                        title="Financial Oversight"
                        description="Monitor revenue, collection rates, and payment trends across the system."
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="sm"
                                className="h-10 gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold shadow-sm hover:bg-emerald-700 cursor-pointer"
                            >
                                <Download className="size-3.5" />
                                Export
                                <ChevronRight className="size-3.5 rotate-90" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="min-w-[180px] rounded-xl border border-zinc-200 p-1.5 shadow-lg"
                        >
                            <DropdownMenuItem
                                onClick={() => setIsGenerateModalOpen(true)}
                                className="cursor-pointer rounded-lg py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                            >
                                <FileText className="mr-2 size-4 text-zinc-500" />
                                PDF Report
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleExportCSV}
                                className="cursor-pointer rounded-lg py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                            >
                                <DownloadCloud className="mr-2 size-4 text-zinc-500" />
                                CSV Data
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Range Preset & Custom Date Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        {RANGE_PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => applyPreset(preset.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    activePreset === preset.value
                                        ? 'bg-zinc-900 text-white'
                                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                }`}
                                title={preset.description}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs">
                            <Calendar className="size-3.5 text-zinc-400" />
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-7 w-32 border-none bg-transparent p-0 text-xs font-medium focus-visible:ring-0"
                            />
                            <span className="text-zinc-400 text-[10px] font-bold">to</span>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="h-7 w-32 border-none bg-transparent p-0 text-xs font-medium focus-visible:ring-0"
                            />
                        </div>

                        <Button
                            onClick={handleFilter}
                            size="sm"
                            disabled={!isDateRangeValid || isFilterUnchanged || isFiltering}
                            className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                        >
                            <Filter className="mr-1.5 size-3.5" />
                            Apply
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="overview" className="w-full space-y-6">
                    <TabsList className="rounded-xl border border-zinc-200/80 bg-zinc-100/80 p-1 font-semibold text-zinc-600">
                        <TabsTrigger value="overview" className="gap-2 rounded-lg text-xs">
                            <LayoutDashboard className="size-3.5" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="bookkeeping" className="gap-2 rounded-lg text-xs">
                            <TableProperties className="size-3.5" />
                            Collections & Receivables
                        </TabsTrigger>
                        <TabsTrigger value="revenue" className="gap-2 rounded-lg text-xs">
                            <PieChart className="size-3.5" />
                            Revenue Analysis
                        </TabsTrigger>
                        <TabsTrigger value="tax" className="gap-2 rounded-lg text-xs">
                            <Receipt className="size-3.5" />
                            Tax & Audit
                        </TabsTrigger>
                        <TabsTrigger value="history" className="gap-2 rounded-lg text-xs">
                            <History className="size-3.5" />
                            Report History
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent
                        value="overview"
                        className="space-y-6 outline-none"
                    >
                        {renderDashboard()}
                    </TabsContent>

                    <TabsContent
                        value="bookkeeping"
                        className="space-y-8 outline-none"
                    >
                        <div className="grid gap-6 lg:grid-cols-1">
                            {/* Daily Collection Detailed */}
                            <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
                                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-700">
                                                <Wallet className="size-4 text-emerald-600" />
                                                Daily Collection Report
                                            </CardTitle>
                                            <CardDescription className="text-xs text-zinc-500 mt-0.5">
                                                Summary of funds received per payment channel.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-zinc-50/80 border-b border-zinc-200/80 text-zinc-500">
                                                <tr>
                                                    <th className="px-6 py-4 text-xs font-black tracking-widest uppercase">
                                                        Date
                                                    </th>
                                                    <th className="px-6 py-4 text-right text-xs font-black tracking-widest uppercase">
                                                        Transactions
                                                    </th>
                                                    <th className="px-6 py-4 text-right text-xs font-black tracking-widest uppercase">
                                                        Cash
                                                    </th>
                                                    <th className="px-6 py-4 text-right text-xs font-black tracking-widest uppercase">
                                                        Bank Transfer
                                                    </th>
                                                    <th className="px-6 py-4 text-right text-xs font-black tracking-widest uppercase">
                                                        Other
                                                    </th>
                                                    <th className="px-6 py-4 text-right text-xs font-black tracking-widest uppercase">
                                                        Total Collection
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-50">
                                                {dailyCollections.length > 0 ? (
                                                    dailyCollections.map(
                                                        (col: any) => (
                                                            <tr
                                                                key={col.date}
                                                                className="transition-colors hover:bg-brand-warm/5"
                                                            >
                                                                <td className="px-6 py-4 font-bold text-zinc-500">
                                                                    {format(
                                                                        new Date(
                                                                            col.date,
                                                                        ),
                                                                        'MMM dd, yyyy',
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 text-right font-bold text-zinc-400">
                                                                    {
                                                                        col.transactions_count
                                                                    }
                                                                </td>
                                                                <td className="px-6 py-4 text-right font-bold text-emerald-600">
                                                                    {formatCurrency(
                                                                        col.cash,
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 text-right font-bold text-indigo-600">
                                                                    {formatCurrency(
                                                                        col.bank_transfer,
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 text-right font-bold text-zinc-400">
                                                                    {formatCurrency(
                                                                        col.other,
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 text-right font-black text-brand-text">
                                                                    {formatCurrency(
                                                                        col.total,
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )
                                                ) : (
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="px-6 py-8"
                                                        >
                                                            <EmptyState
                                                                icon={Wallet}
                                                                title="No collections found"
                                                                description="Daily payment totals will appear here once payments are recorded."
                                                            />
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Outstanding Balances */}
                            <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
                                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
                                    <CardTitle className="flex items-center gap-2 text-sm font-black tracking-widest text-amber-700 uppercase">
                                        <Activity className="size-4" />
                                        Outstanding Balance Report
                                    </CardTitle>
                                    <CardDescription className="text-[10px]">
                                        Active invoices with pending or partial
                                        payments.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="grid gap-3 border-b border-amber-100/60 p-4 sm:grid-cols-5">
                                        {(
                                            Object.keys(
                                                AGING_META,
                                            ) as AgingBucket[]
                                        ).map((bucket) => {
                                            const meta = AGING_META[bucket];

                                            return (
                                                <div
                                                    key={bucket}
                                                    className={`rounded-lg border px-3 py-2 ${meta.summaryClassName}`}
                                                >
                                                    <p className="text-[10px] font-black tracking-widest uppercase">
                                                        {meta.label}
                                                    </p>
                                                    <p className="mt-1 text-lg font-black">
                                                        {formatCurrency(
                                                            stats.aging_buckets?.[bucket] || 0
                                                        )}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-amber-50/50 text-amber-900/60">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-xs font-black tracking-widest uppercase">
                                                        Due Date
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-black tracking-widest uppercase">
                                                        Customer
                                                    </th>
                                                    <th className="px-6 py-4 text-left text-xs font-black tracking-widest uppercase">
                                                        Reference
                                                    </th>
                                                    <th className="px-6 py-4 text-right text-xs font-black tracking-widest uppercase">
                                                        Total Amount
                                                    </th>
                                                    <th className="px-6 py-4 text-right text-xs font-black tracking-widest uppercase">
                                                        Remaining
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-amber-50/50">
                                                {outstandingReport.length >
                                                0 ? (
                                                    outstandingReport.map(
                                                        (inv: any) => {
                                                            const balance =
                                                                getInvoiceBalance(
                                                                    inv,
                                                                );
                                                            const agingBucket =
                                                                getAgingBucket(
                                                                    inv.due_date,
                                                                );
                                                            const agingMeta =
                                                                AGING_META[
                                                                    agingBucket
                                                                ];

                                                            return (
                                                                <tr
                                                                    key={inv.id}
                                                                    className="transition-colors hover:bg-brand-warm/5"
                                                                >
                                                                    <td className="px-6 py-4">
                                                                        <span className="flex items-center gap-1.5 font-bold text-amber-700">
                                                                            <Calendar className="size-3" />
                                                                            {inv.due_date
                                                                                ? format(
                                                                                      new Date(
                                                                                          inv.due_date,
                                                                                      ),
                                                                                      'MMM dd',
                                                                                  )
                                                                                : 'N/A'}
                                                                            <span
                                                                                className={`ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-widest uppercase ${agingMeta.className}`}
                                                                            >
                                                                                {
                                                                                    agingMeta.label
                                                                                }
                                                                            </span>
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4 font-bold text-zinc-700">
                                                                        {
                                                                            inv
                                                                                .booking
                                                                                ?.sender
                                                                                ?.first_name
                                                                        }{' '}
                                                                        {
                                                                            inv
                                                                                .booking
                                                                                ?.sender
                                                                                ?.last_name
                                                                        }
                                                                    </td>
                                                                    <td className="px-6 py-4 font-mono font-bold text-zinc-400">
                                                                        {
                                                                            inv.invoice_number
                                                                        }
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right font-bold text-zinc-400">
                                                                        {formatCurrency(
                                                                            inv.amount,
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right font-black text-amber-600">
                                                                        {formatCurrency(
                                                                            balance,
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        },
                                                    )
                                                ) : (
                                                    <tr>
                                                        <td
                                                            colSpan={5}
                                                            className="px-6 py-8"
                                                        >
                                                            <EmptyState
                                                                icon={Activity}
                                                                title="No outstanding balances"
                                                                description="Open receivables will appear here when invoices have unpaid balances."
                                                            />
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Recent Transactions */}
                            <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-colors hover:border-brand-rust/30">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-zinc-100 bg-zinc-50/50">
                                    <CardTitle className="flex items-center gap-2 text-sm font-black tracking-widest text-brand-rust uppercase">
                                        <CreditCard className="size-4" />
                                        Recent Transactions
                                    </CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleExportCSV}
                                        disabled={recent_payments.length === 0}
                                        className="h-8 gap-2 text-xs font-black tracking-widest text-zinc-500 uppercase hover:text-brand-rust"
                                    >
                                        <DownloadCloud className="size-3.5" />
                                        CSV
                                    </Button>
                                </CardHeader>
                                <CardContent className="custom-scrollbar max-h-[500px] overflow-y-auto p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-brand-warm/5 text-zinc-500">
                                                <tr>
                                                    <th className="px-6 py-4 text-xs font-black tracking-widest uppercase">
                                                        Date
                                                    </th>
                                                    <th className="px-6 py-4 text-xs font-black tracking-widest uppercase">
                                                        Reference
                                                    </th>
                                                    <th className="px-6 py-4 text-xs font-black tracking-widest uppercase">
                                                        Sender
                                                    </th>
                                                    <th className="px-6 py-4 text-xs font-black tracking-widest uppercase">
                                                        Method
                                                    </th>
                                                    <th className="px-6 py-4 text-xs font-black tracking-widest uppercase">
                                                        Status
                                                    </th>
                                                    <th className="px-6 py-4 text-right text-xs font-black tracking-widest uppercase">
                                                        Amount
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-50">
                                                {recent_payments.length > 0 ? (
                                                    recent_payments.map((payment: any) => (
                                                        <tr
                                                            key={payment.id}
                                                            className="transition-colors hover:bg-brand-warm/5"
                                                        >
                                                            <td className="px-6 py-4 font-bold text-zinc-500">
                                                                {format(
                                                                    new Date(
                                                                        payment.paid_at,
                                                                    ),
                                                                    'MMM dd',
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="font-mono font-bold tracking-tight text-brand-rust">
                                                                    {payment.invoice
                                                                        ?.invoice_number ||
                                                                        'N/A'}
                                                                </span>
                                                            </td>
                                                            <td className="max-w-[150px] truncate px-6 py-4 font-bold text-brand-text">
                                                                {
                                                                    payment.invoice?.booking
                                                                        ?.sender?.first_name
                                                                }{' '}
                                                                {
                                                                    payment.invoice?.booking
                                                                        ?.sender?.last_name
                                                                }
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                                                                {formatPaymentMethod(
                                                                    payment.payment_method,
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black tracking-widest text-emerald-700 uppercase">
                                                                    {formatPaymentStatus(
                                                                        payment,
                                                                    )}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right font-black text-brand-text">
                                                                {formatCurrency(
                                                                    payment.amount,
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="px-6 py-8"
                                                        >
                                                            <EmptyState
                                                                icon={CreditCard}
                                                                title="No transactions found"
                                                                description="Payments for the selected range will appear here."
                                                            />
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent
                        value="revenue"
                        className="space-y-8 outline-none"
                    >
                        <div className="grid gap-6 md:grid-cols-3">
                            {/* Revenue by Box Type */}
                            <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
                                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
                                    <CardTitle className="flex items-center gap-2 text-sm font-black tracking-widest text-brand-rust uppercase">
                                        <BoxIcon className="size-4" />
                                        Revenue by Box
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {stats.revenue_by_box_type?.map((box: any) => {
                                            const max = Math.max(
                                                ...stats.revenue_by_box_type.map(
                                                    (b: any) => b.total,
                                                ),
                                            );
                                            const width = max > 0 ? (box.total / max) * 100 : 0;

                                            return (
                                                <div key={box.name} className="space-y-1">
                                                    <div className="flex justify-between text-[11px] font-black tracking-widest uppercase">
                                                        <span className="text-zinc-500">
                                                            {box.name}
                                                        </span>
                                                        <span className="text-brand-rust">
                                                            {formatCurrency(box.total)}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-50">
                                                        <div
                                                            className="h-full rounded-full bg-brand-rust/80 transition-all duration-1000"
                                                            style={{ width: `${width}%` }}
                                                        ></div>
                                                    </div>
                                                    <p className="text-xs font-bold text-zinc-500 uppercase">
                                                        {box.count} units shipped
                                                    </p>
                                                </div>
                                            );
                                        })}
                                        {(!stats.revenue_by_box_type ||
                                            stats.revenue_by_box_type.length === 0) && (
                                            <div className="py-8 text-center text-xs font-bold tracking-widest text-zinc-400 uppercase">
                                                No box data available
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Revenue by Service Type */}
                            <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
                                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
                                    <CardTitle className="flex items-center gap-2 text-sm font-black tracking-widest text-brand-rust uppercase">
                                        <Activity className="size-4" />
                                        Revenue by Service Type
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {stats.revenue_by_service_type?.map((service: any) => {
                                            const max = Math.max(
                                                ...stats.revenue_by_service_type.map(
                                                    (s: any) => s.total,
                                                ),
                                            );
                                            const width = max > 0 ? (service.total / max) * 100 : 0;

                                            return (
                                                <div key={service.service_type} className="space-y-1">
                                                    <div className="flex justify-between text-[11px] font-black tracking-widest uppercase">
                                                        <span className="text-zinc-500">
                                                            {formatServiceType(service.service_type)}
                                                        </span>
                                                        <span className="text-brand-rust">
                                                            {formatCurrency(service.total)}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-50">
                                                        <div
                                                            className="h-full rounded-full bg-indigo-600/80 transition-all duration-1000"
                                                            style={{ width: `${width}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(!stats.revenue_by_service_type ||
                                            stats.revenue_by_service_type.length === 0) && (
                                            <div className="py-8 text-center text-xs font-bold tracking-widest text-zinc-400 uppercase">
                                                No service type data available
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Top Customers Leaderboard */}
                            <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
                                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
                                    <CardTitle className="flex items-center gap-2 text-sm font-black tracking-widest text-brand-rust uppercase">
                                        <Trophy className="size-4" />
                                        Top Senders
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-zinc-50">
                                        {stats.top_customers?.map(
                                            (customer: any, index: number) => (
                                                <div
                                                    key={customer.id}
                                                    className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-50"
                                                >
                                                    <div
                                                        className={`flex size-8 items-center justify-center rounded-xl text-xs font-black ${
                                                            index === 0
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : index === 1
                                                                  ? 'bg-zinc-100 text-zinc-600'
                                                                  : index === 2
                                                                    ? 'bg-orange-100 text-orange-700'
                                                                    : 'bg-zinc-50 text-zinc-400'
                                                        }`}
                                                    >
                                                        #{index + 1}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-xs font-black text-brand-text">
                                                            {customer.name}
                                                        </p>
                                                        <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase">
                                                            {customer.invoice_count}{' '}
                                                            Bookings
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-brand-rust">
                                                            {formatCurrency(
                                                                customer.total_revenue,
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            ),
                                        )}
                                        {(!stats.top_customers ||
                                            stats.top_customers.length === 0) && (
                                            <div className="py-12 text-center text-xs font-bold tracking-widest text-zinc-400 uppercase">
                                                No customer data
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="tax" className="space-y-8 outline-none">
                        <div className="grid gap-6 md:grid-cols-4">
                            <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-300 hover:border-brand-rust/20 hover:shadow-md">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-black tracking-widest text-zinc-500 uppercase">
                                        {taxLabel}able Revenue
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-black text-brand-text">
                                        {formatCurrency(
                                            stats.vat_stats?.vatable_sales || 0,
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-300 hover:border-brand-rust/20 hover:shadow-md">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-black tracking-widest text-zinc-500 uppercase">
                                        {taxLabel} Exempt Revenue
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-black text-brand-text">
                                        {formatCurrency(
                                            stats.vat_stats?.vat_exempt_sales ||
                                                0,
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-300 hover:border-brand-rust/20 hover:shadow-md">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-black tracking-widest text-zinc-500 uppercase">
                                        Tax Amount
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-black text-emerald-600">
                                        {formatCurrency(
                                            stats.vat_stats?.vat_amount || 0,
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-300 hover:border-brand-rust/20 hover:shadow-md">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-black tracking-widest text-zinc-500 uppercase">
                                        Total Gross Revenue
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-black text-brand-rust">
                                        {formatCurrency(
                                            stats.vat_stats?.total_sales || 0,
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
                            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
                                <CardTitle className="flex items-center gap-2 text-sm font-black tracking-widest text-brand-rust uppercase">
                                    <ClipboardCheck className="size-4" />
                                    {taxLabel} Summary & Invoice Log
                                </CardTitle>
                                <CardDescription className="text-xs text-zinc-500">
                                    Detailed breakdown for tax filing and audit
                                    purposes.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-brand-warm/5 text-zinc-500">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-black tracking-widest uppercase">
                                                    Date
                                                </th>
                                                <th className="px-6 py-4 text-xs font-black tracking-widest uppercase">
                                                    Invoice / OR
                                                </th>
                                                <th className="px-6 py-4 text-xs font-black tracking-widest uppercase">
                                                    Customer
                                                </th>
                                                <th className="px-6 py-4 text-right text-xs font-black tracking-widest uppercase">
                                                    {taxLabel}able
                                                </th>
                                                <th className="px-6 py-4 text-right text-xs font-black tracking-widest uppercase">
                                                    {taxLabel}
                                                </th>
                                                <th className="px-6 py-4 text-right text-xs font-black tracking-widest uppercase">
                                                    Total
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-50">
                                            {salesReport.length > 0 ? (
                                                salesReport.map((inv: any) => (
                                                    <tr
                                                        key={inv.id}
                                                        className="transition-colors hover:bg-brand-warm/5"
                                                    >
                                                        <td className="px-6 py-4 font-bold text-zinc-500">
                                                            {format(
                                                                new Date(
                                                                    inv.created_at,
                                                                ),
                                                                'MMM dd, yyyy',
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-mono font-bold text-brand-rust">
                                                                    {
                                                                        inv.invoice_number
                                                                    }
                                                                </span>
                                                                <span className="text-[10px] font-black tracking-tighter text-zinc-500 uppercase">
                                                                    OR:{' '}
                                                                    {inv.or_number ||
                                                                        'PENDING'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 font-bold text-brand-text">
                                                            {
                                                                inv.booking
                                                                    ?.sender
                                                                    ?.first_name
                                                            }{' '}
                                                            {
                                                                inv.booking
                                                                    ?.sender
                                                                    ?.last_name
                                                            }
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-bold text-zinc-400">
                                                            {formatCurrency(
                                                                inv.vatable_revenue,
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-bold text-emerald-600">
                                                            {formatCurrency(
                                                                inv.vat_amount,
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-black text-brand-text">
                                                            {formatCurrency(
                                                                inv.amount,
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td
                                                        colSpan={6}
                                                        className="px-6 py-8"
                                                    >
                                                        <EmptyState
                                                            icon={Receipt}
                                                            title="No tax records"
                                                            description="Invoice tax details will appear here for the selected range."
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                            {props.sales_report?.meta && props.sales_report.meta.last_page > 1 && (
                                <div className="border-t border-zinc-100 bg-zinc-50/50 p-4">
                                    <Pagination data={props.sales_report.meta} />
                                </div>
                            )}
                        </Card>
                    </TabsContent>
                    <TabsContent value="history" className="space-y-8 outline-none">
                        <Card className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-colors hover:border-brand-rust/30">
                            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
                                <CardTitle className="flex items-center gap-2 text-sm font-black tracking-widest text-brand-rust uppercase">
                                    <History className="size-4" />
                                    Report History
                                </CardTitle>
                                <CardDescription className="text-xs text-zinc-500">
                                    Audit trail of generated reports.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="custom-scrollbar max-h-[500px] overflow-y-auto p-0">
                                <div className="flex flex-col divide-y divide-zinc-100">
                                    {report_history.length > 0 ? (
                                        report_history.map((report: any) => (
                                            <div
                                                key={report.id}
                                                className="group p-4 transition-all duration-200 hover:bg-zinc-50/70"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-50 border border-zinc-200/60 text-zinc-400 group-hover:bg-brand-rust/5 group-hover:border-brand-rust/20 group-hover:text-brand-rust transition-all duration-200">
                                                            <FileText className="size-5" />
                                                        </div>
                                                        <div className="flex flex-col gap-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-sm font-bold text-zinc-800 truncate">
                                                                    {formatDateRange(
                                                                        report.parameters
                                                                            .start_date,
                                                                        report.parameters
                                                                            .end_date,
                                                                    )}
                                                                </span>
                                                                <span className="rounded-full bg-brand-warm/60 px-2 py-0.5 text-[9px] font-black tracking-wider text-brand-rust uppercase border border-zinc-200/30">
                                                                    {getReportTypeLabel(
                                                                        report.parameters
                                                                            .report_type,
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-xs text-zinc-400 flex-wrap">
                                                                <span>
                                                                    {format(
                                                                        new Date(
                                                                            report.created_at,
                                                                        ),
                                                                        'MMM dd, yyyy · HH:mm',
                                                                    )}
                                                                </span>
                                                                <span>•</span>
                                                                <div className="flex items-center gap-1">
                                                                    <User className="size-3 text-zinc-400" />
                                                                    <span className="font-semibold text-zinc-500 truncate">
                                                                        {report.user
                                                                            ?.name ||
                                                                            'System'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleViewPdf(
                                                                    report.parameters
                                                                        .start_date,
                                                                    report.parameters
                                                                        .end_date,
                                                                    report.parameters
                                                                        .report_type,
                                                                )
                                                            }
                                                            className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 shadow-sm transition-all duration-150 hover:border-brand-rust hover:bg-brand-rust hover:text-white active:scale-95 cursor-pointer"
                                                            title="View Report"
                                                        >
                                                            <Eye className="size-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleDownloadPdf(
                                                                    report.parameters
                                                                        .start_date,
                                                                    report.parameters
                                                                        .end_date,
                                                                    report.parameters
                                                                        .report_type,
                                                                )
                                                            }
                                                            className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 shadow-sm transition-all duration-150 hover:border-brand-rust hover:bg-brand-rust hover:text-white active:scale-95 cursor-pointer"
                                                            title="Download PDF"
                                                        >
                                                            <Download className="size-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-6">
                                            <EmptyState
                                                icon={FileText}
                                                title="No reports logged yet"
                                                description="Generated PDF reports will appear here for audit history."
                                            />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
