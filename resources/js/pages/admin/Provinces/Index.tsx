import { Head, useForm, router } from '@inertiajs/react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { debounce } from 'lodash';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ConfirmModal from '@/components/common/confirm-modal';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import admin from '@/routes/admin';

interface Area {
    id: number;
    name: string;
}

interface Province {
    id: number;
    name: string;
    area_id: number | null;
    is_active: boolean;
    area?: Area;
}

interface Props {
    provinces: {
        data: Province[];
        current_page: number;
        last_page: number;
        links: any[];
        total: number;
    };
    areas: Area[];
    filters: {
        search?: string;
        area_id?: string;
    };
}

export default function ProvincesIndex({ provinces, areas, filters }: Props) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProvince, setEditingProvince] = useState<Province | null>(null);
    const [provinceToDelete, setProvinceToDelete] = useState<Province | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: '',
        area_id: '' as string | number,
        is_active: true,
    });

    const debouncedSearch = useCallback(
        debounce((query: string) => {
            router.get('/admin/provinces', {
                search: query,
                area_id: filters.area_id,
            }, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300),
        [filters.area_id]
    );

    useEffect(() => {
        if (searchTerm !== filters.search) {
            debouncedSearch(searchTerm);
        }
    }, [searchTerm, debouncedSearch, filters.search]);

    const openCreateDialog = () => {
        clearErrors();
        setEditingProvince(null);
        setData({
            name: '',
            area_id: '',
            is_active: true,
        });
        setIsDialogOpen(true);
    };

    const openEditDialog = (province: Province) => {
        clearErrors();
        setEditingProvince(province);
        setData({
            name: province.name,
            area_id: province.area_id || '',
            is_active: !!province.is_active,
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingProvince) {
            put('/admin/provinces/' + editingProvince.id, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                },
            });
        } else {
            post('/admin/provinces', {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                },
            });
        }
    };

    const confirmDelete = (province: Province) => {
        setProvinceToDelete(province);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = () => {
        if (!provinceToDelete) return;

        router.delete('/admin/provinces/' + provinceToDelete.id, {
            onSuccess: () => {
                setIsDeleteModalOpen(false);
                setProvinceToDelete(null);
                toast.success('Province deleted successfully.');
            },
        });
    };

    const handlePageChange = (url: string | null) => {
        if (!url) return;
        router.get(url, {
            search: searchTerm,
            area_id: filters.area_id,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Provinces', href: '/admin/provinces' }]}>
            <SettingsLayout
                eyebrow="Operations"
                title="Provinces"
                description="Manage the list of all provinces in the system and their assigned destination areas."
                actions={
                    <button
                        onClick={openCreateDialog}
                        className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-black flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                        <Plus className="size-3.5" />
                        Add Province
                    </button>
                }
            >
                <div className="rounded-xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-zinc-100 flex flex-wrap items-center gap-3 bg-zinc-50/50">
                        <div className="relative flex-1 min-w-[240px] max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                            <Input
                                placeholder="Search by province name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 text-xs bg-white"
                            />
                        </div>
                        <select
                            value={filters.area_id || ''}
                            onChange={(e) => {
                                router.get('/admin/provinces', {
                                    search: searchTerm,
                                    area_id: e.target.value || undefined,
                                }, { preserveState: true, preserveScroll: true });
                            }}
                            className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-brand-rust font-medium"
                        >
                            <option value="">All Destination Areas (Assigned & Unassigned)</option>
                            <option value="unassigned">⚠️ Unassigned Provinces Only</option>
                            {areas.map(area => (
                                <option key={area.id} value={area.id}>{area.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="overflow-auto max-h-[600px]">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 font-medium text-zinc-500 text-xs uppercase tracking-wider">Province</th>
                                    <th className="px-6 py-4 font-medium text-zinc-500 text-xs uppercase tracking-wider">Assigned Destination Area</th>
                                    <th className="px-6 py-4 font-medium text-zinc-500 text-xs uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 bg-white">
                                {provinces.data.map((province) => (
                                    <tr key={province.id} className="hover:bg-zinc-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-zinc-900">{province.name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {province.area ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                                    {province.area.name}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-400 text-xs italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-1">
                                            <button
                                                onClick={() => openEditDialog(province)}
                                                className="p-2 text-zinc-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors inline-flex items-center justify-center"
                                                title="Edit Province"
                                            >
                                                <Pencil className="size-4" />
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(province)}
                                                className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center"
                                                title="Delete Province"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {provinces.data.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-zinc-500">
                                            No provinces found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {provinces.last_page > 1 && (
                        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
                            <span className="text-xs text-zinc-500">
                                Showing {((provinces.current_page - 1) * 50) + 1} to {Math.min(provinces.current_page * 50, provinces.total)} of {provinces.total} entries
                            </span>
                            <div className="flex gap-1">
                                {provinces.links.map((link, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handlePageChange(link.url)}
                                        disabled={!link.url || link.active}
                                        className={`px-3 py-1 text-xs rounded-md border ${
                                            link.active
                                                ? 'bg-zinc-900 text-white border-zinc-900'
                                                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                                        } ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white">
                        <div className="p-6 border-b border-zinc-100">
                            <DialogTitle className="text-lg font-semibold text-zinc-900">
                                {editingProvince ? 'Edit Province' : 'Add New Province'}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-zinc-500 mt-1">
                                Fill in the details below to {editingProvince ? 'update the' : 'create a'} province.
                            </DialogDescription>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Province Name *</Label>
                                <Input
                                    id="name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder="e.g. Metro Manila"
                                    autoFocus
                                />
                                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="area_id">Assign to Destination Area</Label>
                                <select
                                    id="area_id"
                                    value={data.area_id}
                                    onChange={(e) => setData('area_id', e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-rust disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">-- Unassigned --</option>
                                    {areas.map(area => (
                                        <option key={area.id} value={area.id}>{area.name}</option>
                                    ))}
                                </select>
                                {errors.area_id && <p className="text-xs text-red-500">{errors.area_id}</p>}
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-100">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={processing} className="bg-zinc-900 text-white hover:bg-black">
                                    Save Province
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <ConfirmModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={handleDelete}
                    title="Delete Province"
                    description={`Are you sure you want to delete ${provinceToDelete?.name}? This action cannot be undone.`}
                    confirmText="Delete Province"
                    variant="destructive"
                />
            </SettingsLayout>
        </AppLayout>
    );
}
