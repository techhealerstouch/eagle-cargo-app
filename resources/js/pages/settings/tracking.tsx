import { Head, useForm } from '@inertiajs/react';
import {
    GripVertical,
    Plus,
    Save,
    Trash2,
    Users,
    Package,
    PackageCheck,
    Warehouse,
    Container,
    Ship,
    MapPin,
    ShieldCheck,
    ArrowDownUp,
    Truck,
    Bike,
    Home,
    Circle,
    Edit2,
    Check,
    Lock,
    Unlock,
    AlertTriangle,
    Eye,
    EyeOff,
    MessageSquare,
    Mail,
    Bell,
    Globe,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import UnsavedChangesBar from '@/components/settings/UnsavedChangesBar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Tracking Journey', href: '/settings/tracking' },
];

const availableIcons = [
    { key: 'package', label: 'Package', icon: Package },
    { key: 'package-check', label: 'Check', icon: PackageCheck },
    { key: 'warehouse', label: 'Warehouse', icon: Warehouse },
    { key: 'container', label: 'Container', icon: Container },
    { key: 'ship', label: 'Ship', icon: Ship },
    { key: 'map-pin', label: 'Map Pin', icon: MapPin },
    { key: 'shield-check', label: 'Customs', icon: ShieldCheck },
    { key: 'arrow-down-up', label: 'Sorting', icon: ArrowDownUp },
    { key: 'truck', label: 'Truck', icon: Truck },
    { key: 'bike', label: 'Courier', icon: Bike },
    { key: 'home', label: 'Delivered', icon: Home },
    { key: 'circle', label: 'Default', icon: Circle },
] as const;

const iconMap: Record<string, typeof Package> = {
    package: Package,
    'package-check': PackageCheck,
    warehouse: Warehouse,
    container: Container,
    ship: Ship,
    'map-pin': MapPin,
    'shield-check': ShieldCheck,
    'arrow-down-up': ArrowDownUp,
    truck: Truck,
    bike: Bike,
    home: Home,
    circle: Circle,
};

const availableRoles = [
    { key: 'picker', label: 'Picker' },
    { key: 'warehouse', label: 'Warehouse Staff' },
    { key: 'courier', label: 'Courier' },
    { key: 'admin', label: 'Admin' },
    { key: 'super_admin', label: 'Super Admin' },
];

const systemStatusGroups = [
    {
        label: 'Origin & Pre-Pickup',
        statuses: [
            { value: 'pending',             label: 'Pending (Booking Placed / Awaiting Review)' },
            { value: 'confirmed',           label: 'Confirmed (Accepted by Admin)' },
            { value: 'collected',           label: 'Collected (Picked Up from Sender)' },
            { value: 'received_by_branch',  label: 'Received by Warehouse' },
            { value: 'loaded_to_container', label: 'Loaded to Container' },
        ],
    },
    {
        label: 'International Transit',
        statuses: [
            { value: 'in_transit', label: 'In Transit (Sea)' },
            { value: 'arrived',    label: 'Arrived at Port' },
        ],
    },
    {
        label: 'Destination',
        statuses: [
            { value: 'for_checking_unloading',  label: 'For Checking / Unloading' },
            { value: 'unloaded_manila',          label: 'Unloaded (Manila)' },
            { value: 'for_delivery_scheduling', label: 'For Delivery Scheduling' },
            { value: 'en_route_roro',           label: 'En Route (RoRo)' },
            { value: 'out_for_delivery',        label: 'Out for Delivery' },
            { value: 'delivered',               label: 'Delivered' },
        ],
    },
    {
        label: 'Exception States',
        statuses: [
            { value: 'held',         label: 'Held' },
            { value: 'held_bulging', label: 'Held (Bulging)' },
            { value: 'damaged',      label: 'Damaged' },
            { value: 'cancelled',    label: 'Cancelled' },
        ],
    },
];

