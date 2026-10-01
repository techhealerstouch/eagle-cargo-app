import React, { useState, useMemo } from 'react';
import { usePage } from '@inertiajs/react';
import { 
    Download, 
    FileSpreadsheet, 
    FileText, 
    Calendar, 
    CheckSquare, 
    Square, 
    Loader2, 
    Package, 
    User, 
    Users, 
    Boxes, 
    CreditCard, 
    FileCheck2,
    Filter,
    Check,
    RotateCcw
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export interface TrackingStep {
    key: string;
    label: string;
    phase?: string;
    order?: number;
    system_status?: string;
    description?: string;
}

interface BookingExportModalProps {
    exportUrl: string;
    selectedIds?: number[];
    filters?: Record<string, any>;
    trackingSteps?: TrackingStep[];
    label?: string;
    size?: 'default' | 'sm' | 'lg' | 'icon';
    variant?: 'default' | 'outline' | 'secondary' | 'ghost';
    className?: string;
}

interface DataSection {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}

const DATA_SECTIONS: DataSection[] = [
    {
        id: 'booking',
        title: 'Booking Details',
        description: 'Reference, type, preferred date, status, created at',
        icon: Package,
    },
    {
        id: 'sender',
        title: 'Sender Details',
        description: 'Name, email, mobile phone, street address, suburb, postcode',
        icon: User,
    },
    {
        id: 'recipient',
        title: 'Recipient Details',
        description: 'Name, mobile phone, destination province, delivery address',
        icon: Users,
    },
    {
        id: 'boxes',
        title: 'Boxes & Cargo',
        description: 'Box counts, tracking numbers, box sizes and assigned types',
        icon: Boxes,
    },
    {
        id: 'payment',
        title: 'Payment & Invoicing',
        description: 'Status, payment method, reference number, total AUD amount',
        icon: CreditCard,
    },
    {
        id: 'notes',
        title: 'Notes & Remarks',
        description: 'Customer booking remarks and internal administration notes',
        icon: FileCheck2,
    },
];

export default function BookingExportModal({
    exportUrl,
    selectedIds = [],
    filters = {},
    trackingSteps: trackingStepsProp,
    label = 'Export',
    size = 'sm',
    variant = 'outline',
    className = '',
}: BookingExportModalProps) {
    const { tracking_steps: pageTrackingSteps } = usePage<any>().props;
    const trackingSteps: TrackingStep[] = (trackingStepsProp ?? pageTrackingSteps ?? []) as TrackingStep[];

    // Dynamically group admin tracking journey steps by phase
    const groupedTrackingSteps = useMemo(() => {
        const groups: Record<string, TrackingStep[]> = {};
        const sorted = [...trackingSteps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        sorted.forEach((step) => {
            const phase = step.phase?.trim() || 'General';
            if (!groups[phase]) {
                groups[phase] = [];
            }
            groups[phase].push(step);
        });

        return groups;
    }, [trackingSteps]);

    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Form state
    const [exportScope, setExportScope] = useState<'selected' | 'filtered'>(
        selectedIds.length > 0 ? 'selected' : 'filtered'
    );
    const [selectedSections, setSelectedSections] = useState<string[]>([
        'booking',
        'sender',
        'recipient',
        'boxes',
        'payment',
        'notes',
    ]);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [status, setStatus] = useState<string>(filters?.status && filters.status !== 'all' ? filters.status : 'all');
    const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');

    const handleOpen = () => {
        setExportScope(selectedIds.length > 0 ? 'selected' : 'filtered');
        setStatus(filters?.status && filters.status !== 'all' ? filters.status : 'all');
        setIsOpen(true);
    };

    const toggleSection = (id: string) => {
        setSelectedSections((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
    };

    const selectAllSections = () => {
        setSelectedSections(DATA_SECTIONS.map((s) => s.id));
    };

    const clearAllSections = () => {
        setSelectedSections(['booking']); // Keep at least booking
    };

    const setDatePreset = (preset: 'today' | '7days' | '30days' | 'thisMonth' | 'all') => {
        const today = new Date();
        const formatDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (preset === 'today') {
            setStartDate(formatDate(today));
            setEndDate(formatDate(today));
        } else if (preset === '7days') {
            const past = new Date();
            past.setDate(today.getDate() - 7);
            setStartDate(formatDate(past));
            setEndDate(formatDate(today));
        } else if (preset === '30days') {
            const past = new Date();
            past.setDate(today.getDate() - 30);
            setStartDate(formatDate(past));
            setEndDate(formatDate(today));
        } else if (preset === 'thisMonth') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            setStartDate(formatDate(firstDay));
            setEndDate(formatDate(today));
        } else if (preset === 'all') {
            setStartDate('');
            setEndDate('');
        }
    };

    const handleExport = (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedSections.length === 0) {
            toast.error('Please select at least one data section to include in the export.');
            return;
        }

        setIsExporting(true);
        toast.info(`Preparing ${format.toUpperCase()} export...`);

        const params = new URLSearchParams();

        // 1. Data sections
        params.append('sections', selectedSections.join(','));

        // 2. Format
        params.append('format', format);

        // 3. Selection scope vs Filters
        if (exportScope === 'selected' && selectedIds.length > 0) {
            params.append('ids', selectedIds.join(','));
        } else {
            // Apply Date Range
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            // Apply Status
            if (status && status !== 'all') {
                params.append('status', status);
            }

            // Carry over any active table filters
            if (filters) {
                if (filters.payment_status && filters.payment_status !== 'all') {
                    params.append('payment_status', String(filters.payment_status));
                }
                if (filters.declaration_form_status && filters.declaration_form_status !== 'all') {
                    params.append('declaration_form_status', String(filters.declaration_form_status));
                }
                if (filters.customer_type && filters.customer_type !== 'all') {
                    params.append('customer_type', String(filters.customer_type));
                }
                if (filters.search) {
                    params.append('search', String(filters.search));
                }
            }
        }

        const queryString = params.toString();
        const fullUrl = queryString ? `${exportUrl}?${queryString}` : exportUrl;

        // Trigger browser file download
        const link = document.createElement('a');
        link.href = fullUrl;
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
            setIsExporting(false);
            setIsOpen(false);
            toast.success(`Bookings ${format.toUpperCase()} export downloaded successfully.`);
        }, 1200);
    };

    return (
        <>
            <Button
                type="button"
                variant={variant}
                size={size}
                onClick={handleOpen}
                className={`gap-2 ${className}`}
            >
                <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>{selectedIds.length > 0 ? `${label} (${selectedIds.length})` : label}</span>
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl p-0 gap-0 overflow-hidden bg-white border border-zinc-200/90 shadow-2xl rounded-2xl max-h-[92vh] flex flex-col">
                    {/* Header */}
                    <div className="p-5 sm:px-6 sm:py-4.5 border-b border-zinc-100 bg-gradient-to-r from-emerald-50/40 via-white to-zinc-50/30 shrink-0">
                        <DialogHeader>
                            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                                        <FileSpreadsheet className="size-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <DialogTitle className="text-base sm:text-lg font-bold font-serif text-brand-navy">
                                                Export Bookings Data
                                            </DialogTitle>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                                                {format}
                                            </span>
                                        </div>
                                        <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                                            Configure the data tables, date range, status, and download file format.
                                        </DialogDescription>
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    {/* Landscape 2-Column Responsive Body */}
                    <form onSubmit={handleExport} className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-100">
                                
                                {/* Left Column: Table & Data Sections (lg:col-span-7) */}
                                <div className="lg:col-span-7 p-5 sm:p-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                                                    1. Table / Data to Export
                                                </Label>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                                                    {selectedSections.length} of {DATA_SECTIONS.length} selected
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-500 mt-0.5">
                                                Select which booking data groups and columns to include in the file
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={selectAllSections}
                                                className="text-xs font-semibold text-brand-rust hover:text-brand-rust/80 hover:underline"
                                            >
                                                Select All
                                            </button>
                                            <span className="text-zinc-300">|</span>
                                            <button
                                                type="button"
                                                onClick={clearAllSections}
                                                className="text-xs font-medium text-zinc-500 hover:text-zinc-800 hover:underline inline-flex items-center gap-1"
                                            >
                                                <RotateCcw className="size-3" />
                                                Reset
                                            </button>
                                        </div>
                                    </div>

                                    {/* 2-Column Grid of Section Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {DATA_SECTIONS.map((section) => {
                                            const isSelected = selectedSections.includes(section.id);
                                            const IconComponent = section.icon;

                                            return (
                                                <div
                                                    key={section.id}
                                                    onClick={() => toggleSection(section.id)}
                                                    className={`group relative flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all select-none ${
                                                        isSelected
                                                            ? 'bg-emerald-50/50 border-emerald-400/80 ring-1 ring-emerald-400/30 shadow-xs'
                                                            : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60'
                                                    }`}
                                                >
                                                    <div className="pt-0.5 shrink-0">
                                                        {isSelected ? (
                                                            <div className="size-4.5 rounded bg-emerald-600 text-white flex items-center justify-center">
                                                                <Check className="size-3 stroke-[2.5]" />
                                                            </div>
                                                        ) : (
                                                            <div className="size-4.5 rounded border border-zinc-300 bg-white group-hover:border-zinc-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-900">
                                                            <IconComponent className={`size-3.5 ${isSelected ? 'text-emerald-700' : 'text-zinc-500'}`} />
                                                            <span>{section.title}</span>
                                                        </div>
                                                        <p className="text-[11px] text-zinc-500 leading-snug mt-1 line-clamp-2">
                                                            {section.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Pro-Tip Box */}
                                    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 text-[11px] text-zinc-600 flex items-start gap-2">
                                        <Filter className="size-3.5 text-zinc-400 shrink-0 mt-0.5" />
                                        <span>
                                            Selected sections will appear as consecutive columns in your spreadsheet. Eager-loaded cargo boxes and recipient details are aggregated per booking.
                                        </span>
                                    </div>
                                </div>

                                {/* Right Column: Filters, Range & Format (lg:col-span-5) */}
                                <div className="lg:col-span-5 p-5 sm:p-6 bg-zinc-50/60 space-y-5">
                                    
                                    {/* Scope selector if items are checked */}
                                    {selectedIds.length > 0 && (
                                        <div className="p-3 rounded-xl bg-white border border-zinc-200/90 shadow-2xs space-y-2">
                                            <Label className="text-[11px] font-bold uppercase tracking-wider text-zinc-700 block">
                                                Export Scope
                                            </Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setExportScope('selected')}
                                                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold transition-all ${
                                                        exportScope === 'selected'
                                                            ? 'bg-brand-rust/10 border-brand-rust text-brand-rust'
                                                            : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                                                    }`}
                                                >
                                                    <span>Selected ({selectedIds.length})</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setExportScope('filtered')}
                                                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold transition-all ${
                                                        exportScope === 'filtered'
                                                            ? 'bg-brand-rust/10 border-brand-rust text-brand-rust'
                                                            : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                                                    }`}
                                                >
                                                    <span>Date Range</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Section 2: Date Range */}
                                    {exportScope === 'filtered' && (
                                        <div className="space-y-3">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                                                        2. Date Range
                                                    </Label>
                                                    <span className="text-[10px] text-zinc-400 font-medium">By Created Date</span>
                                                </div>
                                                
                                                {/* Preset Pills */}
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDatePreset('today')}
                                                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white hover:bg-zinc-200/80 border border-zinc-200 text-zinc-700 transition-colors"
                                                    >
                                                        Today
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDatePreset('7days')}
                                                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white hover:bg-zinc-200/80 border border-zinc-200 text-zinc-700 transition-colors"
                                                    >
                                                        7 Days
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDatePreset('30days')}
                                                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white hover:bg-zinc-200/80 border border-zinc-200 text-zinc-700 transition-colors"
                                                    >
                                                        30 Days
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDatePreset('thisMonth')}
                                                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white hover:bg-zinc-200/80 border border-zinc-200 text-zinc-700 transition-colors"
                                                    >
                                                        This Month
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDatePreset('all')}
                                                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white hover:bg-zinc-200/80 border border-zinc-200 text-zinc-700 transition-colors"
                                                    >
                                                        All Time
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Date Inputs */}
                                            <div className="grid grid-cols-2 gap-2.5">
                                                <div className="space-y-1">
                                                    <Label htmlFor="export-start-date" className="text-[11px] text-zinc-600 font-medium">
                                                        Start Date
                                                    </Label>
                                                    <Input
                                                        id="export-start-date"
                                                        type="date"
                                                        value={startDate}
                                                        onChange={(e) => setStartDate(e.target.value)}
                                                        className="h-9 text-xs rounded-xl bg-white"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor="export-end-date" className="text-[11px] text-zinc-600 font-medium">
                                                        End Date
                                                    </Label>
                                                    <Input
                                                        id="export-end-date"
                                                        type="date"
                                                        value={endDate}
                                                        onChange={(e) => setEndDate(e.target.value)}
                                                        className="h-9 text-xs rounded-xl bg-white"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Section 3: Booking Status */}
                                    {exportScope === 'filtered' && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="export-status" className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                                                    3. Status / Tracking Journey
                                                </Label>
                                                <span className="text-[10px] text-zinc-400 font-medium">Configured by Admin</span>
                                            </div>
                                            <select
                                                id="export-status"
                                                value={status}
                                                onChange={(e) => setStatus(e.target.value)}
                                                className="h-9.5 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust shadow-2xs"
                                            >
                                                <option value="all">All Statuses & Tracking Milestones</option>

                                                <optgroup label="Booking Lifecycle">
                                                    <option value="pending">Pending / Booked</option>
                                                    <option value="confirmed">Confirmed</option>
                                                </optgroup>

                                                {Object.entries(groupedTrackingSteps).map(([phase, steps]) => (
                                                    <optgroup key={phase} label={`Tracking Journey: ${phase}`}>
                                                        {steps.map((step) => (
                                                            <option key={step.key} value={step.key}>
                                                                {step.label}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}

                                                <optgroup label="Other Statuses">
                                                    <option value="cancelled">Cancelled</option>
                                                    <option value="draft">Draft</option>
                                                </optgroup>
                                            </select>
                                        </div>
                                    )}

                                    {/* Section 4: Export Format */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-zinc-800">
                                            {exportScope === 'filtered' ? '4. Export Format' : '2. Export Format'}
                                        </Label>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div
                                                onClick={() => setFormat('xlsx')}
                                                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                                                    format === 'xlsx'
                                                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-1 ring-emerald-400 shadow-2xs'
                                                        : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                                                }`}
                                            >
                                                <FileSpreadsheet className={`size-5 shrink-0 ${format === 'xlsx' ? 'text-emerald-700' : 'text-zinc-400'}`} />
                                                <div className="min-w-0">
                                                    <span className="block text-xs font-bold leading-tight">Excel (.xlsx)</span>
                                                    <span className="text-[10px] text-zinc-500 leading-tight block truncate">Styled columns</span>
                                                </div>
                                            </div>

                                            <div
                                                onClick={() => setFormat('csv')}
                                                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                                                    format === 'csv'
                                                        ? 'bg-blue-50 border-blue-400 text-blue-950 ring-1 ring-blue-400 shadow-2xs'
                                                        : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                                                }`}
                                            >
                                                <FileText className={`size-5 shrink-0 ${format === 'csv' ? 'text-blue-700' : 'text-zinc-400'}`} />
                                                <div className="min-w-0">
                                                    <span className="block text-xs font-bold leading-tight">CSV (.csv)</span>
                                                    <span className="text-[10px] text-zinc-500 leading-tight block truncate">Plain text table</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Footer (Pinned across bottom) */}
                        <DialogFooter className="border-t border-zinc-100 bg-white p-4 sm:px-6 flex flex-row items-center justify-between shrink-0 gap-3">
                            <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                                <span className="font-semibold text-zinc-800">{selectedSections.length}</span>
                                <span>sections selected</span>
                                <span className="text-zinc-300">•</span>
                                <span className="font-medium uppercase text-emerald-700">{format}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsOpen(false)}
                                    disabled={isExporting}
                                    className="rounded-xl text-xs h-9"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isExporting || selectedSections.length === 0}
                                    className="rounded-xl bg-brand-rust hover:bg-brand-rust/90 text-white gap-2 font-medium text-xs h-9 px-4 shadow-xs"
                                >
                                    {isExporting ? (
                                        <>
                                            <Loader2 className="size-3.5 animate-spin" />
                                            <span>Exporting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download className="size-3.5" />
                                            <span>Download {format.toUpperCase()}</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
