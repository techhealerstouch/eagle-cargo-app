import { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    Check,
    Code2,
    Copy,
    Edit3,
    Eye,
    EyeOff,
    Filter,
    FlaskConical,
    Plus,
    Search,
    Shield,
    Trash2,
    Wrench,
    X,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
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
import { Checkbox } from '@/components/ui/checkbox';

type FeatureStatus = 'released' | 'hidden' | 'maintenance';

type Feature = {
    id?: number;
    key: string;
    name: string;
    description: string;
    audiences: string[];
    status: FeatureStatus;
    maintenance_message?: string | null;
    is_system: boolean;
    enabled: boolean;
    updated_at: string | null;
    updated_by: { id: number; name: string } | null;
};

type RoleOption = {
    value: string;
    label: string;
};

type Props = {
    features: Feature[];
    roles?: RoleOption[];
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Developer Console', href: '/developer/features' },
    { title: 'Feature Management', href: '/developer/features' },
];

const DEFAULT_ROLES: RoleOption[] = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'warehouse', label: 'Warehouse' },
    { value: 'courier', label: 'Courier' },
    { value: 'picker', label: 'Picker' },
    { value: 'sender', label: 'Sender' },
    { value: 'recipient', label: 'Recipient' },
];

export default function DeveloperFeatures({ features, roles = DEFAULT_ROLES }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | FeatureStatus>('all');

    // Modals state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
    const [snippetFeature, setSnippetFeature] = useState<Feature | null>(null);
    const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

    // Create form state
    const [createForm, setCreateForm] = useState({
        name: '',
        feature_key: '',
        description: '',
        status: 'hidden' as FeatureStatus,
        audiences: [] as string[],
        maintenance_message: '',
    });
    const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

    // Edit form state
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        status: 'hidden' as FeatureStatus,
        audiences: [] as string[],
        maintenance_message: '',
    });
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});

    // Filter features
    const filteredFeatures = useMemo(() => {
        return features.filter((feat) => {
            const matchesQuery =
                feat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                feat.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (feat.description && feat.description.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus = statusFilter === 'all' || feat.status === statusFilter;

            return matchesQuery && matchesStatus;
        });
    }, [features, searchQuery, statusFilter]);

    // Handle Quick Status Change
    const changeStatus = (feature: Feature, newStatus: FeatureStatus) => {
        if (feature.status === newStatus) return;

        router.patch(
            `/developer/features/${feature.key}`,
            { status: newStatus },
            {
                preserveScroll: true,
            }
        );
    };

    // Handle Delete
    const deleteFeature = (feature: Feature) => {
        if (feature.is_system) {
            alert('System feature flags cannot be deleted.');
            return;
        }

        if (confirm(`Are you sure you want to delete "${feature.name}" (${feature.key})? This action cannot be undone.`)) {
            router.delete(`/developer/features/${feature.key}`, {
                preserveScroll: true,
            });
        }
    };

    // Auto-slugify feature key
    const handleNameChangeInCreate = (name: string) => {
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');

        setCreateForm((prev) => ({
            ...prev,
            name,
            feature_key: prev.feature_key === '' || prev.feature_key === slug.slice(0, -1) ? slug : prev.feature_key,
        }));
    };

    // Handle Create Submit
    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCreateErrors({});

        router.post('/developer/features', createForm, {
            onSuccess: () => {
                setIsCreateOpen(false);
                setCreateForm({
                    name: '',
                    feature_key: '',
                    description: '',
                    status: 'hidden',
                    audiences: [],
                    maintenance_message: '',
                });
            },
            onError: (errs) => {
                setCreateErrors(errs);
            },
        });
    };

    // Open Edit Dialog
    const openEdit = (feature: Feature) => {
        setEditingFeature(feature);
        setEditForm({
            name: feature.name,
            description: feature.description || '',
            status: feature.status,
            audiences: feature.audiences || [],
            maintenance_message: feature.maintenance_message || '',
        });
        setEditErrors({});
    };

    // Handle Edit Submit
    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingFeature) return;

        router.put(`/developer/features/${editingFeature.key}`, editForm, {
            onSuccess: () => {
                setEditingFeature(null);
            },
            onError: (errs) => {
                setEditErrors(errs);
            },
        });
    };

    // Copy to clipboard helper
    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSnippet(id);
        setTimeout(() => setCopiedSnippet(null), 2000);
    };

    const toggleAudienceRole = (
        roleValue: string,
        currentAudiences: string[],
        setAudiences: (roles: string[]) => void
    ) => {
        if (currentAudiences.includes(roleValue)) {
            setAudiences(currentAudiences.filter((r) => r !== roleValue));
        } else {
            setAudiences([...currentAudiences, roleValue]);
        }
    };

    const toggleAllRoles = (currentAudiences: string[], setAudiences: (roles: string[]) => void) => {
        if (currentAudiences.length === roles.length) {
            setAudiences([]);
        } else {
            setAudiences(roles.map((r) => r.value));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dynamic Feature Management - Developer Console" />

            <div className="flex h-full flex-1 flex-col gap-8 p-6 md:p-8">
                {/* Header Banner */}
                <div className="flex flex-col justify-between gap-6 border-b border-brand-warm/20 pb-6 md:flex-row md:items-center">
                    <div className="flex items-start gap-4">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-rust/10 text-brand-rust ring-1 ring-brand-rust/20">
                            <FlaskConical className="size-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-rust">Developer Console</p>
                                <span className="rounded-md bg-brand-warm/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-text">
                                    Dynamic Claims
                                </span>
                            </div>
                            <h1 className="font-serif text-3xl font-bold tracking-tight text-brand-text">
                                Feature Access & Lifecycle Management
                            </h1>
                            <p className="mt-1 text-sm text-brand-text-mid max-w-3xl">
                                Dynamically register application features, target specific user roles, put modules under maintenance, and generate integration snippets without editing backend source code.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsCreateOpen(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-rust px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-brand-rust/20 transition-all hover:bg-brand-rust/90 hover:shadow-lg"
                    >
                        <Plus className="size-4" />
                        <span>New Feature</span>
                    </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-text-light" />
                        <Input
                            type="text"
                            placeholder="Search by name, key, or description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-9 border-brand-warm/20 bg-card rounded-xl text-sm"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-light hover:text-brand-text"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </div>

                    {/* Status Tabs */}
                    <div className="flex items-center gap-1.5 rounded-xl border border-brand-warm/20 bg-card p-1 text-xs">
                        {(
                            [
                                { key: 'all', label: 'All' },
                                { key: 'released', label: 'Released' },
                                { key: 'maintenance', label: 'Maintenance' },
                                { key: 'hidden', label: 'Hidden' },
                            ] as const
                        ).map((tab) => {
                            const count =
                                tab.key === 'all'
                                    ? features.length
                                    : features.filter((f) => f.status === tab.key).length;

                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setStatusFilter(tab.key)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold uppercase tracking-wider transition-all ${
                                        statusFilter === tab.key
                                            ? 'bg-brand-rust text-white shadow-xs'
                                            : 'text-brand-text-mid hover:text-brand-text hover:bg-brand-warm/10'
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span
                                        className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                                            statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-brand-warm/20 text-brand-text-mid'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Features Grid */}
                {filteredFeatures.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-brand-warm/30 bg-card/50 p-12 text-center">
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-rust/10 text-brand-rust mb-4">
                            <Filter className="size-7 opacity-75" />
                        </div>
                        <h2 className="font-serif text-xl font-semibold text-brand-text">No matching feature flags</h2>
                        <p className="mt-2 max-w-md text-sm text-brand-text-mid">
                            No features match your current filter criteria. Try adjusting your search query or status filter.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setStatusFilter('all');
                            }}
                            className="mt-4 text-xs font-bold uppercase tracking-wider text-brand-rust hover:underline"
                        >
                            Reset filters
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                        {filteredFeatures.map((feature) => {
                            const isReleased = feature.status === 'released';
                            const isMaintenance = feature.status === 'maintenance';
                            const isHidden = feature.status === 'hidden';

                            return (
                                <article
                                    key={feature.key}
                                    className="group flex flex-col justify-between rounded-2xl border border-brand-warm/20 bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-brand-warm/40"
                                >
                                    <div>
                                        {/* Card Top Row: Badges & Actions */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h2 className="font-serif text-xl font-bold text-brand-text leading-tight">
                                                        {feature.name}
                                                    </h2>
                                                    {feature.is_system && (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-brand-warm/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-text-mid border border-brand-warm/25">
                                                            <Shield className="size-3" />
                                                            System
                                                        </span>
                                                    )}
                                                </div>
                                                <code className="text-[11px] font-mono font-medium text-brand-text-light block">
                                                    {feature.key}
                                                </code>
                                            </div>

                                            {/* Status Badge */}
                                            <div>
                                                {isReleased && (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        Released
                                                    </span>
                                                )}
                                                {isMaintenance && (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                                        <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                                                        Maintenance
                                                    </span>
                                                )}
                                                {isHidden && (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
                                                        <span className="size-2 rounded-full bg-zinc-400" />
                                                        Hidden
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <p className="mt-3 text-sm leading-relaxed text-brand-text-mid min-h-[40px]">
                                            {feature.description || 'No description provided.'}
                                        </p>

                                        {/* Maintenance Notice Box if Active */}
                                        {isMaintenance && feature.maintenance_message && (
                                            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                                                <Wrench className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                                <p className="line-clamp-2">{feature.maintenance_message}</p>
                                            </div>
                                        )}

                                        {/* Audience Roles */}
                                        <div className="mt-4 pt-3 border-t border-brand-warm/15">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text-light mb-1.5">
                                                Audience Role Claims
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {feature.audiences && feature.audiences.length > 0 && !feature.audiences.includes('*') ? (
                                                    feature.audiences.map((roleKey) => {
                                                        const label = roles.find((r) => r.value === roleKey)?.label ?? roleKey;
                                                        return (
                                                            <span
                                                                key={roleKey}
                                                                className="rounded-lg bg-brand-warm/15 px-2.5 py-0.5 text-[11px] font-semibold text-brand-text border border-brand-warm/20"
                                                            >
                                                                {label}
                                                            </span>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="rounded-lg bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                                        All Roles / Public
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Control Section */}
                                    <div className="mt-6 space-y-3 border-t border-brand-warm/20 pt-4">
                                        {/* Quick State Toggle Buttons */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1 rounded-xl bg-brand-warm/10 p-1 border border-brand-warm/20">
                                                <button
                                                    type="button"
                                                    title="Release feature to audience"
                                                    onClick={() => changeStatus(feature, 'released')}
                                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${
                                                        isReleased
                                                            ? 'bg-emerald-600 text-white shadow-xs'
                                                            : 'text-brand-text-mid hover:text-brand-text'
                                                    }`}
                                                >
                                                    Release
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Put module under maintenance"
                                                    onClick={() => changeStatus(feature, 'maintenance')}
                                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${
                                                        isMaintenance
                                                            ? 'bg-amber-600 text-white shadow-xs'
                                                            : 'text-brand-text-mid hover:text-brand-text'
                                                    }`}
                                                >
                                                    Maintenance
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Hide feature (developer preview only)"
                                                    onClick={() => changeStatus(feature, 'hidden')}
                                                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${
                                                        isHidden
                                                            ? 'bg-zinc-700 text-white shadow-xs'
                                                            : 'text-brand-text-mid hover:text-brand-text'
                                                    }`}
                                                >
                                                    Hide
                                                </button>
                                            </div>

                                            {/* Action Icons */}
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setSnippetFeature(feature)}
                                                    title="View integration code snippets"
                                                    className="flex size-8 items-center justify-center rounded-lg border border-brand-warm/20 bg-card text-brand-text-mid transition-all hover:bg-brand-warm/15 hover:text-brand-text"
                                                >
                                                    <Code2 className="size-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(feature)}
                                                    title="Edit feature properties"
                                                    className="flex size-8 items-center justify-center rounded-lg border border-brand-warm/20 bg-card text-brand-text-mid transition-all hover:bg-brand-warm/15 hover:text-brand-text"
                                                >
                                                    <Edit3 className="size-4" />
                                                </button>
                                                {!feature.is_system && (
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteFeature(feature)}
                                                        title="Delete feature"
                                                        className="flex size-8 items-center justify-center rounded-lg border border-red-200/40 bg-card text-red-600 transition-all hover:bg-red-500/10 dark:text-red-400"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Timestamp & Operator info */}
                                        <div className="text-[11px] text-brand-text-light flex items-center justify-between">
                                            <span>
                                                Updated: {feature.updated_at ? new Date(feature.updated_at).toLocaleDateString() : 'Initial'}
                                            </span>
                                            <span>{feature.updated_by ? `By ${feature.updated_by.name}` : 'By System'}</span>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* CREATE FEATURE DIALOG */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-xl bg-card border-brand-warm/30 max-h-[90vh] overflow-y-auto">
                    <form onSubmit={handleCreateSubmit} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle className="font-serif text-2xl font-bold text-brand-text">
                                Register New Feature
                            </DialogTitle>
                            <DialogDescription className="text-brand-text-mid text-sm">
                                Define a dynamic feature flag and set audience role permissions for immediate in-browser management.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Feature Name */}
                            <div className="space-y-1.5">
                                <Label htmlFor="create-name" className="text-xs font-bold uppercase tracking-wider text-brand-text">
                                    Feature Name *
                                </Label>
                                <Input
                                    id="create-name"
                                    placeholder="e.g. Barcode Scanner"
                                    value={createForm.name}
                                    onChange={(e) => handleNameChangeInCreate(e.target.value)}
                                    required
                                    className="border-brand-warm/20"
                                />
                                {createErrors.name && <p className="text-xs text-red-500">{createErrors.name}</p>}
                            </div>

                            {/* Feature Key */}
                            <div className="space-y-1.5">
                                <Label htmlFor="create-key" className="text-xs font-bold uppercase tracking-wider text-brand-text">
                                    Feature Slug / Key *
                                </Label>
                                <Input
                                    id="create-key"
                                    placeholder="e.g. barcode_scanner"
                                    value={createForm.feature_key}
                                    onChange={(e) => setCreateForm({ ...createForm, feature_key: e.target.value })}
                                    required
                                    className="font-mono text-sm border-brand-warm/20"
                                />
                                <p className="text-[11px] text-brand-text-light">
                                    Unique lowercase slug used in middleware and frontend checks (e.g. <code>feature:barcode_scanner</code>).
                                </p>
                                {createErrors.feature_key && <p className="text-xs text-red-500">{createErrors.feature_key}</p>}
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <Label htmlFor="create-desc" className="text-xs font-bold uppercase tracking-wider text-brand-text">
                                    Description
                                </Label>
                                <Textarea
                                    id="create-desc"
                                    placeholder="Describe purpose, scope, or rollout criteria..."
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                    className="border-brand-warm/20 resize-none h-20"
                                />
                            </div>

                            {/* Initial Status */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-brand-text">
                                    Initial Lifecycle Status *
                                </Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { key: 'hidden', label: 'Hidden', desc: 'Dev mode only' },
                                        { key: 'maintenance', label: 'Maintenance', desc: 'Maintenance screen' },
                                        { key: 'released', label: 'Released', desc: 'Active for audience' },
                                    ].map((s) => (
                                        <button
                                            key={s.key}
                                            type="button"
                                            onClick={() => setCreateForm({ ...createForm, status: s.key as FeatureStatus })}
                                            className={`rounded-xl border p-3 text-left transition-all ${
                                                createForm.status === s.key
                                                    ? 'border-brand-rust bg-brand-rust/10 ring-2 ring-brand-rust/20'
                                                    : 'border-brand-warm/20 bg-card hover:bg-brand-warm/5'
                                            }`}
                                        >
                                            <p className="text-xs font-bold uppercase tracking-wider text-brand-text">{s.label}</p>
                                            <p className="text-[10px] text-brand-text-light">{s.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Audience Roles Checkboxes */}
                            <div className="space-y-2 rounded-2xl border border-brand-warm/20 bg-brand-warm/5 p-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-brand-text">
                                        Allowed Audience Roles
                                    </Label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            toggleAllRoles(createForm.audiences, (roles) =>
                                                setCreateForm({ ...createForm, audiences: roles })
                                            )
                                        }
                                        className="text-[11px] font-semibold text-brand-rust hover:underline"
                                    >
                                        {createForm.audiences.length === roles.length ? 'Deselect All' : 'Select All Roles'}
                                    </button>
                                </div>
                                <p className="text-[11px] text-brand-text-light">
                                    Select which authenticated roles can access this feature. If no roles are selected, access defaults to public / all authenticated users.
                                </p>

                                <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
                                    {roles.map((r) => {
                                        const checked = createForm.audiences.includes(r.value);
                                        return (
                                            <label
                                                key={r.value}
                                                className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-all ${
                                                    checked
                                                        ? 'border-brand-rust/40 bg-brand-rust/10 text-brand-text'
                                                        : 'border-brand-warm/20 bg-card text-brand-text-mid hover:bg-brand-warm/10'
                                                }`}
                                            >
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={() =>
                                                        toggleAudienceRole(r.value, createForm.audiences, (auds) =>
                                                            setCreateForm({ ...createForm, audiences: auds })
                                                        )
                                                    }
                                                />
                                                <span className="text-xs font-medium">{r.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Maintenance Message */}
                            {createForm.status === 'maintenance' && (
                                <div className="space-y-1.5 animate-in fade-in-50">
                                    <Label htmlFor="create-maint" className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                        Custom Maintenance Notice
                                    </Label>
                                    <Textarea
                                        id="create-maint"
                                        placeholder="Optional notice shown to users visiting this module during maintenance..."
                                        value={createForm.maintenance_message}
                                        onChange={(e) => setCreateForm({ ...createForm, maintenance_message: e.target.value })}
                                        className="border-amber-500/30 resize-none h-20 bg-amber-500/5 text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <button
                                type="button"
                                onClick={() => setIsCreateOpen(false)}
                                className="rounded-xl border border-brand-warm/20 bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-text hover:bg-brand-warm/10"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="rounded-xl bg-brand-rust px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-brand-rust/20 hover:bg-brand-rust/90"
                            >
                                Create Feature
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* EDIT FEATURE DIALOG */}
            <Dialog open={!!editingFeature} onOpenChange={(open) => !open && setEditingFeature(null)}>
                <DialogContent className="sm:max-w-xl bg-card border-brand-warm/30 max-h-[90vh] overflow-y-auto">
                    {editingFeature && (
                        <form onSubmit={handleEditSubmit} className="space-y-5">
                            <DialogHeader>
                                <DialogTitle className="font-serif text-2xl font-bold text-brand-text">
                                    Edit Feature: {editingFeature.name}
                                </DialogTitle>
                                <DialogDescription className="text-brand-text-mid text-sm">
                                    Key: <code className="font-mono font-medium text-brand-text">{editingFeature.key}</code>
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                {/* Name */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-name" className="text-xs font-bold uppercase tracking-wider text-brand-text">
                                        Feature Name *
                                    </Label>
                                    <Input
                                        id="edit-name"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        required
                                        className="border-brand-warm/20"
                                    />
                                    {editErrors.name && <p className="text-xs text-red-500">{editErrors.name}</p>}
                                </div>

                                {/* Description */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-desc" className="text-xs font-bold uppercase tracking-wider text-brand-text">
                                        Description
                                    </Label>
                                    <Textarea
                                        id="edit-desc"
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        className="border-brand-warm/20 resize-none h-20"
                                    />
                                </div>

                                {/* Status */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-brand-text">
                                        Lifecycle Status *
                                    </Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { key: 'hidden', label: 'Hidden', desc: 'Dev mode only' },
                                            { key: 'maintenance', label: 'Maintenance', desc: 'Maintenance screen' },
                                            { key: 'released', label: 'Released', desc: 'Active for audience' },
                                        ].map((s) => (
                                            <button
                                                key={s.key}
                                                type="button"
                                                onClick={() => setEditForm({ ...editForm, status: s.key as FeatureStatus })}
                                                className={`rounded-xl border p-3 text-left transition-all ${
                                                    editForm.status === s.key
                                                        ? 'border-brand-rust bg-brand-rust/10 ring-2 ring-brand-rust/20'
                                                        : 'border-brand-warm/20 bg-card hover:bg-brand-warm/5'
                                                }`}
                                            >
                                                <p className="text-xs font-bold uppercase tracking-wider text-brand-text">{s.label}</p>
                                                <p className="text-[10px] text-brand-text-light">{s.desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Audience Roles Checkboxes */}
                                <div className="space-y-2 rounded-2xl border border-brand-warm/20 bg-brand-warm/5 p-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-brand-text">
                                            Allowed Audience Roles
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleAllRoles(editForm.audiences, (roles) =>
                                                    setEditForm({ ...editForm, audiences: roles })
                                                )
                                            }
                                            className="text-[11px] font-semibold text-brand-rust hover:underline"
                                        >
                                            {editForm.audiences.length === roles.length ? 'Deselect All' : 'Select All Roles'}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
                                        {roles.map((r) => {
                                            const checked = editForm.audiences.includes(r.value);
                                            return (
                                                <label
                                                    key={r.value}
                                                    className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-all ${
                                                        checked
                                                            ? 'border-brand-rust/40 bg-brand-rust/10 text-brand-text'
                                                            : 'border-brand-warm/20 bg-card text-brand-text-mid hover:bg-brand-warm/10'
                                                    }`}
                                                >
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={() =>
                                                            toggleAudienceRole(r.value, editForm.audiences, (auds) =>
                                                                setEditForm({ ...editForm, audiences: auds })
                                                            )
                                                        }
                                                    />
                                                    <span className="text-xs font-medium">{r.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Maintenance Notice */}
                                {editForm.status === 'maintenance' && (
                                    <div className="space-y-1.5 animate-in fade-in-50">
                                        <Label htmlFor="edit-maint" className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                            Custom Maintenance Notice
                                        </Label>
                                        <Textarea
                                            id="edit-maint"
                                            placeholder="Optional notice shown to users visiting this module during maintenance..."
                                            value={editForm.maintenance_message}
                                            onChange={(e) => setEditForm({ ...editForm, maintenance_message: e.target.value })}
                                            className="border-amber-500/30 resize-none h-20 bg-amber-500/5 text-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="gap-2 sm:gap-0">
                                <button
                                    type="button"
                                    onClick={() => setEditingFeature(null)}
                                    className="rounded-xl border border-brand-warm/20 bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-text hover:bg-brand-warm/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-brand-rust px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-brand-rust/20 hover:bg-brand-rust/90"
                                >
                                    Save Changes
                                </button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* INTEGRATION CODE SNIPPET HELPER DIALOG */}
            <Dialog open={!!snippetFeature} onOpenChange={(open) => !open && setSnippetFeature(null)}>
                <DialogContent className="sm:max-w-xl bg-card border-brand-warm/30">
                    {snippetFeature && (
                        <div className="space-y-5">
                            <DialogHeader>
                                <DialogTitle className="font-serif text-2xl font-bold text-brand-text">
                                    Integration Snippets: {snippetFeature.name}
                                </DialogTitle>
                                <DialogDescription className="text-brand-text-mid text-sm">
                                    Ready-to-use snippets to protect routes or conditionally render React UI elements.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                {/* Laravel Route Middleware Snippet */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-brand-text">
                                            1. Laravel Route Guard (routes/web.php)
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                copyToClipboard(
                                                    `Route::middleware(['auth', 'feature:${snippetFeature.key}'])->group(function () {\n    // Protected routes\n});`,
                                                    'php-route'
                                                )
                                            }
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-rust hover:underline"
                                        >
                                            {copiedSnippet === 'php-route' ? (
                                                <>
                                                    <Check className="size-3 text-emerald-600" />
                                                    <span>Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="size-3" />
                                                    <span>Copy PHP</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <pre className="rounded-xl bg-zinc-950 p-3.5 text-xs font-mono text-zinc-100 overflow-x-auto border border-zinc-800">
                                        {`Route::middleware(['auth', 'feature:${snippetFeature.key}'])->group(function () {\n    // Protected routes\n});`}
                                    </pre>
                                </div>

                                {/* React / Inertia Component Guard */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-brand-text">
                                            2. React / Inertia View Guard (TSX)
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                copyToClipboard(
                                                    `import { canAccessFeature } from '@/types/auth';\nimport { usePage } from '@inertiajs/react';\n\n// Inside component:\nconst { auth } = usePage().props;\nif (canAccessFeature(auth, '${snippetFeature.key}')) {\n    // Render feature element\n}`,
                                                    'react-guard'
                                                )
                                            }
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-rust hover:underline"
                                        >
                                            {copiedSnippet === 'react-guard' ? (
                                                <>
                                                    <Check className="size-3 text-emerald-600" />
                                                    <span>Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="size-3" />
                                                    <span>Copy TSX</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <pre className="rounded-xl bg-zinc-950 p-3.5 text-xs font-mono text-zinc-100 overflow-x-auto border border-zinc-800">
                                        {`import { canAccessFeature } from '@/types/auth';\nconst { auth } = usePage().props;\n\n{canAccessFeature(auth, '${snippetFeature.key}') && (\n    <FeatureComponent />\n)}`}
                                    </pre>
                                </div>
                            </div>

                            <DialogFooter>
                                <button
                                    type="button"
                                    onClick={() => setSnippetFeature(null)}
                                    className="rounded-xl bg-brand-rust px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-rust/90"
                                >
                                    Done
                                </button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
