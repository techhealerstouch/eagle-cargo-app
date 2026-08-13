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
    Settings,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import UnsavedChangesBar from '@/components/settings/UnsavedChangesBar';
import { Button } from '@/components/ui/button';
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
import {
    Select,
    SelectContent,
    SelectItem,
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

const iconMap = {
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

const systemStatuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'collected', label: 'Collected' },
    { value: 'received_by_branch', label: 'Received by Warehouse' },
    { value: 'loaded_to_container', label: 'Loaded to Container' },
    { value: 'in_transit', label: 'In Transit' },
    { value: 'arrived', label: 'Arrived' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'held', label: 'Held' },
];

interface TrackingStep {
    key: string;
    label: string;
    phase: string;
    order: number;
    icon: string;
    allowed_roles: string[];
    system_status: string;
    description?: string;
}

export default function TrackingSettings({ steps }: { steps: TrackingStep[] }) {
    const { data, setData, put, processing, isDirty, reset } = useForm({
        steps: steps.map((s, i) => ({
            ...s,
            order: i + 1,
            allowed_roles: s.allowed_roles || [],
            system_status: s.system_status || 'pending',
            description: s.description || '',
        })),
    });

    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(
        null,
    );

    const submit: React.FormEventHandler = (e) => {
        e.preventDefault();
        put('/settings/tracking', {
            onSuccess: () => {
                toast.success('Tracking journey steps updated successfully');
            },
        });
    };

    const updateStep = (
        index: number,
        field: keyof TrackingStep,
        value: any,
    ) => {
        const newSteps = [...data.steps];
        newSteps[index] = { ...newSteps[index], [field]: value };

        if (field === 'label') {
            newSteps[index].key = (value as string)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, '');
        }

        setData('steps', newSteps);
    };

    const addStep = () => {
        setData('steps', [
            ...data.steps,
            {
                key: `step_${data.steps.length + 1}`,
                label: 'New Step',
                phase: 'Destination',
                order: data.steps.length + 1,
                icon: 'circle',
                allowed_roles: [],
                system_status: 'pending',
                description: '',
            },
        ]);
    };

    const toggleRole = (index: number, roleKey: string) => {
        const step = data.steps[index];
        const currentRoles = step.allowed_roles || [];
        const newRoles = currentRoles.includes(roleKey)
            ? currentRoles.filter((r) => r !== roleKey)
            : [...currentRoles, roleKey];

        updateStep(index, 'allowed_roles', newRoles);
    };

    const removeStep = (index: number) => {
        if (data.steps.length <= 2) {
            return;
        }

        const updated = data.steps
            .filter((_, i) => i !== index)
            .map((s, i) => ({ ...s, order: i + 1 }));
        setData('steps', updated);
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
                    bg: 'bg-blue-50 text-blue-700 border-blue-200',
                };
            case 'In Transit':
            case 'International Transit':
                return {
                    bg: 'bg-amber-50 text-amber-700 border-amber-200',
                };
            case 'Destination':
                return {
                    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                };
            default:
                return {
                    bg: 'bg-zinc-50 text-zinc-700 border-zinc-200',
                };
        }
    };

    const currentEditingStep =
        editingStepIndex !== null ? data.steps[editingStepIndex] : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tracking Journey" />
            <SettingsLayout
                eyebrow="Operations"
                title="Tracking Journey Milestones"
                description="Configure the tracking timeline sequence and system status mapping."
                actions={
                    <Button
                        onClick={submit}
                        disabled={processing}
                        className="h-9 px-5 rounded-lg bg-brand-rust text-white text-xs font-medium hover:bg-brand-rust/90 flex items-center gap-2"
                    >
                        <Save className="size-3.5" />
                        {processing ? 'Saving...' : 'Save Changes'}
                    </Button>
                }
            >
                <div className="max-w-3xl space-y-4">
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-2">
                            {data.steps.map((step, index) => {
                                const styles = getPhaseStyles(step.phase);
                                const StepIcon =
                                    iconMap[
                                        step.icon as keyof typeof iconMap
                                    ] || iconMap.circle;

                                return (
                                    <div
                                        key={index}
                                        draggable
                                        onDragStart={() =>
                                            handleDragStart(index)
                                        }
                                        onDragOver={(e) =>
                                            handleDragOver(e, index)
                                        }
                                        onDragEnd={handleDragEnd}
                                        className={`group relative flex items-center gap-3.5 rounded-lg border border-zinc-200 bg-white p-3.5 transition-all ${
                                            dragIdx === index ? 'opacity-50' : 'hover:border-zinc-300'
                                        }`}
                                    >
                                        <div className="cursor-grab text-zinc-300 hover:text-zinc-500">
                                            <GripVertical className="size-4" />
                                        </div>
                                        <div className="flex size-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-[11px] font-bold text-zinc-700">
                                            {index + 1}
                                        </div>
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-600">
                                            <StepIcon className="size-4" />
                                        </div>

                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-xs font-semibold text-zinc-900">
                                                    {step.label || 'Untitled Step'}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${styles.bg}`}>
                                                    {step.phase}
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-zinc-500 truncate">
                                                Map: {humanize(step.system_status)} {step.description ? `• ${step.description}` : ''}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                title="Edit step"
                                                onClick={() =>
                                                    setEditingStepIndex(index)
                                                }
                                                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                                            >
                                                <Edit2 className="size-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                title="Remove step"
                                                onClick={() =>
                                                    removeStep(index)
                                                }
                                                className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50"
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
                                onClick={addStep}
                                className="h-9 px-4 text-xs font-medium rounded-lg border-zinc-200 hover:bg-zinc-50"
                            >
                                <Plus className="size-3.5 mr-1" />
                                Add Journey Step
                            </Button>
                        </div>

                        <UnsavedChangesBar
                            isDirty={isDirty}
                            processing={processing}
                            onReset={reset}
                        />
                    </form>

                    <Dialog
                        open={editingStepIndex !== null}
                        onOpenChange={(open) =>
                            !open && setEditingStepIndex(null)
                        }
                    >
                        <DialogContent className="max-w-md rounded-xl p-5">
                            {currentEditingStep && (
                                <>
                                    <DialogHeader className="space-y-1">
                                        <DialogTitle className="text-base font-semibold text-zinc-900">
                                            Configure Milestone: {currentEditingStep.label || 'Step'}
                                        </DialogTitle>
                                        <DialogDescription className="text-xs text-zinc-500">
                                            Edit step label, icon, and role permissions.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4 py-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-semibold text-zinc-700">
                                                Display Label
                                            </Label>
                                            <Input
                                                value={currentEditingStep.label}
                                                onChange={(e) =>
                                                    updateStep(
                                                        editingStepIndex!,
                                                        'label',
                                                        e.target.value,
                                                    )
                                                }
                                                className="h-9 text-xs rounded-lg border-zinc-200"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs font-semibold text-zinc-700">
                                                    Phase
                                                </Label>
                                                <Select
                                                    value={currentEditingStep.phase}
                                                    onValueChange={(v) =>
                                                        updateStep(
                                                            editingStepIndex!,
                                                            'phase',
                                                            v,
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger className="h-9 text-xs rounded-lg border-zinc-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Origin" className="text-xs">Origin</SelectItem>
                                                        <SelectItem value="International Transit" className="text-xs">International Transit</SelectItem>
                                                        <SelectItem value="Destination" className="text-xs">Destination</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1">
                                                <Label className="text-xs font-semibold text-zinc-700">
                                                    System Mapping
                                                </Label>
                                                <Select
                                                    value={currentEditingStep.system_status}
                                                    onValueChange={(v) =>
                                                        updateStep(
                                                            editingStepIndex!,
                                                            'system_status',
                                                            v,
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger className="h-9 text-xs rounded-lg border-zinc-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {systemStatuses.map((s) => (
                                                            <SelectItem key={s.value} value={s.value} className="text-xs">
                                                                {s.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs font-semibold text-zinc-700">
                                                Description
                                            </Label>
                                            <Input
                                                value={currentEditingStep.description || ''}
                                                onChange={(e) =>
                                                    updateStep(
                                                        editingStepIndex!,
                                                        'description',
                                                        e.target.value,
                                                    )
                                                }
                                                className="h-9 text-xs rounded-lg border-zinc-200"
                                            />
                                        </div>
                                    </div>

                                    <DialogFooter className="pt-2">
                                        <Button
                                            onClick={() => setEditingStepIndex(null)}
                                            className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-black"
                                        >
                                            Apply Changes
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