const getStatusColor = (status: string) => {
    const originStatuses = ['pending', 'confirmed', 'collected', 'received_by_branch', 'loaded_to_container'];
    const transitStatuses = ['in_transit', 'arrived'];
    const destStatuses = ['for_checking_unloading', 'unloaded_manila', 'for_delivery_scheduling', 'en_route_roro', 'out_for_delivery', 'delivered'];
    const exceptionStatuses = ['held', 'held_bulging', 'damaged', 'cancelled'];

    if (originStatuses.includes(status)) return 'bg-blue-500';
    if (transitStatuses.includes(status)) return 'bg-amber-500';
    if (destStatuses.includes(status)) return 'bg-emerald-500';
    if (exceptionStatuses.includes(status)) return 'bg-rose-500';
    return 'bg-zinc-400';
};

interface TrackingStep {
    key: string;
    label: string;
    phase: string;
    order: number;
    icon: string;
    allowed_roles: string[];
    system_status: string;
    description: string;
    is_public: boolean;
    notify_sms: boolean;
    notify_email: boolean;
    customer_message: string;
}

interface StepProp {
    key: string;
    label: string;
    phase: string;
    order?: number;
    icon: string;
    allowed_roles?: string[];
    system_status: string;
    description?: string | null;
    is_public?: boolean;
    notify_sms?: boolean;
    notify_email?: boolean;
    customer_message?: string | null;
}

interface StepFormData {
    key: string;
    label: string;
    phase: string;
    icon: string;
    allowed_roles: string[];
    system_status: string;
    description: string;
    is_public: boolean;
    notify_sms: boolean;
    notify_email: boolean;
    customer_message: string;
}

const defaultStepForm: StepFormData = {
    key: '',
    label: '',
    phase: 'Destination',
    icon: 'truck',
    allowed_roles: ['warehouse', 'admin', 'super_admin'],
    system_status: 'out_for_delivery',
    description: '',
    is_public: true,
    notify_sms: false,
    notify_email: false,
    customer_message: '',
};

