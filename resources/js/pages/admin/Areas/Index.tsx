import { Head, useForm, router } from '@inertiajs/react';
import { Globe, MapPin, Pencil, Plus, Ruler, Trash2, Truck, Package, Search, Check } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import ActiveFilterChips from '@/components/common/active-filter-chips';
import FilterSelect from '@/components/common/filter-select';
import SearchFilter from '@/components/common/search-filter';
import ConfirmModal from '@/components/common/confirm-modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import admin from '@/routes/admin';

interface Province {
    id: number;
    name: string;
    area_id: number | null;
}

interface Area {
    id: number;
    name: string;
    description: string | null;
    door_to_door_fee: number | string | null;
    is_active: boolean;
    provinces?: Province[];
}

interface Props {
    areas: Area[];
    provinces: Province[];
    filters?: {
        search?: string;
        is_active?: string;
    };
    auth?: {
        user?: {
            role?: string;
        };
    };
}

const LUZON_PROVINCES = [
    'Abra', 'Apayao', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province', 'Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan',
    'Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales', 'Aurora',
    'Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal', 'Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon',
    'Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon', 'Metro Manila'
];

const VISAYAS_PROVINCES = [
    'Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo', 'Negros Occidental', 'Bohol', 'Cebu', 'Negros Oriental', 'Siquijor',
    'Biliran', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar', 'Southern Leyte'
];

const MINDANAO_PROVINCES = [
    'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay', 'Bukidnon', 'Camiguin', 'Lanao del Norte', 'Misamis Occidental', 'Misamis Oriental',
    'Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental', 'Cotabato', 'Sarangani', 'South Cotabato', 'Sultan Kudarat',
    'Agusan del Norte', 'Agusan del Sur', 'Dinagat Islands', 'Surigao del Norte', 'Surigao del Sur', 'Basilan', 'Lanao del Sur', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Sulu', 'Tawi-Tawi'
];

