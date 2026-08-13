import { Head, router, useForm } from '@inertiajs/react';
import { Package, Pencil, Plus, Ruler, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import ActiveFilterChips from '@/components/common/active-filter-chips';
import ClearFiltersButton from '@/components/common/clear-filters-button';
import ConfirmModal from '@/components/common/confirm-modal';
import FilterSelect from '@/components/common/filter-select';
import SearchFilter from '@/components/common/search-filter';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import admin from '@/routes/admin';

interface BoxType {
    id: number;
    name: string;
    description: string | null;
    dimensions: string | null;
    is_active: boolean;
}

interface Props {
    boxTypes: BoxType[];
    filters?: {
        search?: string;
        is_active?: string;
    };
}

export default function BoxTypesIndex({ boxTypes, filters = {} }: Props) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingBoxType, setEditingBoxType] = useState<BoxType | null>(null);
    const [boxTypeToDelete, setBoxTypeToDelete] = useState<BoxType | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const listingRoute = admin.boxTypes.index().url;

    const breadcrumbs = [
        { title: 'Settings', href: listingRoute },
        { title: 'Asset Configuration', href: listingRoute },
    ];

    const { data, setData, post, put, processing, reset, errors } = useForm({
        name: '',
        description: '',
        dimensions: '',
        is_active: true,
    });

    const openCreateDialog = () => {
        setEditingBoxType(null);
        reset();
        setIsDialogOpen(true);
    };

    const openEditDialog = (boxType: BoxType) => {
        setEditingBoxType(boxType);
        setData({
            name: boxType.name,
            description: boxType.description || '',
            dimensions: boxType.dimensions || '',
            is_active: !!boxType.is_active,
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingBoxType) {
            put(admin.boxTypes.update(editingBoxType.id).url, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    toast.success(`Box type '${data.name}' updated successfully!`);
                    reset();
                },
                onError: () => toast.error('Failed to update box type.'),
            });
        } else {
            post(admin.boxTypes.store().url, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    toast.success(`Box type '${data.name}' created successfully!`);
                    reset();
                },
                onError: () => toast.error('Failed to create box type.'),
            });
        }
    };

    const confirmDelete = (boxType: BoxType) => {
        setBoxTypeToDelete(boxType);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = () => {
        if (!boxTypeToDelete) return;

        router.delete(admin.boxTypes.destroy(boxTypeToDelete.id).url, {
            onSuccess: () => {
                setIsDeleteModalOpen(false);
                setBoxTypeToDelete(null);
                toast.success('Box Type soft-deleted successfully!');
            },
            onError: () => toast.error('Failed to delete box type.'),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <SettingsLayout
                eyebrow="Operations"
                title="Box Type Catalog"
                description="Set standard box sizes and dimensional specifications."
                actions={
                    <button
                        onClick={openCreateDialog}
                        className="h-9 px-4 rounded-lg bg-brand-rust text-white text-xs font-medium hover:bg-brand-rust/90 flex items-center gap-2"
                    >
                        <Plus className="size-3.5" /> Add Box Type
                    </button>
                }
            >
                <Head title="Box Sizes | Admin" />

                <div className="space-y-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-1 flex-wrap items-center gap-2">
                                <SearchFilter
                                    routeName={listingRoute}
                                    queryParams={filters}
                                    placeholder="Search box name or dimensions..."
                                    ariaLabel="Search box types"
                                />
                                <FilterSelect
                                    label="Status"
                                    routeName={listingRoute}
                                    paramName="is_active"
                                    queryParams={filters}
                                    placeholder="All Status"
                                    ariaLabel="Filter box types by active state"
                                    options={[
                                        { label: 'Active', value: 'active' },
                                        { label: 'Inactive', value: 'inactive' },
                                    ]}
                                />
                            </div>
                        </div>
                        <ActiveFilterChips
                            routeName={listingRoute}
                            queryParams={filters}
                            labels={{ search: 'Search', is_active: 'Status' }}
                        />
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                                        <th className="px-4 py-3">Box Type</th>
                                        <th className="px-4 py-3">Dimensions (W x H x L)</th>
                                        <th className="px-4 py-3">Notes</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200/80 text-xs">
                                    {boxTypes.length > 0 ? (
                                        boxTypes.map((boxType) => (
                                            <tr key={boxType.id} className="hover:bg-zinc-50/50 transition-colors">
                                                <td className="px-4 py-3 font-semibold text-zinc-900">
                                                    <div className="flex items-center gap-2">
                                                        <Package className="size-4 text-brand-rust" />
                                                        <span>{boxType.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-zinc-600 font-mono">
                                                    {boxType.dimensions || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">
                                                    {boxType.description || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {boxType.is_active ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right space-x-1">
                                                    <button
                                                        onClick={() => openEditDialog(boxType)}
                                                        className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors inline-flex items-center justify-center"
                                                        title="Edit Box Type"
                                                    >
                                                        <Pencil className="size-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => confirmDelete(boxType)}
                                                        className="p-1.5 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors inline-flex items-center justify-center"
                                                        title="Delete Box Type"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-xs text-zinc-400 italic">
                                                No box types configured.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-md rounded-xl p-5 bg-white">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <h3 className="text-base font-semibold text-zinc-900">
                                    {editingBoxType ? `Edit Box Type` : 'Add Box Type'}
                                </h3>
                                <p className="text-xs text-zinc-500">
                                    Configure dimensions and active status.
                                </p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-zinc-700">Box Name *</Label>
                                    <Input
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="e.g. Jumbo Box"
                                        className="h-9 rounded-lg border-zinc-200 text-xs"
                                        required
                                    />
                                    {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-zinc-700">Dimensions (W x H x L in cm)</Label>
                                    <Input
                                        value={data.dimensions}
                                        onChange={(e) => setData('dimensions', e.target.value)}
                                        placeholder="e.g. 70 x 70 x 70 cm"
                                        className="h-9 rounded-lg border-zinc-200 text-xs font-mono"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-zinc-700">Description</Label>
                                    <Input
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                        placeholder="Notes..."
                                        className="h-9 rounded-lg border-zinc-200 text-xs"
                                    />
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <Checkbox
                                        id="is_active_box"
                                        checked={data.is_active}
                                        onCheckedChange={(checked) => setData('is_active', !!checked)}
                                        className="size-4 rounded border-zinc-300"
                                    />
                                    <label htmlFor="is_active_box" className="text-xs font-medium text-zinc-700 cursor-pointer">
                                        Active Box Type
                                    </label>
                                </div>
                            </div>

                            <div className="pt-3 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="px-3 h-8 rounded-lg border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50"
                                >
                                    Cancel
                                </button>
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="px-4 h-8 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-black"
                                >
                                    {editingBoxType ? 'Save Changes' : 'Create'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <ConfirmModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={handleDelete}
                    title="Delete Box Type"
                    description={`Are you sure you want to delete "${boxTypeToDelete?.name}"? It will be soft-deleted so historical bookings remain intact, but it won't appear for new bookings or rate tables.`}
                    confirmText="Delete Box Type"
                    variant="destructive"
                />
            </SettingsLayout>
        </AppLayout>
    );
}