export default function TrackingSettings({ steps }: { steps: StepProp[] }) {
    const { data, setData, put, processing, isDirty, reset } = useForm<{ steps: TrackingStep[] }>({
        steps: steps.map((s, i) => ({
            key: s.key,
            label: s.label,
            phase: s.phase,
            order: s.order ?? i + 1,
            icon: s.icon || 'circle',
            allowed_roles: s.allowed_roles || [],
            system_status: s.system_status || 'pending',
            description: s.description || '',
            is_public: s.is_public !== false,
            notify_sms: !!s.notify_sms,
            notify_email: !!s.notify_email,
            customer_message: s.customer_message || '',
        })),
    });

    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [formData, setFormData] = useState<StepFormData>(defaultStepForm);
    const [keyTouched, setKeyTouched] = useState(false);
    const [isKeyLocked, setIsKeyLocked] = useState(true);
    const [validationError, setValidationError] = useState<string | null>(null);

    const submit: React.FormEventHandler = (e) => {
        e.preventDefault();
        put('/settings/tracking', {
            onSuccess: () => {
                toast.success('Tracking journey steps updated successfully');
            },
        });
    };

    const openAddModal = () => {
        const nextOrder = data.steps.length + 1;
        setFormData({
            ...defaultStepForm,
            key: `step_${nextOrder}`,
        });
        setModalMode('create');
        setEditingIndex(null);
        setKeyTouched(false);
        setIsKeyLocked(false);
        setValidationError(null);
        setModalOpen(true);
    };

    const openEditModal = (index: number) => {
        const step = data.steps[index];
        setFormData({
            key: step.key,
            label: step.label,
            phase: step.phase,
            icon: step.icon || 'circle',
            allowed_roles: step.allowed_roles || [],
            system_status: step.system_status || 'pending',
            description: step.description || '',
            is_public: step.is_public !== false,
            notify_sms: !!step.notify_sms,
            notify_email: !!step.notify_email,
            customer_message: step.customer_message || '',
        });
        setModalMode('edit');
        setEditingIndex(index);
        setKeyTouched(true);
        setIsKeyLocked(true);
        setValidationError(null);
        setModalOpen(true);
    };

    const setRolePreset = (preset: 'all' | 'ops' | 'admin' | 'clear') => {
        switch (preset) {
            case 'all':
                setFormData((prev) => ({
                    ...prev,
                    allowed_roles: availableRoles.map((r) => r.key),
                }));
                break;
            case 'ops':
                setFormData((prev) => ({
                    ...prev,
                    allowed_roles: ['picker', 'warehouse', 'courier'],
                }));
                break;
            case 'admin':
                setFormData((prev) => ({
                    ...prev,
                    allowed_roles: ['admin', 'super_admin'],
                }));
                break;
            case 'clear':
                setFormData((prev) => ({
                    ...prev,
                    allowed_roles: [],
                }));
                break;
        }
    };

    const handleLabelChange = (newLabel: string) => {
        if (modalMode === 'create' && !keyTouched) {
            const slug = newLabel
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, '');
            setFormData((prev) => ({
                ...prev,
                label: newLabel,
                key: slug || `step_${data.steps.length + 1}`,
            }));
        } else {
            setFormData((prev) => ({ ...prev, label: newLabel }));
        }
    };

    const toggleRole = (roleKey: string) => {
        setFormData((prev) => {
            const exists = prev.allowed_roles.includes(roleKey);
            return {
                ...prev,
                allowed_roles: exists
                    ? prev.allowed_roles.filter((r) => r !== roleKey)
                    : [...prev.allowed_roles, roleKey],
            };
        });
    };

    const handleSaveMilestone = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const trimmedLabel = formData.label.trim();
        if (!trimmedLabel) {
            setValidationError('Please enter a display label for this milestone.');
            return;
        }

        const trimmedKey = formData.key
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^_|_$/g, '');

        if (!trimmedKey) {
            setValidationError('Please enter a valid programmatic key (e.g. customs_clearance).');
            return;
        }

        const isDuplicate = data.steps.some(
            (s, idx) =>
                s.key === trimmedKey &&
                (modalMode === 'create' || idx !== editingIndex),
        );

        if (isDuplicate) {
            setValidationError(
                `A milestone with key "${trimmedKey}" already exists. Please choose a unique key.`,
            );
            return;
        }

        if (modalMode === 'create') {
            const newStep: TrackingStep = {
                ...formData,
                label: trimmedLabel,
                key: trimmedKey,
                order: data.steps.length + 1,
            };
            setData('steps', [...data.steps, newStep]);
            toast.success(`Milestone "${trimmedLabel}" added to tracking journey`);
        } else if (editingIndex !== null) {
            const updated = [...data.steps];
            updated[editingIndex] = {
                ...updated[editingIndex],
                ...formData,
                label: trimmedLabel,
                key: trimmedKey,
            };
            setData('steps', updated);
            toast.success(`Milestone "${trimmedLabel}" updated`);
        }

        setModalOpen(false);
    };

    const removeStep = (index: number) => {
        if (data.steps.length <= 2) {
            toast.error('The journey requires at least 2 milestone steps.');
            return;
        }

        const removed = data.steps[index];
        const updated = data.steps
            .filter((_, i) => i !== index)
            .map((s, i) => ({ ...s, order: i + 1 }));
        setData('steps', updated);
        toast.success(`Milestone "${removed.label}" removed`);
    };

    const moveStep = (from: number, to: number) => {
        const updated = [...data.steps];
        const [moved] = updated.splice(from, 1);
        updated.splice(to, 0, moved);
        setData(
            'steps',
            updated.map((s, i) => ({ ...s, order: i + 1 })),
        );
    };

    const handleDragStart = (idx: number) => setDragIdx(idx);
    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();

        if (dragIdx === null || dragIdx === idx) {
            return;
        }

        moveStep(dragIdx, idx);
        setDragIdx(idx);
    };
    const handleDragEnd = () => setDragIdx(null);

    const getPhaseStyles = (phase: string) => {
        switch (phase) {
            case 'Origin':
                return {
                    bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
                };
            case 'In Transit':
            case 'International Transit':
                return {
                    bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                };
            case 'Destination':
                return {
                    bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                };
            default:
                return {
                    bg: 'bg-brand-warm/10 text-brand-text border-border',
                };
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tracking Journey" />
            <SettingsLayout
                eyebrow="Operations"
                title="Tracking Journey Milestones"
                description="Configure the tracking timeline sequence, icons, role permissions, and system status mapping."
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={openAddModal}
                            className="h-10 px-4 rounded-xl border border-border bg-card text-brand-text text-xs font-semibold hover:bg-brand-warm/20 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                            <Plus className="size-3.5 text-brand-rust" />
                            Add Milestone
                        </Button>
                        <Button
                            onClick={submit}
                            disabled={processing}
                            className="h-10 px-5 rounded-xl bg-brand-rust text-white text-xs font-semibold hover:bg-brand-rust/90 flex items-center gap-2 shadow-2xs cursor-pointer"
                        >
                            <Save className="size-3.5" />
                            {processing ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                }
            >
                <div className="w-full space-y-4">
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-2.5">
                            {data.steps.map((step, index) => {
                                const styles = getPhaseStyles(step.phase);
                                const StepIcon =
                                    iconMap[step.icon as keyof typeof iconMap] ||
                                    iconMap.circle;

                                return (
                                    <div
                                        key={step.key || index}
                                        draggable
                                        onDragStart={() =>
                                            handleDragStart(index)
                                        }
                                        onDragOver={(e) =>
                                            handleDragOver(e, index)
                                        }
                                        onDragEnd={handleDragEnd}
                                        className={`group relative flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 transition-all shadow-2xs hover:border-brand-rust/40 ${
                                            dragIdx === index ? 'opacity-50' : ''
                                        }`}
                                    >
                                        <div className="cursor-grab text-brand-text-light hover:text-brand-text">
                                            <GripVertical className="size-4" />
                                        </div>
                                        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-brand-warm/20 text-[11px] font-bold text-brand-text">
                                            {index + 1}
                                        </div>
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-warm/10 border border-border text-brand-rust">
                                            <StepIcon className="size-4" />
                                        </div>

                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="truncate text-xs font-semibold text-brand-text">
                                                    {step.label || 'Untitled Step'}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${styles.bg}`}>
                                                    {step.phase}
                                                </span>
                                                <span className="text-[10px] font-mono text-brand-text-light/60 bg-brand-warm/15 px-1.5 py-0.5 rounded border border-border/40">
                                                    {step.key}
                                                </span>
                                                {step.is_public !== false ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                        <Eye className="size-2.5" /> Public
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 bg-zinc-500/10 px-1.5 py-0.5 rounded border border-zinc-500/20">
                                                        <EyeOff className="size-2.5" /> Internal Only
                                                    </span>
                                                )}
                                                {step.notify_sms && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                                                        <MessageSquare className="size-2.5" /> SMS
                                                    </span>
                                                )}
                                                {step.notify_email && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                                        <Mail className="size-2.5" /> Email
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-brand-text-light mt-0.5 flex-wrap">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className={`size-1.5 rounded-full ${getStatusColor(step.system_status)}`} />
                                                    Map: <strong className="font-semibold text-brand-text">{humanize(step.system_status)}</strong>
                                                </span>
                                                {step.customer_message && (
                                                    <span className="truncate text-brand-text-light/90 italic">
                                                        • "{step.customer_message}"
                                                    </span>
                                                )}
                                                {!step.customer_message && step.description && (
                                                    <span className="truncate text-brand-text-light/80">
                                                        • {step.description}
                                                    </span>
                                                )}
                                            </div>
                                            {step.allowed_roles && step.allowed_roles.length > 0 && (
                                                <div className="flex items-center gap-1 mt-1 text-[10px] text-brand-text-light">
                                                    <Users className="size-3 shrink-0 text-brand-rust/70" />
                                                    <span className="truncate">
                                                        {step.allowed_roles
                                                            .map(
                                                                (r) =>
                                                                    availableRoles.find(
                                                                        (ar) =>
                                                                            ar.key ===
                                                                            r,
                                                                    )?.label || r,
                                                            )
                                                            .join(', ')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                title="Edit step"
                                                onClick={() =>
                                                    openEditModal(index)
                                                }
                                                className="p-1.5 rounded-lg text-brand-text-light hover:text-brand-text hover:bg-brand-warm/20 cursor-pointer"
                                            >
                                                <Edit2 className="size-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                title="Remove step"
                                                onClick={() =>
                                                    removeStep(index)
                                                }
                                                className="p-1.5 rounded-lg text-brand-text-light hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={openAddModal}
                                className="h-10 px-4 text-xs font-semibold rounded-xl border border-border bg-card text-brand-text hover:bg-brand-warm/20 shadow-2xs cursor-pointer flex items-center gap-1.5"
                            >
                                <Plus className="size-3.5 text-brand-rust" />
                                Add Journey Step
                            </Button>
                            <span className="text-xs text-brand-text-light">
                                {data.steps.length} milestones configured
                            </span>
                        </div>

                        <UnsavedChangesBar
                            isDirty={isDirty}
                            processing={processing}
                            onReset={reset}
                        />
                    </form>

                    <Dialog
                        open={modalOpen}
                        onOpenChange={(open) => {
                            if (!open) {
                                setModalOpen(false);
                                setValidationError(null);
                            }
                        }}
                    >
                        <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl rounded-2xl p-6 bg-card border border-border text-brand-text shadow-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader className="space-y-1">
                                <DialogTitle className="text-base font-semibold text-brand-text">
                                    {modalMode === 'create'
                                        ? 'Add Tracking Milestone'
                                        : `Configure Milestone: ${formData.label || 'Step'}`}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-brand-text-light">
                                    {modalMode === 'create'
                                        ? 'Define a new milestone step, icon, role access, and system mapping.'
                                        : 'Edit step label, icon, role access, and system mapping.'}
                                </DialogDescription>
                            </DialogHeader>

                            {validationError && (
                                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-medium">
                                    {validationError}
                                </div>
                            )}

                            {/* Live Customer Timeline Preview */}
                            <div className="rounded-xl border border-border/80 bg-brand-warm/10 p-3.5 space-y-2">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-brand-text-light uppercase tracking-wider">
                                    <span className="flex items-center gap-1.5">
                                        <Eye className="size-3.5 text-brand-rust" />
                                        Customer Timeline Preview
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        {formData.is_public ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
                                                <Eye className="size-2.5" /> Public
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 uppercase">
                                                <EyeOff className="size-2.5" /> Internal Only
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getPhaseStyles(formData.phase).bg}`}>
                                            {formData.phase}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 pt-0.5">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card border border-border text-brand-rust shadow-2xs">
                                        {(() => {
                                            const PreviewIcon = iconMap[formData.icon as keyof typeof iconMap] || iconMap.circle;
                                            return <PreviewIcon className="size-5" />;
                                        })()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-semibold text-brand-text">
                                                {formData.label || 'Untitled Milestone'}
                                            </span>
                                            <span className="text-[10px] font-mono text-brand-text-light/80 bg-card px-1.5 py-0.5 rounded border border-border/50">
                                                {formData.key || 'key'}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[10px] text-brand-text-light bg-card px-1.5 py-0.5 rounded border border-border/50">
                                                <span className={`size-1.5 rounded-full ${getStatusColor(formData.system_status)}`} />
                                                {humanize(formData.system_status)}
                                            </span>
                                            {(formData.notify_sms || formData.notify_email) && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-rust bg-brand-rust/10 px-1.5 py-0.5 rounded border border-brand-rust/20">
                                                    <Bell className="size-2.5" />
                                                    {[formData.notify_sms && 'SMS', formData.notify_email && 'Email'].filter(Boolean).join(' & ')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-brand-text-light mt-1 line-clamp-2">
                                            {formData.customer_message 
                                                ? formData.customer_message 
                                                : formData.description 
                                                    ? formData.description 
                                                    : 'No customer message entered yet. Customers will only see the milestone title on their timeline.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleSaveMilestone} className="space-y-4 pt-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-brand-text-mid">
                                            Display Label <span className="text-rose-500">*</span>
                                        </Label>
                                        <Input
                                            value={formData.label}
                                            placeholder="e.g. Delivered"
                                            onChange={(e) =>
                                                handleLabelChange(e.target.value)
                                            }
                                            className="h-10 text-xs font-medium rounded-xl border border-border bg-card text-brand-text focus-visible:ring-2 focus-visible:ring-ring focus:border-brand-rust"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-brand-text-mid flex items-center justify-between">
                                            <span>Milestone Key <span className="text-rose-500">*</span></span>
                                            <span className="text-[10px] font-normal text-brand-text-light">slug</span>
                                        </Label>
                                        <div className="relative flex items-center">
                                            <Input
                                                value={formData.key}
                                                readOnly={modalMode === 'edit' && isKeyLocked}
                                                placeholder="e.g. delivered"
                                                onChange={(e) => {
                                                    setKeyTouched(true);
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        key: e.target.value,
                                                    }));
                                                }}
                                                className={`h-10 text-xs font-mono rounded-xl border border-border bg-card text-brand-text focus-visible:ring-2 focus-visible:ring-ring focus:border-brand-rust ${
                                                    modalMode === 'edit' && isKeyLocked ? 'opacity-80 bg-brand-warm/10 pr-9 cursor-not-allowed' : ''
                                                }`}
                                            />
                                            {modalMode === 'edit' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsKeyLocked((prev) => !prev)}
                                                    title={isKeyLocked ? 'Unlock key to rename' : 'Lock key slug'}
                                                    className="absolute right-2 p-1 rounded-md text-brand-text-light hover:text-brand-text hover:bg-brand-warm/20 transition-colors cursor-pointer"
                                                >
                                                    {isKeyLocked ? (
                                                        <Lock className="size-3.5 text-brand-text-light" />
                                                    ) : (
                                                        <Unlock className="size-3.5 text-amber-500" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        {modalMode === 'edit' && !isKeyLocked && (
                                            <p className="text-[10px] text-amber-500 flex items-center gap-1 pt-0.5">
                                                <AlertTriangle className="size-3 shrink-0" />
                                                Careful: Changing the key may affect historical logs or status references.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-brand-text-mid">
                                            Phase
                                        </Label>
                                        <Select
                                            value={formData.phase}
                                            onValueChange={(v) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    phase: v,
                                                }))
                                            }
                                        >
                                            <SelectTrigger className="h-10 text-xs font-medium rounded-xl border border-border bg-card text-brand-text">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border border-border bg-card text-brand-text shadow-2xl">
                                                <SelectItem value="Origin" className="text-xs text-brand-text">Origin</SelectItem>
                                                <SelectItem value="International Transit" className="text-xs text-brand-text">International Transit</SelectItem>
                                                <SelectItem value="Destination" className="text-xs text-brand-text">Destination</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-brand-text-mid flex items-center justify-between">
                                            <span>System Mapping</span>
                                            <span className="text-[10px] font-normal text-brand-text-light">BoxStatus sync</span>
                                        </Label>
                                        <Select
                                            value={formData.system_status}
                                            onValueChange={(v) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    system_status: v,
                                                }))
                                            }
                                        >
                                            <SelectTrigger className="h-10 text-xs font-medium rounded-xl border border-border bg-card text-brand-text">
                                                <div className="flex items-center gap-2 truncate">
                                                    <span className={`size-2 rounded-full shrink-0 ${getStatusColor(formData.system_status)}`} />
                                                    <SelectValue />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border border-border bg-card text-brand-text shadow-2xl max-h-72">
                                                {systemStatusGroups.map((group, gi) => (
                                                    <SelectGroup key={group.label}>
                                                        {gi > 0 && <SelectSeparator />}
                                                        <SelectLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2 py-1">
                                                            {group.label}
                                                        </SelectLabel>
                                                        {group.statuses.map((s) => (
                                                            <SelectItem key={s.value} value={s.value} className="text-xs text-brand-text">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`size-2 rounded-full shrink-0 ${getStatusColor(s.value)}`} />
                                                                    <span>{s.label}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {['held', 'held_bulging', 'damaged', 'cancelled'].includes(formData.system_status) && (
                                            <p className="text-[10px] text-amber-500 flex items-center gap-1 pt-0.5">
                                                <AlertTriangle className="size-3 shrink-0" />
                                                Mapped to exception status ({humanize(formData.system_status)}).
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-brand-text-mid flex items-center justify-between">
                                        <span>Milestone Icon</span>
                                        <span className="text-[10px] font-normal text-brand-text-light">Select visual symbol</span>
                                    </Label>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
                                        {availableIcons.map(({ key: iconKey, icon: IconComponent, label: iconLabel }) => {
                                            const isSelected = formData.icon === iconKey;
                                            return (
                                                <button
                                                    key={iconKey}
                                                    type="button"
                                                    title={iconLabel}
                                                    onClick={() =>
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            icon: iconKey,
                                                        }))
                                                    }
                                                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'border-brand-rust bg-brand-rust/15 text-brand-rust shadow-xs ring-2 ring-brand-rust/30 font-semibold'
                                                            : 'border-border bg-card text-brand-text-light hover:text-brand-text hover:bg-brand-warm/20 hover:border-brand-rust/40'
                                                    }`}
                                                >
                                                    <IconComponent className="size-4" />
                                                    <span className="text-[10px] truncate max-w-full mt-1 text-center font-medium opacity-90">
                                                        {iconLabel}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-xs font-semibold text-brand-text-mid">
                                                Allowed Roles
                                            </Label>
                                            <span className="text-[10px] text-brand-text-light ml-2">Who can update this step</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px]">
                                            <button
                                                type="button"
                                                onClick={() => setRolePreset('all')}
                                                className="text-brand-rust hover:underline font-medium cursor-pointer"
                                            >
                                                All
                                            </button>
                                            <span className="text-brand-text-light/40">•</span>
                                            <button
                                                type="button"
                                                onClick={() => setRolePreset('ops')}
                                                className="text-brand-text-light hover:text-brand-text font-medium cursor-pointer"
                                            >
                                                Ops
                                            </button>
                                            <span className="text-brand-text-light/40">•</span>
                                            <button
                                                type="button"
                                                onClick={() => setRolePreset('admin')}
                                                className="text-brand-text-light hover:text-brand-text font-medium cursor-pointer"
                                            >
                                                Admins
                                            </button>
                                            <span className="text-brand-text-light/40">•</span>
                                            <button
                                                type="button"
                                                onClick={() => setRolePreset('clear')}
                                                className="text-brand-text-light hover:text-rose-400 font-medium cursor-pointer"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {availableRoles.map((role) => {
                                            const isSelected = formData.allowed_roles.includes(role.key);
                                            return (
                                                <button
                                                    key={role.key}
                                                    type="button"
                                                    onClick={() => toggleRole(role.key)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                                                        isSelected
                                                            ? 'bg-brand-rust/15 text-brand-rust border-brand-rust/40'
                                                            : 'bg-card text-brand-text-light border-border hover:bg-brand-warm/20 hover:text-brand-text'
                                                    }`}
                                                >
                                                    {isSelected ? (
                                                        <Check className="size-3 text-brand-rust" />
                                                    ) : (
                                                        <span className="size-1.5 rounded-full bg-zinc-400" />
                                                    )}
                                                    {role.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Visibility and Customer Audience */}
                                <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5 pr-4">
                                            <Label className="text-xs font-semibold text-brand-text flex items-center gap-1.5 cursor-pointer" htmlFor="toggle-is-public">
                                                <Globe className="size-3.5 text-brand-rust" />
                                                Show on Customer Tracking Page (/track)
                                            </Label>
                                            <p className="text-[11px] text-brand-text-light">
                                                {formData.is_public 
                                                    ? 'Customers and recipients will see this milestone step on their online tracking roadmap.'
                                                    : 'Internal operations only. Hidden from customer tracking views, ideal for internal warehouse and customs checks.'}
                                            </p>
                                        </div>
                                        <Switch
                                            id="toggle-is-public"
                                            checked={formData.is_public}
                                            onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_public: checked }))}
                                        />
                                    </div>
                                </div>

                                {/* Automated Notifications */}
                                <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-text">
                                        <Bell className="size-3.5 text-brand-rust" />
                                        Automated Milestone Notifications
                                    </div>
                                    <p className="text-[11px] text-brand-text-light">
                                        Send proactive real-time alerts to the sender and recipient when this milestone is reached.
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                                        <div 
                                            onClick={() => setFormData((prev) => ({ ...prev, notify_sms: !prev.notify_sms }))}
                                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                                formData.notify_sms 
                                                    ? 'border-cyan-500/40 bg-cyan-500/10 text-brand-text' 
                                                    : 'border-border bg-card text-brand-text-light hover:bg-brand-warm/15'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className={`size-4 ${formData.notify_sms ? 'text-cyan-400' : 'text-zinc-400'}`} />
                                                <div>
                                                    <div className="text-xs font-semibold">SMS Alert</div>
                                                    <div className="text-[10px] text-brand-text-light">Mobile SMS update</div>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={formData.notify_sms}
                                                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, notify_sms: checked }))}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>

                                        <div 
                                            onClick={() => setFormData((prev) => ({ ...prev, notify_email: !prev.notify_email }))}
                                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                                formData.notify_email 
                                                    ? 'border-indigo-500/40 bg-indigo-500/10 text-brand-text' 
                                                    : 'border-border bg-card text-brand-text-light hover:bg-brand-warm/15'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Mail className={`size-4 ${formData.notify_email ? 'text-indigo-400' : 'text-zinc-400'}`} />
                                                <div>
                                                    <div className="text-xs font-semibold">Email Notification</div>
                                                    <div className="text-[10px] text-brand-text-light">Automated status email</div>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={formData.notify_email}
                                                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, notify_email: checked }))}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold text-brand-text-mid">
                                                Customer Reassurance Message
                                            </Label>
                                            <span className="text-[10px] text-brand-text-light">
                                                {formData.customer_message.length}/255 chars
                                            </span>
                                        </div>
                                        <Input
                                            value={formData.customer_message}
                                            maxLength={255}
                                            placeholder="e.g. Your box is sailing smoothly across international waters to Manila."
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    customer_message: e.target.value,
                                                }))
                                            }
                                            className="h-10 text-xs font-medium rounded-xl border border-border bg-card text-brand-text focus-visible:ring-2 focus-visible:ring-ring focus:border-brand-rust"
                                        />
                                        <p className="text-[10px] text-brand-text-light">
                                            Highlight message shown to customers on their tracking timeline and included in SMS/Email alerts.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold text-brand-text-mid">
                                            Internal / Operational Notes
                                        </Label>
                                        <span className="text-[10px] text-brand-text-light">
                                            {formData.description.length}/200 chars
                                        </span>
                                    </div>
                                    <Textarea
                                        value={formData.description}
                                        rows={2}
                                        maxLength={200}
                                        placeholder="Internal operational notes (e.g. Requires port stamp verification and container release document)..."
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                description: e.target.value,
                                            }))
                                        }
                                        className="text-xs font-medium rounded-xl border border-border bg-card text-brand-text focus-visible:ring-2 focus-visible:ring-ring focus:border-brand-rust resize-none"
                                    />
                                </div>

                                <DialogFooter className="pt-3 gap-2 flex items-center justify-end border-t border-border/50">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setModalOpen(false)}
                                        className="h-10 px-4 rounded-xl border border-border bg-card text-brand-text text-xs font-semibold hover:bg-brand-warm/20 cursor-pointer"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="h-10 px-5 rounded-xl bg-brand-rust text-white text-xs font-semibold hover:bg-brand-rust/90 shadow-2xs cursor-pointer flex items-center gap-1.5"
                                    >
                                        <Check className="size-3.5" />
                                        {modalMode === 'create'
                                            ? 'Add Milestone'
                                            : 'Apply Changes'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