export default function AreasIndex({ areas, provinces, filters = {}, auth }: Props) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingArea, setEditingArea] = useState<Area | null>(null);
    const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Modal tabs and search/filter states
    const [modalTab, setModalTab] = useState<'details' | 'provinces'>('details');
    const [provinceSearch, setProvinceSearch] = useState('');
    const [regionFilter, setRegionFilter] = useState<'all' | 'luzon' | 'visayas' | 'mindanao'>('all');

    // Add Province modal state
    const [isAddProvinceDialogOpen, setIsAddProvinceDialogOpen] = useState(false);
    const [newProvinceName, setNewProvinceName] = useState('');
    const [isSubmittingProvince, setIsSubmittingProvince] = useState(false);
    const [provinceError, setProvinceError] = useState('');

    const listingRoute = admin.areas.index().url;
    const isSuperAdmin = auth?.user?.role === 'super_admin';

    const breadcrumbs = [
        { title: 'Settings', href: listingRoute },
        { title: 'Destination Areas', href: listingRoute },
    ];

    const { data, setData, post, put, processing, reset, errors } = useForm({
        name: '',
        description: '',
        door_to_door_fee: '' as string | number,
        is_active: true,
        province_ids: [] as number[],
    });

    const openCreateDialog = () => {
        setEditingArea(null);
        setModalTab('details');
        setProvinceSearch('');
        setRegionFilter('all');
        reset();
        setIsDialogOpen(true);
    };

    const openEditDialog = (area: Area) => {
        setEditingArea(area);
        setModalTab('details');
        setProvinceSearch('');
        setRegionFilter('all');
        setData({
            name: area.name,
            description: area.description || '',
            door_to_door_fee: area.door_to_door_fee ?? '',
            is_active: !!area.is_active,
            province_ids: area.provinces ? area.provinces.map(p => p.id) : [],
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingArea) {
            put(admin.areas.update(editingArea.id).url, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                },
            });
        } else {
            post(admin.areas.store().url, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                },
            });
        }
    };

    const handleCreateProvince = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newProvinceName.trim();
        if (!trimmed) return;

        setIsSubmittingProvince(true);
        setProvinceError('');

        router.post('/admin/provinces', {
            name: trimmed,
            area_id: editingArea ? editingArea.id : null,
        }, {
            onSuccess: (page) => {
                setIsSubmittingProvince(false);
                setIsAddProvinceDialogOpen(false);
                toast.success(`Province '${trimmed}' added successfully!`);

                const updatedProvinces = (page.props as any).provinces as Province[] | undefined;
                const created = updatedProvinces?.find(
                    (p: Province) => p.name.toLowerCase() === trimmed.toLowerCase()
                );
                if (created && !data.province_ids.includes(created.id)) {
                    setData('province_ids', [...data.province_ids, created.id]);
                }
                setNewProvinceName('');
            },
            onError: (errs) => {
                setIsSubmittingProvince(false);
                if (errs.name) {
                    setProvinceError(errs.name);
                } else {
                    toast.error('Failed to create province.');
                }
            }
        });
    };

    const filteredProvinces = useMemo(() => {
        return provinces.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(provinceSearch.toLowerCase().trim());
            if (!matchesSearch) return false;

            if (regionFilter === 'luzon') return LUZON_PROVINCES.includes(p.name);
            if (regionFilter === 'visayas') return VISAYAS_PROVINCES.includes(p.name);
            if (regionFilter === 'mindanao') return MINDANAO_PROVINCES.includes(p.name);
            return true;
        });
    }, [provinces, provinceSearch, regionFilter]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <SettingsLayout
                eyebrow="Operations"
                title="Destination Areas & Rates"
                description="Manage destination areas, covered provinces, CBM rates, and door-to-door fees."
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsAddProvinceDialogOpen(true)}
                            className="h-9 px-3.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                            <Plus className="size-3.5 text-zinc-500" /> Add Province
                        </button>
                        <button
                            onClick={openCreateDialog}
                            className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-black flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                            <Plus className="size-3.5" /> Add Destination Area
                        </button>
                    </div>
                }
            >
                <Head title="Destination Areas | Admin" />

                <div className="space-y-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-1 flex-wrap items-center gap-2">
                                <SearchFilter
                                    routeName={listingRoute}
                                    queryParams={filters}
                                    placeholder="Search area name or notes..."
                                    ariaLabel="Search delivery areas"
                                />
                                <FilterSelect
                                    label="Status"
                                    routeName={listingRoute}
                                    paramName="is_active"
                                    queryParams={filters}
                                    placeholder="All Status"
                                    ariaLabel="Filter areas by active state"
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

                    <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-100 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                                        <th className="px-4 py-3 font-semibold">Area Name</th>
                                        <th className="px-4 py-3 font-semibold">Description</th>
                                        <th className="px-4 py-3 font-semibold text-center">Door-to-Door Fee</th>
                                        <th className="px-4 py-3 font-semibold text-center">Status</th>
                                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 text-xs font-normal">
                                    {areas.length > 0 ? (
                                        areas.map((area) => (
                                            <tr key={area.id} className="hover:bg-zinc-50/60 transition-colors">
                                                <td className="px-4 py-3.5 font-semibold text-zinc-900">
                                                    <div className="flex items-center gap-2.5">
                                                        <MapPin className="size-4 text-brand-rust shrink-0" />
                                                        <span>{area.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-zinc-500 max-w-xs truncate">
                                                    {area.description || '—'}
                                                </td>

                                                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                    {area.door_to_door_fee && Number(area.door_to_door_fee) > 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                                                            +${Number(area.door_to_door_fee).toFixed(2)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-400 italic">Free / None</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                    {area.is_active ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button
                                                            onClick={() => openEditDialog(area)}
                                                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                                                            title="Edit Area"
                                                        >
                                                            <Pencil className="size-3.5" />
                                                        </button>
                                                        {isSuperAdmin && (
                                                            <button
                                                                onClick={() => {
                                                                    setAreaToDelete(area);
                                                                    setIsDeleteModalOpen(true);
                                                                }}
                                                                className="p-1 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                                title="Delete Area"
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-xs text-zinc-400 italic">
                                                No destination areas configured.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Add / Edit Area Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-3xl h-[80vh] max-h-[650px] border-zinc-200 rounded-xl p-0 overflow-hidden bg-white shadow-xl flex flex-col">
                        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                            {/* Modal Header */}
                            <div className="bg-zinc-50/80 px-6 py-4 border-b border-zinc-200/80 flex-none">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <DialogTitle className="text-base font-semibold text-zinc-900">
                                            {editingArea ? `Edit Destination Area: ${editingArea.name}` : 'Add New Destination Area'}
                                        </DialogTitle>
                                        <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                                            Configure destination area details, covered provinces, and box pricing.
                                        </DialogDescription>
                                    </div>
                                </div>

                                {/* Modal Nav Tabs */}
                                <div className="flex items-center gap-1 border-b border-zinc-200/80 -mb-4 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setModalTab('details')}
                                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2 ${
                                            modalTab === 'details'
                                                ? 'border-zinc-900 text-zinc-900 font-semibold'
                                                : 'border-transparent text-zinc-500 hover:text-zinc-800'
                                        }`}
                                    >
                                        <MapPin className="size-3.5" />
                                        1. Details
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setModalTab('provinces')}
                                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2 ${
                                            modalTab === 'provinces'
                                                ? 'border-zinc-900 text-zinc-900 font-semibold'
                                                : 'border-transparent text-zinc-500 hover:text-zinc-800'
                                        }`}
                                    >
                                        <Globe className="size-3.5" />
                                        2. Covered Provinces ({data.province_ids.length})
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content Body */}
                            <div className="flex-1 overflow-y-auto p-5">
                                {modalTab === 'details' && (
                                    <div className="space-y-4 max-w-xl mx-auto">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-semibold text-zinc-700">Area Name *</Label>
                                            <Input
                                                value={data.name}
                                                onChange={(e) => setData('name', e.target.value)}
                                                placeholder="e.g. Metro Manila"
                                                className="h-9 rounded-lg border-zinc-200 text-xs font-medium"
                                                required
                                            />
                                            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-xs font-semibold text-zinc-700">Description</Label>
                                            <Input
                                                value={data.description}
                                                onChange={(e) => setData('description', e.target.value)}
                                                placeholder="Coverage notes..."
                                                className="h-9 rounded-lg border-zinc-200 text-xs font-medium"
                                            />
                                        </div>

                                        <div className="pt-1">
                                            <div className="space-y-1 p-3 rounded-lg border border-zinc-200/80 bg-zinc-50/50">
                                                <Label className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                                                    <Truck className="size-3.5 text-amber-600" />
                                                    Door-to-Door Fee ($)
                                                </Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={data.door_to_door_fee}
                                                    onChange={(e) => setData('door_to_door_fee', e.target.value)}
                                                    placeholder="300.00"
                                                    className="h-9 rounded-lg border-zinc-200 bg-white text-xs font-medium"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <Checkbox
                                                id="is_active"
                                                checked={data.is_active}
                                                onCheckedChange={(checked) => setData('is_active', !!checked)}
                                                className="size-4 rounded border-zinc-300"
                                            />
                                            <label htmlFor="is_active" className="text-xs font-medium text-zinc-700 cursor-pointer">
                                                Active Destination Area
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {modalTab === 'provinces' && (
                                    <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                                            <div className="relative flex-1 w-full">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                                                <input
                                                    type="text"
                                                    value={provinceSearch}
                                                    onChange={(e) => setProvinceSearch(e.target.value)}
                                                    placeholder="Search province..."
                                                    className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-zinc-200 bg-white"
                                                />
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {(['all', 'luzon', 'visayas', 'mindanao'] as const).map((r) => (
                                                    <button
                                                        key={r}
                                                        type="button"
                                                        onClick={() => setRegionFilter(r)}
                                                        className={`px-2.5 py-1 rounded text-xs font-medium capitalize ${
                                                            regionFilter === r
                                                                ? 'bg-zinc-900 text-white'
                                                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                                        }`}
                                                    >
                                                        {r}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {filteredProvinces.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {filteredProvinces.map((province) => {
                                                    const isAssignedElsewhere = !!(province.area_id && province.area_id !== editingArea?.id);
                                                    const isChecked = data.province_ids.includes(province.id);

                                                    return (
                                                        <div
                                                            key={province.id}
                                                            onClick={() => {
                                                                if (isAssignedElsewhere) return;
                                                                const updated = isChecked
                                                                    ? data.province_ids.filter(id => id !== province.id)
                                                                    : [...data.province_ids, province.id];
                                                                setData('province_ids', updated);
                                                            }}
                                                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between select-none transition-all ${
                                                                isAssignedElsewhere
                                                                    ? 'bg-zinc-50 border-zinc-200 opacity-50 cursor-not-allowed'
                                                                    : isChecked
                                                                    ? 'bg-zinc-900/5 border-zinc-900 text-zinc-900 font-semibold cursor-pointer'
                                                                    : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-800 cursor-pointer'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className={`size-4 rounded flex items-center justify-center border transition-colors ${
                                                                        isChecked
                                                                            ? 'bg-zinc-900 border-zinc-900 text-white'
                                                                            : 'border-zinc-300 bg-white'
                                                                    }`}
                                                                >
                                                                    {isChecked && <Check className="size-3 stroke-[3]" />}
                                                                </div>
                                                                <span>{province.name}</span>
                                                            </div>
                                                            {isChecked && (
                                                                <Check className="size-3.5 text-zinc-900" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-center text-xs text-zinc-400 py-6 italic">No matching provinces found.</p>
                                        )}
                                    </div>
                                )}

                                </div>

                            {/* Modal Footer */}
                            <div className="bg-zinc-50 px-6 py-3 border-t border-zinc-200/80 flex items-center justify-end gap-2 flex-none">
                                <button
                                    type="button"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="px-3 h-8 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                                >
                                    Cancel
                                </button>
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="px-4 h-8 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-black"
                                >
                                    {editingArea ? 'Save Changes' : 'Create Area'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Add Province Dialog */}
                <Dialog open={isAddProvinceDialogOpen} onOpenChange={setIsAddProvinceDialogOpen}>
                    <DialogContent className="sm:max-w-md rounded-xl p-5 bg-white">
                        <form onSubmit={handleCreateProvince} className="space-y-4">
                            <div>
                                <DialogTitle className="text-base font-semibold text-zinc-900">Add New Province</DialogTitle>
                                <DialogDescription className="text-xs text-zinc-500 mt-0.5">Create a new Philippine province in the system.</DialogDescription>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-zinc-700">Province Name *</Label>
                                <Input
                                    value={newProvinceName}
                                    onChange={(e) => setNewProvinceName(e.target.value)}
                                    placeholder="e.g. Sorsogon"
                                    className="h-9 rounded-lg border-zinc-200 text-xs font-medium"
                                    required
                                />
                                {provinceError && <p className="text-xs text-red-500">{provinceError}</p>}
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddProvinceDialogOpen(false)}
                                    className="px-3 h-8 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                                >
                                    Cancel
                                </button>
                                <Button
                                    type="submit"
                                    disabled={isSubmittingProvince}
                                    className="px-4 h-8 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-black"
                                >
                                    {isSubmittingProvince ? 'Adding...' : 'Add Province'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
                
                {/* Delete Area Confirm Modal */}
                <ConfirmModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    title="Delete Destination Area"
                    description={areaToDelete ? `Are you sure you want to delete the "${areaToDelete.name}" destination area? This will also remove any assigned box prices, milestones, and unassign its provinces. This action cannot be undone.` : ''}
                    confirmText="Delete Destination Area"
                    variant="destructive"
                    onConfirm={() => {
                        if (areaToDelete) {
                            router.delete(admin.areas.destroy(areaToDelete.id).url, {
                                onSuccess: () => {
                                    setIsDeleteModalOpen(false);
                                    setAreaToDelete(null);
                                    toast.success('Delivery area deleted successfully.');
                                }
                            });
                        }
                    }}
                />
            </SettingsLayout>
        </AppLayout>
    );
}
