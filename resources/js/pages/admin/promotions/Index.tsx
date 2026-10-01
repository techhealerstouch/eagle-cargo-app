import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    DollarSign,
    Gift,
    Globe,
    Layers,
    MapPin,
    Package,
    Percent,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Sliders,
    Sparkles,
    Tag,
    Trash2,
    TrendingUp,
    UserCheck,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import Heading from '@/components/common/heading';
import Pagination, { type PaginationData } from '@/components/common/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type PromotionType = 'fixed_discount' | 'percentage_discount' | 'per_box_discount' | 'waive_empty_box_fee' | 'buy_x_get_y_free';

export type Promotion = {
    id: number;
    code: string;
    name: string;
    description: string | null;
    type: PromotionType;
    value: number;
    min_box_count: number;
    buy_quantity?: number | null;
    free_quantity?: number | null;
    min_spend: number | null;
    max_discount: number | null;
    max_uses: number | null;
    uses_count: number;
    redemptions_count?: number;
    max_uses_per_user: number;
    applicable_pickup_zones: number[] | null;
    applicable_box_types: number[] | null;
    first_time_sender_only: boolean;
    valid_from: string | null;
    valid_to: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

type PickupZone = {
    id: number;
    name: string;
    code: string;
};

type BoxType = {
    id: number;
    name: string;
    dimensions: string | null;
};

type PromotionStats = {
    total: number;
    active: number;
    total_redemptions: number;
    total_discount_disbursed: number;
};

type PromotionPagination = PaginationData & {
    data: Promotion[];
};

interface Props {
    promotions: PromotionPagination;
    stats: PromotionStats;
    pickupZones: PickupZone[];
    boxTypes: BoxType[];
    filters: {
        search?: string;
        type?: string;
        status?: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Promotions',
        href: '/admin/promotions',
    },
];

const PROMOTION_TYPE_LABELS: Record<PromotionType, { label: string; icon: typeof Tag; color: string; desc: string }> = {
    fixed_discount: {
        label: 'Fixed Discount',
        icon: DollarSign,
        color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        desc: 'Subtracts a flat AUD amount from booking total.',
    },
    percentage_discount: {
        label: 'Percentage Off',
        icon: Percent,
        color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        desc: 'Applies a percentage discount on freight costs.',
    },
    per_box_discount: {
        label: 'Per-Box Discount',
        icon: Package,
        color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        desc: 'Applies a fixed discount per cargo box unit.',
    },
    waive_empty_box_fee: {
        label: 'Waive Box Fee',
        icon: Gift,
        color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        desc: 'Waiver on empty box delivery drop-off fees.',
    },
    buy_x_get_y_free: {
        label: 'Buy X Get Y Free',
        icon: Layers,
        color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
        desc: 'Book X boxes and get Y cheapest boxes free.',
    },
};

export default function PromotionsIndex({
    promotions,
    stats,
    pickupZones = [],
    boxTypes = [],
    filters = {},
}: Props) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [typeFilter, setTypeFilter] = useState(filters.type || 'all');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');

    const {
        data,
        setData,
        post,
        put,
        processing,
        errors,
        reset,
        clearErrors,
    } = useForm({
        code: '',
        name: '',
        description: '',
        type: 'fixed_discount' as PromotionType,
        value: 0,
        min_box_count: 1,
        buy_quantity: '' as string | number,
        free_quantity: '' as string | number,
        min_spend: '',
        max_discount: '',
        max_uses: '',
        max_uses_per_user: 1,
        applicable_pickup_zones: [] as number[],
        applicable_box_types: [] as number[],
        first_time_sender_only: false,
        valid_from: '',
        valid_to: '',
        is_active: true,
    });

    const openCreateDialog = () => {
        clearErrors();
        reset();
        setEditingPromotion(null);
        setIsDialogOpen(true);
    };

    const openEditDialog = (promo: Promotion) => {
        clearErrors();
        setData({
            code: promo.code,
            name: promo.name,
            description: promo.description || '',
            type: promo.type,
            value: promo.value,
            min_box_count: promo.min_box_count || 1,
            buy_quantity: promo.buy_quantity || '',
            free_quantity: promo.free_quantity || '',
            min_spend: promo.min_spend?.toString() || '',
            max_discount: promo.max_discount?.toString() || '',
            max_uses: promo.max_uses?.toString() || '',
            max_uses_per_user: promo.max_uses_per_user || 1,
            applicable_pickup_zones: promo.applicable_pickup_zones || [],
            applicable_box_types: promo.applicable_box_types || [],
            first_time_sender_only: promo.first_time_sender_only,
            valid_from: promo.valid_from ? promo.valid_from.split('T')[0] : '',
            valid_to: promo.valid_to ? promo.valid_to.split('T')[0] : '',
            is_active: promo.is_active,
        });
        setEditingPromotion(promo);
        setIsDialogOpen(true);
    };

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast.success(`Promo code "${code}" copied to clipboard`);
        setTimeout(() => {
            setCopiedCode(null);
        }, 2000);
    };

    const handleToggleActive = (promo: Promotion) => {
        router.post(
            `/admin/promotions/${promo.id}/toggle`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(`Promo "${promo.code}" is now ${!promo.is_active ? 'Active' : 'Inactive'}`);
                },
                onError: () => {
                    toast.error('Failed to toggle promotion status');
                },
            }
        );
    };

    const handleDelete = (promo: Promotion) => {
        if (confirm(`Are you sure you want to delete promo code "${promo.code}"?`)) {
            router.delete(`/admin/promotions/${promo.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Promotion deleted successfully');
                },
            });
        }
    };

    const handleFilterApply = (newSearch?: string, newType?: string, newStatus?: string) => {
        const query: Record<string, string> = {};
        const s = newSearch !== undefined ? newSearch : searchQuery;
        const t = newType !== undefined ? newType : typeFilter;
        const st = newStatus !== undefined ? newStatus : statusFilter;

        if (s.trim()) query.search = s.trim();
        if (t && t !== 'all') query.type = t;
        if (st && st !== 'all') query.status = st;

        router.get('/admin/promotions', query, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setTypeFilter('all');
        setStatusFilter('all');
        router.get('/admin/promotions', {}, { preserveState: true });
    };

    const generateRandomCode = () => {
        const prefixes = ['LOVE', 'BALIK', 'SAVE', 'PROMO', 'FREIGHT', 'SPECIAL'];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const num = Math.floor(10 + Math.random() * 90);
        const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
        setData('code', `${prefix}${num}-${randomStr}`);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const submitPayload = {
            ...data,
            min_spend: data.min_spend ? parseFloat(data.min_spend as string) : null,
            max_discount: data.max_discount ? parseFloat(data.max_discount) : null,
            max_uses: data.max_uses ? parseInt(data.max_uses.toString(), 10) : null,
            buy_quantity: data.type === 'buy_x_get_y_free' && data.buy_quantity ? parseInt(String(data.buy_quantity), 10) : null,
            free_quantity: data.type === 'buy_x_get_y_free' && data.free_quantity ? parseInt(String(data.free_quantity), 10) : null,
            valid_from: data.valid_from || null,
            valid_to: data.valid_to || null,
            applicable_pickup_zones: data.applicable_pickup_zones.length > 0 ? data.applicable_pickup_zones : null,
            applicable_box_types: data.applicable_box_types.length > 0 ? data.applicable_box_types : null,
        };

        if (editingPromotion) {
            router.put(`/admin/promotions/${editingPromotion.id}`, submitPayload as any, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    toast.success('Promotion updated successfully');
                },
            });
        } else {
            router.post('/admin/promotions', submitPayload as any, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    toast.success('Promotion created successfully');
                },
            });
        }
    };

    const togglePickupZone = (zoneId: number) => {
        const current = [...data.applicable_pickup_zones];
        const index = current.indexOf(zoneId);
        if (index > -1) {
            current.splice(index, 1);
        } else {
            current.push(zoneId);
        }
        setData('applicable_pickup_zones', current);
    };

    const toggleBoxType = (typeId: number) => {
        const current = [...data.applicable_box_types];
        const index = current.indexOf(typeId);
        if (index > -1) {
            current.splice(index, 1);
        } else {
            current.push(typeId);
        }
        setData('applicable_box_types', current);
    };

    const selectAllPickupZones = () => {
        if (data.applicable_pickup_zones.length === pickupZones.length) {
            setData('applicable_pickup_zones', []);
        } else {
            setData('applicable_pickup_zones', pickupZones.map(z => z.id));
        }
    };

    const selectAllBoxTypes = () => {
        if (data.applicable_box_types.length === boxTypes.length) {
            setData('applicable_box_types', []);
        } else {
            setData('applicable_box_types', boxTypes.map(b => b.id));
        }
    };

    const getValidityStatus = (promo: Promotion) => {
        const now = new Date();
        const from = promo.valid_from ? new Date(promo.valid_from) : null;
        const to = promo.valid_to ? new Date(promo.valid_to) : null;

        if (!promo.is_active) {
            return { label: 'Inactive', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' };
        }
        if (to && to < now) {
            return { label: 'Expired', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900' };
        }
        if (from && from > now) {
            return { label: 'Scheduled', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900' };
        }
        return { label: 'Active', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900' };
    };

    const formatDiscountValue = (type: PromotionType, value: number) => {
        switch (type) {
            case 'percentage_discount':
                return `${Number(value) || 0}% OFF`;
            case 'fixed_discount':
                return `$${(Number(value) || 0).toFixed(2)} OFF`;
            case 'per_box_discount':
                return `$${(Number(value) || 0).toFixed(2)} / Box`;
            case 'waive_empty_box_fee':
                return 'Free Box Fee';
            case 'buy_x_get_y_free':
                return 'Free Box(es)';
            default:
                return `$${(Number(value) || 0).toFixed(2)}`;
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Promotions & Discount Campaigns" />

            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
                {/* Page Title & Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <Heading
                            title="Promotions & Discounts"
                            description="Create, manage, and monitor promo codes, campaign rules, and redemption limits."
                        />
                    </div>
                    <Button
                        onClick={openCreateDialog}
                        className="bg-brand-rust hover:bg-brand-rust/90 text-white font-semibold shadow-md shadow-brand-rust/20 flex items-center gap-2 h-10 px-4"
                    >
                        <Plus className="size-4" />
                        <span>Create Promotion</span>
                    </Button>
                </div>

                {/* KPI / Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-border/60 shadow-xs hover:border-brand-rust/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Campaigns</p>
                                <p className="text-2xl font-extrabold text-foreground tracking-tight">{stats.total || 0}</p>
                                <p className="text-[11px] text-muted-foreground">Lifetime promotions created</p>
                            </div>
                            <div className="size-12 rounded-xl bg-brand-rust/10 text-brand-rust flex items-center justify-center">
                                <Tag className="size-6" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-xs hover:border-emerald-500/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Deals</p>
                                <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">{stats.active || 0}</p>
                                <p className="text-[11px] text-muted-foreground">Ready for checkout usage</p>
                            </div>
                            <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <Sparkles className="size-6" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-xs hover:border-blue-500/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Redemptions</p>
                                <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">{stats.total_redemptions || 0}</p>
                                <p className="text-[11px] text-muted-foreground">Used across bookings</p>
                            </div>
                            <div className="size-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <Users className="size-6" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-xs hover:border-purple-500/30 transition-all">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Discount Given</p>
                                <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 tracking-tight">
                                    ${(stats.total_discount_disbursed || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-[11px] text-muted-foreground">Value passed to senders</p>
                            </div>
                            <div className="size-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                <TrendingUp className="size-6" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-3">
                    <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                        {/* Search Bar */}
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Search code, campaign name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleFilterApply(searchQuery);
                                }}
                                className="pl-9 h-9 text-xs"
                            />
                        </div>

                        {/* Filter Selects */}
                        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                            <Select
                                value={typeFilter}
                                onValueChange={(val) => {
                                    setTypeFilter(val);
                                    handleFilterApply(undefined, val, undefined);
                                }}
                            >
                                <SelectTrigger className="h-9 w-[150px] text-xs">
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="fixed_discount">Fixed Discount</SelectItem>
                                    <SelectItem value="percentage_discount">Percentage Off</SelectItem>
                                    <SelectItem value="per_box_discount">Per-Box</SelectItem>
                                    <SelectItem value="waive_empty_box_fee">Waive Box Fee</SelectItem>
                                    <SelectItem value="buy_x_get_y_free">Buy X Get Y Free</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select
                                value={statusFilter}
                                onValueChange={(val) => {
                                    setStatusFilter(val);
                                    handleFilterApply(undefined, undefined, val);
                                }}
                            >
                                <SelectTrigger className="h-9 w-[130px] text-xs">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active Only</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                </SelectContent>
                            </Select>

                            {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleResetFilters}
                                    className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                >
                                    <X className="size-3.5" />
                                    <span>Reset</span>
                                </Button>
                            )}

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleFilterApply()}
                                className="h-9 px-3 text-xs"
                            >
                                <Search className="size-3.5 mr-1" /> Search
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Promotions Table */}
                <div className="bg-card border border-border/80 rounded-xl shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <tr className="bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/80">
                                    <TableHead className="py-3.5 px-4">Coupon Code & Details</TableHead>
                                    <TableHead className="py-3.5 px-4">Discount Value</TableHead>
                                    <TableHead className="py-3.5 px-4">Conditions & Limits</TableHead>
                                    <TableHead className="py-3.5 px-4">Usage Progress</TableHead>
                                    <TableHead className="py-3.5 px-4">Validity</TableHead>
                                    <TableHead className="py-3.5 px-4 text-center">Active</TableHead>
                                    <TableHead className="py-3.5 px-4 text-right">Actions</TableHead>
                                </tr>
                            </TableHeader>
                            <TableBody className="divide-y divide-border/60 text-xs">
                                {promotions.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Tag className="size-8 text-muted-foreground/40 stroke-1" />
                                                <p className="font-medium">No promotion campaigns found.</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={openCreateDialog}
                                                    className="mt-1 text-xs"
                                                >
                                                    Create your first promo code
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    promotions.data.map((promo) => {
                                        const typeMeta = PROMOTION_TYPE_LABELS[promo.type] || PROMOTION_TYPE_LABELS.fixed_discount;
                                        const TypeIcon = typeMeta.icon;
                                        const statusMeta = getValidityStatus(promo);
                                        const redemptionsCount = promo.redemptions_count ?? promo.uses_count ?? 0;
                                        const maxUses = promo.max_uses;
                                        const usagePercentage = maxUses ? Math.min(100, Math.round((redemptionsCount / maxUses) * 100)) : null;

                                        return (
                                            <TableRow
                                                key={promo.id}
                                                className="hover:bg-muted/30 transition-colors group"
                                            >
                                                {/* Code & Campaign Name */}
                                                <TableCell className="py-4 px-4 align-top">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-mono font-bold text-xs shadow-xs tracking-wider">
                                                                <span>{promo.code}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopyCode(promo.code)}
                                                                    className="hover:opacity-75 transition-opacity"
                                                                    title="Copy code"
                                                                >
                                                                    {copiedCode === promo.code ? (
                                                                        <Check className="size-3 text-emerald-400" />
                                                                    ) : (
                                                                        <Copy className="size-3 opacity-60" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-[10px] px-1.5 py-0 font-medium ${typeMeta.color}`}
                                                            >
                                                                <TypeIcon className="size-2.5 mr-0.5" />
                                                                {typeMeta.label}
                                                            </Badge>
                                                        </div>
                                                        <p className="font-bold text-foreground text-sm pt-0.5">{promo.name}</p>
                                                        {promo.description && (
                                                            <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-xs">
                                                                {promo.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                {/* Discount Value */}
                                                <TableCell className="py-4 px-4 align-top">
                                                    <div className="space-y-0.5">
                                                        <span className="font-black text-brand-rust dark:text-orange-400 text-base font-mono">
                                                            {promo.type === 'buy_x_get_y_free'
                                                                ? `Buy ${promo.buy_quantity || '?'} Get ${promo.free_quantity || '?'} Free`
                                                                : formatDiscountValue(promo.type, promo.value)}
                                                        </span>
                                                        {promo.max_discount && promo.type === 'percentage_discount' && (
                                                            <p className="text-[10px] text-muted-foreground">
                                                                Cap: ${Number(promo.max_discount).toFixed(2)} max
                                                            </p>
                                                        )}
                                                        {promo.type === 'buy_x_get_y_free' && (
                                                            <p className="text-[10px] text-muted-foreground">
                                                                Cheapest box(es) waived
                                                            </p>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                {/* Conditions & Eligibility */}
                                                <TableCell className="py-4 px-4 align-top">
                                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                                        {promo.min_box_count > 1 && (
                                                            <Badge variant="outline" className="text-[10px] bg-muted/30">
                                                                Min {promo.min_box_count} Boxes
                                                            </Badge>
                                                        )}
                                                        {Number(promo.min_spend || 0) > 0 && (
                                                            <Badge variant="outline" className="text-[10px] bg-muted/30">
                                                                Min spend ${Number(promo.min_spend).toFixed(0)}
                                                            </Badge>
                                                        )}
                                                        {promo.first_time_sender_only && (
                                                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold">
                                                                New Senders Only
                                                            </Badge>
                                                        )}
                                                        {promo.applicable_pickup_zones && promo.applicable_pickup_zones.length > 0 && (
                                                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">
                                                                <MapPin className="size-2.5 mr-0.5" />
                                                                {promo.applicable_pickup_zones.length} Zones
                                                            </Badge>
                                                        )}
                                                        {promo.applicable_box_types && promo.applicable_box_types.length > 0 && (
                                                            <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                                                                <Package className="size-2.5 mr-0.5" />
                                                                {promo.applicable_box_types.length} Box Types
                                                            </Badge>
                                                        )}
                                                        {!promo.min_spend && promo.min_box_count <= 1 && !promo.first_time_sender_only && !promo.applicable_pickup_zones && (
                                                            <span className="text-muted-foreground text-[11px] italic">No restrictions</span>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                {/* Usage Progress */}
                                                <TableCell className="py-4 px-4 align-top">
                                                    <div className="space-y-1.5 min-w-[130px]">
                                                        <div className="flex justify-between text-[11px] font-medium">
                                                            <span className="text-foreground font-mono font-bold">{redemptionsCount}</span>
                                                            <span className="text-muted-foreground font-mono">
                                                                {maxUses ? `/ ${maxUses}` : 'Unlimited'}
                                                            </span>
                                                        </div>
                                                        {maxUses ? (
                                                            <Progress value={usagePercentage || 0} className="h-1.5" />
                                                        ) : (
                                                            <div className="h-1.5 w-full bg-emerald-500/20 rounded-full" />
                                                        )}
                                                        <p className="text-[10px] text-muted-foreground">
                                                            Limit: {promo.max_uses_per_user}/customer
                                                        </p>
                                                    </div>
                                                </TableCell>

                                                {/* Validity Period */}
                                                <TableCell className="py-4 px-4 align-top">
                                                    <div className="space-y-1">
                                                        <Badge variant="outline" className={`text-[10px] font-bold ${statusMeta.color}`}>
                                                            {statusMeta.label}
                                                        </Badge>
                                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                                                            <Calendar className="size-3 opacity-60" />
                                                            {promo.valid_to ? (
                                                                <span>Until {new Date(promo.valid_to).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                            ) : (
                                                                <span>No expiration</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </TableCell>

                                                {/* Active Toggle Switch */}
                                                <TableCell className="py-4 px-4 align-middle text-center">
                                                    <Switch
                                                        checked={promo.is_active}
                                                        onCheckedChange={() => handleToggleActive(promo)}
                                                        aria-label="Toggle promotion status"
                                                    />
                                                </TableCell>

                                                {/* Action Buttons */}
                                                <TableCell className="py-4 px-4 align-middle text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openEditDialog(promo)}
                                                            className="h-8 px-2.5 text-xs font-semibold"
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(promo)}
                                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-border/80 bg-muted/10">
                        <Pagination data={promotions} />
                    </div>
                </div>
            </div>

            {/* Widescreen 2-Column Create & Edit Promotion Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl border-border/80">
                    {/* Header */}
                    <div className="p-6 border-b border-border/80 bg-card/60 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-brand-rust/10 text-brand-rust flex items-center justify-center shadow-xs">
                                <Tag className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold text-foreground">
                                    {editingPromotion ? `Edit Promotion: ${editingPromotion.code}` : 'Create Promotion Campaign'}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    Define discount values, audience eligibility rules, and campaign lifecycle.
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Form Body */}
                    <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                        {/* LEFT COLUMN: Main Form Inputs (62%) */}
                        <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(92vh-140px)] border-b lg:border-b-0 lg:border-r border-border/70">
                            {/* SECTION 1: General Info */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                                    <Sliders className="size-4 text-brand-rust" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">1. Basic Campaign Information</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="code" className="text-xs font-bold text-foreground">Promo Code *</Label>
                                            <button
                                                type="button"
                                                onClick={generateRandomCode}
                                                className="text-[11px] text-brand-rust hover:underline flex items-center gap-1 font-semibold"
                                            >
                                                <Sparkles className="size-3" /> Auto-Generate
                                            </button>
                                        </div>
                                        <Input
                                            id="code"
                                            value={data.code}
                                            onChange={(e) => setData('code', e.target.value.toUpperCase().replace(/\s+/g, ''))}
                                            placeholder="e.g. SUMMER2026"
                                            className="font-mono uppercase font-bold tracking-wider h-10"
                                            required
                                        />
                                        {errors.code && <p className="text-[11px] text-red-500 font-medium">{errors.code}</p>}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="name" className="text-xs font-bold text-foreground">Campaign Name *</Label>
                                        <Input
                                            id="name"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            placeholder="e.g. Summer Holiday Sale 2026"
                                            className="h-10"
                                            required
                                        />
                                        {errors.name && <p className="text-[11px] text-red-500 font-medium">{errors.name}</p>}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="description" className="text-xs font-bold text-foreground">Description (Optional)</Label>
                                    <Textarea
                                        id="description"
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                        placeholder="Internal marketing purpose or customer-facing terms..."
                                        rows={2}
                                        className="text-xs resize-none"
                                    />
                                    {errors.description && <p className="text-[11px] text-red-500 font-medium">{errors.description}</p>}
                                </div>
                            </div>

                            {/* SECTION 2: Discount Rules */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                                    <DollarSign className="size-4 text-emerald-600" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">2. Discount Configuration</h3>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-foreground">Select Discount Mechanism *</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {(Object.keys(PROMOTION_TYPE_LABELS) as PromotionType[]).map((typeKey) => {
                                            const meta = PROMOTION_TYPE_LABELS[typeKey];
                                            const Icon = meta.icon;
                                            const isSelected = data.type === typeKey;

                                            return (
                                                <button
                                                    key={typeKey}
                                                    type="button"
                                                    onClick={() => setData('type', typeKey)}
                                                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                                                        isSelected
                                                            ? 'border-brand-rust bg-brand-rust/5 shadow-xs ring-2 ring-brand-rust/30'
                                                            : 'border-border bg-card hover:bg-muted/40'
                                                    }`}
                                                >
                                                    <div className={`p-2 rounded-lg ${meta.color} shrink-0`}>
                                                        <Icon className="size-4" />
                                                    </div>
                                                    <div className="space-y-0.5 min-w-0">
                                                        <p className="text-xs font-bold text-foreground flex items-center justify-between">
                                                            <span>{meta.label}</span>
                                                            {isSelected && <CheckCircle2 className="size-3.5 text-brand-rust" />}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground leading-tight">{meta.desc}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {errors.type && <p className="text-[11px] text-red-500 font-medium">{errors.type}</p>}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="value" className="text-xs font-bold text-foreground">
                                            {data.type === 'percentage_discount' ? 'Percentage Value (%) *' : 'Discount Amount ($) *'}
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="value"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max={data.type === 'percentage_discount' ? '100' : undefined}
                                                value={data.value}
                                                onChange={(e) => setData('value', parseFloat(e.target.value) || 0)}
                                                className="font-mono font-bold h-10 pr-8"
                                                required
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                                                {data.type === 'percentage_discount' ? '%' : '$'}
                                            </span>
                                        </div>
                                        {errors.value && <p className="text-[11px] text-red-500 font-medium">{errors.value}</p>}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="max_discount" className="text-xs font-bold text-foreground">Max Cap Limit ($)</Label>
                                        <div className="relative">
                                            <Input
                                                id="max_discount"
                                                type="number"
                                                step="0.01"
                                                placeholder="No limit"
                                                value={data.max_discount}
                                                onChange={(e) => setData('max_discount', e.target.value)}
                                                disabled={data.type !== 'percentage_discount'}
                                                className="h-10 pr-8"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Cap for percentage discounts</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="min_spend" className="text-xs font-bold text-foreground">Min Booking Spend ($)</Label>
                                        <div className="relative">
                                            <Input
                                                id="min_spend"
                                                type="number"
                                                step="0.01"
                                                placeholder="No min"
                                                value={data.min_spend}
                                                onChange={(e) => setData('min_spend', e.target.value)}
                                                className="h-10 pr-8"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Freight total before promo</p>
                                    </div>
                                </div>

                                {/* Conditional Buy X Get Y Free fields */}
                                {data.type === 'buy_x_get_y_free' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 p-3.5 rounded-xl border border-teal-500/20 bg-teal-500/5">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="buy_quantity" className="text-xs font-bold text-foreground">Buy (Minimum Boxes) *</Label>
                                            <Input
                                                id="buy_quantity"
                                                type="number"
                                                min="2"
                                                value={data.buy_quantity}
                                                onChange={(e) => setData('buy_quantity', parseInt(e.target.value, 10) || '')}
                                                placeholder="e.g. 5"
                                                className="h-10 font-mono font-bold"
                                                required
                                            />
                                            <p className="text-[10px] text-muted-foreground">Customer must book at least this many boxes.</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="free_quantity" className="text-xs font-bold text-foreground">Get Free (Boxes) *</Label>
                                            <Input
                                                id="free_quantity"
                                                type="number"
                                                min="1"
                                                value={data.free_quantity}
                                                onChange={(e) => setData('free_quantity', parseInt(e.target.value, 10) || '')}
                                                placeholder="e.g. 1"
                                                className="h-10 font-mono font-bold"
                                                required
                                            />
                                            <p className="text-[10px] text-muted-foreground">The cheapest box(es) will be free.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 3: Customer & Cargo Eligibility */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                                    <ShieldCheck className="size-4 text-blue-600" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">3. Eligibility & Restrictions</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="min_box_count" className="text-xs font-bold text-foreground">Min Cargo Box Units</Label>
                                        <Input
                                            id="min_box_count"
                                            type="number"
                                            min="1"
                                            value={data.min_box_count}
                                            onChange={(e) => setData('min_box_count', parseInt(e.target.value, 10) || 1)}
                                            className="h-10"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Applies when booking has at least this many boxes.</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="max_uses_per_user" className="text-xs font-bold text-foreground">Max Uses Per Customer *</Label>
                                        <Input
                                            id="max_uses_per_user"
                                            type="number"
                                            min="1"
                                            value={data.max_uses_per_user}
                                            onChange={(e) => setData('max_uses_per_user', parseInt(e.target.value, 10) || 1)}
                                            className="h-10"
                                            required
                                        />
                                        <p className="text-[10px] text-muted-foreground">Prevents repeated redemption abuse by same sender.</p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3 bg-muted/20 p-3.5 rounded-xl border border-border/60">
                                    <Checkbox
                                        id="first_time_sender_only"
                                        checked={data.first_time_sender_only}
                                        onCheckedChange={(checked) => setData('first_time_sender_only', checked === true)}
                                        className="size-4"
                                    />
                                    <div>
                                        <Label htmlFor="first_time_sender_only" className="text-xs font-bold cursor-pointer text-foreground">
                                            First-Time Customers Only
                                        </Label>
                                        <p className="text-[11px] text-muted-foreground">
                                            Only senders placing their very first shipment can redeem this code.
                                        </p>
                                    </div>
                                </div>

                                {/* Pickup Zones Restriction */}
                                {pickupZones.length > 0 && (
                                    <div className="space-y-2 pt-1">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <MapPin className="size-3.5 text-blue-600" />
                                                Applicable Pickup Zones
                                            </Label>
                                            <button
                                                type="button"
                                                onClick={selectAllPickupZones}
                                                className="text-[11px] text-blue-600 hover:underline font-semibold"
                                            >
                                                {data.applicable_pickup_zones.length === pickupZones.length ? 'Clear Selection' : 'Select All Zones'}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Leave empty to allow bookings from all zones.</p>
                                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-muted/20 border border-border/60 rounded-xl">
                                            {pickupZones.map((zone) => {
                                                const isSelected = data.applicable_pickup_zones.includes(zone.id);
                                                return (
                                                    <button
                                                        key={zone.id}
                                                        type="button"
                                                        onClick={() => togglePickupZone(zone.id)}
                                                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                                                            isSelected
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                                : 'bg-card text-foreground border-border hover:bg-muted'
                                                        }`}
                                                    >
                                                        {zone.name} ({zone.code})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Box Types Restriction */}
                                {boxTypes.length > 0 && (
                                    <div className="space-y-2 pt-1">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Package className="size-3.5 text-indigo-600" />
                                                Applicable Box Types
                                            </Label>
                                            <button
                                                type="button"
                                                onClick={selectAllBoxTypes}
                                                className="text-[11px] text-indigo-600 hover:underline font-semibold"
                                            >
                                                {data.applicable_box_types.length === boxTypes.length ? 'Clear Selection' : 'Select All Types'}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Leave empty to allow all box sizes.</p>
                                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-muted/20 border border-border/60 rounded-xl">
                                            {boxTypes.map((type) => {
                                                const isSelected = data.applicable_box_types.includes(type.id);
                                                return (
                                                    <button
                                                        key={type.id}
                                                        type="button"
                                                        onClick={() => toggleBoxType(type.id)}
                                                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                                                            isSelected
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                                : 'bg-card text-foreground border-border hover:bg-muted'
                                                        }`}
                                                    >
                                                        {type.name} {type.dimensions ? `(${type.dimensions})` : ''}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 4: Schedule & Limits */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                                    <Clock className="size-4 text-purple-600" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">4. Schedule & Usage Limits</h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="max_uses" className="text-xs font-bold text-foreground">Global Max Uses</Label>
                                        <Input
                                            id="max_uses"
                                            type="number"
                                            min="1"
                                            placeholder="Unlimited"
                                            value={data.max_uses}
                                            onChange={(e) => setData('max_uses', e.target.value)}
                                            className="h-10"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Total redemptions allowed</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="valid_from" className="text-xs font-bold text-foreground">Valid From</Label>
                                        <Input
                                            id="valid_from"
                                            type="date"
                                            value={data.valid_from}
                                            onChange={(e) => setData('valid_from', e.target.value)}
                                            className="h-10"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Start date (optional)</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="valid_to" className="text-xs font-bold text-foreground">Valid Until</Label>
                                        <Input
                                            id="valid_to"
                                            type="date"
                                            value={data.valid_to}
                                            onChange={(e) => setData('valid_to', e.target.value)}
                                            className="h-10"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Expiration date (optional)</p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3 bg-muted/20 p-3.5 rounded-xl border border-border/60">
                                    <Switch
                                        id="is_active"
                                        checked={data.is_active}
                                        onCheckedChange={(checked) => setData('is_active', checked === true)}
                                    />
                                    <div>
                                        <Label htmlFor="is_active" className="text-xs font-bold cursor-pointer text-foreground">
                                            Status: {data.is_active ? 'Active & Ready' : 'Draft / Inactive'}
                                        </Label>
                                        <p className="text-[11px] text-muted-foreground">
                                            When active, senders can apply this promo code during booking checkout.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Live Ticket Preview & Summary Panel (38%) */}
                        <div className="w-full lg:w-[380px] p-6 bg-muted/20 flex flex-col justify-between space-y-6 shrink-0 overflow-y-auto max-h-[calc(92vh-140px)]">
                            <div className="space-y-5">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                        <Sparkles className="size-3.5 text-brand-rust" />
                                        Live Customer Voucher Preview
                                    </p>

                                    {/* Digital Voucher Ticket Card */}
                                    <div className="rounded-2xl border-2 border-dashed border-brand-rust/40 bg-card p-5 relative shadow-md overflow-hidden space-y-4">
                                        {/* Ticket Header */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-mono font-black text-sm tracking-wider shadow-xs">
                                                    <span>{data.code || 'COUPON_CODE'}</span>
                                                </div>
                                                <p className="font-bold text-foreground text-sm pt-1">
                                                    {data.name || 'Campaign Title'}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <span className="text-xl font-black text-brand-rust font-mono block">
                                                    {data.type === 'buy_x_get_y_free'
                                                        ? `Buy ${data.buy_quantity || 'X'} Get ${data.free_quantity || 'Y'} Free`
                                                        : formatDiscountValue(data.type, Number(data.value) || 0)}
                                                </span>
                                                {data.max_discount && data.type === 'percentage_discount' && (
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        Cap: ${data.max_discount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                            {data.description || 'Apply code at checkout on Love Balikbayan Sea Cargo for instant savings.'}
                                        </p>

                                        {/* Ticket Footer / Badge */}
                                        <div className="pt-3 border-t border-dashed border-border flex items-center justify-between text-[11px]">
                                            <Badge variant="outline" className={`text-[10px] font-bold ${PROMOTION_TYPE_LABELS[data.type]?.color}`}>
                                                {PROMOTION_TYPE_LABELS[data.type]?.label}
                                            </Badge>
                                            <span className="text-muted-foreground font-mono">
                                                {data.valid_to ? `Exp: ${data.valid_to}` : 'No Expiry'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Live Rules Checklist */}
                                <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
                                    <p className="text-xs font-bold uppercase tracking-wider text-foreground">Rule Verification</p>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span>Min Requirement:</span>
                                            <span className="font-semibold text-foreground">
                                                {data.min_box_count > 1 ? `${data.min_box_count}+ Boxes` : '1+ Box'}
                                                {data.min_spend ? ` • Min $${data.min_spend}` : ''}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span>Customer Scope:</span>
                                            <span className="font-semibold text-foreground">
                                                {data.first_time_sender_only ? 'First-Time Only' : 'All Senders'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span>Per-User Limit:</span>
                                            <span className="font-semibold text-foreground">
                                                {data.max_uses_per_user} use(s) / sender
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span>Pickup Zones:</span>
                                            <span className="font-semibold text-foreground">
                                                {data.applicable_pickup_zones.length > 0
                                                    ? `${data.applicable_pickup_zones.length} zone(s)`
                                                    : 'All Zones (Unrestricted)'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span>Box Sizes:</span>
                                            <span className="font-semibold text-foreground">
                                                {data.applicable_box_types.length > 0
                                                    ? `${data.applicable_box_types.length} type(s)`
                                                    : 'All Box Types'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-muted-foreground">
                                            <span>Status:</span>
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] font-bold ${
                                                    data.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'
                                                }`}
                                            >
                                                {data.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-4 border-t border-border space-y-2">
                                <Button
                                    type="submit"
                                    disabled={processing || !data.code || !data.name}
                                    className="w-full bg-brand-rust hover:bg-brand-rust/90 text-white font-bold h-11 shadow-md shadow-brand-rust/20 text-sm"
                                >
                                    {processing ? 'Saving Promotion...' : editingPromotion ? 'Update Promotion Campaign' : 'Create Promotion Campaign'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="w-full text-xs"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
