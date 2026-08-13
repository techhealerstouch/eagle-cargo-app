import { Head, Link, usePage, router } from '@inertiajs/react';
import { Plus, Search, Download, ScanLine, CheckCircle2, Package, XCircle, TrendingUp, MoreVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import ActiveFilterChips from '@/components/common/active-filter-chips';
import ConfirmModal from '@/components/common/confirm-modal';
import FilterSelect from '@/components/common/filter-select';
import Heading from '@/components/common/heading';
import Pagination from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
import SortLink from '@/components/common/sort-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { format } from 'date-fns';

interface SerialNumber {
    id: number;
    serial_number: string;
    status: string;
    box_id: number | null;
    assigned_by: number | null;
    allocated_at: string | null;
    created_at: string;
    box?: {
        tracking_number: string;
        status?: string;
        runsheets?: {
            type: string;
            courier?: {
                name: string;
                custom_id?: string;
            };
        }[];
        booking?: {
            reference_number: string;
            sender?: {
                first_name: string;
                last_name: string;
                user?: {
                    custom_id?: string;
                };
            };
            runsheets?: {
                type: string;
                picker?: {
                    name: string;
                    custom_id?: string;
                };
            }[];
        };
    };
    assigned_by_user?: {
        name: string;
        custom_id?: string;
    };
}

interface PaginationProps {
    data: SerialNumber[];
    links: { url: string | null; label: string; active: boolean }[];
    total: number;
    from: number;
    to: number;
}

interface SerialStats {
    total: number;
    available: number;
    allocated: number;
    assigned: number;
    void: number;
}

const STATUS_COLORS: Record<string, string> = {
    Available: 'bg-green-500/10 text-green-600 border border-green-500/20',
    Allocated: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    Assigned: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
    Void: 'bg-red-500/10 text-red-600 border border-red-500/20',
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Serial Numbers', href: '/admin/serial-numbers' },
];

function StatCard({
    title,
    value,
    description,
    icon: Icon,
    colorClass = 'text-brand-rust bg-brand-rust/10',
    hoverBorderClass = 'hover:border-brand-rust/20',
}: {
    title: string;
    value: string | number;
    description: string;
    icon: React.ComponentType<any>;
    colorClass?: string;
    hoverBorderClass?: string;
}) {
    return (
        <div className={`group relative overflow-hidden rounded-2xl border border-brand-warm/20 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md ${hoverBorderClass}`}>
            <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-brand-warm/5 z-0 transition-transform duration-500 group-hover:scale-110"></div>
            <div className="relative z-10 mb-4 flex items-center justify-between">
                <div className={`rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-110 ${colorClass}`}>
                    <Icon className="size-4" />
                </div>
            </div>
            <div className="relative z-10">
                <h3 className="mb-1 text-xs font-semibold text-brand-text-mid transition-colors group-hover:text-brand-rust">
                    {title}
                </h3>
                <p className="text-2xl font-bold tracking-tight text-brand-text">
                    {value}
                </p>
                <p className="mt-1 text-xs text-brand-text-mid/60">
                    {description}
                </p>
            </div>
        </div>
    );
}

export default function Index() {
    const getPickerName = (sn: SerialNumber) => {
        if (sn.assigned_by_user) return `${sn.assigned_by_user.name} ${sn.assigned_by_user.custom_id ? `(${sn.assigned_by_user.custom_id})` : ''}`.trim();
        const pickupRunsheet = sn.box?.booking?.runsheets?.find(r => r.type === 'Pickup');
        const picker = pickupRunsheet?.picker;
        if (!picker) return '-';
        return `${picker.name} ${picker.custom_id ? `(${picker.custom_id})` : ''}`.trim();
    };

    const getCourierName = (sn: SerialNumber) => {
        const deliveryRunsheet = sn.box?.runsheets?.find(r => r.type === 'Delivery');
        const courier = deliveryRunsheet?.courier;
        if (!courier) return '-';
        return `${courier.name} ${courier.custom_id ? `(${courier.custom_id})` : ''}`.trim();
    };

    const { serialNumbers, filters, statuses, stats, pickers = [], couriers = [], errors } = usePage<{
        serialNumbers: PaginationProps;
        filters: { search?: string; status?: string; sort?: string; direction?: string; start_date?: string; end_date?: string; picker_id?: string; courier_id?: string };
        statuses: string[];
        stats: SerialStats;
        pickers: { id: number; name: string }[];
        couriers: { id: number; name: string }[];
        errors: any;
    }>().props;

    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [generateForm, setGenerateForm] = useState({
        start: '',
        end: '',
        prefix: '',
        padding: '6',
    });
    const [isGenerating, setIsGenerating] = useState(false);

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isVoiding, setIsVoiding] = useState(false);
    const [isBulkVoiding, setIsBulkVoiding] = useState(false);
    const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
    const [isBulkVoidModalOpen, setIsBulkVoidModalOpen] = useState(false);
    const [voidingId, setVoidingId] = useState<number | null>(null);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(serialNumbers.data.map(sn => sn.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id: number, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(rowId => rowId !== id));
        }
    };

    const handleBulkVoid = () => {
        setIsBulkVoidModalOpen(true);
    };

    const handleVoid = (id: number) => {
        setVoidingId(id);
        setIsVoidModalOpen(true);
    };

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportType, setExportType] = useState('all'); // 'all', 'available', 'allocated', 'void', 'custom'
    const [exportForm, setExportForm] = useState({
        status: '',
        picker_id: '',
        courier_id: '',
        start_date: '',
        end_date: '',
    });

    const handleGenerate = (e: React.FormEvent) => {
        e.preventDefault();
        setIsGenerating(true);
        router.post('/admin/serial-numbers', generateForm, {
            onSuccess: () => {
                setIsGenerateModalOpen(false);
                setIsGenerating(false);
                setGenerateForm({ start: '', end: '', prefix: '', padding: '6' });
            },
            onError: () => setIsGenerating(false),
            preserveScroll: true,
        });
    };

    const handleExport = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (exportForm.status) params.append('status', exportForm.status);
        if (exportForm.picker_id) params.append('picker_id', exportForm.picker_id);
        if (exportForm.courier_id) params.append('courier_id', exportForm.courier_id);
        if (exportForm.start_date) params.append('start_date', exportForm.start_date);
        if (exportForm.end_date) params.append('end_date', exportForm.end_date);

        window.location.href = `/admin/serial-numbers/export?${params.toString()}`;
        setIsExportModalOpen(false);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Serial Numbers | Admin" />

            <div className="flex h-full flex-1 flex-col gap-8 p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-brand-warm/20 pb-6">
                    <Heading
                        eyebrow="Logistics"
                        title="Serial Numbers"
                        description="Manage the pool of serial numbers for box allocation."
                    />
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => setIsExportModalOpen(true)}
                            variant="outline"
                            className="h-11 rounded-xl border-brand-warm/20 bg-white px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-text-mid transition-all hover:bg-zinc-50 active:scale-95 gap-2 shadow-sm"
                        >
                            <Download className="size-4" />
                            Export
                        </Button>
                        <Button
                            onClick={() => setIsGenerateModalOpen(true)}
                            className="bg-brand-rust text-white hover:bg-brand-rust/90 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-brand-rust/10 transition-all font-sans"
                        >
                            <Plus className="size-4" />
                            Generate Serial Numbers
                        </Button>
                    </div>
                </div>

                {/* Stats Cards Section */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <StatCard
                        title="Total Pool"
                        value={stats.total.toLocaleString()}
                        description="Total generated serials"
                        icon={ScanLine}
                        colorClass="text-indigo-600 bg-indigo-500/10"
                        hoverBorderClass="hover:border-indigo-500/20"
                    />
                    <StatCard
                        title="Available Serials"
                        value={stats.available.toLocaleString()}
                        description="Ready for allocation"
                        icon={CheckCircle2}
                        colorClass="text-green-600 bg-green-500/10"
                        hoverBorderClass="hover:border-green-500/20"
                    />
                    <StatCard
                        title="Allocated Serials"
                        value={stats.allocated.toLocaleString()}
                        description="Allocated to runsheets"
                        icon={Package}
                        colorClass="text-blue-600 bg-blue-500/10"
                        hoverBorderClass="hover:border-blue-500/20"
                    />
                    <StatCard
                        title="Assigned Serials"
                        value={stats.assigned.toLocaleString()}
                        description="Assigned to active boxes"
                        icon={Package}
                        colorClass="text-purple-600 bg-purple-500/10"
                        hoverBorderClass="hover:border-purple-500/20"
                    />
                    <StatCard
                        title="Void Serials"
                        value={stats.void.toLocaleString()}
                        description="Cancelled or voided numbers"
                        icon={XCircle}
                        colorClass="text-red-600 bg-red-500/10"
                        hoverBorderClass="hover:border-red-500/20"
                    />
                </div>

                {/* Filters Section */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1 max-w-sm">
                            <SearchFilter
                                routeName="/admin/serial-numbers"
                                queryParams={filters}
                                placeholder="Search serial numbers, tracking..."
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <FilterSelect
                                label="Status"
                                paramName="status"
                                options={statuses.map(s => ({ value: s, label: s }))}
                                queryParams={filters}
                                routeName="/admin/serial-numbers"
                            />
                            <FilterSelect
                                label="Picker"
                                paramName="picker_id"
                                options={pickers.map(p => ({ value: p.id.toString(), label: p.name }))}
                                queryParams={filters}
                                routeName="/admin/serial-numbers"
                            />
                            <FilterSelect
                                label="Courier"
                                paramName="courier_id"
                                options={couriers.map(c => ({ value: c.id.toString(), label: c.name }))}
                                queryParams={filters}
                                routeName="/admin/serial-numbers"
                            />
                        </div>
                    </div>

                    <ActiveFilterChips
                        routeName="/admin/serial-numbers"
                        queryParams={filters}
                        className="px-1"
                    />
                </div>

                {/* Table Section */}
                <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs flex flex-col">
                    {selectedIds.length > 0 && (
                        <div className="bg-zinc-50 border-b border-zinc-200/80 px-4 py-2.5 flex items-center justify-between">
                            <span className="text-xs font-medium text-zinc-700">{selectedIds.length} serial number(s) selected</span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.location.href = `/admin/serial-numbers/export?ids=${selectedIds.join(',')}`}
                                    className="h-8 text-xs text-zinc-700 border-zinc-200 hover:bg-white"
                                >
                                    <Download className="size-3.5 mr-1.5" />
                                    Export Selected
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleBulkVoid}
                                    disabled={isBulkVoiding}
                                    className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                >
                                    <Trash2 className="size-3.5 mr-1.5" />
                                    {isBulkVoiding ? 'Voiding...' : 'Bulk Void'}
                                </Button>
                            </div>
                        </div>
                    )}
                    {serialNumbers.data.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                                        <th scope="col" className="px-4 py-3 w-10">
                                            <Checkbox
                                                checked={serialNumbers.data.length > 0 && selectedIds.length === serialNumbers.data.length}
                                                onCheckedChange={handleSelectAll}
                                                className="size-4 rounded border-zinc-300"
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">
                                            <SortLink
                                                label="Serial Number"
                                                sortField="serial_number"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName="/admin/serial-numbers"
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">
                                            <SortLink
                                                label="Generated At"
                                                sortField="created_at"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName="/admin/serial-numbers"
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">
                                            <SortLink
                                                label="Status"
                                                sortField="status"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName="/admin/serial-numbers"
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Assigned Box</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Box Status</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Sender</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Picker</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Courier</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">
                                            <SortLink
                                                label="Allocated At"
                                                sortField="allocated_at"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName="/admin/serial-numbers"
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 text-xs font-normal">
                                    {serialNumbers.data.map((sn) => (
                                        <tr key={sn.id} className="transition-colors hover:bg-brand-warm/10">
                                            <td className="px-6 py-4">
                                                <Checkbox
                                                    checked={selectedIds.includes(sn.id)}
                                                    onCheckedChange={(checked) => handleSelectRow(sn.id, !!checked)}
                                                />
                                            </td>
                                            <td className="px-6 py-4 font-mono text-zinc-900 font-medium">
                                                <Link href={`/admin/serial-numbers/${sn.id}`} className="hover:text-brand-rust hover:underline transition-colors">
                                                    {sn.serial_number}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-brand-text-mid">
                                                {format(new Date(sn.created_at), 'MMM d, yyyy h:mm a')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[sn.status] || STATUS_COLORS.draft}`}>
                                                    {sn.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-brand-text">
                                                {sn.box ? (
                                                    <Link href={`/admin/boxes/${sn.box_id}`} className="text-brand-rust hover:underline">
                                                        {sn.box.tracking_number}
                                                    </Link>
                                                ) : (
                                                    <span className="text-brand-text/40">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {sn.box?.status ? (
                                                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-brand-warm/20 text-brand-text">
                                                        {sn.box.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                    </span>
                                                ) : (
                                                    <span className="text-brand-text/40">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-brand-text">
                                                {sn.box?.booking?.sender ? `${sn.box.booking.sender.first_name} ${sn.box.booking.sender.last_name} ${sn.box.booking.sender.user?.custom_id ? `(${sn.box.booking.sender.user.custom_id})` : ''}`.trim() : <span className="text-brand-text/40">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-brand-text">
                                                {getPickerName(sn) !== '-' ? getPickerName(sn) : <span className="text-brand-text/40">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-brand-text">
                                                {getCourierName(sn) !== '-' ? getCourierName(sn) : <span className="text-brand-text/40">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-brand-text-mid">
                                                {sn.allocated_at ? format(new Date(sn.allocated_at), 'MMM d, yyyy h:mm a') : <span className="text-brand-text/40">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-brand-warm/20">
                                                            <MoreVertical className="size-4 text-brand-text-mid" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 rounded-xl border-brand-warm/10 shadow-xl shadow-brand-warm/10 p-1">
                                                        <DropdownMenuItem
                                                            className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors gap-2"
                                                            onClick={() => handleVoid(sn.id)}
                                                            disabled={sn.status === 'Void' || isVoiding}
                                                        >
                                                            <XCircle className="size-4" />
                                                            Void Serial Number
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <Pagination data={serialNumbers} />
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-12">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-warm/20">
                                <ScanLine className="size-10 text-brand-rust" />
                            </div>
                            <h3 className="mb-2 font-serif text-xl font-medium text-brand-text">No serial numbers found</h3>
                            <p className="mb-6 max-w-sm text-center text-brand-text-mid">
                                {(filters.search || filters.status || filters.picker_id || filters.courier_id)
                                    ? "Try adjusting your search or filters to find what you're looking for."
                                    : "You haven't generated any serial numbers yet."}
                            </p>
                            {(filters.search || filters.status || filters.picker_id || filters.courier_id) ? (
                                <Link
                                    href="/admin/serial-numbers"
                                    className="bg-brand-warm/20 text-brand-text hover:bg-brand-warm/30 px-6 py-2 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors"
                                >
                                    Clear Filters
                                </Link>
                            ) : (
                                <Button
                                    onClick={() => setIsGenerateModalOpen(true)}
                                    className="bg-brand-rust text-white px-6 py-2 rounded-xl font-bold uppercase text-xs tracking-widest"
                                >
                                    Generate First Batch
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Generate Modal */}
            <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl font-black text-brand-rust">Generate</DialogTitle>
                        <DialogDescription className="text-sm text-brand-text-mid">
                            Create a new batch of sequential serial numbers.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleGenerate} className="flex flex-col gap-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start">Start Number *</Label>
                                <Input
                                    id="start"
                                    type="number"
                                    required
                                    min="1"
                                    value={generateForm.start}
                                    onChange={(e) => setGenerateForm({ ...generateForm, start: e.target.value })}
                                    placeholder="e.g. 1"
                                    className="h-11 rounded-xl border-brand-warm/10 focus:border-brand-rust/30 focus:ring-brand-rust/5"
                                />
                                {errors?.start && <p className="text-xs text-red-500">{errors.start}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end">End Number *</Label>
                                <Input
                                    id="end"
                                    type="number"
                                    required
                                    min="1"
                                    value={generateForm.end}
                                    onChange={(e) => setGenerateForm({ ...generateForm, end: e.target.value })}
                                    placeholder="e.g. 1000"
                                    className="h-11 rounded-xl border-brand-warm/10 focus:border-brand-rust/30 focus:ring-brand-rust/5"
                                />
                                {errors?.end && <p className="text-xs text-red-500">{errors.end}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="prefix">Prefix (Optional)</Label>
                                <Input
                                    id="prefix"
                                    type="text"
                                    value={generateForm.prefix}
                                    onChange={(e) => setGenerateForm({ ...generateForm, prefix: e.target.value })}
                                    placeholder="e.g. LBB-"
                                    className="h-11 rounded-xl border-brand-warm/10 focus:border-brand-rust/30 focus:ring-brand-rust/5"
                                />
                                {errors?.prefix && <p className="text-xs text-red-500">{errors.prefix}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="padding">Zero Padding</Label>
                                <Input
                                    id="padding"
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={generateForm.padding}
                                    onChange={(e) => setGenerateForm({ ...generateForm, padding: e.target.value })}
                                    placeholder="e.g. 6"
                                    className="h-11 rounded-xl border-brand-warm/10 focus:border-brand-rust/30 focus:ring-brand-rust/5"
                                />
                                <p className="text-[10px] text-brand-text/50">Example: 1 becomes 000001</p>
                                {errors?.padding && <p className="text-xs text-red-500">{errors.padding}</p>}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-brand-sand/30">
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl border-brand-warm/20"
                                onClick={() => setIsGenerateModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="bg-brand-rust text-white hover:bg-brand-rust/90 rounded-xl px-6 py-2.5 font-bold uppercase text-xs tracking-widest"
                                disabled={isGenerating}
                            >
                                {isGenerating ? 'Generating...' : 'Generate Batch'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Export Modal */}
            <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl font-black text-brand-rust">Export PDF Report</DialogTitle>
                        <DialogDescription className="text-sm text-brand-text-mid">
                            Choose what content you would like to export to your PDF report.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleExport} className="flex flex-col gap-4 mt-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-brand-text/60">Export Target</Label>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {[
                                        { value: 'all', label: 'All Serials' },
                                        { value: 'available', label: 'Available Only' },
                                        { value: 'allocated', label: 'Allocated Only' },
                                        { value: 'assigned', label: 'Assigned Only' },
                                        { value: 'void', label: 'Voided Only' },
                                        { value: 'custom', label: 'Custom Selection...' },
                                    ].map((option) => (
                                        <label
                                            key={option.value}
                                            className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                                                exportType === option.value
                                                    ? 'border-brand-rust bg-brand-rust/5 text-brand-rust font-bold'
                                                    : 'border-brand-warm/15 bg-brand-warm/5 text-brand-text hover:bg-zinc-50'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="exportType"
                                                value={option.value}
                                                checked={exportType === option.value}
                                                onChange={(e) => {
                                                    setExportType(e.target.value);
                                                    if (e.target.value === 'all') {
                                                        setExportForm({ status: '', picker_id: '', courier_id: '', start_date: '', end_date: '' });
                                                    } else if (e.target.value === 'available') {
                                                        setExportForm({ status: 'Available', picker_id: '', courier_id: '', start_date: '', end_date: '' });
                                                    } else if (e.target.value === 'allocated') {
                                                        setExportForm({ status: 'Allocated', picker_id: '', courier_id: '', start_date: '', end_date: '' });
                                                    } else if (e.target.value === 'assigned') {
                                                        setExportForm({ status: 'Assigned', picker_id: '', courier_id: '', start_date: '', end_date: '' });
                                                    } else if (e.target.value === 'void') {
                                                        setExportForm({ status: 'Void', picker_id: '', courier_id: '', start_date: '', end_date: '' });
                                                    }
                                                }}
                                                className="sr-only"
                                            />
                                            <span className="text-sm">{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {exportType === 'custom' && (
                                <div className="border-t border-brand-sand/30 pt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="space-y-2">
                                        <Label htmlFor="export-status">Status</Label>
                                        <select
                                            id="export-status"
                                            value={exportForm.status}
                                            onChange={(e) => setExportForm({ ...exportForm, status: e.target.value })}
                                            className="h-11 w-full rounded-xl border border-brand-warm/10 bg-white px-4 text-sm focus:border-brand-rust/30 focus:ring-brand-rust/5"
                                        >
                                            <option value="">All Statuses</option>
                                            {statuses.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="export-picker">Picker</Label>
                                        <select
                                            id="export-picker"
                                            value={exportForm.picker_id}
                                            onChange={(e) => setExportForm({ ...exportForm, picker_id: e.target.value })}
                                            className="h-11 w-full rounded-xl border border-brand-warm/10 bg-white px-4 text-sm focus:border-brand-rust/30 focus:ring-brand-rust/5"
                                        >
                                            <option value="">All Pickers</option>
                                            {pickers.map((p) => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="export-courier">Courier</Label>
                                        <select
                                            id="export-courier"
                                            value={exportForm.courier_id}
                                            onChange={(e) => setExportForm({ ...exportForm, courier_id: e.target.value })}
                                            className="h-11 w-full rounded-xl border border-brand-warm/10 bg-white px-4 text-sm focus:border-brand-rust/30 focus:ring-brand-rust/5"
                                        >
                                            <option value="">All Couriers</option>
                                            {couriers.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="export-start-date">Allocated From</Label>
                                            <Input
                                                id="export-start-date"
                                                type="date"
                                                value={exportForm.start_date}
                                                onChange={(e) => setExportForm({ ...exportForm, start_date: e.target.value })}
                                                className="h-11 rounded-xl border-brand-warm/10 focus:border-brand-rust/30 focus:ring-brand-rust/5"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="export-end-date">Allocated To</Label>
                                            <Input
                                                id="export-end-date"
                                                type="date"
                                                value={exportForm.end_date}
                                                onChange={(e) => setExportForm({ ...exportForm, end_date: e.target.value })}
                                                className="h-11 rounded-xl border-brand-warm/10 focus:border-brand-rust/30 focus:ring-brand-rust/5"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-brand-sand/30">
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl border-brand-warm/20"
                                onClick={() => setIsExportModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="bg-brand-rust text-white hover:bg-brand-rust/90 rounded-xl px-6 py-2.5 font-bold uppercase text-xs tracking-widest gap-2"
                            >
                                <Download className="size-4" />
                                Download PDF
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

                <ConfirmModal
                    isOpen={isVoidModalOpen}
                    onClose={() => {
                        setIsVoidModalOpen(false);
                        setVoidingId(null);
                    }}
                    onConfirm={() => {
                        if (voidingId !== null) {
                            setIsVoiding(true);
                            router.post(`/admin/serial-numbers/${voidingId}/void`, {}, {
                                onSuccess: () => {
                                    setIsVoidModalOpen(false);
                                    setVoidingId(null);
                                    setIsVoiding(false);
                                },
                                onError: () => {
                                    setIsVoiding(false);
                                },
                                preserveScroll: true
                            });
                        }
                    }}
                    loading={isVoiding}
                    title="Void Serial Number?"
                    description="Are you sure you want to void this serial number?"
                    variant="destructive"
                    confirmText="Yes, Void"
                />

                <ConfirmModal
                    isOpen={isBulkVoidModalOpen}
                    onClose={() => setIsBulkVoidModalOpen(false)}
                    onConfirm={() => {
                        setIsBulkVoiding(true);
                        router.post('/admin/serial-numbers/bulk-void', { ids: selectedIds }, {
                            onSuccess: () => {
                                setSelectedIds([]);
                                setIsBulkVoidModalOpen(false);
                                setIsBulkVoiding(false);
                            },
                            onError: () => {
                                setIsBulkVoiding(false);
                            },
                            preserveScroll: true
                        });
                    }}
                    loading={isBulkVoiding}
                    title="Void Selected Serial Numbers?"
                    description={`Are you sure you want to void ${selectedIds.length} serial numbers?`}
                    variant="destructive"
                    confirmText="Yes, Void All"
                />
            </AppLayout>
    );
}
